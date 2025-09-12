const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const EventEmitter = require('events');
const { app } = require('electron');

class PythonBridge extends EventEmitter {
  constructor() {
    super();
    this.tempDir = path.join(__dirname, '../../../temp');
    this.currentProcess = null;
    
    // Determine if we're in development or production
    const isDev = !app.isPackaged;
    
    if (isDev) {
      // Development: use Python interpreter and source files
      this.pythonPath = 'python';
      this.scriptPath = path.join(__dirname, '../../python/ai_pipeline.py');
      this.useBundled = false;
    } else {
      // Production: use bundled executable
      this.bundledExecutablePath = this.getBundledExecutablePath();
      this.useBundled = true;
    }
  }
  
  getBundledExecutablePath() {
    // In production, bundled executables are in resources/python/
    const resourcesPath = process.resourcesPath || path.join(process.cwd(), 'resources');
    const pythonDir = path.join(resourcesPath, 'python');
    
    // Platform-specific executable names
    const isWindows = process.platform === 'win32';
    const executableName = isWindows ? 'ai_pipeline.exe' : 'ai_pipeline';
    
    return path.join(pythonDir, 'ai_pipeline', executableName);
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  async checkPythonDependencies() {
    return new Promise((resolve) => {
      const checkProcess = spawn(this.pythonPath, ['-c', 'import whisper, openai, moviepy; print("Dependencies OK")']);
      
      let output = '';
      let errorOutput = '';

      checkProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      checkProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      checkProcess.on('close', (code) => {
        if (code === 0 && output.includes('Dependencies OK')) {
          resolve({ success: true });
        } else {
          resolve({ 
            success: false, 
            error: `Python dependencies missing. Error: ${errorOutput}` 
          });
        }
      });

      checkProcess.on('error', (error) => {
        resolve({ 
          success: false, 
          error: `Python not found or not executable: ${error.message}` 
        });
      });
    });
  }

  async processVideo(videoPath, options = {}) {
    await this.ensureTempDir();

    const {
      outputDir = path.join(this.tempDir, 'output'),
      openaiKey = null,
      maxClips = 5
    } = options;

    return new Promise((resolve, reject) => {
      const args = [
        this.scriptPath,
        videoPath,
        '--output-dir', outputDir,
        '--max-clips', maxClips.toString(),
        '--temp-dir', this.tempDir
      ];

      if (openaiKey) {
        args.push('--openai-key', openaiKey);
      }

      console.log('Starting Python AI pipeline:', args);

      this.currentProcess = spawn(this.pythonPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';

      this.currentProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // Parse progress updates
        const progressMatch = output.match(/\[(\d+\.\d+)%\] (.+)/);
        if (progressMatch) {
          const progress = parseFloat(progressMatch[1]);
          const step = progressMatch[2];
          this.emit('progress', { progress, step });
        }

        // Emit raw output for debugging
        this.emit('stdout', output);
      });

      this.currentProcess.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        this.emit('stderr', error);
        
        // Check for specific error types
        if (error.includes('ModuleNotFoundError')) {
          this.emit('error', { type: 'missing_dependency', message: error });
        }
      });

      this.currentProcess.on('close', async (code) => {
        this.currentProcess = null;

        if (code === 0) {
          try {
            // Try to read results file
            const videoName = path.basename(videoPath, path.extname(videoPath));
            const resultsPath = path.join(outputDir, `${videoName}_results.json`);
            
            const resultsData = await fs.readFile(resultsPath, 'utf-8');
            const results = JSON.parse(resultsData);
            
            resolve(results);
          } catch (error) {
            resolve({
              success: false,
              error: `Failed to read results: ${error.message}`,
              stdout,
              stderr
            });
          }
        } else {
          reject({
            success: false,
            error: `Python process exited with code ${code}`,
            stdout,
            stderr
          });
        }
      });

      this.currentProcess.on('error', (error) => {
        this.currentProcess = null;
        reject({
          success: false,
          error: `Failed to start Python process: ${error.message}`,
          stdout,
          stderr
        });
      });
    });
  }

  cancelProcessing() {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
      this.emit('cancelled');
      return true;
    }
    return false;
  }

  async getVideoInfo(videoPath) {
    const scriptPath = path.join(__dirname, '../../python/editing/video_processor.py');
    
    return new Promise((resolve, reject) => {
      const process = spawn(this.pythonPath, [
        scriptPath,
        videoPath,
        '--command', 'info'
      ]);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(stdout);
            resolve(info);
          } catch (error) {
            reject({ error: 'Failed to parse video info', stderr });
          }
        } else {
          reject({ error: `Process exited with code ${code}`, stderr });
        }
      });

      process.on('error', (error) => {
        reject({ error: `Failed to get video info: ${error.message}` });
      });
    });
  }

  async extractAudio(videoPath, outputPath = null) {
    const scriptPath = path.join(__dirname, '../../python/editing/video_processor.py');
    
    return new Promise((resolve, reject) => {
      const args = [
        scriptPath,
        videoPath,
        '--command', 'extract_audio'
      ];

      if (outputPath) {
        args.push('--output', outputPath);
      }

      const process = spawn(this.pythonPath, args);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          // Extract audio file path from output
          const audioPathMatch = stdout.match(/Audio extracted to: (.+)/);
          if (audioPathMatch) {
            resolve({ audioPath: audioPathMatch[1].trim() });
          } else {
            resolve({ audioPath: outputPath });
          }
        } else {
          reject({ error: `Audio extraction failed with code ${code}`, stderr });
        }
      });

      process.on('error', (error) => {
        reject({ error: `Failed to extract audio: ${error.message}` });
      });
    });
  }
}

module.exports = { PythonBridge };
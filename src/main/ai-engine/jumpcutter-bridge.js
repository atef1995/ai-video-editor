const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const EventEmitter = require('events');
const { app } = require('electron');

class JumpcutterBridge extends EventEmitter {
  constructor() {
    super();
    this.tempDir = path.join(__dirname, '../../../temp');
    this.currentProcess = null;

    // Determine if we're in development or production
    const isDev = !app.isPackaged;

    if (isDev) {
      // Development: use Python interpreter and source files
      this.pythonPath = 'python';
      this.scriptPath = path.join(__dirname, '../../python/cut-quiet-parts/jumpcutter.py');
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
    const executableName = isWindows ? 'jumpcutter.exe' : 'jumpcutter';

    return path.join(pythonDir, 'jumpcutter', executableName);
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }


  async checkDependencies() {
    return new Promise(async (resolve) => {
      if (this.useBundled) {
        // For bundled executables, check if the executable exists
        try {
          const stats = await fs.stat(this.bundledExecutablePath);
          if (stats.isFile()) {
            resolve({ success: true, message: 'Bundled executable is ready' });
          } else {
            resolve({
              success: false,
              error: 'Bundled executable not found. Please reinstall the application.'
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: `Bundled executable not accessible: ${error.message}. Please reinstall the application.`
          });
        }
        return;
      }

      // Development mode: check Python dependencies
      const checkScript = `
import sys
missing_modules = []

try:
    import numpy
    print("✓ numpy found")
except ImportError:
    missing_modules.append("numpy")
    print("✗ numpy missing")

try:
    import scipy
    print("✓ scipy found")
except ImportError:
    missing_modules.append("scipy")
    print("✗ scipy missing")

try:
    import PIL
    print("✓ Pillow (PIL) found")
except ImportError:
    missing_modules.append("Pillow")
    print("✗ Pillow (PIL) missing")

try:
    import audiotsm
    print("✓ audiotsm found")
except ImportError:
    missing_modules.append("audiotsm")
    print("✗ audiotsm missing")

try:
    import pytube
    print("✓ pytube found")
except ImportError:
    missing_modules.append("pytube")
    print("✗ pytube missing")

if missing_modules:
    print(f"MISSING_MODULES: {','.join(missing_modules)}")
    sys.exit(1)
else:
    print("ALL_DEPENDENCIES_OK")
    sys.exit(0)
`;

      const checkProcess = spawn(this.pythonPath, ['-c', checkScript]);

      let output = '';
      let errorOutput = '';

      checkProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      checkProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      checkProcess.on('close', (code) => {
        if (code === 0 && output.includes('ALL_DEPENDENCIES_OK')) {
          resolve({ success: true, message: 'All dependencies are installed' });
        } else {
          const missingMatch = output.match(/MISSING_MODULES: (.+)/);
          const missingModules = missingMatch ? missingMatch[1].split(',') : [];

          let errorMessage = 'Missing Python dependencies for jumpcutter functionality:\\n\\n';

          if (missingModules.length > 0) {
            errorMessage += `Missing modules: ${missingModules.join(', ')}\\n\\n`;
            errorMessage += 'To install missing dependencies, run:\\n';
            errorMessage += `pip install ${missingModules.join(' ')}\\n\\n`;
            errorMessage += 'Or install all dependencies with:\\n';
            errorMessage += 'pip install -r src/python/cut-quiet-parts/requirements.txt';
          } else {
            errorMessage += `Error details: ${errorOutput || output}`;
          }

          resolve({
            success: false,
            error: errorMessage,
            missingModules: missingModules
          });
        }
      });

      checkProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Python not found or not executable: ${error.message}\\n\\nPlease ensure Python is installed and in your PATH.`
        });
      });
    });
  }

  async processVideo(videoPath, options = {}) {
    await this.ensureTempDir();

    const {
      outputDir = path.join(this.tempDir, 'jumpcutter-output'),
      silentThreshold = 0.03,
      soundedSpeed = 1.0,
      silentSpeed = 5.0,
      frameMargin = 1,
      sampleRate = 44100,
      frameRate = 30,
      frameQuality = 3
    } = options;

    // Ensure output directory exists
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const outputFileName = path.basename(videoPath, path.extname(videoPath)) + '_QUIET_PARTS_REMOVED' + path.extname(videoPath);
    const outputPath = path.join(outputDir, outputFileName);

    return new Promise((resolve, reject) => {
      let command, args;

      if (this.useBundled) {
        // Use bundled executable
        command = this.bundledExecutablePath;
        args = [
          '--input_file', videoPath,
          '--output_file', outputPath,
          '--silent_threshold', silentThreshold.toString(),
          '--sounded_speed', soundedSpeed.toString(),
          '--silent_speed', silentSpeed.toString(),
          '--frame_margin', frameMargin.toString(),
          '--sample_rate', sampleRate.toString(),
          '--frame_rate', frameRate.toString(),
          '--frame_quality', frameQuality.toString()
        ];
      } else {
        // Use Python interpreter with script
        command = this.pythonPath;
        args = [
          this.scriptPath,
          '--input_file', videoPath,
          '--output_file', outputPath,
          '--silent_threshold', silentThreshold.toString(),
          '--sounded_speed', soundedSpeed.toString(),
          '--silent_speed', silentSpeed.toString(),
          '--frame_margin', frameMargin.toString(),
          '--sample_rate', sampleRate.toString(),
          '--frame_rate', frameRate.toString(),
          '--frame_quality', frameQuality.toString()
        ];
      }

      console.log('Starting jumpcutter process:', { command, args });

      this.currentProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
        cwd: this.useBundled ? path.dirname(this.bundledExecutablePath) : path.dirname(this.scriptPath)
      });

      let stdout = '';
      let stderr = '';
      let lastProgress = 0;

      this.currentProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;

        console.log('[JUMPCUTTER STDOUT]:', output);

        // Parse progress from jumpcutter output
        // Look for "X time-altered frames saved." messages
        const progressMatch = output.match(/(\d+) time-altered frames saved\./);
        if (progressMatch) {
          const frames = parseInt(progressMatch[1]);
          // Estimate progress (this is rough since we don't know total frames upfront)
          const progress = Math.min(90, Math.floor(frames / 100) * 10);
          if (progress > lastProgress) {
            lastProgress = progress;
            this.emit('progress', { progress, step: `Processing frames: ${frames} completed` });
          }
        }

        // Look for ffmpeg progress indicators
        if (output.includes('frame=')) {
          this.emit('progress', { progress: 95, step: 'Finalizing video output' });
        }

        // Look for any output that indicates progress
        if (output.trim()) {
          this.emit('progress', { progress: Math.min(lastProgress + 5, 85), step: 'Processing video...' });
        }

        this.emit('stdout', output);
      });

      this.currentProcess.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;

        console.log('[JUMPCUTTER STDERR]:', error);

        // Check for specific error types
        if (error.includes('ModuleNotFoundError')) {
          this.emit('error', { type: 'missing_dependency', message: error });
        } else if (error.includes('FileNotFoundError')) {
          this.emit('error', { type: 'file_not_found', message: error });
        } else if (error.includes('ERROR') || error.includes('FAILED')) {
          this.emit('error', { type: 'processing_error', message: error });
        }

        this.emit('stderr', error);
      });

      // Add timeout for the process (5 minutes)
      const timeout = setTimeout(() => {
        if (this.currentProcess) {
          console.log('[JUMPCUTTER] Process timeout - killing process');
          this.currentProcess.kill('SIGTERM');
          this.currentProcess = null;
          reject({
            success: false,
            error: 'Process timed out after 5 minutes',
            stdout,
            stderr
          });
        }
      }, 5 * 60 * 1000); // 5 minutes

      this.currentProcess.on('close', async (code) => {
        clearTimeout(timeout);
        this.currentProcess = null;

        console.log(`[JUMPCUTTER] Process exited with code: ${code}`);
        console.log(`[JUMPCUTTER] STDOUT length: ${stdout.length}`);
        console.log(`[JUMPCUTTER] STDERR length: ${stderr.length}`);

        if (code === 0) {
          try {
            // Check if output file exists
            const stats = await fs.stat(outputPath);

            this.emit('progress', { progress: 100, step: 'Processing completed' });

            resolve({
              success: true,
              outputPath: outputPath,
              originalPath: videoPath,
              fileSize: stats.size,
              settings: {
                silentThreshold,
                soundedSpeed,
                silentSpeed,
                frameMargin,
                sampleRate,
                frameRate,
                frameQuality
              },
              processedAt: new Date().toISOString()
            });
          } catch (error) {
            resolve({
              success: false,
              error: `Output file not found: ${error.message}`,
              stdout,
              stderr
            });
          }
        } else {
          reject({
            success: false,
            error: `Jumpcutter process exited with code ${code}`,
            stdout,
            stderr
          });
        }
      });

      this.currentProcess.on('error', (error) => {
        this.currentProcess = null;
        reject({
          success: false,
          error: `Failed to start jumpcutter process: ${error.message}`,
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

  async getVideoAnalysis(videoPath) {
    // This could be expanded to provide preview analysis of quiet parts
    // For now, just return basic info
    return {
      success: true,
      analysis: 'Video ready for quiet parts removal processing'
    };
  }
}

module.exports = { JumpcutterBridge };
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const EventEmitter = require('events');
const { app } = require('electron');

/**
 * JumpcutterBridge - Interface for quiet parts removal (jumpcutter) functionality
 * 
 * This bridge manages the Python-based jumpcutter process that automatically removes
 * silent or quiet sections from videos. It provides:
 * 
 * - Dependency checking for required Python libraries
 * - Video processing with configurable silence detection
 * - Real-time progress tracking with detailed phase information
 * - Error handling and process management
 * - Cross-platform support (development and production)
 * 
 * The jumpcutter algorithm works by:
 * 1. Extracting video frames and audio track
 * 2. Analyzing audio volume levels to detect silence
 * 3. Time-stretching quiet sections (speed up or remove)
 * 4. Preserving normal speech at original speed
 * 5. Reassembling video with synchronized audio
 * 
 * @extends EventEmitter
 * @fires JumpcutterBridge#progress - Processing progress updates
 * @fires JumpcutterBridge#error - Error events during processing
 * @fires JumpcutterBridge#stdout - Raw stdout from Python process
 * @fires JumpcutterBridge#stderr - Raw stderr from Python process
 * @fires JumpcutterBridge#cancelled - Process cancellation confirmation
 */
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


  /**
   * Checks if required Python dependencies are installed and accessible
   * 
   * In development mode, verifies Python interpreter and required packages:
   * - numpy: Numerical computing
   * - scipy: Scientific computing (audio file I/O)
   * - PIL (Pillow): Image processing
   * - audiotsm: Time-scale modification for audio
   * - pytube: YouTube video downloading (optional)
   * 
   * In production mode, checks for bundled executable availability.
   * 
   * @returns {Promise<Object>} Dependency check result
   * @returns {boolean} returns.success - Whether all dependencies are available
   * @returns {string} returns.message - Success message or error description
   * @returns {string} returns.error - Detailed error message if failed
   * @returns {string[]} returns.missingModules - List of missing Python modules
   * 
   * @example
   * const result = await bridge.checkDependencies();
   * if (!result.success) {
   *   console.error('Missing dependencies:', result.missingModules);
   *   console.log('Install command:', result.error);
   * }
   */
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

  /**
   * Processes a video to remove quiet parts using the jumpcutter algorithm
   * 
   * This method orchestrates the complete quiet parts removal workflow:
   * 
   * 1. **Setup Phase** (0-5%): Create output directory and validate inputs
   * 2. **Frame Extraction** (5-20%): Extract video frames as JPEG images
   * 3. **Audio Extraction** (20-30%): Extract and resample audio track
   * 4. **Analysis** (30-35%): Detect silence and create processing chunks
   * 5. **Processing** (35-75%): Time-stretch audio and map frames
   * 6. **Assembly** (75-98%): Reassemble final video with synchronized audio
   * 7. **Finalization** (98-100%): Encode output and cleanup temporary files
   * 
   * Progress events are emitted throughout processing with detailed information
   * about current phase, frame counts, processing speed, and estimated completion.
   * 
   * @param {string} videoPath - Absolute path to input video file
   * @param {Object} options - Processing configuration options
   * @param {string} [options.outputDir] - Output directory path
   * @param {number} [options.silentThreshold=0.03] - Volume threshold for silence detection (0.01-0.1)
   * @param {number} [options.soundedSpeed=1.0] - Playback speed for speech segments
   * @param {number} [options.silentSpeed=5.0] - Speed multiplier for quiet segments (2x-999999x)
   * @param {number} [options.frameMargin=1] - Context frames around speech segments
   * @param {number} [options.sampleRate=44100] - Audio sample rate (22050, 44100, 48000)
   * @param {number} [options.frameRate=30] - Video frame rate (auto-detected if not specified)
   * @param {number} [options.frameQuality=3] - JPEG quality for frame extraction (1-31, lower=better)
   * 
   * @returns {Promise<Object>} Processing result
   * @returns {boolean} returns.success - Whether processing completed successfully
   * @returns {string} returns.outputPath - Path to generated output file
   * @returns {string} returns.originalPath - Path to original input file
   * @returns {number} returns.fileSize - Size of output file in bytes
   * @returns {Object} returns.settings - Settings used for processing
   * @returns {string} returns.processedAt - ISO timestamp of completion
   * @returns {string} returns.error - Error message if processing failed
   * @returns {string} returns.stdout - Process stdout for debugging
   * @returns {string} returns.stderr - Process stderr for debugging
   * 
   * @fires JumpcutterBridge#progress - Emitted with progress updates
   * @fires JumpcutterBridge#error - Emitted on processing errors
   * @fires JumpcutterBridge#stdout - Emitted with process output
   * @fires JumpcutterBridge#stderr - Emitted with process errors
   * 
   * @example
   * const bridge = new JumpcutterBridge();
   * 
   * // Listen for progress updates
   * bridge.on('progress', (data) => {
   *   console.log(`${data.progress}%: ${data.step}`);
   *   console.log('Phase:', data.phase, 'Details:', data.details);
   * });
   * 
   * // Process video with custom settings
   * const result = await bridge.processVideo('/path/to/video.mp4', {
   *   silentThreshold: 0.025,  // More sensitive
   *   silentSpeed: 999999,     // Cut out completely
   *   frameQuality: 1          // Highest quality
   * });
   * 
   * if (result.success) {
   *   console.log('Output saved to:', result.outputPath);
   * } else {
   *   console.error('Processing failed:', result.error);
   * }
   */
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

        // Parse progress from jumpcutter Python script output
        
        // Detect frame rate detection
        if (output.includes('Detected frame rate:')) {
          this.emit('progress', { 
            progress: 30, 
            step: 'Analyzing video metadata...',
            phase: 'analysis',
            details: { message: output.trim() }
          });
        }
        
        // Look for "X time-altered frames saved." messages from Python script
        const progressMatch = output.match(/(\d+) time-altered frames saved\./);
        if (progressMatch) {
          const frames = parseInt(progressMatch[1]);
          // Better progress estimation - map frame processing to 30-70% range
          const progress = Math.min(70, 30 + Math.floor(frames / 50) * 2);
          if (progress > lastProgress) {
            lastProgress = progress;
            this.emit('progress', { 
              progress, 
              step: `Processing quiet parts: ${frames.toLocaleString()} frames completed`,
              phase: 'processing',
              details: { 
                framesProcessed: frames,
                estimatedCompletion: `${Math.round((progress / 70) * 100)}% of processing phase`
              }
            });
          }
        }

        // Look for any meaningful output that indicates progress
        if (output.trim() && !output.includes('time-altered')) {
          const currentProgress = Math.min(lastProgress + 1, 75);
          if (currentProgress > lastProgress) {
            lastProgress = currentProgress;
            this.emit('progress', { 
              progress: currentProgress, 
              step: 'Processing video segments...',
              phase: 'processing',
              details: { message: 'Analyzing and processing audio segments' }
            });
          }
        }

        this.emit('stdout', output);
      });

      this.currentProcess.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;

        console.log('[JUMPCUTTER STDERR]:', error);

        // Parse ffmpeg progress from stderr
        const frameMatch = error.match(/frame=\s*(\d+)/);
        const timeMatch = error.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
        const speedMatch = error.match(/speed=\s*([\d.]+)x/);
        
        // Detect different processing phases with detailed progress tracking
        if (error.includes('Stream mapping:') && error.includes('frame%06d.jpg')) {
          this.emit('progress', { 
            progress: 5, 
            step: 'Starting frame extraction...',
            phase: 'frame_extraction',
            details: { message: 'Initializing video frame extraction' }
          });
        } else if (error.includes('frame%06d.jpg') && frameMatch) {
          // Frame extraction progress
          const currentFrame = parseInt(frameMatch[1]);
          let extractionProgress = Math.min(15, 5 + Math.floor(currentFrame / 200));
          
          this.emit('progress', { 
            progress: extractionProgress, 
            step: `Extracting frames: ${currentFrame.toLocaleString()}`,
            phase: 'frame_extraction',
            details: { currentFrame, processingSpeed: speedMatch ? speedMatch[1] : null }
          });
        } else if (error.includes('Stream mapping:') && error.includes('audio.wav')) {
          this.emit('progress', { 
            progress: 20, 
            step: 'Starting audio extraction...',
            phase: 'audio_extraction',
            details: { message: 'Initializing audio track extraction' }
          });
        } else if (error.includes('audio.wav') && !error.includes('newFrame')) {
          this.emit('progress', { 
            progress: 25, 
            step: 'Extracting audio track...',
            phase: 'audio_extraction',
            details: { message: 'Processing audio for analysis' }
          });
        } else if (frameMatch) {
          const currentFrame = parseInt(frameMatch[1]);
          
          // Better progress estimation based on typical video lengths
          // Assume most processing happens during frame reassembly
          // Final video assembly phase (75-95%)
          let estimatedProgress = 75 + Math.min(20, Math.floor(currentFrame / 1000) * 2);
          
          let progressMessage = `Reassembling final video: frame ${currentFrame.toLocaleString()}`;
          if (timeMatch && timeMatch[1]) {
            progressMessage += ` (${timeMatch[1]} processed)`;
          }
          if (speedMatch && speedMatch[1]) {
            progressMessage += ` at ${speedMatch[1]}x speed`;
          }
          
          if (estimatedProgress > lastProgress) {
            lastProgress = estimatedProgress;
            this.emit('progress', { 
              progress: estimatedProgress, 
              step: progressMessage,
              phase: 'assembly',
              details: {
                currentFrame,
                timeProcessed: timeMatch ? timeMatch[1] : null,
                processingSpeed: speedMatch ? speedMatch[1] : null,
                estimatedCompletion: `${Math.round(((estimatedProgress - 75) / 20) * 100)}% of assembly phase`
              }
            });
          }
        }

        // Look for completion indicators
        if (error.includes('muxing overhead:') || error.includes('Lsize=')) {
          this.emit('progress', { 
            progress: 98, 
            step: 'Finalizing video output...',
            phase: 'finalization',
            details: { message: 'Writing final video file and cleaning up' }
          });
        }

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

      this.currentProcess.on('close', async (code, signal) => {
        clearTimeout(timeout);
        this.currentProcess = null;

        console.log(`[JUMPCUTTER] Process exited with code: ${code}, signal: ${signal}`);
        console.log(`[JUMPCUTTER] STDOUT length: ${stdout.length}`);
        console.log(`[JUMPCUTTER] STDERR length: ${stderr.length}`);

        // Handle null exit code (process was terminated) or successful completion
        const isSuccess = code === 0 || (code === null && signal === 'SIGTERM' && stderr.includes('Lsize='));
        
        if (isSuccess || code === 0) {
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
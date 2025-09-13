const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const EventEmitter = require('events');
const { app } = require('electron');

/**
 * TranscriptionBridge - Interface for Whisper-based audio transcription
 * 
 * This bridge manages the Python-based Whisper transcription process that converts
 * speech in videos/audio to text with timestamps. It provides:
 * 
 * - Dependency checking for Whisper and required libraries
 * - Audio transcription with word-level timestamps
 * - Multiple model sizes (tiny, base, small, medium, large)
 * - Language detection and manual language specification
 * - Progress tracking and error handling
 * - Cross-platform support (development and production)
 * 
 * The transcription process works by:
 * 1. Extracting or using audio from video/audio files
 * 2. Loading the specified Whisper model
 * 3. Processing audio through Whisper AI
 * 4. Generating transcript with segment and word timestamps
 * 5. Returning structured JSON results
 * 
 * @extends EventEmitter
 * @fires TranscriptionBridge#progress - Transcription progress updates
 * @fires TranscriptionBridge#error - Error events during transcription
 * @fires TranscriptionBridge#complete - Transcription completion
 * @fires TranscriptionBridge#model-loaded - Model loading completion
 */
class TranscriptionBridge extends EventEmitter {
  constructor() {
    super();
    this.tempDir = path.join(__dirname, '../../../temp');
    this.currentProcess = null;

    // Determine if we're in development or production
    const isDev = !app.isPackaged;

    if (isDev) {
      // Development: use Python interpreter and source files
      this.pythonPath = 'python';
      this.scriptPath = path.join(__dirname, '../../python/transcription/whisper_transcriber.py');
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
    const executableName = isWindows ? 'whisper_transcriber.exe' : 'whisper_transcriber';

    return path.join(pythonDir, 'transcription', executableName);
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(path.join(this.tempDir, 'transcriptions'), { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directories:', error);
    }
  }

  /**
   * Checks if required Python dependencies are installed and accessible
   * 
   * Verifies Python interpreter and required packages:
   * - whisper: OpenAI Whisper for speech recognition
   * - torch: PyTorch for ML computations
   * - ffmpeg: Audio processing (system dependency)
   * 
   * @returns {Promise<Object>} Dependency check result
   * @returns {boolean} returns.success - Whether all dependencies are available
   * @returns {string} returns.message - Success message or error description
   * @returns {string} returns.error - Detailed error message if failed
   * @returns {string[]} returns.missingModules - List of missing Python modules
   */
  async checkDependencies() {
    return new Promise(async (resolve) => {
      if (this.useBundled) {
        // For bundled executables, check if the executable exists
        try {
          const stats = await fs.stat(this.bundledExecutablePath);
          if (stats.isFile()) {
            resolve({ success: true, message: 'Bundled transcription executable is ready' });
          } else {
            resolve({
              success: false,
              error: 'Bundled transcription executable not found. Please reinstall the application.'
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: `Bundled transcription executable not accessible: ${error.message}. Please reinstall the application.`
          });
        }
        return;
      }

      // Development mode: check Python dependencies
      const checkScript = `
import sys
missing_modules = []

try:
    import whisper
    print("✓ whisper found")
except ImportError:
    missing_modules.append("openai-whisper")
    print("✗ whisper missing")

try:
    import torch
    print("✓ torch found")
except ImportError:
    missing_modules.append("torch")
    print("✗ torch missing")

try:
    import json
    print("✓ json found")
except ImportError:
    missing_modules.append("json")
    print("✗ json missing (should be built-in)")

# Check ffmpeg availability by trying to import subprocess and run ffmpeg
try:
    import subprocess
    result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, timeout=5)
    if result.returncode == 0:
        print("✓ ffmpeg found")
    else:
        missing_modules.append("ffmpeg")
        print("✗ ffmpeg not working")
except:
    missing_modules.append("ffmpeg")
    print("✗ ffmpeg missing")

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
          resolve({ success: true, message: 'All transcription dependencies are installed' });
        } else {
          const missingMatch = output.match(/MISSING_MODULES: (.+)/);
          const missingModules = missingMatch ? missingMatch[1].split(',') : [];

          let errorMessage = 'Missing Python dependencies for transcription functionality:\\n\\n';

          if (missingModules.length > 0) {
            errorMessage += `Missing modules: ${missingModules.join(', ')}\\n\\n`;
            
            if (missingModules.includes('openai-whisper')) {
              errorMessage += 'To install Whisper:\\n';
              errorMessage += 'pip install openai-whisper\\n\\n';
            }
            if (missingModules.includes('torch')) {
              errorMessage += 'To install PyTorch:\\n';
              errorMessage += 'pip install torch torchaudio\\n\\n';
            }
            if (missingModules.includes('ffmpeg')) {
              errorMessage += 'FFmpeg is required. Install from:\\n';
              errorMessage += 'https://ffmpeg.org/download.html\\n\\n';
            }
            
            errorMessage += 'Or install all dependencies with:\\n';
            errorMessage += 'pip install -r src/python/transcription/requirements.txt';
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
   * Transcribes audio from a video or audio file using Whisper
   * 
   * @param {string} filePath - Absolute path to video/audio file
   * @param {Object} options - Transcription configuration options
   * @param {string} [options.model='base'] - Whisper model size ('tiny', 'base', 'small', 'medium', 'large')
   * @param {string} [options.language] - Language code (auto-detect if not specified)
   * @param {string} [options.outputDir] - Output directory for transcription files
   * @param {boolean} [options.addTextOverlay=false] - Whether to create video with text overlay
   * @param {Object} [options.textStyle] - Text styling options for overlay
   * @param {Array} [options.subtitlePositions] - Array of subtitle positioning data from overlay
   *
   * @returns {Promise<Object>} Transcription result
   * @returns {boolean} returns.success - Whether transcription completed successfully
   * @returns {string} returns.outputPath - Path to generated transcription JSON file
   * @returns {string} returns.videoOutputPath - Path to video with text overlay (if requested)
   * @returns {Object} returns.transcription - Transcription data with segments and timestamps
   * @returns {string} returns.language - Detected or specified language
   * @returns {number} returns.duration - Audio duration in seconds
   * @returns {string} returns.error - Error message if transcription failed
   */
  async transcribeFile(filePath, options = {}) {
    await this.ensureTempDir();

    const {
      model = 'base',
      language = null,
      outputDir = path.join(this.tempDir, 'transcriptions'),
      addTextOverlay = false,
      textStyle = {
        fontsize: 50,
        color: 'white',
        strokeColor: 'black',
        strokeWidth: 2,
        position: 'bottom'
      },
      subtitlePositions = null
    } = options;

    // Ensure output directory exists
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const outputFileName = path.basename(filePath, path.extname(filePath)) + '_transcription.json';
    const outputPath = path.join(outputDir, outputFileName);

    return new Promise((resolve, reject) => {
      let command, args;

      if (this.useBundled) {
        // Use bundled executable
        command = this.bundledExecutablePath;
        args = [filePath, outputPath, '--model', model];
        if (language) {
          args.push('--language', language);
        }
      } else {
        // Use Python interpreter with script
        command = this.pythonPath;
        args = [this.scriptPath, filePath, outputPath, '--model', model];
        if (language) {
          args.push('--language', language);
        }
      }

      console.log('Starting transcription process:', { command, args });

      this.emit('progress', { 
        progress: 0, 
        step: `Loading ${model} model...`,
        phase: 'initialization',
        details: { model, language: language || 'auto-detect' }
      });

      this.currentProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';

      this.currentProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;

        console.log('[TRANSCRIPTION STDOUT]:', output);

        // Parse progress from transcription output
        if (output.includes('Loading model')) {
          this.emit('progress', { 
            progress: 10, 
            step: 'Loading Whisper model...',
            phase: 'model_loading',
            details: { model }
          });
        } else if (output.includes('Transcribing')) {
          this.emit('progress', { 
            progress: 20, 
            step: 'Starting transcription...',
            phase: 'transcription',
            details: { message: 'Processing audio with AI' }
          });
        } else if (output.includes('Language:')) {
          const langMatch = output.match(/Language: (\w+)/);
          if (langMatch) {
            this.emit('progress', { 
              progress: 90, 
              step: 'Finalizing transcription...',
              phase: 'finalization',
              details: { detectedLanguage: langMatch[1] }
            });
          }
        } else if (output.includes('segments:')) {
          const segMatch = output.match(/segments: (\d+)/);
          if (segMatch) {
            this.emit('progress', { 
              progress: 95, 
              step: `Generated ${segMatch[1]} segments`,
              phase: 'finalization',
              details: { segmentCount: parseInt(segMatch[1]) }
            });
          }
        }

        this.emit('stdout', output);
      });

      this.currentProcess.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;

        console.log('[TRANSCRIPTION STDERR]:', error);

        // Look for progress indicators in stderr (Whisper outputs progress here)
        if (error.includes('%')) {
          const progressMatch = error.match(/(\d+)%/);
          if (progressMatch) {
            const progress = Math.max(20, Math.min(85, parseInt(progressMatch[1])));
            this.emit('progress', { 
              progress, 
              step: 'Processing audio...',
              phase: 'transcription',
              details: { completion: `${progressMatch[1]}%` }
            });
          }
        }

        // Check for specific error types
        if (error.includes('ModuleNotFoundError') || error.includes('ImportError')) {
          this.emit('error', { type: 'missing_dependency', message: error });
        } else if (error.includes('FileNotFoundError')) {
          this.emit('error', { type: 'file_not_found', message: error });
        } else if (error.includes('Error:') || error.includes('CUDA') || error.includes('RuntimeError')) {
          this.emit('error', { type: 'transcription_error', message: error });
        }

        this.emit('stderr', error);
      });

      // Add timeout for the process (10 minutes for large files)
      const timeout = setTimeout(() => {
        if (this.currentProcess) {
          console.log('[TRANSCRIPTION] Process timeout - killing process');
          this.currentProcess.kill('SIGTERM');
          this.currentProcess = null;
          reject({
            success: false,
            error: 'Transcription timed out after 10 minutes',
            stdout,
            stderr
          });
        }
      }, 10 * 60 * 1000); // 10 minutes

      this.currentProcess.on('close', async (code, signal) => {
        clearTimeout(timeout);
        this.currentProcess = null;

        console.log(`[TRANSCRIPTION] Process exited with code: ${code}, signal: ${signal}`);

        // Handle null exit code or successful completion
        const isSuccess = code === 0 || (code === null && !stderr.includes('Error'));

        if (isSuccess) {
          try {
            // Check if output file exists and read transcription data
            const stats = await fs.stat(outputPath);
            const transcriptionData = JSON.parse(await fs.readFile(outputPath, 'utf8'));

            let result = {
              success: true,
              outputPath: outputPath,
              originalPath: filePath,
              transcription: transcriptionData,
              language: transcriptionData.language || 'unknown',
              segmentCount: transcriptionData.segments?.length || 0,
              fileSize: stats.size,
              model: model,
              processedAt: new Date().toISOString()
            };

            // If text overlay is requested, process video with captions
            if (addTextOverlay) {
              try {
                this.emit('progress', { 
                  progress: 85, 
                  step: 'Adding text overlay to video...',
                  phase: 'video_overlay',
                  details: { segmentCount: transcriptionData.segments?.length || 0 }
                });

                const videoWithCaptions = await this.addTextOverlayToVideo(
                  filePath,
                  transcriptionData,
                  textStyle,
                  outputDir,
                  subtitlePositions
                );
                
                result.videoOutputPath = videoWithCaptions;
                
                this.emit('progress', { 
                  progress: 100, 
                  step: 'Video with text overlay completed',
                  phase: 'complete',
                  details: { outputPath: videoWithCaptions }
                });
              } catch (overlayError) {
                console.error('[TRANSCRIPTION] Text overlay failed:', overlayError);
                result.overlayError = overlayError.message;
                this.emit('progress', { progress: 100, step: 'Transcription completed (text overlay failed)' });
              }
            } else {
              this.emit('progress', { progress: 100, step: 'Transcription completed' });
            }

            this.emit('complete', result);
            resolve(result);
          } catch (error) {
            const errorResult = {
              success: false,
              error: `Failed to read transcription output: ${error.message}`,
              stdout,
              stderr
            };
            this.emit('error', errorResult);
            resolve(errorResult);
          }
        } else {
          const errorResult = {
            success: false,
            error: `Transcription process failed with code ${code}`,
            stdout,
            stderr
          };
          this.emit('error', errorResult);
          reject(errorResult);
        }
      });

      this.currentProcess.on('error', (error) => {
        clearTimeout(timeout);
        this.currentProcess = null;
        const errorResult = {
          success: false,
          error: `Failed to start transcription process: ${error.message}`,
          stdout,
          stderr
        };
        this.emit('error', errorResult);
        reject(errorResult);
      });
    });
  }

  /**
   * Creates ASS subtitle file with exact positioning from transcription data
   * @param {Object} transcriptionData - Transcription data with segments
   * @param {string} assPath - Path where to save the ASS file
   * @param {Object} videoInfo - Video dimensions and properties
   * @param {Array} subtitlePositions - Positioning data from overlay
   */
  async createASSFile(transcriptionData, assPath, videoInfo, subtitlePositions) {
    const fs = require('fs').promises;

    // Create ASS header
    let assContent = `[Script Info]
Title: AI Video Editor Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: ${videoInfo.width}
PlayResY: ${videoInfo.height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,50,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Process each transcription segment
    transcriptionData.segments.forEach((segment, index) => {
      const startTime = this.formatASSTime(segment.start);
      const endTime = this.formatASSTime(segment.end);
      let text = segment.text.trim();

      // Find matching positioning data
      const position = this.findPositionForSegment(segment, subtitlePositions, index);

      if (position) {
        // Convert percentage coordinates to pixel coordinates
        const x = Math.round((position.x / 100) * videoInfo.width);
        const y = Math.round((position.y / 100) * videoInfo.height);

        // Use exact positioning with {\pos(x,y)} tag
        text = `{\\pos(${x},${y})}${text}`;

        console.log(`[ASS] Segment ${index}: positioned at (${x}, ${y}) - "${text.substring(0, 30)}..."`);
      }

      // Add dialogue line
      assContent += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}\n`;
    });

    await fs.writeFile(assPath, assContent, 'utf8');
    console.log(`[TRANSCRIPTION] Created ASS file with exact positioning: ${assPath}`);
  }

  /**
   * Creates SRT subtitle file from transcription data
   * @param {Object} transcriptionData - Transcription data with segments
   * @param {string} srtPath - Path where to save the SRT file
   */
  async createSRTFile(transcriptionData, srtPath) {
    const fs = require('fs').promises;
    
    let srtContent = '';
    transcriptionData.segments.forEach((segment, index) => {
      const startTime = this.formatSRTTime(segment.start);
      const endTime = this.formatSRTTime(segment.end);
      const text = segment.text.trim();
      
      srtContent += `${index + 1}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${text}\n\n`;
    });
    
    await fs.writeFile(srtPath, srtContent, 'utf8');
    console.log(`[TRANSCRIPTION] Created SRT file: ${srtPath}`);
    
    // Verify file exists and show actual Windows path
    try {
      const stats = await fs.stat(srtPath);
      console.log(`[TRANSCRIPTION] SRT file verified, size: ${stats.size} bytes`);
      console.log(`[TRANSCRIPTION] Absolute SRT path: ${path.resolve(srtPath)}`);
    } catch (error) {
      console.error(`[TRANSCRIPTION] SRT file verification failed: ${error.message}`);
    }
  }

  /**
   * Formats seconds to ASS time format (H:MM:SS.cc)
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted ASS time
   */
  formatASSTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const centiseconds = Math.floor((seconds % 1) * 100);

    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }

  /**
   * Finds the best matching position for a transcription segment
   * @param {Object} segment - Transcription segment
   * @param {Array} subtitlePositions - Array of positioning data
   * @param {number} segmentIndex - Index of current segment
   * @returns {Object|null} Position data or null
   */
  findPositionForSegment(segment, subtitlePositions, segmentIndex) {
    if (!subtitlePositions || subtitlePositions.length === 0) {
      return null;
    }

    // Try to find exact time match first
    let bestMatch = subtitlePositions.find(pos =>
      Math.abs(pos.startTime - segment.start) < 0.1 &&
      Math.abs(pos.endTime - segment.end) < 0.1
    );

    // If no exact match, try text matching
    if (!bestMatch) {
      bestMatch = subtitlePositions.find(pos =>
        pos.text && segment.text &&
        pos.text.trim().toLowerCase() === segment.text.trim().toLowerCase()
      );
    }

    // If still no match, use index-based matching
    if (!bestMatch && segmentIndex < subtitlePositions.length) {
      bestMatch = subtitlePositions[segmentIndex];
    }

    // If no specific match, use the default/first position
    if (!bestMatch && subtitlePositions.length > 0) {
      bestMatch = subtitlePositions[0];
    }

    return bestMatch;
  }

  /**
   * Formats seconds to SRT time format (HH:MM:SS,mmm)
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted SRT time
   */
  formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }

  /**
   * Get video information including aspect ratio
   * @param {string} videoPath - Path to video file
   * @returns {Promise<Object>} Video information
   */
  async getVideoInfo(videoPath) {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ]);

      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(stdout);
            const videoStream = info.streams.find(stream => stream.codec_type === 'video');
            
            if (videoStream) {
              const width = videoStream.width;
              const height = videoStream.height;
              const aspectRatio = width / height;
              
              resolve({
                width,
                height,
                aspectRatio,
                duration: parseFloat(info.format.duration),
                isVertical: aspectRatio < 1.0,
                isSquare: Math.abs(aspectRatio - 1.0) < 0.1,
                isWidescreen: aspectRatio > 1.7
              });
            } else {
              reject(new Error('No video stream found'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse video info: ${error.message}`));
          }
        } else {
          reject(new Error(`ffprobe failed: ${stderr}`));
        }
      });
    });
  }

  /**
   * Get aspect ratio-aware subtitle settings
   * @param {Object} videoInfo - Video information including aspect ratio
   * @param {Object} textStyle - User-defined text styling preferences
   * @returns {Object} Optimized settings for the video aspect ratio
   */
  getAspectRatioSettings(videoInfo, textStyle) {
    const baseSettings = {
      fontSize: textStyle.fontsize || 50,
      color: this.convertColorToHex(textStyle.color || 'white'),
      outlineColor: this.convertColorToHex(textStyle.strokeColor || 'black'),
      outline: textStyle.strokeWidth || 2
    };

    // Adjust settings based on aspect ratio
    if (videoInfo.isVertical) {
      // Vertical videos (9:16, TikTok, Instagram Stories)
      return {
        ...baseSettings,
        fontSize: Math.max(baseSettings.fontSize * 1.2, 60), // Larger text for mobile
        alignment: textStyle.position === 'top' ? 8 : textStyle.position === 'center' ? 5 : 2, // 8=top, 5=center, 2=bottom
        marginV: textStyle.position === 'top' ? 50 : textStyle.position === 'center' ? 0 : 100 // More margin for readability
      };
    } else if (videoInfo.isSquare) {
      // Square videos (1:1, Instagram posts)
      return {
        ...baseSettings,
        fontSize: Math.max(baseSettings.fontSize * 1.1, 55),
        alignment: textStyle.position === 'top' ? 8 : textStyle.position === 'center' ? 5 : 2,
        marginV: textStyle.position === 'top' ? 40 : textStyle.position === 'center' ? 0 : 80
      };
    } else if (videoInfo.isWidescreen) {
      // Widescreen videos (21:9, cinematic)
      return {
        ...baseSettings,
        fontSize: Math.max(baseSettings.fontSize * 0.9, 40), // Smaller text for wide format
        alignment: textStyle.position === 'top' ? 8 : textStyle.position === 'center' ? 5 : 2,
        marginV: textStyle.position === 'top' ? 30 : textStyle.position === 'center' ? 0 : 60
      };
    } else {
      // Standard videos (16:9, YouTube, etc.)
      return {
        ...baseSettings,
        alignment: textStyle.position === 'top' ? 8 : textStyle.position === 'center' ? 5 : 2,
        marginV: textStyle.position === 'top' ? 40 : textStyle.position === 'center' ? 0 : 80
      };
    }
  }

  /**
   * Convert color names to hex format for FFmpeg
   * @param {string} color - Color name or hex
   * @returns {string} Hex color code
   */
  convertColorToHex(color) {
    const colorMap = {
      'white': '&HFFFFFF',
      'black': '&H000000',
      'red': '&H0000FF',
      'green': '&H00FF00',
      'blue': '&HFF0000',
      'yellow': '&H00FFFF',
      'cyan': '&HFFFF00',
      'magenta': '&HFF00FF'
    };
    
    return colorMap[color.toLowerCase()] || '&HFFFFFF'; // Default to white
  }

  /**
   * Adds text overlay to video using transcription data
   * @param {string} videoPath - Path to original video
   * @param {Object} transcriptionData - Transcription data with segments
   * @param {Object} textStyle - Text styling options
   * @param {string} outputDir - Output directory
   * @param {Array} subtitlePositions - Array of positioning data from overlay
   * @returns {Promise<string>} Path to video with text overlay
   */
  async addTextOverlayToVideo(videoPath, transcriptionData, textStyle, outputDir, subtitlePositions = null) {
    const { spawn } = require('child_process');
    const videoFileName = path.basename(videoPath, path.extname(videoPath));
    const outputPath = path.join(outputDir, `${videoFileName}_with_captions.mp4`);

    // Get video information for aspect ratio-based subtitle positioning
    console.log('[VIDEO OVERLAY] Analyzing video aspect ratio...');
    const videoInfo = await this.getVideoInfo(videoPath);
    console.log(`[VIDEO OVERLAY] Video info:`, {
      width: videoInfo.width,
      height: videoInfo.height,
      aspectRatio: videoInfo.aspectRatio.toFixed(2),
      isVertical: videoInfo.isVertical,
      isSquare: videoInfo.isSquare,
      isWidescreen: videoInfo.isWidescreen
    });

    // Create subtitle file - use ASS format if positioning data available, otherwise SRT
    let subtitlePath;
    if (subtitlePositions && subtitlePositions.length > 0) {
      subtitlePath = path.join(outputDir, `${videoFileName}_subtitles.ass`);
      await this.createASSFile(transcriptionData, subtitlePath, videoInfo, subtitlePositions);
      console.log('[VIDEO OVERLAY] Using ASS format with exact positioning');
    } else {
      subtitlePath = path.join(outputDir, `${videoFileName}_subtitles.srt`);
      await this.createSRTFile(transcriptionData, subtitlePath);
      console.log('[VIDEO OVERLAY] Using SRT format with basic positioning');
    }

    return new Promise((resolve, reject) => {
      let command, args;

      if (this.useBundled) {
        // Use bundled whisper transcriber with FFmpeg overlay
        const resourcesPath = process.resourcesPath || path.join(process.cwd(), 'resources');
        const transcriptionScript = path.join(resourcesPath, 'python', 'transcription', 'overlay_subtitles.py');
        command = 'python';
        args = [transcriptionScript, videoPath, subtitlePath, outputPath];
      } else {
        // Development: use FFmpeg directly  
        command = 'ffmpeg';
        
        // Cross-platform path handling for FFmpeg
        let escapedSubtitlePath;
        console.log(`[VIDEO OVERLAY] Original subtitle path: ${subtitlePath}`);
        console.log(`[VIDEO OVERLAY] Platform: ${process.platform}`);

        if (process.platform === 'win32') {
          // Windows: Convert backslashes to forward slashes and escape colons
          escapedSubtitlePath = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
          console.log(`[VIDEO OVERLAY] Windows escaped path: ${escapedSubtitlePath}`);
        } else {
          // Linux/Mac: Use path as-is but escape special characters
          escapedSubtitlePath = subtitlePath.replace(/'/g, "'\"'\"'");
          console.log(`[VIDEO OVERLAY] Unix escaped path: ${escapedSubtitlePath}`);
        }

        // Create subtitle filter
        const subtitleFilename = path.basename(subtitlePath);
        const subtitleDirectory = path.dirname(subtitlePath);
        console.log(`[VIDEO OVERLAY] Subtitle filename: ${subtitleFilename}`);
        console.log(`[VIDEO OVERLAY] Subtitle directory: ${subtitleDirectory}`);
        
        // Determine font size and position based on aspect ratio and user preferences
        const aspectRatioSettings = this.getAspectRatioSettings(videoInfo, textStyle);
        console.log(`[VIDEO OVERLAY] Aspect ratio settings:`, aspectRatioSettings);
        
        let vfFilter;

        if (subtitlePath.endsWith('.ass')) {
          // ASS format with exact positioning - use directly
          vfFilter = `ass=filename=${subtitleFilename}`;
          console.log(`[VIDEO OVERLAY] Using ASS format with exact positioning`);
        } else {
          // SRT format with aspect ratio-aware styling
          const aspectRatioSettings = this.getAspectRatioSettings(videoInfo, textStyle);
          console.log(`[VIDEO OVERLAY] Aspect ratio settings:`, aspectRatioSettings);

          const subtitleOptions = [
            `filename=${subtitleFilename}`,
            `force_style='FontSize=${aspectRatioSettings.fontSize}'`,
            `force_style='Alignment=${aspectRatioSettings.alignment}'`,
            `force_style='MarginV=${aspectRatioSettings.marginV}'`,
            `force_style='PrimaryColour=${aspectRatioSettings.color}'`,
            `force_style='OutlineColour=${aspectRatioSettings.outlineColor}'`,
            `force_style='Outline=${aspectRatioSettings.outline}'`
          ].join(':');

          vfFilter = `subtitles=${subtitleOptions}`;
        }

        console.log(`[VIDEO OVERLAY] FFmpeg filter: ${vfFilter}`);

        args = [
          '-i', videoPath,
          '-vf', vfFilter,
          '-c:a', 'copy',
          '-y',
          outputPath
        ];
      }

      // Set working directory to where the subtitle file is located
      const workingDir = command === 'ffmpeg' ? path.dirname(subtitlePath) : process.cwd();
      console.log(`[VIDEO OVERLAY] Working directory: ${workingDir}`);
      console.log(`[VIDEO OVERLAY] Command: ${command}`);
      console.log(`[VIDEO OVERLAY] Args: ${JSON.stringify(args)}`);

      const overlayProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: workingDir
      });

      let stdout = '';
      let stderr = '';

      overlayProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('[VIDEO OVERLAY STDOUT]:', output);
      });

      overlayProcess.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        console.log('[VIDEO OVERLAY STDERR]:', error);
      });

      // Add timeout for video overlay process (5 minutes)
      const overlayTimeout = setTimeout(() => {
        console.log('[VIDEO OVERLAY] Process timeout - killing process');
        overlayProcess.kill('SIGTERM');
        reject(new Error('Video overlay process timed out after 5 minutes'));
      }, 5 * 60 * 1000);

      overlayProcess.on('close', (code) => {
        clearTimeout(overlayTimeout);
        console.log(`[VIDEO OVERLAY] Process exited with code: ${code}`);
        
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`Video overlay process failed with code ${code}: ${stderr || stdout}`));
        }
      });

      overlayProcess.on('error', (error) => {
        clearTimeout(overlayTimeout);
        reject(new Error(`Failed to start video overlay process: ${error.message}`));
      });
    });
  }

  /**
   * Cancels the current transcription process
   * @returns {boolean} True if process was cancelled, false if no process running
   */
  cancelTranscription() {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
      this.emit('cancelled');
      return true;
    }
    return false;
  }

  /**
   * Gets available Whisper model sizes and their characteristics
   * @returns {Array} Array of model information objects
   */
  getAvailableModels() {
    return [
      { 
        name: 'tiny', 
        size: '39 MB', 
        speed: 'Very Fast', 
        accuracy: 'Lower',
        description: 'Fastest processing, good for quick previews'
      },
      { 
        name: 'base', 
        size: '74 MB', 
        speed: 'Fast', 
        accuracy: 'Good',
        description: 'Balanced speed and accuracy, recommended for most use cases'
      },
      { 
        name: 'small', 
        size: '244 MB', 
        speed: 'Medium', 
        accuracy: 'Better',
        description: 'Better accuracy with moderate speed'
      },
      { 
        name: 'medium', 
        size: '769 MB', 
        speed: 'Slow', 
        accuracy: 'High',
        description: 'High accuracy, slower processing'
      },
      { 
        name: 'large', 
        size: '1550 MB', 
        speed: 'Very Slow', 
        accuracy: 'Highest',
        description: 'Best accuracy, slowest processing'
      }
    ];
  }
}

module.exports = { TranscriptionBridge };
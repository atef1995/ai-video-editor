const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs").promises;
const EventEmitter = require("events");
const { app } = require("electron");

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
    // Use user data directory for temp files in production, project temp in dev
    const isDev = !app.isPackaged;
    if (isDev) {
      this.tempDir = path.join(__dirname, "../../../temp");
    } else {
      this.tempDir = path.join(app.getPath("userData"), "temp");
    }
    this.currentProcess = null;

    if (isDev) {
      // Development: use Python interpreter and source files
      this.pythonPath = "python";
      this.scriptPath = path.join(
        __dirname,
        "../../python/transcription/whisper_transcriber.py",
      );
      this.useBundled = false;
    } else {
      // Production: try bundled executable, fallback to Python if not found
      this.bundledExecutablePath = this.getBundledExecutablePath();
      this.pythonPath = "python";
      this.scriptPath = this.getBundledScriptPath();
      this.useBundled = this.checkBundledExecutable();

      console.log(
        `Bundled transcription executable check: ${this.bundledExecutablePath} exists: ${this.useBundled}`,
      );
      if (!this.useBundled) {
        console.log(
          `Falling back to Python interpreter with script: ${this.scriptPath}`,
        );
      }
    }
  }

  getBundledExecutablePath() {
    // In production, bundled executables are in resources/python/
    const resourcesPath =
      process.resourcesPath || path.join(process.cwd(), "resources");
    const pythonDir = path.join(resourcesPath, "python");

    // Platform-specific executable names
    const isWindows = process.platform === "win32";
    const executableName = isWindows
      ? "whisper_transcriber.exe"
      : "whisper_transcriber";

    return path.join(pythonDir, "transcription", executableName);
  }

  getBundledScriptPath() {
    // In production, Python scripts are bundled as extraResources at resources/src/python/
    const resourcesPath =
      process.resourcesPath || path.join(process.cwd(), "resources");
    return path.join(
      resourcesPath,
      "src",
      "python",
      "transcription",
      "whisper_transcriber.py",
    );
  }

  checkBundledExecutable() {
    try {
      const fs = require("fs");
      const exists = fs.existsSync(this.bundledExecutablePath);
      console.log(
        `Bundled transcription executable check: ${this.bundledExecutablePath} exists: ${exists}`,
      );
      return exists;
    } catch (error) {
      console.error("Error checking bundled transcription executable:", error);
      return false;
    }
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(path.join(this.tempDir, "transcriptions"), {
        recursive: true,
      });
      console.log(`Transcription temp directory ensured: ${this.tempDir}`);
    } catch (error) {
      console.error("Failed to create temp directories:", error);
      throw error;
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
            resolve({
              success: true,
              message: "Bundled transcription executable is ready",
            });
          } else {
            resolve({
              success: false,
              error:
                "Bundled transcription executable not found. Please reinstall the application.",
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: `Bundled transcription executable not accessible: ${error.message}. Please reinstall the application.`,
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

      const checkProcess = spawn(this.pythonPath, ["-c", checkScript]);

      let output = "";
      let errorOutput = "";

      checkProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      checkProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      checkProcess.on("close", (code) => {
        if (code === 0 && output.includes("ALL_DEPENDENCIES_OK")) {
          resolve({
            success: true,
            message: "All transcription dependencies are installed",
          });
        } else {
          const missingMatch = output.match(/MISSING_MODULES: (.+)/);
          const missingModules = missingMatch ? missingMatch[1].split(",") : [];

          let errorMessage =
            "Missing Python dependencies for transcription functionality:\\n\\n";

          if (missingModules.length > 0) {
            errorMessage += `Missing modules: ${missingModules.join(", ")}\\n\\n`;

            if (missingModules.includes("openai-whisper")) {
              errorMessage += "To install Whisper:\\n";
              errorMessage += "pip install openai-whisper\\n\\n";
            }
            if (missingModules.includes("torch")) {
              errorMessage += "To install PyTorch:\\n";
              errorMessage += "pip install torch torchaudio\\n\\n";
            }
            if (missingModules.includes("ffmpeg")) {
              errorMessage += "FFmpeg is required. Install from:\\n";
              errorMessage += "https://ffmpeg.org/download.html\\n\\n";
            }

            errorMessage += "Or install all dependencies with:\\n";
            errorMessage +=
              "pip install -r src/python/transcription/requirements.txt";
          } else {
            errorMessage += `Error details: ${errorOutput || output}`;
          }

          resolve({
            success: false,
            error: errorMessage,
            missingModules: missingModules,
          });
        }
      });

      checkProcess.on("error", (error) => {
        resolve({
          success: false,
          error: `Python not found or not executable: ${error.message}\\n\\nPlease ensure Python is installed and in your PATH.`,
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
      model = "base",
      language = null,
      outputDir = path.join(this.tempDir, "transcriptions"),
      addTextOverlay = false,
      textStyle = {},
      subtitlePositions = null,
    } = options;

    // Normalize text style properties for Python compatibility
    const normalizedTextStyle = {
      fontSize: textStyle.fontSize || textStyle.fontsize || 24,
      fontFamily: textStyle.fontFamily || "Arial",
      color: textStyle.color || "white",
      backgroundColor: textStyle.backgroundColor || "rgba(0, 0, 0, 0.7)",
      strokeColor: textStyle.strokeColor || "black",
      strokeWidth: textStyle.strokeWidth || 2,
      fontWeight: textStyle.fontWeight || "bold",
      position: textStyle.position || "bottom",
    };
    console.log(options);

    // Ensure output directory exists
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const outputFileName =
      path.basename(filePath, path.extname(filePath)) + "_transcription.json";
    const outputPath = path.join(outputDir, outputFileName);

    return new Promise((resolve, reject) => {
      let command, args;

      if (this.useBundled) {
        // Use bundled executable
        command = this.bundledExecutablePath;
        args = [filePath, outputPath, "--model", model];
        if (language) {
          args.push("--language", language);
        }
      } else {
        // Use Python interpreter with script
        command = this.pythonPath;
        args = [this.scriptPath, filePath, outputPath, "--model", model];
        if (language) {
          args.push("--language", language);
        }
      }

      console.log("Starting transcription process:", { command, args });

      this.emit("progress", {
        progress: 0,
        step: `Loading ${model} model...`,
        phase: "initialization",
        details: { model, language: language || "auto-detect" },
      });

      this.currentProcess = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";

      this.currentProcess.stdout.on("data", (data) => {
        const output = data.toString();
        stdout += output;

        console.log("[TRANSCRIPTION STDOUT]:", output);

        // Parse progress from transcription output
        if (output.includes("Loading model")) {
          this.emit("progress", {
            progress: 10,
            step: "Loading Whisper model...",
            phase: "model_loading",
            details: { model },
          });
        } else if (output.includes("Transcribing")) {
          this.emit("progress", {
            progress: 20,
            step: "Starting transcription...",
            phase: "transcription",
            details: { message: "Processing audio with AI" },
          });
        } else if (output.includes("Language:")) {
          const langMatch = output.match(/Language: (\w+)/);
          if (langMatch) {
            this.emit("progress", {
              progress: 90,
              step: "Finalizing transcription...",
              phase: "finalization",
              details: { detectedLanguage: langMatch[1] },
            });
          }
        } else if (output.includes("segments:")) {
          const segMatch = output.match(/segments: (\d+)/);
          if (segMatch) {
            this.emit("progress", {
              progress: 95,
              step: `Generated ${segMatch[1]} segments`,
              phase: "finalization",
              details: { segmentCount: parseInt(segMatch[1]) },
            });
          }
        }

        this.emit("stdout", output);
      });

      this.currentProcess.stderr.on("data", (data) => {
        const error = data.toString();
        stderr += error;

        console.log("[TRANSCRIPTION STDERR]:", error);

        // Look for progress indicators in stderr (Whisper outputs progress here)
        if (error.includes("%")) {
          const progressMatch = error.match(/(\d+)%/);
          if (progressMatch) {
            const progress = Math.max(
              20,
              Math.min(85, parseInt(progressMatch[1])),
            );
            this.emit("progress", {
              progress,
              step: "Processing audio...",
              phase: "transcription",
              details: { completion: `${progressMatch[1]}%` },
            });
          }
        }

        // Check for specific error types
        if (
          error.includes("ModuleNotFoundError") ||
          error.includes("ImportError")
        ) {
          this.emit("error", { type: "missing_dependency", message: error });
        } else if (error.includes("FileNotFoundError")) {
          this.emit("error", { type: "file_not_found", message: error });
        } else if (
          error.includes("Error:") ||
          error.includes("CUDA") ||
          error.includes("RuntimeError")
        ) {
          this.emit("error", { type: "transcription_error", message: error });
        }

        this.emit("stderr", error);
      });

      // Add timeout for the process (10 minutes for large files)
      const timeout = setTimeout(
        () => {
          if (this.currentProcess) {
            console.log("[TRANSCRIPTION] Process timeout - killing process");
            this.currentProcess.kill("SIGTERM");
            this.currentProcess = null;
            reject({
              success: false,
              error: "Transcription timed out after 10 minutes",
              stdout,
              stderr,
            });
          }
        },
        10 * 60 * 1000,
      ); // 10 minutes

      this.currentProcess.on("close", async (code, signal) => {
        clearTimeout(timeout);
        this.currentProcess = null;

        console.log(
          `[TRANSCRIPTION] Process exited with code: ${code}, signal: ${signal}`,
        );

        // Handle null exit code or successful completion
        const isSuccess =
          code === 0 || (code === null && !stderr.includes("Error"));

        if (isSuccess) {
          try {
            // Check if output file exists and read transcription data
            const stats = await fs.stat(outputPath);
            const transcriptionData = JSON.parse(
              await fs.readFile(outputPath, "utf8"),
            );

            let result = {
              success: true,
              outputPath: outputPath,
              originalPath: filePath,
              transcription: transcriptionData,
              language: transcriptionData.language || "unknown",
              segmentCount: transcriptionData.segments?.length || 0,
              fileSize: stats.size,
              model: model,
              processedAt: new Date().toISOString(),
            };

            // If text overlay is requested, process video with captions
            if (addTextOverlay) {
              try {
                this.emit("progress", {
                  progress: 85,
                  step: "Adding text overlay to video...",
                  phase: "video_overlay",
                  details: {
                    segmentCount: transcriptionData.segments?.length || 0,
                  },
                });

                const videoWithCaptions = await this.addTextOverlayToVideo(
                  filePath,
                  transcriptionData,
                  normalizedTextStyle,
                  outputDir,
                  subtitlePositions,
                );

                result.videoOutputPath = videoWithCaptions;

                this.emit("progress", {
                  progress: 100,
                  step: "Video with text overlay completed",
                  phase: "complete",
                  details: { outputPath: videoWithCaptions },
                });
              } catch (overlayError) {
                console.error(
                  "[TRANSCRIPTION] Text overlay failed:",
                  overlayError,
                );
                result.overlayError = overlayError.message;
                this.emit("progress", {
                  progress: 100,
                  step: "Transcription completed (text overlay failed)",
                });
              }
            } else {
              this.emit("progress", {
                progress: 100,
                step: "Transcription completed",
              });
            }

            this.emit("complete", result);
            resolve(result);
          } catch (error) {
            const errorResult = {
              success: false,
              error: `Failed to read transcription output: ${error.message}`,
              stdout,
              stderr,
            };
            this.emit("error", errorResult);
            resolve(errorResult);
          }
        } else {
          const errorResult = {
            success: false,
            error: `Transcription process failed with code ${code}`,
            stdout,
            stderr,
          };
          this.emit("error", errorResult);
          reject(errorResult);
        }
      });

      this.currentProcess.on("error", (error) => {
        clearTimeout(timeout);
        this.currentProcess = null;
        const errorResult = {
          success: false,
          error: `Failed to start transcription process: ${error.message}`,
          stdout,
          stderr,
        };
        this.emit("error", errorResult);
        reject(errorResult);
      });
    });
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
  async addTextOverlayToVideo(
    videoPath,
    transcriptionData,
    textStyle,
    outputDir,
    subtitlePositions = null,
  ) {
    const { spawn } = require("child_process");
    const videoFileName = path.basename(videoPath, path.extname(videoPath));
    const outputPath = path.join(
      outputDir,
      `${videoFileName}_with_captions.mp4`,
    );

    console.log("[VIDEO OVERLAY] Starting Python-based overlay process...");

    return new Promise((resolve, reject) => {
      // Fix path resolution for development vs production
      const { app } = require("electron");
      const isDev = !app.isPackaged;

      let overlayScript;
      if (isDev) {
        // Development: use src directory
        overlayScript = path.join(
          process.cwd(),
          "src",
          "python",
          "transcription",
          "overlay_subtitles.py",
        );
      } else {
        // Production: use resourcesPath with correct structure
        overlayScript = path.join(
          process.resourcesPath,
          "src",
          "python",
          "transcription",
          "overlay_subtitles.py",
        );
      }

      console.log(`[VIDEO OVERLAY] Development mode: ${isDev}`);
      console.log(`[VIDEO OVERLAY] Using script path: ${overlayScript}`);
      console.log(
        `[VIDEO OVERLAY] process.resourcesPath: ${process.resourcesPath}`,
      );
      console.log(`[VIDEO OVERLAY] process.cwd(): ${process.cwd()}`);

      const args = [
        overlayScript,
        videoPath,
        JSON.stringify(transcriptionData),
        outputPath,
        "--text-style",
        JSON.stringify(textStyle || {}),
        "--subtitle-positions",
        JSON.stringify(subtitlePositions || []),
      ];

      console.log(
        `[VIDEO OVERLAY] Running: python ${args[0]} [transcription-data] ${args[2]} ...`,
      );

      const overlayProcess = spawn("python", args, {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: process.cwd(),
      });

      let stdout = "";
      let stderr = "";

      overlayProcess.stdout.on("data", (data) => {
        const output = data.toString();
        stdout += output;
        console.log("[VIDEO OVERLAY]", output.trim());
      });

      overlayProcess.stderr.on("data", (data) => {
        const error = data.toString();
        stderr += error;
        console.log("[VIDEO OVERLAY ERROR]", error.trim());
      });

      const timeout = setTimeout(
        () => {
          overlayProcess.kill("SIGTERM");
          reject(new Error("Video overlay process timed out after 5 minutes"));
        },
        5 * 60 * 1000,
      );

      overlayProcess.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`Video overlay failed: ${stderr || stdout}`));
        }
      });

      overlayProcess.on("error", (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start overlay process: ${error.message}`));
      });
    });
  }

  /**
   * Cancels the current transcription process
   * @returns {boolean} True if process was cancelled, false if no process running
   */
  cancelTranscription() {
    if (this.currentProcess) {
      this.currentProcess.kill("SIGTERM");
      this.currentProcess = null;
      this.emit("cancelled");
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
        name: "tiny",
        size: "39 MB",
        speed: "Very Fast",
        accuracy: "Lower",
        description: "Fastest processing, good for quick previews",
      },
      {
        name: "base",
        size: "74 MB",
        speed: "Fast",
        accuracy: "Good",
        description:
          "Balanced speed and accuracy, recommended for most use cases",
      },
      {
        name: "small",
        size: "244 MB",
        speed: "Medium",
        accuracy: "Better",
        description: "Better accuracy with moderate speed",
      },
      {
        name: "medium",
        size: "769 MB",
        speed: "Slow",
        accuracy: "High",
        description: "High accuracy, slower processing",
      },
      {
        name: "large",
        size: "1550 MB",
        speed: "Very Slow",
        accuracy: "Highest",
        description: "Best accuracy, slowest processing",
      },
    ];
  }
}

module.exports = { TranscriptionBridge };

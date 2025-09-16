const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs").promises;
const EventEmitter = require("events");
const { app } = require("electron");

class PythonBridge extends EventEmitter {
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
    this.processingStartTime = null;
    this.stepStartTime = null;
    this.stepTimes = new Map();

    // Determine if we're in development or production
    if (isDev) {
      // Development: use Python interpreter and source files
      this.pythonPath = "python";
      this.scriptPath = path.join(__dirname, "../../python/ai_pipeline.py");
      this.useBundled = false;
    } else {
      // Production: try bundled executable, fallback to Python if not found
      this.bundledExecutablePath = this.getBundledExecutablePath();
      this.pythonPath = "python";
      this.scriptPath = this.getBundledScriptPath();
      this.useBundled = this.checkBundledExecutable();

      console.log(
        `Bundled executable check: ${this.bundledExecutablePath} exists: ${this.useBundled}`,
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
    const executableName = isWindows ? "ai_pipeline.exe" : "ai_pipeline";

    return path.join(pythonDir, "ai_pipeline", executableName);
  }

  getBundledScriptPath() {
    // In production, Python scripts are bundled as extraResources at resources/src/python/
    const resourcesPath =
      process.resourcesPath || path.join(process.cwd(), "resources");
    return path.join(resourcesPath, "src", "python", "ai_pipeline.py");
  }

  checkBundledExecutable() {
    try {
      const fs = require("fs");
      const exists = fs.existsSync(this.bundledExecutablePath);
      console.log(
        `Bundled executable check: ${this.bundledExecutablePath} exists: ${exists}`,
      );
      return exists;
    } catch (error) {
      console.error("Error checking bundled executable:", error);
      return false;
    }
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log(`Temp directory ensured: ${this.tempDir}`);
    } catch (error) {
      console.error("Failed to create temp directory:", error);
      throw error;
    }
  }

  async checkPythonDependencies() {
    return new Promise((resolve) => {
      const checkProcess = spawn(this.pythonPath, [
        "-c",
        'import whisper, openai, moviepy; print("Dependencies OK")',
      ]);

      let output = "";
      let errorOutput = "";

      checkProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      checkProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      checkProcess.on("close", (code) => {
        if (code === 0 && output.includes("Dependencies OK")) {
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: `Python dependencies missing. Error: ${errorOutput}`,
          });
        }
      });

      checkProcess.on("error", (error) => {
        resolve({
          success: false,
          error: `Python not found or not executable: ${error.message}`,
        });
      });
    });
  }

  async processVideo(videoPath, options = {}) {
    if (!videoPath || typeof videoPath !== "string") {
      throw new Error(
        `Invalid videoPath: expected string, got ${typeof videoPath}: ${videoPath}`,
      );
    }

    await this.ensureTempDir();

    const {
      outputDir = path.join(this.tempDir, "output"),
      openaiKey = null,
      maxClips = 5,
      minDuration = 30,
      maxDuration = 90,
      focusOnHighEnergy = true,
      includeActionableContent = true,
      includeEmotionalPeaks = true,
      includeInsights = true,
    } = options;

    return new Promise((resolve, reject) => {
      let command, args;

      if (this.useBundled) {
        // Production: use bundled executable
        command = this.bundledExecutablePath;
        args = [
          videoPath,
          "--output-dir",
          outputDir,
          "--max-clips",
          maxClips.toString(),
          "--min-duration",
          minDuration.toString(),
          "--max-duration",
          maxDuration.toString(),
          "--temp-dir",
          this.tempDir,
        ];
      } else {
        // Development: use Python interpreter
        command = this.pythonPath;
        args = [
          this.scriptPath,
          videoPath,
          "--output-dir",
          outputDir,
          "--max-clips",
          maxClips.toString(),
          "--min-duration",
          minDuration.toString(),
          "--max-duration",
          maxDuration.toString(),
          "--temp-dir",
          this.tempDir,
        ];
      }

      // Add content preference flags
      if (focusOnHighEnergy) {
        args.push("--focus-high-energy");
      }
      if (includeActionableContent) {
        args.push("--include-actionable");
      }
      if (includeEmotionalPeaks) {
        args.push("--include-emotional");
      }
      if (includeInsights) {
        args.push("--include-insights");
      }

      if (openaiKey) {
        args.push("--openai-key", openaiKey);
      }

      console.log(`Starting Python AI pipeline with command: ${command}`);
      console.log(`Args: ${JSON.stringify(args, null, 2)}`);

      // Track processing start time
      this.processingStartTime = Date.now();
      this.stepStartTime = Date.now();
      this.stepTimes.clear();

      this.currentProcess = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";

      this.currentProcess.stdout.on("data", (data) => {
        const output = data.toString();
        stdout += output;

        // Parse progress updates with detailed information
        const progressMatch = output.match(/\[(\d+\.\d+)%\] (.+)/);
        if (progressMatch) {
          const progress = parseFloat(progressMatch[1]);
          const step = progressMatch[2];
          const now = Date.now();

          // Calculate step duration if this is a new step
          const lastStepTime = this.stepTimes.get(step);
          let stepDuration = null;

          if (lastStepTime) {
            stepDuration = now - lastStepTime;
          } else if (this.stepStartTime) {
            stepDuration = now - this.stepStartTime;
            this.stepTimes.set(step, now);
            this.stepStartTime = now;
          }

          // Parse additional details from output
          const detailsMatch = output.match(/Details: (.+)/);
          const details = detailsMatch ? detailsMatch[1].trim() : "";

          // Calculate total elapsed time
          const totalElapsed = this.processingStartTime
            ? now - this.processingStartTime
            : 0;

          this.emit("progress", {
            progress,
            step,
            stepDuration,
            totalElapsed,
            details,
          });
        }

        // Parse specific step completion messages
        const stepCompleteMatch = output.match(/Completed: (.+) in (.+)/);
        if (stepCompleteMatch) {
          const completedStep = stepCompleteMatch[1];
          const duration = stepCompleteMatch[2];

          this.emit("progress", {
            progress: null, // Don't update progress bar
            step: `✓ ${completedStep}`,
            stepDuration: duration,
            details: `Completed in ${duration}`,
          });
        }

        // Emit raw output for debugging
        this.emit("stdout", output);
      });

      this.currentProcess.stderr.on("data", (data) => {
        const error = data.toString();
        stderr += error;
        this.emit("stderr", error);

        // Check for specific error types
        if (error.includes("ModuleNotFoundError")) {
          this.emit("error", { type: "missing_dependency", message: error });
        }
      });

      this.currentProcess.on("close", async (code) => {
        this.currentProcess = null;

        console.log(`Python process closed with code: ${code}`);
        console.log(`STDOUT: ${stdout}`);
        console.log(`STDERR: ${stderr}`);

        if (code === 0) {
          try {
            // Try to read results file
            const videoName = path.basename(videoPath, path.extname(videoPath));
            const resultsPath = path.join(
              outputDir,
              `${videoName}_results.json`,
            );

            console.log(`Looking for results file at: ${resultsPath}`);
            const resultsData = await fs.readFile(resultsPath, "utf-8");
            const results = JSON.parse(resultsData);

            resolve(results);
          } catch (error) {
            console.error(`Failed to read results file: ${error.message}`);
            resolve({
              success: false,
              error: `Failed to read results: ${error.message}`,
              stdout,
              stderr,
            });
          }
        } else {
          reject({
            success: false,
            error: `Python process exited with code ${code}`,
            stdout,
            stderr,
          });
        }
      });

      this.currentProcess.on("error", (error) => {
        this.currentProcess = null;

        let errorMessage = `Failed to start Python process: ${error.message}`;

        if (this.useBundled && error.code === "ENOENT") {
          errorMessage +=
            "\n\nThe bundled executable was not found. This might be because:";
          errorMessage +=
            "\n1. The Python scripts were not bundled with the application";
          errorMessage += "\n2. You need to install Python on your system";
          errorMessage += "\n3. Python is not in your system PATH";
          errorMessage +=
            "\n\nPlease install Python 3.8+ and required dependencies (whisper, openai, moviepy)";
        } else if (error.code === "ENOENT") {
          errorMessage +=
            "\n\nPython was not found. Please install Python 3.8+ and required dependencies.";
        }

        reject({
          success: false,
          error: errorMessage,
          stdout,
          stderr,
          usedBundled: this.useBundled,
          bundledPath: this.bundledExecutablePath,
        });
      });
    });
  }

  cancelProcessing() {
    if (this.currentProcess) {
      this.currentProcess.kill("SIGTERM");
      this.currentProcess = null;

      // Reset timing information
      this.processingStartTime = null;
      this.stepStartTime = null;
      this.stepTimes.clear();

      this.emit("cancelled");
      return true;
    }
    return false;
  }

  async getVideoInfo(videoPath) {
    const isDev = !app.isPackaged;
    const scriptPath = isDev
      ? path.join(__dirname, "../../python/editing/video_processor.py")
      : path.join(
          process.resourcesPath,
          "src",
          "python",
          "editing",
          "video_processor.py",
        );

    return new Promise((resolve, reject) => {
      const process = spawn(this.pythonPath, [
        scriptPath,
        videoPath,
        "--command",
        "info",
      ]);

      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(stdout);
            resolve(info);
          } catch (error) {
            reject({ error: "Failed to parse video info", stderr });
          }
        } else {
          reject({ error: `Process exited with code ${code}`, stderr });
        }
      });

      process.on("error", (error) => {
        reject({ error: `Failed to get video info: ${error.message}` });
      });
    });
  }

  async extractAudio(videoPath, outputPath = null) {
    const isDev = !app.isPackaged;
    const scriptPath = isDev
      ? path.join(__dirname, "../../python/editing/video_processor.py")
      : path.join(
          process.resourcesPath,
          "src",
          "python",
          "editing",
          "video_processor.py",
        );

    return new Promise((resolve, reject) => {
      const args = [scriptPath, videoPath, "--command", "extract_audio"];

      if (outputPath) {
        args.push("--output", outputPath);
      }

      const process = spawn(this.pythonPath, args);

      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0) {
          // Extract audio file path from output
          const audioPathMatch = stdout.match(/Audio extracted to: (.+)/);
          if (audioPathMatch) {
            resolve({ audioPath: audioPathMatch[1].trim() });
          } else {
            resolve({ audioPath: outputPath });
          }
        } else {
          reject({
            error: `Audio extraction failed with code ${code}`,
            stderr,
          });
        }
      });

      process.on("error", (error) => {
        reject({ error: `Failed to extract audio: ${error.message}` });
      });
    });
  }
}

module.exports = { PythonBridge };

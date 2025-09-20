const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  protocol,
  safeStorage,
} = require("electron");
const path = require("path");
const fs = require("fs");
const isDev = !app.isPackaged; // More reliable way to detect development mode

// Set up logging for production
const LOG_FILE_PATH = path.join(app.getPath("userData"), "app.log");

function logToFile(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message} ${args
    .map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
    )
    .join(" ")}\n`;

  try {
    fs.appendFileSync(LOG_FILE_PATH, logMessage);
  } catch (error) {
    // Fallback to console if file logging fails
    console.error("Failed to write to log file:", error);
  }
}

// Override console methods to also log to file in production
if (!isDev) {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  console.log = (...args) => {
    originalConsoleLog(...args);
    logToFile("INFO", ...args);
  };

  console.error = (...args) => {
    originalConsoleError(...args);
    logToFile("ERROR", ...args);
  };

  console.warn = (...args) => {
    originalConsoleWarn(...args);
    logToFile("WARN", ...args);
  };
}

// Log startup immediately
console.log("AI Video Editor starting...");
console.log("isDev:", isDev);
console.log("App path:", app.getAppPath());
console.log("User data path:", app.getPath("userData"));
console.log("Log file path:", LOG_FILE_PATH);

const { PythonBridge } = require("./ai-engine/python-bridge");
const { JumpcutterBridge } = require("./ai-engine/jumpcutter-bridge");
const { TranscriptionBridge } = require("./ai-engine/transcription-bridge");
const { Database } = require("./database/database");

let mainWindow;

// Process management
const activeProcesses = new Set();

function registerProcess(bridge, processName) {
  activeProcesses.add({ bridge, processName });
}

function unregisterProcess(bridge) {
  activeProcesses.forEach((item) => {
    if (item.bridge === bridge) {
      activeProcesses.delete(item);
    }
  });
}

function killAllProcesses() {
  console.log('Killing all active processes...');
  activeProcesses.forEach((item) => {
    try {
      if (item.bridge && typeof item.bridge.cancelProcessing === 'function') {
        console.log(`Killing ${item.processName} process`);
        item.bridge.cancelProcessing();
      }
    } catch (error) {
      console.error(`Error killing ${item.processName} process:`, error);
    }
  });
  activeProcesses.clear();
}

// Register protocol schemes before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: "safe-video",
    privileges: {
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false, // Allow custom protocols during development
    },
    show: false,
    titleBarStyle: "default",
  });

  const startUrl = isDev
    ? "http://localhost:5173"
    : `file://${path.join(__dirname, "../../dist/renderer/index.html")}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Add keyboard shortcut to open dev tools in production (Ctrl+Shift+I)
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === "i") {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Cleanup processes when window is about to close
  mainWindow.on("close", (event) => {
    console.log('Window closing, cleaning up processes...');
    killAllProcesses();
  });
}

app.whenReady().then(async () => {
  // Register secure video protocol
  protocol.registerFileProtocol("safe-video", (request, callback) => {
    console.log("Protocol handler called with request:", request.url);
    const url = request.url.substring("safe-video://".length);
    const decodedPath = decodeURIComponent(url);
    console.log("Decoded path:", decodedPath);

    // Security: Only allow video files and verify path exists
    const allowedExtensions = [
      ".mp4",
      ".avi",
      ".mov",
      ".mkv",
      ".wmv",
      ".flv",
      ".webm",
    ];
    const extension = path.extname(decodedPath).toLowerCase();
    console.log("File extension:", extension);

    if (!allowedExtensions.includes(extension)) {
      console.error("Blocked non-video file access:", decodedPath);
      callback({ error: -6 }); // FILE_NOT_FOUND
      return;
    }

    // Verify file exists and is readable
    fs.access(decodedPath, fs.constants.R_OK, (err) => {
      if (err) {
        console.error("File access denied:", decodedPath, err);
        callback({ error: -6 });
        return;
      }

      // Security: Normalize path to prevent directory traversal
      const normalizedPath = path.normalize(decodedPath);
      console.log("Successfully serving file:", normalizedPath);
      callback({ path: normalizedPath });
    });
  });

  // Initialize database
  await database.initialize();
  createWindow();
});

app.on("window-all-closed", () => {
  console.log('All windows closed, killing processes...');
  killAllProcesses();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  console.log('App before quit, killing processes...');
  killAllProcesses();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("select-video-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      {
        name: "Video Files",
        extensions: ["mp4", "avi", "mov", "mkv", "wmv", "flv", "webm"],
      },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  console.log("result.filePaths[0]: " + result.filePaths[0]);

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle("get-app-path", () => {
  return app.getAppPath();
});

// Get video file as buffer for blob URL creation
ipcMain.handle("get-video-buffer", async (event, videoPath) => {
  try {
    // Validate that it's a video file
    const allowedExtensions = [
      ".mp4",
      ".avi",
      ".mov",
      ".mkv",
      ".wmv",
      ".flv",
      ".webm",
    ];
    const extension = path.extname(videoPath).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return { success: false, error: "Invalid file type" };
    }

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return { success: false, error: "File not found" };
    }

    // Read file as buffer
    const buffer = await fs.promises.readFile(videoPath);
    const mimeType = getMimeType(extension);

    return {
      success: true,
      buffer: Array.from(buffer), // Convert buffer to array for JSON serialization
      mimeType,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Secure video URL generation (fallback)
ipcMain.handle("get-video-preview-url", (event, videoPath) => {
  try {
    // Validate that it's a video file
    const allowedExtensions = [
      ".mp4",
      ".avi",
      ".mov",
      ".mkv",
      ".wmv",
      ".flv",
      ".webm",
    ];
    const extension = path.extname(videoPath).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return { success: false, error: "Invalid file type" };
    }

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return { success: false, error: "File not found" };
    }

    // Generate secure URL
    const encodedPath = encodeURIComponent(videoPath);
    const secureUrl = `safe-video://${encodedPath}`;

    return { success: true, url: secureUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Helper function to get MIME type
function getMimeType(extension) {
  const mimeTypes = {
    ".mp4": "video/mp4",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".wmv": "video/x-ms-wmv",
    ".flv": "video/x-flv",
    ".webm": "video/webm",
  };
  return mimeTypes[extension] || "video/mp4";
}

// Initialize Python bridge, jumpcutter bridge, transcription bridge and database
const pythonBridge = new PythonBridge();
const jumpcutterBridge = new JumpcutterBridge();
const transcriptionBridge = new TranscriptionBridge();
const database = new Database();

// Video processing handlers
ipcMain.handle("check-python-dependencies", async () => {
  try {
    const result = await pythonBridge.checkPythonDependencies();
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-video-info", async (event, videoPath) => {
  try {
    const info = await pythonBridge.getVideoInfo(videoPath);
    return { success: true, info };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("process-video", async (event, videoPath, options = {}) => {
  try {
    // Register the process
    registerProcess(pythonBridge, 'AI Pipeline');

    // Set up progress forwarding
    pythonBridge.on("progress", (progressData) => {
      mainWindow.webContents.send("processing-progress", progressData);
    });

    pythonBridge.on("error", (errorData) => {
      mainWindow.webContents.send("processing-error", errorData);
    });

    const result = await pythonBridge.processVideo(videoPath, options);

    // Unregister when complete
    unregisterProcess(pythonBridge);

    if (result.success) {
      mainWindow.webContents.send("processing-complete", result);
    }

    return result;
  } catch (error) {
    console.error("Process video error:", error);
    // Make sure to unregister on error
    unregisterProcess(pythonBridge);
    const errorResult = {
      success: false,
      error: error.message,
      stack: error.stack,
      details: error.toString(),
    };
    mainWindow.webContents.send("processing-error", errorResult);
    return errorResult;
  }
});

ipcMain.handle("cancel-processing", () => {
  unregisterProcess(pythonBridge);
  return pythonBridge.cancelProcessing();
});

// Jumpcutter (quiet parts removal) handlers
ipcMain.handle("check-jumpcutter-dependencies", async () => {
  try {
    const result = await jumpcutterBridge.checkDependencies();
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "process-quiet-parts",
  async (event, videoPath, options = {}) => {
    try {
      // Register the process
      registerProcess(jumpcutterBridge, 'Jumpcutter');

      // Set up progress forwarding for jumpcutter
      jumpcutterBridge.on("progress", (progressData) => {
        mainWindow.webContents.send("jumpcutter-progress", progressData);
      });

      jumpcutterBridge.on("error", (errorData) => {
        mainWindow.webContents.send("jumpcutter-error", errorData);
      });

      const result = await jumpcutterBridge.processVideo(videoPath, options);

      // Unregister when complete
      unregisterProcess(jumpcutterBridge);

      if (result.success) {
        mainWindow.webContents.send("jumpcutter-complete", result);
      }

      return result;
    } catch (error) {
      // Make sure to unregister on error
      unregisterProcess(jumpcutterBridge);
      const errorResult = { success: false, error: error.message };
      mainWindow.webContents.send("jumpcutter-error", errorResult);
      return errorResult;
    }
  },
);

ipcMain.handle("cancel-jumpcutter-processing", () => {
  unregisterProcess(jumpcutterBridge);
  return jumpcutterBridge.cancelProcessing();
});

ipcMain.handle("get-quiet-parts-analysis", async (event, videoPath) => {
  try {
    const analysis = await jumpcutterBridge.getVideoAnalysis(videoPath);
    return { success: true, analysis };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Transcription handlers
ipcMain.handle("check-transcription-dependencies", async () => {
  try {
    return await transcriptionBridge.checkDependencies();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("transcribe-video", async (event, videoPath, options = {}) => {
  try {
    // Register the process
    registerProcess(transcriptionBridge, 'Transcription');
    const result = await transcriptionBridge.transcribeFile(videoPath, options);
    // Unregister when complete
    unregisterProcess(transcriptionBridge);
    return result;
  } catch (error) {
    // Make sure to unregister on error
    unregisterProcess(transcriptionBridge);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("cancel-transcription", () => {
  unregisterProcess(transcriptionBridge);
  return transcriptionBridge.cancelTranscription();
});

// Kill all active processes handler
ipcMain.handle("kill-all-processes", () => {
  try {
    killAllProcesses();
    return { success: true, message: "All processes killed successfully" };
  } catch (error) {
    console.error("Error killing all processes:", error);
    return { success: false, error: error.message };
  }
});

// Get active processes count
ipcMain.handle("get-active-processes", () => {
  const processes = Array.from(activeProcesses).map(item => item.processName);
  return { success: true, count: activeProcesses.size, processes };
});

ipcMain.handle("get-available-models", () => {
  return { success: true, models: transcriptionBridge.getAvailableModels() };
});

// Forward transcription events to renderer
transcriptionBridge.on("progress", (progressData) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("transcription-progress", progressData);
  }
});

transcriptionBridge.on("complete", (result) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("transcription-complete", result);
  }
});

transcriptionBridge.on("error", (error) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("transcription-error", error);
  }
});

transcriptionBridge.on("cancelled", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("transcription-cancelled");
  }
});

// Database handlers
ipcMain.handle("create-project", async (event, projectData) => {
  try {
    const result = await database.createProject(projectData);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-projects", async (event, limit, offset) => {
  try {
    const projects = await database.getProjects(limit, offset);
    return { success: true, projects };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-project", async (event, projectId) => {
  try {
    const project = await database.getProject(projectId);
    return { success: true, project };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("save-clips", async (event, projectId, clips) => {
  try {
    const savedClips = [];
    for (const clip of clips) {
      const result = await database.saveClip({ ...clip, projectId });
      savedClips.push(result);
    }
    return { success: true, clips: savedClips };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-clips", async (event, projectId) => {
  try {
    const clips = await database.getClips(projectId);
    return { success: true, clips };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open folder in file explorer
ipcMain.handle("open-folder", async (event, folderPath) => {
  try {
    await shell.openPath(folderPath);
    return { success: true };
  } catch (error) {
    console.error("Failed to open folder:", error);
    return { success: false, error: error.message };
  }
});

// Show file in folder (reveal in file explorer)
ipcMain.handle("show-file-in-folder", async (event, filePath) => {
  try {
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    console.error("Failed to show file in folder:", error);
    return { success: false, error: error.message };
  }
});

// Show generated clips in folder
ipcMain.handle("show-clips-in-folder", async () => {
  try {
    // Use correct temp directory based on environment
    const isDev = !app.isPackaged;
    const tempDir = isDev
      ? path.join(__dirname, "../../temp")
      : path.join(app.getPath("userData"), "temp");
    const outputDir = path.join(tempDir, "output");

    console.log(`Looking for clips in: ${outputDir}`);

    // Check if output directory exists
    if (fs.existsSync(outputDir)) {
      await shell.openPath(outputDir);
      return { success: true };
    } else {
      // Fall back to temp directory if output doesn't exist
      console.log(`Output directory not found, opening temp: ${tempDir}`);
      await shell.openPath(tempDir);
      return {
        success: true,
        message: "Opened temp directory - output folder not found",
      };
    }
  } catch (error) {
    console.error("Failed to show clips folder:", error);
    return { success: false, error: error.message };
  }
});

// Settings storage handlers
const SETTINGS_FILE_PATH = path.join(
  app.getPath("userData"),
  "app-settings.json",
);

// Helper to load settings from file
function loadSettingsFromFile() {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const data = fs.readFileSync(SETTINGS_FILE_PATH, "utf8");
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error("Failed to load settings:", error);
    return {};
  }
}

// Helper to save settings to file
function saveSettingsToFile(settings) {
  try {
    const dir = path.dirname(SETTINGS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error("Failed to save settings:", error);
    return false;
  }
}

ipcMain.handle(
  "save-setting",
  async (event, key, value, isEncrypted = false) => {
    try {
      const settings = loadSettingsFromFile();

      if (isEncrypted && safeStorage.isEncryptionAvailable()) {
        // Encrypt sensitive values like API keys
        const encryptedBuffer = safeStorage.encryptString(value);
        settings[key] = {
          encrypted: true,
          value: encryptedBuffer.toString("base64"),
        };
      } else {
        // Store non-sensitive values as plain text
        settings[key] = {
          encrypted: false,
          value: value,
        };
      }

      const success = saveSettingsToFile(settings);
      return {
        success,
        message: success
          ? "Setting saved successfully"
          : "Failed to save setting",
      };
    } catch (error) {
      console.error("Error saving setting:", error);
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle("get-setting", async (event, key, defaultValue = null) => {
  try {
    const settings = loadSettingsFromFile();

    if (!settings[key]) {
      return { success: true, value: defaultValue };
    }

    const setting = settings[key];

    if (setting.encrypted && safeStorage.isEncryptionAvailable()) {
      // Decrypt the value
      try {
        const buffer = Buffer.from(setting.value, "base64");
        const decryptedValue = safeStorage.decryptString(buffer);
        return { success: true, value: decryptedValue };
      } catch (decryptError) {
        console.error("Failed to decrypt setting:", decryptError);
        return { success: false, error: "Failed to decrypt setting" };
      }
    } else {
      // Return plain text value
      return { success: true, value: setting.value };
    }
  } catch (error) {
    console.error("Error getting setting:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-all-settings", async () => {
  try {
    const settings = loadSettingsFromFile();
    const decryptedSettings = {};

    for (const [key, setting] of Object.entries(settings)) {
      if (setting.encrypted && safeStorage.isEncryptionAvailable()) {
        try {
          const buffer = Buffer.from(setting.value, "base64");
          const decryptedValue = safeStorage.decryptString(buffer);
          decryptedSettings[key] = decryptedValue;
        } catch (decryptError) {
          console.error(`Failed to decrypt setting ${key}:`, decryptError);
          decryptedSettings[key] = null;
        }
      } else {
        decryptedSettings[key] = setting.value;
      }
    }

    return { success: true, settings: decryptedSettings };
  } catch (error) {
    console.error("Error getting all settings:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("delete-setting", async (event, key) => {
  try {
    const settings = loadSettingsFromFile();
    delete settings[key];
    const success = saveSettingsToFile(settings);
    return {
      success,
      message: success
        ? "Setting deleted successfully"
        : "Failed to delete setting",
    };
  } catch (error) {
    console.error("Error deleting setting:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("is-encryption-available", () => {
  return { available: safeStorage.isEncryptionAvailable() };
});

// Open external URL
ipcMain.handle("open-external", async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error("Failed to open external URL:", error);
    return { success: false, error: error.message };
  }
});

// Open video file in default player
ipcMain.handle("open-video-file", async (event, videoPath) => {
  try {
    if (!fs.existsSync(videoPath)) {
      return { success: false, error: "Video file not found" };
    }
    await shell.openPath(videoPath);
    return { success: true };
  } catch (error) {
    console.error("Failed to open video file:", error);
    return { success: false, error: error.message };
  }
});

// Get log file path for debugging
ipcMain.handle("get-log-file-path", () => {
  return { success: true, path: LOG_FILE_PATH };
});

// Open log file in default text editor
ipcMain.handle("open-log-file", async () => {
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      await shell.openPath(LOG_FILE_PATH);
      return { success: true };
    } else {
      return { success: false, error: "Log file does not exist" };
    }
  } catch (error) {
    console.error("Failed to open log file:", error);
    return { success: false, error: error.message };
  }
});

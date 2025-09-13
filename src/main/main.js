const { app, BrowserWindow, ipcMain, dialog, shell, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = !app.isPackaged; // More reliable way to detect development mode
const { PythonBridge } = require('./ai-engine/python-bridge');
const { JumpcutterBridge } = require('./ai-engine/jumpcutter-bridge');
const { TranscriptionBridge } = require('./ai-engine/transcription-bridge');
const { Database } = require('./database/database');

let mainWindow;

// Register protocol schemes before app is ready
protocol.registerSchemesAsPrivileged([{
  scheme: 'safe-video',
  privileges: {
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true
  }
}]);

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
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // Allow custom protocols during development
    },
    show: false,
    titleBarStyle: 'default'
  });

  const startUrl = isDev 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, '../../dist/renderer/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Register secure video protocol
  protocol.registerFileProtocol('safe-video', (request, callback) => {
    console.log('Protocol handler called with request:', request.url);
    const url = request.url.substring('safe-video://'.length);
    const decodedPath = decodeURIComponent(url);
    console.log('Decoded path:', decodedPath);

    // Security: Only allow video files and verify path exists
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'];
    const extension = path.extname(decodedPath).toLowerCase();
    console.log('File extension:', extension);

    if (!allowedExtensions.includes(extension)) {
      console.error('Blocked non-video file access:', decodedPath);
      callback({ error: -6 }); // FILE_NOT_FOUND
      return;
    }

    // Verify file exists and is readable
    fs.access(decodedPath, fs.constants.R_OK, (err) => {
      if (err) {
        console.error('File access denied:', decodedPath, err);
        callback({ error: -6 });
        return;
      }

      // Security: Normalize path to prevent directory traversal
      const normalizedPath = path.normalize(decodedPath);
      console.log('Successfully serving file:', normalizedPath);
      callback({ path: normalizedPath });
    });
  });

  // Initialize database
  await database.initialize();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('select-video-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

// Get video file as buffer for blob URL creation
ipcMain.handle('get-video-buffer', async (event, videoPath) => {
  try {
    // Validate that it's a video file
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'];
    const extension = path.extname(videoPath).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return { success: false, error: 'Invalid file type' };
    }

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return { success: false, error: 'File not found' };
    }

    // Read file as buffer
    const buffer = await fs.promises.readFile(videoPath);
    const mimeType = getMimeType(extension);

    return {
      success: true,
      buffer: Array.from(buffer), // Convert buffer to array for JSON serialization
      mimeType
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Secure video URL generation (fallback)
ipcMain.handle('get-video-preview-url', (event, videoPath) => {
  try {
    // Validate that it's a video file
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'];
    const extension = path.extname(videoPath).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return { success: false, error: 'Invalid file type' };
    }

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return { success: false, error: 'File not found' };
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
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.webm': 'video/webm'
  };
  return mimeTypes[extension] || 'video/mp4';
}

// Initialize Python bridge, jumpcutter bridge, transcription bridge and database
const pythonBridge = new PythonBridge();
const jumpcutterBridge = new JumpcutterBridge();
const transcriptionBridge = new TranscriptionBridge();
const database = new Database();

// Video processing handlers
ipcMain.handle('check-python-dependencies', async () => {
  try {
    const result = await pythonBridge.checkPythonDependencies();
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-video-info', async (event, videoPath) => {
  try {
    const info = await pythonBridge.getVideoInfo(videoPath);
    return { success: true, info };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('process-video', async (event, videoPath, options = {}) => {
  try {
    // Set up progress forwarding
    pythonBridge.on('progress', (progressData) => {
      mainWindow.webContents.send('processing-progress', progressData);
    });

    pythonBridge.on('error', (errorData) => {
      mainWindow.webContents.send('processing-error', errorData);
    });

    const result = await pythonBridge.processVideo(videoPath, options);
    
    if (result.success) {
      mainWindow.webContents.send('processing-complete', result);
    }
    
    return result;
  } catch (error) {
    const errorResult = { success: false, error: error.message };
    mainWindow.webContents.send('processing-error', errorResult);
    return errorResult;
  }
});

ipcMain.handle('cancel-processing', () => {
  return pythonBridge.cancelProcessing();
});

// Jumpcutter (quiet parts removal) handlers
ipcMain.handle('check-jumpcutter-dependencies', async () => {
  try {
    const result = await jumpcutterBridge.checkDependencies();
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('process-quiet-parts', async (event, videoPath, options = {}) => {
  try {
    // Set up progress forwarding for jumpcutter
    jumpcutterBridge.on('progress', (progressData) => {
      mainWindow.webContents.send('jumpcutter-progress', progressData);
    });

    jumpcutterBridge.on('error', (errorData) => {
      mainWindow.webContents.send('jumpcutter-error', errorData);
    });

    const result = await jumpcutterBridge.processVideo(videoPath, options);
    
    if (result.success) {
      mainWindow.webContents.send('jumpcutter-complete', result);
    }
    
    return result;
  } catch (error) {
    const errorResult = { success: false, error: error.message };
    mainWindow.webContents.send('jumpcutter-error', errorResult);
    return errorResult;
  }
});

ipcMain.handle('cancel-jumpcutter-processing', () => {
  return jumpcutterBridge.cancelProcessing();
});

ipcMain.handle('get-quiet-parts-analysis', async (event, videoPath) => {
  try {
    const analysis = await jumpcutterBridge.getVideoAnalysis(videoPath);
    return { success: true, analysis };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Transcription handlers
ipcMain.handle('check-transcription-dependencies', async () => {
  try {
    return await transcriptionBridge.checkDependencies();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('transcribe-video', async (event, videoPath, options = {}) => {
  try {
    const result = await transcriptionBridge.transcribeFile(videoPath, options);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cancel-transcription', () => {
  return transcriptionBridge.cancelTranscription();
});

ipcMain.handle('get-available-models', () => {
  return { success: true, models: transcriptionBridge.getAvailableModels() };
});

// Forward transcription events to renderer
transcriptionBridge.on('progress', (progressData) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('transcription-progress', progressData);
  }
});

transcriptionBridge.on('complete', (result) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('transcription-complete', result);
  }
});

transcriptionBridge.on('error', (error) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('transcription-error', error);
  }
});

transcriptionBridge.on('cancelled', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('transcription-cancelled');
  }
});

// Database handlers
ipcMain.handle('create-project', async (event, projectData) => {
  try {
    const result = await database.createProject(projectData);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-projects', async (event, limit, offset) => {
  try {
    const projects = await database.getProjects(limit, offset);
    return { success: true, projects };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-project', async (event, projectId) => {
  try {
    const project = await database.getProject(projectId);
    return { success: true, project };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-clips', async (event, projectId, clips) => {
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

ipcMain.handle('get-clips', async (event, projectId) => {
  try {
    const clips = await database.getClips(projectId);
    return { success: true, clips };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open folder in file explorer
ipcMain.handle('open-folder', async (event, folderPath) => {
  try {
    await shell.openPath(folderPath);
    return { success: true };
  } catch (error) {
    console.error('Failed to open folder:', error);
    return { success: false, error: error.message };
  }
});

// Show file in folder (reveal in file explorer)
ipcMain.handle('show-file-in-folder', async (event, filePath) => {
  try {
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    console.error('Failed to show file in folder:', error);
    return { success: false, error: error.message };
  }
});
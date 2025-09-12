const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = !app.isPackaged; // More reliable way to detect development mode
const { PythonBridge } = require('./ai-engine/python-bridge');
const { JumpcutterBridge } = require('./ai-engine/jumpcutter-bridge');
const { Database } = require('./database/database');

let mainWindow;

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
      preload: path.join(__dirname, 'preload.js')
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

// Initialize Python bridge, jumpcutter bridge and database
const pythonBridge = new PythonBridge();
const jumpcutterBridge = new JumpcutterBridge();
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
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  
  // Video processing
  checkPythonDependencies: () => ipcRenderer.invoke('check-python-dependencies'),
  getVideoInfo: (videoPath) => ipcRenderer.invoke('get-video-info', videoPath),
  processVideo: (videoPath, options) => ipcRenderer.invoke('process-video', videoPath, options),
  cancelProcessing: () => ipcRenderer.invoke('cancel-processing'),
  
  // Jumpcutter (quiet parts removal)
  checkJumpcutterDependencies: () => ipcRenderer.invoke('check-jumpcutter-dependencies'),
  processQuietParts: (videoPath, options) => ipcRenderer.invoke('process-quiet-parts', videoPath, options),
  cancelJumpcutterProcessing: () => ipcRenderer.invoke('cancel-jumpcutter-processing'),
  getQuietPartsAnalysis: (videoPath) => ipcRenderer.invoke('get-quiet-parts-analysis', videoPath),
  
  // Event listeners
  onProgress: (callback) => {
    ipcRenderer.on('processing-progress', callback);
    return () => ipcRenderer.removeListener('processing-progress', callback);
  },
  
  onError: (callback) => {
    ipcRenderer.on('processing-error', callback);
    return () => ipcRenderer.removeListener('processing-error', callback);
  },
  
  onComplete: (callback) => {
    ipcRenderer.on('processing-complete', callback);
    return () => ipcRenderer.removeListener('processing-complete', callback);
  },
  
  // Jumpcutter event listeners
  onJumpcutterProgress: (callback) => {
    ipcRenderer.on('jumpcutter-progress', callback);
    return () => ipcRenderer.removeListener('jumpcutter-progress', callback);
  },
  
  onJumpcutterError: (callback) => {
    ipcRenderer.on('jumpcutter-error', callback);
    return () => ipcRenderer.removeListener('jumpcutter-error', callback);
  },
  
  onJumpcutterComplete: (callback) => {
    ipcRenderer.on('jumpcutter-complete', callback);
    return () => ipcRenderer.removeListener('jumpcutter-complete', callback);
  },
  
  // Database operations
  createProject: (projectData) => ipcRenderer.invoke('create-project', projectData),
  getProjects: (limit, offset) => ipcRenderer.invoke('get-projects', limit, offset),
  getProject: (projectId) => ipcRenderer.invoke('get-project', projectId),
  saveClips: (projectId, clips) => ipcRenderer.invoke('save-clips', projectId, clips),
  getClips: (projectId) => ipcRenderer.invoke('get-clips', projectId)
});
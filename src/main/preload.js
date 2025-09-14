const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getVideoPreviewUrl: (videoPath) => ipcRenderer.invoke('get-video-preview-url', videoPath),
  getVideoBuffer: (videoPath) => ipcRenderer.invoke('get-video-buffer', videoPath),
  
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
  
  // Transcription (Whisper)
  checkTranscriptionDependencies: () => ipcRenderer.invoke('check-transcription-dependencies'),
  transcribeVideo: (videoPath, options) => ipcRenderer.invoke('transcribe-video', videoPath, options),
  cancelTranscription: () => ipcRenderer.invoke('cancel-transcription'),
  getAvailableModels: () => ipcRenderer.invoke('get-available-models'),
  
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
  
  // Transcription event listeners
  onTranscriptionProgress: (callback) => {
    ipcRenderer.on('transcription-progress', callback);
    return () => ipcRenderer.removeListener('transcription-progress', callback);
  },
  
  onTranscriptionError: (callback) => {
    ipcRenderer.on('transcription-error', callback);
    return () => ipcRenderer.removeListener('transcription-error', callback);
  },
  
  onTranscriptionComplete: (callback) => {
    ipcRenderer.on('transcription-complete', callback);
    return () => ipcRenderer.removeListener('transcription-complete', callback);
  },
  
  onTranscriptionCancelled: (callback) => {
    ipcRenderer.on('transcription-cancelled', callback);
    return () => ipcRenderer.removeListener('transcription-cancelled', callback);
  },
  
  // Database operations
  createProject: (projectData) => ipcRenderer.invoke('create-project', projectData),
  getProjects: (limit, offset) => ipcRenderer.invoke('get-projects', limit, offset),
  getProject: (projectId) => ipcRenderer.invoke('get-project', projectId),
  saveClips: (projectId, clips) => ipcRenderer.invoke('save-clips', projectId, clips),
  getClips: (projectId) => ipcRenderer.invoke('get-clips', projectId),
  
  // File system operations
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  showFileInFolder: (filePath) => ipcRenderer.invoke('show-file-in-folder', filePath),
  showClipsInFolder: () => ipcRenderer.invoke('show-clips-in-folder'),

  // Settings management
  saveSetting: (key, value, isEncrypted) => ipcRenderer.invoke('save-setting', key, value, isEncrypted),
  getSetting: (key, defaultValue) => ipcRenderer.invoke('get-setting', key, defaultValue),
  getAllSettings: () => ipcRenderer.invoke('get-all-settings'),
  deleteSetting: (key) => ipcRenderer.invoke('delete-setting', key),
  isEncryptionAvailable: () => ipcRenderer.invoke('is-encryption-available'),

  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Debug helpers
  getLogFilePath: () => ipcRenderer.invoke('get-log-file-path'),
  openLogFile: () => ipcRenderer.invoke('open-log-file')
});
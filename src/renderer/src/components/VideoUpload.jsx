import React, { useState } from 'react';

export const VideoUpload = ({ onVideoSelect, disabled }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileSelect = async () => {
    try {
      const filePath = await window.electronAPI.selectVideoFile();
      if (filePath) {
        onVideoSelect(filePath);
      }
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => 
      file.type.startsWith('video/') || 
      /\.(mp4|avi|mov|mkv|wmv|flv|webm)$/i.test(file.name)
    );
    
    if (videoFile) {
      onVideoSelect(videoFile.path);
    }
  };

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">Upload Video</h2>
        <p className="text-gray-400 text-sm">Select a video file to get started</p>
      </div>
      
      <div
        className={`
          border-2 border-dashed rounded-xl p-16 text-center transition-all duration-200 cursor-pointer
          ${isDragOver && !disabled 
            ? 'border-primary-400 bg-primary-500/5' 
            : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/20'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!disabled ? handleFileSelect : undefined}
      >
        <div className="flex flex-col items-center space-y-6">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-colors ${
            isDragOver && !disabled ? 'bg-primary-500' : 'bg-gray-700'
          }`}>
            {disabled ? (
              <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className={`w-10 h-10 transition-colors ${isDragOver ? 'text-white' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
          </div>
          
          <div>
            <h3 className="text-2xl font-semibold mb-2 text-white">
              {disabled ? 'Processing...' : isDragOver ? 'Drop to Upload' : 'Select Video File'}
            </h3>
            
            <p className="text-gray-400 mb-8">
              {disabled ? 'Please wait while processing' : 'Drag and drop or click to browse'}
            </p>
          </div>
          
          {!disabled && (
            <div className="flex flex-wrap gap-2 max-w-md">
              {['MP4', 'AVI', 'MOV', 'MKV', 'WMV'].map((format) => (
                <span key={format} className="text-xs bg-gray-700 text-gray-300 px-3 py-1 rounded-full">
                  {format}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
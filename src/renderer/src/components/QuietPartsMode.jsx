import React, { useState, useEffect } from 'react';
import { VideoUpload } from './VideoUpload';
import { VideoPreview } from './VideoPreview';
import { ProcessingStatus } from './ProcessingStatus';

export const QuietPartsMode = () => {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [processedVideo, setProcessedVideo] = useState(null);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState({
    silentThreshold: 0.03,
    soundedSpeed: 1.0,
    silentSpeed: 5.0,
    frameMargin: 1,
    sampleRate: 44100,
    frameRate: 30,
    frameQuality: 3
  });

  useEffect(() => {
    // Set up event listeners for jumpcutter progress
    const progressUnsubscribe = window.electronAPI.onJumpcutterProgress((event, progressData) => {
      setProcessingProgress(progressData.progress);
      setProcessingStep(progressData.step);
    });

    const errorUnsubscribe = window.electronAPI.onJumpcutterError((event, errorData) => {
      setError(errorData.error || errorData.message);
      setIsProcessing(false);
    });

    const completeUnsubscribe = window.electronAPI.onJumpcutterComplete((event, result) => {
      setProcessedVideo(result);
      setIsProcessing(false);
      setProcessingProgress(100);
      setProcessingStep('Completed successfully');
    });

    // Cleanup on unmount
    return () => {
      progressUnsubscribe();
      errorUnsubscribe();
      completeUnsubscribe();
    };
  }, []);

  const handleVideoSelect = (videoPath) => {
    setSelectedVideo(videoPath);
    setProcessedVideo(null);
    setError(null);
  };

  const handleProcessStart = async () => {
    if (!selectedVideo) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStep('Starting quiet parts removal...');
    setError(null);

    try {
      // Start processing
      const result = await window.electronAPI.processQuietParts(selectedVideo, settings);
      
      if (!result.success) {
        setError(result.error);
        setIsProcessing(false);
      }
    } catch (error) {
      setError(`Failed to start processing: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    try {
      await window.electronAPI.cancelJumpcutterProcessing();
      setIsProcessing(false);
      setProcessingStep('Processing cancelled');
    } catch (error) {
      console.error('Failed to cancel processing:', error);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-blue-300 font-semibold">Cut Quiet Parts Mode</h3>
            <p className="text-blue-200 text-sm">Automatically remove silent or quiet sections from your video</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <VideoUpload 
            onVideoSelect={handleVideoSelect}
            disabled={isProcessing}
          />
          
          {selectedVideo && (
            <div className="space-y-6">
              <VideoPreview 
                videoPath={selectedVideo}
                onProcessStart={handleProcessStart}
                disabled={isProcessing}
                buttonText="Remove Quiet Parts"
              />
              
              {/* Quiet Parts Settings */}
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Quiet Parts Detection Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Silence Threshold: {settings.silentThreshold}
                    </label>
                    <input
                      type="range"
                      min="0.01"
                      max="0.1"
                      step="0.001"
                      value={settings.silentThreshold}
                      onChange={(e) => updateSetting('silentThreshold', parseFloat(e.target.value))}
                      disabled={isProcessing}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0.01 (Very Sensitive)</span>
                      <span>0.1 (Less Sensitive)</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Silent Speed: {settings.silentSpeed}x
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="999999"
                      step="1"
                      value={settings.silentSpeed}
                      onChange={(e) => updateSetting('silentSpeed', parseFloat(e.target.value))}
                      disabled={isProcessing}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>2x (Speed up)</span>
                      <span>999999x (Cut out)</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Frame Margin: {settings.frameMargin} frames
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.1"
                      value={settings.frameMargin}
                      onChange={(e) => updateSetting('frameMargin', parseFloat(e.target.value))}
                      disabled={isProcessing}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0 (No padding)</span>
                      <span>5 (More context)</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Frame Quality (1-31)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={settings.frameQuality}
                        onChange={(e) => updateSetting('frameQuality', parseInt(e.target.value))}
                        disabled={isProcessing}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Sample Rate
                      </label>
                      <select
                        value={settings.sampleRate}
                        onChange={(e) => updateSetting('sampleRate', parseInt(e.target.value))}
                        disabled={isProcessing}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed"
                      >
                        <option value={22050}>22050 Hz</option>
                        <option value={44100}>44100 Hz</option>
                        <option value={48000}>48000 Hz</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {isProcessing && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Processing Video</h3>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
              <ProcessingStatus 
                progress={processingProgress} 
                step={processingStep}
              />
            </div>
          )}

          {error && (
            <div className="card border-red-500 bg-red-900/20">
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-red-300 font-semibold">Processing Error</h3>
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Processing Results</h3>
            {processedVideo ? (
              <div className="space-y-4">
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <h4 className="text-green-300 font-semibold">Processing Complete!</h4>
                      <p className="text-green-200 text-sm">Quiet parts have been removed from your video</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Output File:</span>
                    <span className="text-white font-medium">{processedVideo.outputPath.split(/[/\\]/).pop()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">File Size:</span>
                    <span className="text-white">{(processedVideo.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Processed:</span>
                    <span className="text-white">{new Date(processedVideo.processedAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-300">Settings Used:</h4>
                  <div className="bg-gray-800 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Silence Threshold:</span>
                      <span className="text-white">{processedVideo.settings.silentThreshold}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Silent Speed:</span>
                      <span className="text-white">{processedVideo.settings.silentSpeed}x</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Frame Margin:</span>
                      <span className="text-white">{processedVideo.settings.frameMargin} frames</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  <button
                    onClick={() => window.electronAPI.selectVideoFile().then(path => path && window.open(`file://${processedVideo.outputPath}`))}
                    className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Open Output Folder
                  </button>
                  <button
                    onClick={() => {
                      setProcessedVideo(null);
                      setError(null);
                    }}
                    className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Process Another Video
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-8">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-1v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-1c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-1" />
                </svg>
                <p>Process a video to see results</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
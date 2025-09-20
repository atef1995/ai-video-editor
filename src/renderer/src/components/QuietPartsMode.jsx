import React, { useState, useEffect } from 'react';
import { VideoUpload } from './VideoUpload';
import { VideoPreview } from './VideoPreview';
import { ProcessingStatus } from './ProcessingStatus';
import { useVideo } from '../contexts/VideoContext';

export const QuietPartsMode = () => {
  const { selectedVideo, handleVideoSelect, hasVideo } = useVideo();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [processingPhase, setProcessingPhase] = useState('initialization');
  const [processingDetails, setProcessingDetails] = useState({});
  const [processedVideo, setProcessedVideo] = useState(null);
  const [error, setError] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
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
      if (progressData.phase) {
        setProcessingPhase(progressData.phase);
      }
      if (progressData.details) {
        setProcessingDetails(progressData.details);
      }
    });

    const errorUnsubscribe = window.electronAPI.onJumpcutterError((event, errorData) => {
      setError(errorData.error || errorData.message);
      setIsProcessing(false);
      setStartTime(null);
      setElapsedTime(0);
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

  // Track elapsed time during processing
  useEffect(() => {
    let intervalId;

    if (isProcessing && startTime) {
      intervalId = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000); // Update every second
    } else if (!isProcessing) {
      setElapsedTime(0);
      setStartTime(null);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isProcessing, startTime]);

  const handleVideoSelectLocal = (videoPath) => {
    handleVideoSelect(videoPath);
    setProcessedVideo(null);
    setError(null);
  };

  const handleProcessStart = async () => {
    if (!selectedVideo) return;

    const now = Date.now();
    setStartTime(now);
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStep('Starting quiet parts removal...');
    setProcessingPhase('initialization');
    setProcessingDetails({});
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
      setStartTime(null);
      setElapsedTime(0);
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
    <div className="space-y-12">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Cut Quiet Parts</h2>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Automatically remove silent or quiet sections from your video to create more engaging content.
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-12">
        {/* Left Side - Upload, Preview, and Settings */}
        <div className="2xl:col-span-8 space-y-8">
          <VideoUpload
            onVideoSelect={handleVideoSelectLocal}
            disabled={isProcessing}
            hasVideo={hasVideo}
          />
          
          {selectedVideo && (
            <VideoPreview 
              videoPath={selectedVideo}
              onProcessStart={handleProcessStart}
              disabled={isProcessing}
              buttonText="Remove Quiet Parts"
            />
          )}

          {/* Settings Panel */}
          {selectedVideo && (
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">Detection Settings</h3>
                <p className="text-gray-400 text-sm">Adjust how quiet parts are detected and processed</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8">
                {/* Silence Threshold */}
                <div>
                  <label className="block text-sm font-medium text-white mb-3">
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
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>Very Sensitive</span>
                    <span>Less Sensitive</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">How quiet a sound needs to be to be considered silent</p>
                </div>
                
                {/* Silent Speed */}
                <div>
                  <label className="block text-sm font-medium text-white mb-3">
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
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>Speed up</span>
                    <span>Cut out</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Speed multiplier for quiet sections (high values remove them)</p>
                </div>
                
                {/* Frame Margin */}
                <div>
                  <label className="block text-sm font-medium text-white mb-3">
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
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>No padding</span>
                    <span>More context</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Extra frames to keep around speech for smooth transitions</p>
                </div>
                
                {/* Quality Settings */}
                <div>
                  <label className="block text-sm font-medium text-white mb-3">
                    Quality & Sample Rate
                  </label>
                  <div className="space-y-3">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={settings.frameQuality}
                      onChange={(e) => updateSetting('frameQuality', parseInt(e.target.value))}
                      disabled={isProcessing}
                      placeholder="Quality (1-31)"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed"
                    />
                    <select
                      value={settings.sampleRate}
                      onChange={(e) => updateSetting('sampleRate', parseInt(e.target.value))}
                      disabled={isProcessing}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed"
                    >
                      <option value={22050}>22050 Hz</option>
                      <option value={44100}>44100 Hz</option>
                      <option value={48000}>48000 Hz</option>
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Lower quality = faster processing, higher quality = better output</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Processing Status */}
          {isProcessing && (
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">Processing Video</h3>
                  <p className="text-gray-400 text-sm">{processingStep}</p>
                </div>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
              <ProcessingStatus
                progress={processingProgress}
                currentStep={processingStep}
                phase={processingPhase}
                details={processingDetails}
                steps={[]}
                totalElapsedTime={elapsedTime}
              />
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-2xl p-8">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-300 mb-1">Processing Error</h3>
                  <p className="text-red-200">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors text-sm"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side - Results */}
        <div className="2xl:col-span-4 space-y-8">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white mb-2">Results</h3>
              <p className="text-gray-400 text-sm">Processed video details and download</p>
            </div>
            
            {processedVideo ? (
              <div className="space-y-6">
                {/* Success Message */}
                <div className="bg-green-900/20 border border-green-700 rounded-xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-green-300">Complete!</h4>
                      <p className="text-green-200 text-sm">Quiet parts removed successfully</p>
                    </div>
                  </div>
                </div>

                {/* File Details */}
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-700">
                    <span className="text-gray-400">Output File</span>
                    <span className="text-white font-medium text-right max-w-xs truncate">
                      {processedVideo.outputPath.split(/[/\\]/).pop()}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-700">
                    <span className="text-gray-400">File Size</span>
                    <span className="text-white">{(processedVideo.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-700">
                    <span className="text-gray-400">Processed</span>
                    <span className="text-white">{new Date(processedVideo.processedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Settings Used */}
                <div>
                  <h4 className="font-medium text-gray-300 mb-3">Settings Used</h4>
                  <div className="bg-gray-700/50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Silence Threshold</span>
                      <span className="text-white">{processedVideo.settings?.silentThreshold || settings.silentThreshold}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Silent Speed</span>
                      <span className="text-white">{processedVideo.settings?.silentSpeed || settings.silentSpeed}x</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Frame Margin</span>
                      <span className="text-white">{processedVideo.settings?.frameMargin || settings.frameMargin} frames</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={() => window.electronAPI.showFileInFolder(processedVideo.outputPath)}
                    className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Show in Folder
                  </button>
                  <button
                    onClick={() => {
                      const folderPath = processedVideo.outputPath.substring(0, Math.max(
                        processedVideo.outputPath.lastIndexOf('/'),
                        processedVideo.outputPath.lastIndexOf('\\')
                      ));
                      window.electronAPI.openFolder(folderPath);
                    }}
                    className="w-full py-3 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
                  >
                    Open Output Folder
                  </button>
                  <button
                    onClick={() => {
                      setProcessedVideo(null);
                      setError(null);
                    }}
                    className="w-full py-2 px-4 text-gray-300 hover:text-white transition-colors text-sm"
                  >
                    Process Another Video
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-1v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-1c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-1" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">No Results Yet</h4>
                <p className="text-gray-400">Process a video to see results here</p>
              </div>
            )}
          </div>

          {/* Tips Panel */}
          {!selectedVideo && !isProcessing && (
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8">
              <h3 className="text-lg font-semibold text-white mb-4">Tips</h3>
              <div className="space-y-4 text-sm text-gray-300">
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-primary-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Works best with talking head videos or podcasts</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-primary-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Lower thresholds detect more silence</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-primary-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Frame margin prevents choppy audio cuts</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-primary-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Processing time depends on video length</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { VideoUpload } from './VideoUpload';
import { VideoPreview } from './VideoPreview';
import { ProcessingStatus } from './ProcessingStatus';
import { useVideo } from '../contexts/VideoContext';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

/**
 * TranscriptionMode Component
 * 
 * Provides video transcription functionality using OpenAI Whisper.
 * Features:
 * - Video file upload and preview
 * - Whisper model selection (tiny to large)
 * - Language detection or manual selection
 * - Real-time transcription progress
 * - Downloadable transcript results
 * - Word-level timestamps for precise editing
 */
export const TranscriptionMode = () => {
  const { selectedVideo, handleVideoSelect, hasVideo } = useVideo();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [processingPhase, setProcessingPhase] = useState('initialization');
  const [processingDetails, setProcessingDetails] = useState({});
  const [transcriptionResult, setTranscriptionResult] = useState(null);
  const [error, setError] = useState(null);

  // Subtitle overlay state
  const [showSubtitleOverlay, setShowSubtitleOverlay] = useState(false);
  const [subtitleData, setSubtitleData] = useState([]);
  const [previewMode, setPreviewMode] = useState(false); // For testing positioning before transcription
  const [availableModels, setAvailableModels] = useState([]);
  const [settings, setSettings] = useState({
    model: 'base',
    language: '', // Auto-detect if empty
    addTextOverlay: false
  });
  

  useEffect(() => {
    // Load available models
    loadAvailableModels();

    // Set up event listeners for transcription progress
    const progressUnsubscribe = window.electronAPI.onTranscriptionProgress((event, progressData) => {
      setProcessingProgress(progressData.progress);
      setProcessingStep(progressData.step);
      if (progressData.phase) {
        setProcessingPhase(progressData.phase);
      }
      if (progressData.details) {
        setProcessingDetails(progressData.details);
      }
    });

    const errorUnsubscribe = window.electronAPI.onTranscriptionError((event, errorData) => {
      setError(errorData.error || errorData.message);
      setIsProcessing(false);
    });

    const completeUnsubscribe = window.electronAPI.onTranscriptionComplete((event, result) => {
      setTranscriptionResult(result);
      setIsProcessing(false);
      setProcessingProgress(100);
      setProcessingStep('Transcription completed successfully');
    });

    const cancelUnsubscribe = window.electronAPI.onTranscriptionCancelled((event) => {
      setIsProcessing(false);
      setProcessingStep('Transcription cancelled');
      setProcessingProgress(0);
    });

    // Cleanup on unmount
    return () => {
      progressUnsubscribe();
      errorUnsubscribe();
      completeUnsubscribe();
      cancelUnsubscribe();
    };
  }, []);

  // Convert transcription to subtitle data when transcription completes
  useEffect(() => {
    if (transcriptionResult?.transcription?.segments) {
      console.log('Converting transcription to subtitles:', transcriptionResult.transcription.segments.length, 'segments');

      // Get current position preferences from existing subtitle data (if any)
      const currentPosition = subtitleData.length > 0 ? subtitleData[0].position : { x: 10, y: 80 };
      const currentSize = subtitleData.length > 0 ? subtitleData[0].size : { width: 80, height: 10 };

      // Convert transcription using user's preferred positioning
      const subtitles = transcriptionResult.transcription.segments.map((segment, index) => ({
        id: `subtitle-${index}`,
        text: segment.text.trim(),
        startTime: segment.start,
        endTime: segment.end,
        position: { ...currentPosition },
        size: { ...currentSize }
      }));

      console.log('Created subtitle data:', subtitles);
      setSubtitleData(subtitles);

      // Auto-enable subtitle overlay after transcription
      setShowSubtitleOverlay(true);
      setPreviewMode(false); // Exit preview mode
    }
  }, [transcriptionResult]);

  const loadAvailableModels = async () => {
    try {
      const result = await window.electronAPI.getAvailableModels();
      if (result.success) {
        setAvailableModels(result.models);
      }
    } catch (error) {
      console.error('Failed to load available models:', error);
    }
  };

  const handleVideoSelectLocal = (videoPath) => {
    handleVideoSelect(videoPath);
    setTranscriptionResult(null);
    setError(null);
    setSubtitleData([]);
    setShowSubtitleOverlay(false);
  };

  // Convert transcription results to subtitle data for overlay
  const convertTranscriptionToSubtitles = (transcription) => {
    if (!transcription?.segments) return [];

    return transcription.segments.map((segment, index) => ({
      id: `subtitle-${index}`,
      text: segment.text.trim(),
      startTime: segment.start,
      endTime: segment.end,
      position: {
        x: 10, // Default 10% from left
        y: 80, // Default 80% from top (near bottom)
      },
      size: {
        width: 80, // Default 80% of container width
        height: 10, // Default 10% of container height
      },
      style: {
        fontSize: 16,
        color: 'white',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold'
      }
    }));
  };

  // Handle subtitle position/size updates
  const handleSubtitleUpdate = (subtitleId, updates) => {
    setSubtitleData(prev =>
      prev.map(subtitle =>
        subtitle.id === subtitleId
          ? { ...subtitle, ...updates }
          : subtitle
      )
    );
  };

  // Create demo subtitles for positioning preview
  const createDemoSubtitles = () => {
    return [
      {
        id: 'demo-1',
        text: 'Drag and resize to position where you want subtitles to appear',
        startTime: 0,
        endTime: 5,
        position: { x: 10, y: 80 },
        size: { width: 80, height: 10 }
      }
    ];
  };

  // Toggle preview mode
  const handlePreviewToggle = () => {
    if (!previewMode) {
      // Enable preview mode with demo subtitles
      const demoSubs = createDemoSubtitles();

      // Use React's automatic batching by wrapping in a callback
      React.startTransition(() => {
        setSubtitleData(demoSubs);
        setShowSubtitleOverlay(true);
        setPreviewMode(true);
      });
    } else {
      // Disable preview mode
      React.startTransition(() => {
        if (!transcriptionResult) {
          setSubtitleData([]);
          setShowSubtitleOverlay(false);
        }
        setPreviewMode(false);
      });
    }
  };

  const handleTranscriptionStart = async () => {
    if (!selectedVideo) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStep('Starting transcription...');
    setProcessingPhase('initialization');
    setProcessingDetails({});
    setError(null);

    try {
      // Extract text style from subtitle data or use defaults
      const textStyle = subtitleData.length > 0 && subtitleData[0].style
        ? subtitleData[0].style
        : {
            fontSize: 24,
            color: 'white',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            strokeColor: 'black',
            strokeWidth: 2
          };

      // Start transcription with positioning data and text style
      const transcriptionOptions = {
        ...settings,
        textStyle: textStyle,
        subtitlePositions: subtitleData.length > 0 ? subtitleData : null
      };

      const result = await window.electronAPI.transcribeVideo(selectedVideo, transcriptionOptions);
      
      if (!result.success) {
        setError(result.error);
        setIsProcessing(false);
      }
    } catch (error) {
      setError(`Failed to start transcription: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    try {
      await window.electronAPI.cancelTranscription();
      setIsProcessing(false);
      setProcessingStep('Transcription cancelled');
    } catch (error) {
      console.error('Failed to cancel transcription:', error);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };


  const downloadTranscript = () => {
    if (!transcriptionResult?.transcription) return;

    const transcript = transcriptionResult.transcription;
    const content = transcript.segments.map(segment => 
      `[${formatTime(segment.start)} --> ${formatTime(segment.end)}]\n${segment.text}\n\n`
    ).join('');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadJSON = () => {
    if (!transcriptionResult?.transcription) return;

    const content = JSON.stringify(transcriptionResult.transcription, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export positioned subtitles as JSON
  const exportPositionedSubtitles = () => {
    if (!subtitleData.length) return;

    const exportData = {
      version: '1.0',
      videoFile: selectedVideo?.split(/[/\\]/).pop() || 'unknown',
      exportDate: new Date().toISOString(),
      subtitles: subtitleData.map(subtitle => ({
        id: subtitle.id,
        text: subtitle.text,
        startTime: subtitle.startTime,
        endTime: subtitle.endTime,
        position: subtitle.position,
        size: subtitle.size,
        style: subtitle.style
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `positioned_subtitles_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <div>
            <h3 className="text-purple-300 font-semibold">Video Transcription</h3>
            <p className="text-purple-200 text-sm">Convert speech to text with AI-powered Whisper transcription</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <VideoUpload
            onVideoSelect={handleVideoSelectLocal}
            disabled={isProcessing}
            hasVideo={!!selectedVideo}
          />
          
          {selectedVideo && (
            <div className="space-y-6">
              <VideoPreview
                videoPath={selectedVideo}
                onProcessStart={handleTranscriptionStart}
                disabled={isProcessing}
                buttonText="Start Transcription"
                transcriptionResult={transcriptionResult}
                // New subtitle overlay props
                showSubtitleOverlay={showSubtitleOverlay}
                onSubtitleOverlayToggle={previewMode ? null : setShowSubtitleOverlay}
                subtitleOverlayData={subtitleData}
                onSubtitleUpdate={handleSubtitleUpdate}
              />


              {/* Preview Position Button */}
              {selectedVideo && !isProcessing && (
                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">Subtitle Position</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Choose where subtitles will appear before running transcription.
                  </p>
                  <button
                    onClick={handlePreviewToggle}
                    className={`
                      w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center
                      ${previewMode
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }
                    `}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {previewMode ? 'Stop Position Preview' : 'Preview Subtitle Position'}
                  </button>
                </div>
              )}

              {/* Transcription Settings */}
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Transcription Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Whisper Model
                    </label>
                    <div className="relative">
                      <select
                        value={settings.model}
                        onChange={(e) => updateSetting('model', e.target.value)}
                        disabled={isProcessing}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed appearance-none"
                      >
                        {availableModels.map((model) => (
                          <option key={model.name} value={model.name}>
                            {model.name} ({model.size}) - {model.speed} Speed, {model.accuracy} Accuracy
                          </option>
                        ))}
                      </select>
                      <ChevronDownIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                    </div>
                    {settings.model && availableModels.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        {availableModels.find(m => m.name === settings.model)?.description}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Language (Optional)
                    </label>
                    <input
                      type="text"
                      value={settings.language}
                      onChange={(e) => updateSetting('language', e.target.value)}
                      disabled={isProcessing}
                      placeholder="Auto-detect (leave empty) or specify (e.g., 'en', 'es', 'fr')"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Leave empty for automatic language detection, or specify a language code
                    </p>
                  </div>
                  
                  {/* Text Overlay Settings */}
                  <div className="border-t border-gray-600 pt-4">
                    <div className="flex items-center space-x-3 mb-4">
                      <input
                        type="checkbox"
                        id="addTextOverlay"
                        checked={settings.addTextOverlay}
                        onChange={(e) => updateSetting('addTextOverlay', e.target.checked)}
                        disabled={isProcessing}
                        className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="addTextOverlay" className="text-sm font-medium text-gray-300">
                        Add text overlay to video
                      </label>
                    </div>
                    
                    {settings.addTextOverlay && (
                      <div className="space-y-4 pl-7">
                        {subtitleData.length > 0 ? (
                          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <h4 className="text-blue-300 font-medium text-sm">Interactive Positioning Active</h4>
                            </div>
                            <p className="text-blue-200 text-xs mb-3">
                              Subtitles will be positioned exactly where you placed them in the interactive preview above.
                            </p>
                            <div className="text-xs text-blue-300">
                              <strong>Positioned subtitles:</strong> {subtitleData.length}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <h4 className="text-amber-300 font-medium text-sm">No Position Data</h4>
                            </div>
                            <p className="text-amber-200 text-xs mb-3">
                              Use the "Preview Subtitle Position" button above to set exact subtitle positions before transcription.
                            </p>
                            <p className="text-amber-300 text-xs">
                              Without positioning data, subtitles will use default bottom placement.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {isProcessing && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Transcribing Video</h3>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
              <ProcessingStatus 
                progress={processingProgress} 
                currentStep={processingStep}
                phase={processingPhase}
                details={processingDetails}
                steps={[]} // Use dynamic step display
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
                  <h3 className="text-red-300 font-semibold">Transcription Error</h3>
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Transcription Results</h3>
            {transcriptionResult ? (
              <div className="space-y-4">
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <h4 className="text-green-300 font-semibold">Transcription Complete!</h4>
                      <p className="text-green-200 text-sm">Speech has been converted to text with timestamps</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Language:</span>
                    <span className="text-white font-medium">{transcriptionResult.language?.toUpperCase() || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Segments:</span>
                    <span className="text-white">{transcriptionResult.segmentCount || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Model Used:</span>
                    <span className="text-white">{transcriptionResult.model}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Processed:</span>
                    <span className="text-white">{new Date(transcriptionResult.processedAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Preview of transcript */}
                {transcriptionResult.transcription?.text && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-300">Preview:</h4>
                    <div className="bg-gray-800 rounded-lg p-3 max-h-32 overflow-y-auto">
                      <p className="text-sm text-gray-300 line-clamp-4">
                        {transcriptionResult.transcription.text.substring(0, 200)}
                        {transcriptionResult.transcription.text.length > 200 ? '...' : ''}
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-4 space-y-2">
                  <button
                    onClick={downloadTranscript}
                    className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Download Transcript (.txt)
                  </button>
                  <button
                    onClick={downloadJSON}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Download Full Data (.json)
                  </button>

                  {/* Export positioned subtitles */}
                  {subtitleData.length > 0 && (
                    <button
                      onClick={exportPositionedSubtitles}
                      className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v1a1 1 0 01-1 1v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7a1 1 0 01-1-1V5a1 1 0 011-1h4z" />
                      </svg>
                      Export Positioned Subtitles (.json)
                    </button>
                  )}
                  
                  {/* Video with overlay download */}
                  {transcriptionResult.videoOutputPath && (
                    <div className="border-t border-gray-600 pt-4">
                      <div className="bg-green-900/10 border border-green-700 rounded-lg p-3 mb-3">
                        <div className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V3a1 1 0 011 1v8.586l-2.293-2.293a1 1 0 00-1.414 0L12 13.586l-2.293-2.293a1 1 0 00-1.414 0L6 13.586V4a1 1 0 011-1z" />
                          </svg>
                          <div>
                            <h4 className="text-green-300 font-medium text-sm">Video with Text Overlay Ready!</h4>
                            <p className="text-green-200 text-xs">Your video now includes synchronized captions</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <button
                          onClick={() => window.electronAPI.showFileInFolder(transcriptionResult.videoOutputPath)}
                          className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                        >
                          Open Video with Captions
                        </button>
                        <button
                          onClick={() => window.electronAPI.openFolder(transcriptionResult.videoOutputPath.split('/').slice(0, -1).join('/'))}
                          className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                        >
                          Show in Folder
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {transcriptionResult.overlayError && (
                    <div className="border-t border-gray-600 pt-4">
                      <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                        <div className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <h4 className="text-yellow-300 font-medium text-sm">Text Overlay Failed</h4>
                            <p className="text-yellow-200 text-xs">{transcriptionResult.overlayError}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => {
                      setTranscriptionResult(null);
                      setError(null);
                    }}
                    className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Transcribe Another Video
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-8">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <p>Transcribe a video to see results</p>
              </div>
            )}
          </div>

          {/* Model Information */}
          {availableModels.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Available Models</h3>
              <div className="space-y-3">
                {availableModels.map((model) => (
                  <div key={model.name} className={`p-3 rounded-lg border ${
                    settings.model === model.name 
                      ? 'border-purple-500 bg-purple-900/20' 
                      : 'border-gray-600 bg-gray-800'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-white">{model.name}</h4>
                        <p className="text-xs text-gray-400">{model.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">{model.size}</p>
                        <p className="text-xs text-gray-500">{model.speed}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranscriptionMode;
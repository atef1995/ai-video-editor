import { useState, useEffect, useRef } from "react";
import { VideoUpload } from "./VideoUpload";
import { VideoPreview } from "./VideoPreview";
import { ProcessingStatus } from "./ProcessingStatus";
import { GeneratedClips } from "./GeneratedClips";

const AiShortsGenerator = ({ selectedVideo, handleVideoSelect, hasVideo }) => {
  console.log({ selectedVideo, handleVideoSelect, hasVideo });

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [generatedClips, setGeneratedClips] = useState([]);
  const [processingStep, setProcessingStep] = useState("");
  const [processingError, setProcessingError] = useState(null);
  const [openaiKey, setOpenaiKey] = useState("");
  const [totalElapsedTime, setTotalElapsedTime] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null);
  const [detailedSteps, setDetailedSteps] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [clipSettings, setClipSettings] = useState({
    minDuration: 30,
    maxDuration: 90,
    maxClips: 5,
    focusOnHighEnergy: true,
    includeActionableContent: true,
    includeEmotionalPeaks: true,
    includeInsights: true
  });
  const processingStartTimeRef = useRef(null);
  const stepStartTimeRef = useRef(null);
  const elapsedTimeIntervalRef = useRef(null);

  // Load OpenAI key from settings
  useEffect(() => {
    const loadOpenAIKey = async () => {
      try {
        const result = await window.electronAPI.getSetting("openai_key");
        if (result.success && result.value) {
          setOpenaiKey(result.value);
        }
      } catch (error) {
        console.error("Failed to load OpenAI key:", error);
      }
    };
    loadOpenAIKey();
  }, []);

  // Update elapsed time every second when processing
  useEffect(() => {
    if (isProcessing && processingStartTimeRef.current) {
      elapsedTimeIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - processingStartTimeRef.current;
        setTotalElapsedTime(elapsed);
      }, 1000);
    } else {
      if (elapsedTimeIntervalRef.current) {
        clearInterval(elapsedTimeIntervalRef.current);
        elapsedTimeIntervalRef.current = null;
      }
    }

    return () => {
      if (elapsedTimeIntervalRef.current) {
        clearInterval(elapsedTimeIntervalRef.current);
      }
    };
  }, [isProcessing]);

  const handleVideoSelectLocal = (videoPath) => {
    handleVideoSelect(videoPath);
    setGeneratedClips([]);
    setProcessingError(null);
    setDetailedSteps([]);
    processingStartTimeRef.current = null;
    stepStartTimeRef.current = null;
    setTotalElapsedTime(0);
    setEstimatedTimeRemaining(null);
  };

  const handleProcessStart = async (videoPath) => {

    if (!videoPath || typeof videoPath !== 'string') {
      setProcessingError(
        "Invalid video file path. Please select a video file first."
      );
      return;
    }

    if (!openaiKey) {
      setProcessingError(
        "OpenAI API key is required. Please add it in Settings."
      );
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStep("Starting AI analysis...");
    setProcessingError(null);

    const startTime = Date.now();
    processingStartTimeRef.current = startTime;
    stepStartTimeRef.current = startTime;
    setTotalElapsedTime(0);
    setDetailedSteps([]);
    setEstimatedTimeRemaining(null);

    try {
      // Set up event listeners for progress updates
      const removeProgressListener = window.electronAPI.onProgress(
        (event, progressData) => {
          const now = Date.now();
          const currentStepDuration = stepStartTimeRef.current
            ? now - stepStartTimeRef.current
            : 0;

          setProcessingProgress(progressData.progress);
          setProcessingStep(progressData.step);

          // Calculate estimated time remaining based on progress
          if (processingStartTimeRef.current && progressData.progress > 0) {
            const elapsed = now - processingStartTimeRef.current;
            const estimatedTotal = (elapsed / progressData.progress) * 100;
            const remaining = Math.max(0, estimatedTotal - elapsed);
            setEstimatedTimeRemaining(remaining);
          }

          // Update detailed steps tracking
          setDetailedSteps((prev) => {
            const newStep = {
              step: progressData.step,
              progress: progressData.progress,
              timestamp: now,
              duration: progressData.stepDuration || currentStepDuration,
              details: progressData.details || "",
            };

            // If it's a new step, add it; otherwise update the last one
            const lastStep = prev[prev.length - 1];
            if (!lastStep || lastStep.step !== progressData.step) {
              stepStartTimeRef.current = now;
              return [...prev, newStep];
            } else {
              return [...prev.slice(0, -1), newStep];
            }
          });
        }
      );

      const removeErrorListener = window.electronAPI.onError(
        (event, errorData) => {
          setProcessingError(errorData.error || errorData.message);
          setIsProcessing(false);
        }
      );

      const removeCompleteListener = window.electronAPI.onComplete(
        (event, result) => {
          if (result.success) {
            setGeneratedClips(result.clips || []);
            setProcessingProgress(100);
            setProcessingStep("Complete!");
          } else {
            setProcessingError(result.error);
          }
          setIsProcessing(false);
        }
      );


      // Start the AI processing pipeline
      const result = await window.electronAPI.processVideo(videoPath, {
        openaiKey: openaiKey,
        ...clipSettings,
      });

      // Clean up event listeners
      setTimeout(() => {
        removeProgressListener();
        removeErrorListener();
        removeCompleteListener();
      }, 1000);
    } catch (error) {
      console.error(error);

      setProcessingError(`Failed to start processing: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const handleProcessComplete = (clips) => {
    setIsProcessing(false);
    setProcessingProgress(100);
    setGeneratedClips(clips);
    setProcessingStep("Complete!");
  };
  return (
    <div className="space-y-12">
      {/* Settings Panel */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700">
        <div
          className="p-6 cursor-pointer flex items-center justify-between"
          onClick={() => setShowSettings(!showSettings)}
        >
          <h3 className="text-lg font-semibold text-white flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Clip Generation Settings
          </h3>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${showSettings ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {showSettings && (
          <div className="px-6 pb-6 space-y-6 border-t border-gray-700 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Duration Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Clip Duration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-300 mb-1">Minimum Duration (seconds)</label>
                    <input
                      type="number"
                      min="10"
                      max="300"
                      value={clipSettings.minDuration}
                      onChange={(e) => {
                        const newMin = parseInt(e.target.value) || 30;
                        setClipSettings(prev => ({
                          ...prev,
                          minDuration: newMin,
                          maxDuration: Math.max(newMin, prev.maxDuration)
                        }));
                      }}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      disabled={isProcessing}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-300 mb-1">Maximum Duration (seconds)</label>
                    <input
                      type="number"
                      min="20"
                      max="600"
                      value={clipSettings.maxDuration}
                      onChange={(e) => {
                        const newMax = parseInt(e.target.value) || 90;
                        setClipSettings(prev => ({
                          ...prev,
                          maxDuration: newMax,
                          minDuration: Math.min(prev.minDuration, newMax)
                        }));
                      }}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      disabled={isProcessing}
                    />
                  </div>
                </div>
              </div>

              {/* Output Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Output Settings</h4>
                <div>
                  <label className="block text-xs text-gray-300 mb-1">Maximum Number of Clips</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={clipSettings.maxClips}
                    onChange={(e) => setClipSettings(prev => ({
                      ...prev,
                      maxClips: parseInt(e.target.value) || 5
                    }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={isProcessing}
                  />
                </div>
              </div>
            </div>

            {/* Content Preferences */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white">Content Preferences</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clipSettings.focusOnHighEnergy}
                    onChange={(e) => setClipSettings(prev => ({
                      ...prev,
                      focusOnHighEnergy: e.target.checked
                    }))}
                    className="w-4 h-4 text-primary-600 bg-gray-700 border-gray-600 rounded focus:ring-primary-500"
                    disabled={isProcessing}
                  />
                  <span className="text-sm text-gray-300">High Energy Moments</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clipSettings.includeActionableContent}
                    onChange={(e) => setClipSettings(prev => ({
                      ...prev,
                      includeActionableContent: e.target.checked
                    }))}
                    className="w-4 h-4 text-primary-600 bg-gray-700 border-gray-600 rounded focus:ring-primary-500"
                    disabled={isProcessing}
                  />
                  <span className="text-sm text-gray-300">Actionable Content</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clipSettings.includeEmotionalPeaks}
                    onChange={(e) => setClipSettings(prev => ({
                      ...prev,
                      includeEmotionalPeaks: e.target.checked
                    }))}
                    className="w-4 h-4 text-primary-600 bg-gray-700 border-gray-600 rounded focus:ring-primary-500"
                    disabled={isProcessing}
                  />
                  <span className="text-sm text-gray-300">Emotional Peaks</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clipSettings.includeInsights}
                    onChange={(e) => setClipSettings(prev => ({
                      ...prev,
                      includeInsights: e.target.checked
                    }))}
                    className="w-4 h-4 text-primary-600 bg-gray-700 border-gray-600 rounded focus:ring-primary-500"
                    disabled={isProcessing}
                  />
                  <span className="text-sm text-gray-300">Valuable Insights</span>
                </label>
              </div>
            </div>

            {/* Reset Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setClipSettings({
                  minDuration: 30,
                  maxDuration: 90,
                  maxClips: 5,
                  focusOnHighEnergy: true,
                  includeActionableContent: true,
                  includeEmotionalPeaks: true,
                  includeInsights: true
                })}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
                disabled={isProcessing}
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-12">
        {/* Left Side - Upload and Preview */}
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
            />
          )}

          {isProcessing && (
            <ProcessingStatus
              progress={processingProgress}
              currentStep={processingStep}
              totalElapsedTime={totalElapsedTime}
              estimatedTimeRemaining={estimatedTimeRemaining}
              detailedSteps={detailedSteps}
            />
          )}
        </div>

        {/* Right Side - Results and Info */}
        <div className="2xl:col-span-4 space-y-8">
          {/* Error Display */}
          {processingError && (
            <div className="bg-red-900/20 border border-red-700 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-red-300 mb-3 flex items-center">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                Processing Error
              </h3>
              <p className="text-red-200 text-sm">{processingError}</p>
              {processingError.includes("OpenAI API key") && (
                <p className="text-red-300 text-xs mt-2">
                  Go to Settings to add your OpenAI API key.
                </p>
              )}
            </div>
          )}

          <GeneratedClips clips={generatedClips} />

          {/* Help Panel - Only show when no video is selected */}
          {!selectedVideo && !isProcessing && generatedClips.length === 0 && (
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Tips</h3>
              <div className="space-y-4 text-sm text-gray-300">
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-primary-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Videos with clear speech work best</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-primary-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Longer videos provide more content options</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-primary-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Educational content performs well</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiShortsGenerator;

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
        maxClips: 5,
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

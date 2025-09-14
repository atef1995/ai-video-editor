import React from 'react';
import { EnhancedProgressBar } from './EnhancedProgressBar';

/**
 * Processing Status Component
 *
 * Displays processing progress for video operations with support for:
 * - Traditional step-by-step progress (AI pipeline)
 * - Dynamic real-time progress (jumpcutter/quiet parts)
 * - Enhanced progress visualization with timing information
 *
 * @param {Object} props - Component props
 * @param {number} props.progress - Progress percentage (0-100)
 * @param {string} props.currentStep - Current step description
 * @param {Array} props.steps - Predefined steps for traditional workflow
 * @param {string} props.phase - Current processing phase (for dynamic mode)
 * @param {Object} props.details - Additional progress details (for dynamic mode)
 * @param {number} props.totalElapsedTime - Total elapsed time in milliseconds
 * @param {number} props.estimatedTimeRemaining - Estimated time remaining in milliseconds
 * @param {Array} props.detailedSteps - Array of detailed step information
 */
export const ProcessingStatus = ({
  progress,
  currentStep = 'Initializing...',
  steps = [],
  phase,
  details = {},
  totalElapsedTime = 0,
  estimatedTimeRemaining = null,
  detailedSteps = []
}) => {
  const defaultSteps = [
    'Extracting video metadata',
    'Transcribing audio with Whisper',
    'Analyzing content with AI',
    'Identifying key moments',
    'Generating short clips',
    'Optimizing output'
  ];

  const processingSteps = steps.length > 0 ? steps : defaultSteps;
  const currentStepIndex = Math.floor((progress / 100) * processingSteps.length);

  // If steps is empty array, use dynamic step display
  const useDynamicSteps = steps.length === 0;

  // Helper function to format time
  const formatTime = (milliseconds) => {
    if (!milliseconds || milliseconds < 1000) return '< 1s';

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <div className="animate-spin w-5 h-5 mr-2 border-2 border-primary-500 border-t-transparent rounded-full" />
          Processing Video
        </h2>

        {/* Timing Information */}
        <div className="text-right text-sm">
          <div className="text-gray-400">
            Elapsed: <span className="text-white font-medium">{formatTime(totalElapsedTime)}</span>
          </div>
          {estimatedTimeRemaining && (
            <div className="text-gray-400">
              Remaining: <span className="text-primary-400 font-medium">{formatTime(estimatedTimeRemaining)}</span>
            </div>
          )}
        </div>
      </div>

      <div className={useDynamicSteps ? "space-y-4" : "space-y-6"}>
        {useDynamicSteps ? (
          // Enhanced dynamic progress display with HeadlessUI
          <EnhancedProgressBar
            progress={progress}
            step={currentStep}
            phase={phase}
            details={details}
            isProcessing={true}
          />
        ) : (
          // Traditional step-by-step with enhanced progress bar
          <>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-300">Overall Progress</span>
                <span className="text-sm font-medium text-primary-400">{Math.round(progress)}%</span>
              </div>

              <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Current Step Display */}
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-white">{currentStep}</div>
                {detailedSteps.length > 0 && detailedSteps[detailedSteps.length - 1]?.duration && (
                  <div className="text-xs text-gray-400">
                    {formatTime(detailedSteps[detailedSteps.length - 1].duration)}
                  </div>
                )}
              </div>

              {detailedSteps.length > 0 && detailedSteps[detailedSteps.length - 1]?.details && (
                <div className="text-xs text-gray-500 mt-1">
                  {detailedSteps[detailedSteps.length - 1].details}
                </div>
              )}
            </div>
          </>
        )}

        {!useDynamicSteps && (
          // Traditional step-by-step display for predefined workflows
          <div className="space-y-3">
            {processingSteps.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isUpcoming = index > currentStepIndex;

              return (
                <div key={index} className="flex items-center space-x-3">
                  <div className={`
                    flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                    ${isCompleted 
                      ? 'bg-green-500' 
                      : isCurrent 
                        ? 'bg-primary-500 animate-pulse' 
                        : 'bg-gray-600'
                    }
                  `}>
                    {isCompleted ? (
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span className="text-xs font-bold text-white">{index + 1}</span>
                    )}
                  </div>
                  
                  <span className={`
                    text-sm
                    ${isCompleted 
                      ? 'text-green-400' 
                      : isCurrent 
                        ? 'text-white font-medium' 
                        : 'text-gray-500'
                    }
                  `}>
                    {step}
                    {isCurrent && (
                      <span className="ml-2">
                        <span className="animate-pulse">•••</span>
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Detailed Steps History (if available) */}
        {detailedSteps.length > 1 && (
          <div className="mt-6 pt-4 border-t border-gray-700">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Step History</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {detailedSteps.slice(-5).map((step, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className={`${step.step.startsWith('✓') ? 'text-green-400' : 'text-gray-400'}`}>
                    {step.step}
                  </span>
                  {step.duration && (
                    <span className="text-gray-500">
                      {formatTime(step.duration)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-400 text-center">
            This may take several minutes depending on video length and complexity.
          </p>
        </div>
      </div>
    </div>
  );
};
import React from 'react';

export const ProcessingStatus = ({ progress, currentStep = 'Initializing...', steps = [] }) => {
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

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <div className="animate-spin w-5 h-5 mr-2 border-2 border-primary-500 border-t-transparent rounded-full" />
        Processing Video
      </h2>

      <div className="space-y-6">
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

        <div className="pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-400 text-center">
            This may take several minutes depending on video length and complexity.
          </p>
        </div>
      </div>
    </div>
  );
};
import React from 'react';
import { Transition } from '@headlessui/react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  CogIcon,
  FilmIcon,
  SpeakerWaveIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';

/**
 * Enhanced Progress Bar Component with HeadlessUI
 * 
 * Provides detailed progress tracking for video processing with:
 * - Phase-based progress visualization
 * - Smooth transitions and animations
 * - Rich progress details and statistics
 * - Phase-specific icons and colors
 * 
 * @param {Object} props - Component props
 * @param {number} props.progress - Progress percentage (0-100)
 * @param {string} props.step - Current step description
 * @param {string} props.phase - Current processing phase
 * @param {Object} props.details - Additional progress details
 * @param {boolean} props.isProcessing - Whether processing is active
 * @param {string} props.error - Error message if any
 */
export const EnhancedProgressBar = ({ 
  progress = 0, 
  step = 'Initializing...', 
  phase = 'initialization',
  details = {},
  isProcessing = true,
  error = null
}) => {
  // Define processing phases with their respective ranges and icons
  const phases = {
    initialization: { 
      icon: ClockIcon, 
      color: 'text-blue-500', 
      bgColor: 'bg-blue-500/20', 
      range: [0, 5],
      label: 'Initialization'
    },
    frame_extraction: { 
      icon: FilmIcon, 
      color: 'text-purple-500', 
      bgColor: 'bg-purple-500/20',
      range: [5, 20],
      label: 'Frame Extraction'
    },
    audio_extraction: { 
      icon: SpeakerWaveIcon, 
      color: 'text-green-500', 
      bgColor: 'bg-green-500/20',
      range: [20, 30],
      label: 'Audio Extraction'
    },
    analysis: { 
      icon: CogIcon, 
      color: 'text-yellow-500', 
      bgColor: 'bg-yellow-500/20',
      range: [30, 35],
      label: 'Analysis'
    },
    processing: { 
      icon: WrenchScrewdriverIcon, 
      color: 'text-orange-500', 
      bgColor: 'bg-orange-500/20',
      range: [35, 75],
      label: 'Processing'
    },
    assembly: { 
      icon: FilmIcon, 
      color: 'text-indigo-500', 
      bgColor: 'bg-indigo-500/20',
      range: [75, 98],
      label: 'Assembly'
    },
    finalization: { 
      icon: CheckCircleIcon, 
      color: 'text-green-600', 
      bgColor: 'bg-green-600/20',
      range: [98, 100],
      label: 'Finalization'
    }
  };

  const currentPhase = phases[phase] || phases.initialization;
  const PhaseIcon = currentPhase.icon;

  // Calculate phase completion percentage
  const [phaseStart, phaseEnd] = currentPhase.range;
  const phaseProgress = phaseEnd > phaseStart 
    ? Math.max(0, Math.min(100, ((progress - phaseStart) / (phaseEnd - phaseStart)) * 100))
    : 0;

  // We don't need detail items for the minimalistic design - removed unused code

  return (
    <div className="space-y-6">
      {/* Header with current step and phase */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`flex-shrink-0 ${currentPhase.color}`}>
            {error ? (
              <ExclamationCircleIcon className="w-6 h-6 text-red-500" />
            ) : progress >= 100 ? (
              <CheckCircleIconSolid className="w-6 h-6 text-green-500" />
            ) : (
              <PhaseIcon className={`w-6 h-6 ${isProcessing ? 'animate-pulse' : ''}`} />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{step}</h3>
            <p className={`text-sm ${currentPhase.color}`}>
              {currentPhase.label} • {Math.round(progress)}% Complete
            </p>
          </div>
        </div>
        
        {/* Progress percentage badge */}
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${currentPhase.bgColor} ${currentPhase.color}`}>
          {Math.round(progress)}%
        </div>
      </div>

      {/* Single Progress Bar */}
      <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
          style={{ 
            width: `${progress}%`,
            transform: 'translateZ(0)', // Force hardware acceleration
            backgroundColor:"blue"
          }}
        />
      </div>

      {/* Current Phase Indicator */}
      <div className="text-center">
        <span className="text-sm text-gray-400">
          {currentPhase.label}
        </span>
      </div>

      {/* Minimal Progress Details */}
      {details.processingSpeed && (
        <div className="text-center text-xs text-gray-500">
          Processing at {details.processingSpeed} speed
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Transition
          show={true}
          enter="transition-all duration-300"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          as="div"
          className="bg-red-900/20 border border-red-500 rounded-lg p-4"
        >
          <div className="flex items-center space-x-3">
            <ExclamationCircleIcon className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <h4 className="text-red-300 font-semibold">Processing Error</h4>
              <p className="text-red-200 text-sm mt-1">{error}</p>
            </div>
          </div>
        </Transition>
      )}
    </div>
  );
};

// Default export for easier importing
export default EnhancedProgressBar;
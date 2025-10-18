import { useState, useEffect } from 'react';
import { ExclamationTriangleIcon, CheckCircleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

/**
 * FFmpegInstallGuide - Displays FFmpeg installation status and instructions
 *
 * Checks if FFmpeg is available on the system and provides
 * platform-specific installation instructions if missing.
 */
export default function FFmpegInstallGuide({ onStatusChange }) {
  const [status, setStatus] = useState({
    checking: true,
    available: false,
    type: null,
    message: '',
    instructions: null
  });

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    checkFFmpeg();
  }, []);

  const checkFFmpeg = async () => {
    try {
      const result = await window.electronAPI.checkFFmpegAvailability();

      setStatus({
        checking: false,
        available: result.available,
        type: result.type,
        message: result.message,
        instructions: result.installInstructions || null
      });

      // Notify parent component of status
      if (onStatusChange) {
        onStatusChange(result.available);
      }
    } catch (error) {
      console.error('Failed to check FFmpeg:', error);
      setStatus({
        checking: false,
        available: false,
        type: 'error',
        message: 'Failed to check FFmpeg availability',
        instructions: null
      });

      if (onStatusChange) {
        onStatusChange(false);
      }
    }
  };

  const getPlatformName = () => {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('win')) return 'Windows';
    if (platform.includes('mac')) return 'macOS';
    return 'Linux';
  };

  const getPlatformKey = () => {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('win')) return 'windows';
    if (platform.includes('mac')) return 'darwin';
    return 'linux';
  };

  const getInstallationInstructions = () => {
    if (!status.instructions) return null;

    const platformKey = getPlatformKey();
    const instruction = status.instructions[platformKey];

    if (!instruction) return null;

    const downloadLinks = {
      windows: 'https://www.gyan.dev/ffmpeg/builds/',
      darwin: 'https://brew.sh/',
      linux: null
    };

    return {
      text: instruction,
      link: downloadLinks[platformKey]
    };
  };

  if (status.checking) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="text-sm text-gray-600">Checking FFmpeg availability...</span>
        </div>
      </div>
    );
  }

  if (status.available) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <CheckCircleIcon className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">{status.message}</p>
            <p className="text-xs text-green-600 mt-1">
              Video processing features are ready to use
            </p>
          </div>
        </div>
      </div>
    );
  }

  const instructions = getInstallationInstructions();

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-yellow-800">FFmpeg Not Found</h3>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-yellow-700 hover:text-yellow-900 font-medium"
            >
              {expanded ? 'Hide' : 'Show'} Instructions
            </button>
          </div>

          <p className="text-sm text-yellow-700 mt-1">
            FFmpeg is required for video processing. Please install it to use this feature.
          </p>

          {expanded && instructions && (
            <div className="mt-4 space-y-3">
              <div className="bg-white rounded-md p-3 border border-yellow-300">
                <p className="text-sm font-medium text-gray-900 mb-2">
                  Installation for {getPlatformName()}:
                </p>
                <p className="text-sm text-gray-700 font-mono bg-gray-50 p-2 rounded border border-gray-200">
                  {instructions.text}
                </p>
              </div>

              {instructions.link && (
                <button
                  onClick={() => window.electronAPI.openExternal(instructions.link)}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 transition-colors"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  <span>Download FFmpeg</span>
                </button>
              )}

              <button
                onClick={checkFFmpeg}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-white text-yellow-800 text-sm font-medium rounded-md border border-yellow-300 hover:bg-yellow-50 transition-colors ml-2"
              >
                <span>Check Again</span>
              </button>

              <div className="mt-3 pt-3 border-t border-yellow-200">
                <p className="text-xs text-yellow-600">
                  <strong>Note:</strong> After installing FFmpeg, you may need to restart the application.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

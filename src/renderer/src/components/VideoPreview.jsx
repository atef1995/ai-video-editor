import React, { useState, useRef, useEffect } from 'react';

export const VideoPreview = ({ videoPath, onProcessStart, disabled, buttonText = "Generate AI Shorts" }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [previewPath, setPreviewPath] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  useEffect(() => {
    if (videoPath) {
      prepareVideoPreview(videoPath);
    }
  }, [videoPath]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleError = () => {
      setPreviewError('Unable to load video preview. The file format may not be supported for preview.');
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleError);
    };
  }, [previewPath]);

  const prepareVideoPreview = async (path) => {
    setIsLoadingPreview(true);
    setPreviewError(null);
    
    try {
      // First try to use the original file
      setPreviewPath(path);
      
      // If it's an MKV file, we might need to convert it
      const fileExtension = path.split('.').pop().toLowerCase();
      if (fileExtension === 'mkv') {
        // Try to get video info first to check if conversion is needed
        const result = await window.electronAPI.getVideoInfo(path);
        if (result.success) {
          setPreviewPath(path); // Try original first
        }
      } else {
        setPreviewPath(path);
      }
    } catch (error) {
      setPreviewError('Failed to prepare video preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    video.currentTime = percent * duration;
  };

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4 flex items-center justify-between">
        <span className="flex items-center">
          <svg className="w-5 h-5 mr-2 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-10V5a2 2 0 00-2-2H9a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2V5z" />
          </svg>
          Video Preview
        </span>
      </h2>

      <div className="space-y-4">
        <div className="relative bg-black rounded-lg overflow-hidden">
          {isLoadingPreview ? (
            <div className="w-full h-64 flex items-center justify-center">
              <div className="text-white text-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p>Preparing video preview...</p>
              </div>
            </div>
          ) : previewError ? (
            <div className="w-full h-64 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="mb-2">{previewError}</p>
                <p className="text-sm">You can still process the video - preview is not required for AI generation.</p>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-64 object-contain"
                src={previewPath}
                onEnded={() => setIsPlaying(false)}
              />
              
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={togglePlay}
                  className="bg-black/50 hover:bg-black/70 rounded-full p-3 transition-colors"
                >
                  {isPlaying ? (
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {!previewError && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            
            <div
              className="w-full h-2 bg-gray-700 rounded-full cursor-pointer"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-100"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-gray-700">
          <button
            onClick={onProcessStart}
            disabled={disabled}
            className={`
              w-full py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center
              ${disabled 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                : 'bg-primary-600 hover:bg-primary-700 text-white'
              }
            `}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {disabled ? 'Processing...' : buttonText}
          </button>
        </div>

        <div className="text-sm text-gray-400">
          <p className="mb-2">
            <strong>File:</strong> {videoPath.split(/[/\\]/).pop()}
          </p>
          <p>
            <strong>Duration:</strong> {formatTime(duration)}
          </p>
        </div>
      </div>
    </div>
  );
};
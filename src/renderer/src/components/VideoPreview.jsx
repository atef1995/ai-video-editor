import React, { useState, useRef, useEffect, useCallback } from "react";
import { SubtitleOverlay } from "./subtitle/SubtitleOverlay";
import { useVideo } from "../contexts/VideoContext";

export const VideoPreview = ({
  videoPath,
  onProcessStart,
  disabled,
  buttonText = "Generate AI Shorts",
  showSubtitlePreview = false,
  subtitleSettings = null,
  transcriptionResult = null,
  // New subtitle overlay props
  showSubtitleOverlay = false,
  onSubtitleOverlayToggle = null,
  subtitleOverlayData = [],
  onSubtitleUpdate = null,
}) => {
  const { videoInfo, handleVideoInfoLoad } = useVideo();
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [previewPath, setPreviewPath] = useState(videoInfo?.createdBlobUrl);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    if (videoPath && !videoInfo) {
      prepareVideoPreview(videoPath);
    }
  }, [videoPath, previewPath, videoInfo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      // Update current subtitle based on video time
      if (showSubtitlePreview && transcriptionResult?.transcription?.segments) {
        const currentSub = transcriptionResult.transcription.segments.find(
          (segment) =>
            video.currentTime >= segment.start &&
            video.currentTime <= segment.end
        );
        setCurrentSubtitle(currentSub?.text || "");
      }
    };

    const handleError = (e) => {
      console.error("Video loading error:", e);
      console.error("Video element:", video);
      console.error("Video src:", video?.src);
      console.error("Video networkState:", video?.networkState);
      console.error("Video readyState:", video?.readyState);
      setPreviewError(
        "Unable to load video preview. The file format may not be supported for preview."
      );
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("error", handleError);
    };
  }, [previewPath]);

  const prepareVideoPreview = async (path) => {
    setIsLoadingPreview(true);
    setPreviewError(null);

    try {
      console.log(videoInfo);

      if (videoInfo) {
        setBlobUrl(videoInfo.createdBlobUrl);
        setPreviewPath(videoInfo.createdBlobUrl);
        return;
      }

      // Get video information for aspect ratio and metadata
      const infoResult = await window.electronAPI.getVideoInfo(path);
      if (infoResult.success) {
        const info = infoResult.info;
        handleVideoInfoLoad({
          width: info.width,
          height: info.height,
          duration: info.duration,
          aspectRatio: info.width / info.height,
          isVertical: info.width / info.height < 1.0,
          isSquare: Math.abs(info.width / info.height - 1.0) < 0.1,
          isWidescreen: info.width / info.height > 1.7,
        });
      }

      // Try blob URL approach first
      try {
        console.log("Attempting blob URL approach...");
        const bufferResult = await window.electronAPI.getVideoBuffer(path);
        if (bufferResult.success) {
          // Create blob from buffer
          const uint8Array = new Uint8Array(bufferResult.buffer);
          const blob = new Blob([uint8Array], { type: bufferResult.mimeType });
          const createdBlobUrl = URL.createObjectURL(blob);
          handleVideoInfoLoad((prev) => {
            return { ...prev, createdBlobUrl };
          });
          console.log("Setting blob video URL:", createdBlobUrl);
          setBlobUrl(createdBlobUrl);
          setPreviewPath(createdBlobUrl);
        } else {
          throw new Error(bufferResult.error);
        }
      } catch (blobError) {
        console.warn(
          "Blob URL approach failed, trying secure protocol:",
          blobError
        );

        // Fallback to secure protocol
        const urlResult = await window.electronAPI.getVideoPreviewUrl(path);
        if (urlResult.success) {
          console.log("Setting secure video preview URL:", urlResult.url);
          setPreviewPath(urlResult.url);
        } else {
          throw new Error(
            `Both approaches failed. Blob: ${blobError.message}, Protocol: ${urlResult.error}`
          );
        }
      }
    } catch (error) {
      console.error("Video preview preparation failed:", error);
      setPreviewError(
        "Unable to prepare video preview. Processing will still work."
      );
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
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    video.currentTime = percent * duration;
  };

  const downloadSRT = () => {
    if (!transcriptionResult?.transcription?.segments) return;

    const formatSRTTime = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const milliseconds = Math.floor((seconds % 1) * 1000);

      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")},${milliseconds
        .toString()
        .padStart(3, "0")}`;
    };

    let srtContent = "";
    transcriptionResult.transcription.segments.forEach((segment, index) => {
      const startTime = formatSRTTime(segment.start);
      const endTime = formatSRTTime(segment.end);
      const text = segment.text.trim();

      srtContent += `${index + 1}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${text}\n\n`;
    });

    const blob = new Blob([srtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subtitles_${Date.now()}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getSubtitlePositionStyle = () => {
    if (!videoInfo || !subtitleSettings) return {};

    const position = subtitleSettings.position || "bottom";
    let positionStyle = {};

    if (position === "top") {
      positionStyle = { top: "10%", transform: "translateY(0)" };
    } else if (position === "center") {
      positionStyle = { top: "50%", transform: "translateY(-50%)" };
    } else {
      positionStyle = { bottom: "10%", transform: "translateY(0)" };
    }

    // Adjust font size based on aspect ratio
    let fontSize = subtitleSettings.fontsize || 24;
    if (videoInfo.isVertical) {
      fontSize = Math.max(fontSize * 1.2, 28);
    } else if (videoInfo.isWidescreen) {
      fontSize = Math.max(fontSize * 0.8, 18);
    }

    return {
      ...positionStyle,
      fontSize: `${fontSize}px`,
      color: subtitleSettings.color || "white",
      textShadow: `2px 2px 4px ${subtitleSettings.strokeColor || "black"}`,
      fontWeight: "bold",
      textAlign: "center",
      padding: "8px 16px",
      maxWidth: "80%",
      left: "50%",
      transform: `translateX(-50%) ${positionStyle.transform || ""}`,
      position: "absolute",
      zIndex: 10,
      background: "rgba(0,0,0,0.3)",
      borderRadius: "4px",
      wordWrap: "break-word",
    };
  };

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4 flex items-center justify-between">
        <span className="flex items-center">
          <svg
            className="w-5 h-5 mr-2 text-primary-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-10V5a2 2 0 00-2-2H9a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2V5z"
            />
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
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p className="mb-2">{previewError}</p>
                <p className="text-sm">
                  You can still process the video - preview is not required for
                  AI generation.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-64">
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                src={previewPath}
                onEnded={() => setIsPlaying(false)}
              />

              {/* Legacy Subtitle Preview Overlay */}
              {showSubtitlePreview &&
                currentSubtitle &&
                !showSubtitleOverlay && (
                  <div
                    className="absolute pointer-events-none"
                    style={getSubtitlePositionStyle()}
                  >
                    {currentSubtitle}
                  </div>
                )}

              {/* Interactive Subtitle Overlay */}
              {showSubtitleOverlay && subtitleOverlayData.length > 0 && (
                <SubtitleOverlay
                  subtitles={subtitleOverlayData}
                  currentTime={currentTime}
                  isVisible={showSubtitleOverlay}
                  onSubtitleUpdate={onSubtitleUpdate}
                />
              )}

              {/* Debug info */}
              {showSubtitleOverlay && (
                <div className="absolute top-2 left-2 bg-red-900 bg-opacity-75 text-white px-2 py-1 rounded text-xs z-20">
                  Debug: Overlay={showSubtitleOverlay ? "ON" : "OFF"}, Data=
                  {subtitleOverlayData.length} subtitles
                </div>
              )}

              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={togglePlay}
                  className="bg-black/50 hover:bg-black/70 rounded-full p-3 transition-colors"
                >
                  {isPlaying ? (
                    <svg
                      className="w-8 h-8 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                    </svg>
                  ) : (
                    <svg
                      className="w-8 h-8 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
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
                style={{
                  width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-gray-700 space-y-3">
          {/* Subtitle Overlay Toggle */}
          {onSubtitleOverlayToggle && subtitleOverlayData.length > 0 && (
            <button
              onClick={() => onSubtitleOverlayToggle(!showSubtitleOverlay)}
              className={`
                w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center text-sm
                ${
                  showSubtitleOverlay
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-gray-600 hover:bg-gray-700 text-white"
                }
              `}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v1a1 1 0 01-1 1v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7a1 1 0 01-1-1V5a1 1 0 011-1h4z"
                />
              </svg>
              {showSubtitleOverlay
                ? "Hide Subtitle Editor"
                : "Edit Subtitle Positions"}
            </button>
          )}

          <button
            onClick={() => onProcessStart && onProcessStart(videoPath)}
            disabled={disabled}
            className={`
              w-full py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center
              ${
                disabled
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-primary-600 hover:bg-primary-700 text-white"
              }
            `}
          >
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
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            {disabled ? "Processing..." : buttonText}
          </button>
        </div>

        <div className="text-sm text-gray-400">
          <p className="mb-2">
            <strong>File:</strong> {videoPath.split(/[/\\]/).pop()}
          </p>
          <p className="mb-2">
            <strong>Duration:</strong> {formatTime(duration)}
          </p>
          {videoInfo && (
            <div className="mb-2">
              <p className="mb-1">
                <strong>Resolution:</strong> {videoInfo.width}×
                {videoInfo.height}
              </p>
              <p className="mb-1">
                <strong>Aspect Ratio:</strong>{" "}
                {videoInfo.aspectRatio.toFixed(2)}{" "}
                {videoInfo.isVertical
                  ? "(Vertical)"
                  : videoInfo.isSquare
                  ? "(Square)"
                  : videoInfo.isWidescreen
                  ? "(Widescreen)"
                  : "(Standard)"}
              </p>
            </div>
          )}

          {showSubtitlePreview && transcriptionResult && (
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
              <h4 className="text-blue-300 font-medium mb-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v1a1 1 0 01-1 1v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7a1 1 0 01-1-1V5a1 1 0 011-1h4z"
                  />
                </svg>
                Subtitle Preview Active
              </h4>
              <p className="text-blue-200 text-xs mb-3">
                Play the video to see subtitles positioned as they will appear
                in the final output. Subtitles are automatically optimized for{" "}
                {videoInfo?.isVertical
                  ? "vertical"
                  : videoInfo?.isSquare
                  ? "square"
                  : "standard"}{" "}
                aspect ratio.
              </p>
              <button
                onClick={downloadSRT}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors flex items-center justify-center"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download SRT File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { createContext, useContext, useState } from 'react';

const VideoContext = createContext();

export const VideoProvider = ({ children }) => {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoInfo, setVideoInfo] = useState(null);

  const handleVideoSelect = (videoPath) => {
    setSelectedVideo(videoPath);
    setVideoInfo(null); // Reset video info when new video is selected
  };

  const handleVideoInfoLoad = (info) => {
    setVideoInfo(info);
  };

  const clearVideo = () => {
    setSelectedVideo(null);
    setVideoInfo(null);
  };

  const value = {
    selectedVideo,
    videoInfo,
    handleVideoSelect,
    handleVideoInfoLoad,
    clearVideo,
    hasVideo: !!selectedVideo
  };

  return (
    <VideoContext.Provider value={value}>
      {children}
    </VideoContext.Provider>
  );
};

export const useVideo = () => {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
};
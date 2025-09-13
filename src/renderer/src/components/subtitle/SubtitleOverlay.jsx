import React, { useState, useRef, useEffect } from 'react';
import { SubtitleBox } from './SubtitleBox';

export const SubtitleOverlay = ({
  subtitles = [],
  currentTime = 0,
  isVisible = true,
  onSubtitleUpdate,
  style = {}
}) => {
  const [selectedSubtitleId, setSelectedSubtitleId] = useState(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const overlayRef = useRef(null);

  // Update container dimensions when overlay size changes
  useEffect(() => {
    const updateDimensions = () => {
      if (overlayRef.current) {
        const rect = overlayRef.current.getBoundingClientRect();
        setContainerDimensions({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (overlayRef.current) {
      resizeObserver.observe(overlayRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Handle subtitle updates (position/size changes)
  const handleSubtitleUpdate = (subtitleId, updates) => {
    if (onSubtitleUpdate) {
      onSubtitleUpdate(subtitleId, updates);
    }
  };

  // Handle subtitle selection
  const handleSubtitleSelect = (subtitleId) => {
    setSelectedSubtitleId(subtitleId);
  };

  // Handle clicking empty space (deselect all)
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      setSelectedSubtitleId(null);
    }
  };

  // Filter subtitles that should be visible at current time
  const getVisibleSubtitles = () => {
    return subtitles.filter(subtitle =>
      currentTime >= subtitle.startTime && currentTime <= subtitle.endTime
    );
  };

  // Get all subtitles for positioning (show all with reduced opacity when not active)
  const getAllSubtitles = () => {
    return subtitles.map(subtitle => ({
      ...subtitle,
      isActive: currentTime >= subtitle.startTime && currentTime <= subtitle.endTime
    }));
  };

  if (!isVisible) {
    return null;
  }

  const subtitlesToRender = getAllSubtitles();

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-auto"
      style={{
        zIndex: 10,
        ...style
      }}
      onClick={handleOverlayClick}
    >
      {/* Helper grid lines (optional - can be toggled) */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        {/* Vertical center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white" />
        {/* Horizontal thirds */}
        <div className="absolute left-0 right-0 top-1/3 h-px bg-white" />
        <div className="absolute left-0 right-0 top-2/3 h-px bg-white" />
        {/* Bottom safe zone */}
        <div className="absolute left-0 right-0 bottom-[10%] h-px bg-yellow-400 opacity-30" />
      </div>

      {/* Render all subtitle boxes */}
      {subtitlesToRender.map((subtitle) => (
        <SubtitleBox
          key={subtitle.id}
          subtitle={subtitle}
          isActive={subtitle.isActive}
          isSelected={selectedSubtitleId === subtitle.id}
          containerDimensions={containerDimensions}
          onUpdate={handleSubtitleUpdate}
          onSelect={handleSubtitleSelect}
          style={subtitle.style || {}}
        />
      ))}

      {/* Selection info overlay */}
      {selectedSubtitleId && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs pointer-events-none">
          Selected: Subtitle {subtitlesToRender.findIndex(s => s.id === selectedSubtitleId) + 1}
        </div>
      )}

      {/* Instructions overlay */}
      {subtitlesToRender.length > 0 && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs pointer-events-none">
          <div>Click to select • Drag to move</div>
          <div>Drag corner to resize</div>
        </div>
      )}
    </div>
  );
};
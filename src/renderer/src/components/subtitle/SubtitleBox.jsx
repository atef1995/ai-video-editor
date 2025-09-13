import React, { useState, useRef, useEffect } from 'react';

export const SubtitleBox = ({
  subtitle,
  isActive,
  isSelected,
  containerDimensions,
  onUpdate,
  onSelect,
  style = {}
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const boxRef = useRef(null);

  // Default positioning and sizing (percentages of container)
  const defaultPosition = {
    x: subtitle.position?.x || 10, // 10% from left
    y: subtitle.position?.y || 80, // 80% from top (near bottom)
    width: subtitle.size?.width || 80, // 80% of container width
    height: subtitle.size?.height || 10 // 10% of container height
  };

  const [position, setPosition] = useState(defaultPosition);

  // Convert percentage to pixels for display
  const getPixelPosition = () => ({
    left: (position.x / 100) * containerDimensions.width,
    top: (position.y / 100) * containerDimensions.height,
    width: (position.width / 100) * containerDimensions.width,
    height: (position.height / 100) * containerDimensions.height
  });

  // Convert pixel position back to percentage
  const getPercentagePosition = (pixelPos) => ({
    x: (pixelPos.left / containerDimensions.width) * 100,
    y: (pixelPos.top / containerDimensions.height) * 100,
    width: (pixelPos.width / containerDimensions.width) * 100,
    height: (pixelPos.height / containerDimensions.height) * 100
  });

  // Handle drag start
  const handleMouseDown = (e) => {
    if (e.target.classList.contains('resize-handle')) return;

    e.preventDefault();
    e.stopPropagation();
    onSelect(subtitle.id);

    setIsDragging(true);
    const rect = boxRef.current.getBoundingClientRect();
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  // Handle resize start
  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    const pixelPos = getPixelPosition();
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: pixelPos.width,
      height: pixelPos.height
    });
  };

  // Handle mouse move for dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const containerRect = boxRef.current.parentElement.getBoundingClientRect();
        const newLeft = e.clientX - containerRect.left - dragStart.x;
        const newTop = e.clientY - containerRect.top - dragStart.y;

        // Constrain to container bounds
        const pixelPos = getPixelPosition();
        const constrainedLeft = Math.max(0, Math.min(newLeft, containerDimensions.width - pixelPos.width));
        const constrainedTop = Math.max(0, Math.min(newTop, containerDimensions.height - pixelPos.height));

        const newPosition = getPercentagePosition({
          left: constrainedLeft,
          top: constrainedTop,
          width: pixelPos.width,
          height: pixelPos.height
        });

        setPosition(prev => ({ ...prev, x: newPosition.x, y: newPosition.y }));
      }

      if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;

        const newWidth = Math.max(50, resizeStart.width + deltaX); // Min 50px width
        const newHeight = Math.max(20, resizeStart.height + deltaY); // Min 20px height

        // Constrain to container bounds
        const pixelPos = getPixelPosition();
        const maxWidth = containerDimensions.width - pixelPos.left;
        const maxHeight = containerDimensions.height - pixelPos.top;

        const constrainedWidth = Math.min(newWidth, maxWidth);
        const constrainedHeight = Math.min(newHeight, maxHeight);

        const newPosition = getPercentagePosition({
          left: pixelPos.left,
          top: pixelPos.top,
          width: constrainedWidth,
          height: constrainedHeight
        });

        setPosition(prev => ({ ...prev, width: newPosition.width, height: newPosition.height }));
      }
    };

    const handleMouseUp = () => {
      if (isDragging || isResizing) {
        // Update parent component with new position
        onUpdate(subtitle.id, {
          position: { x: position.x, y: position.y },
          size: { width: position.width, height: position.height }
        });
      }
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, resizeStart, position, subtitle.id, onUpdate, containerDimensions]);

  const pixelPosition = getPixelPosition();

  // Calculate font size based on container size
  const fontSize = Math.max(12, Math.min(24, pixelPosition.height * 0.4));

  return (
    <div
      ref={boxRef}
      className={`absolute cursor-move select-none transition-opacity ${
        isActive ? 'opacity-100' : 'opacity-70'
      } ${
        isSelected ? 'ring-2 ring-blue-400 ring-opacity-75' : ''
      }`}
      style={{
        left: pixelPosition.left,
        top: pixelPosition.top,
        width: pixelPosition.width,
        height: pixelPosition.height,
        backgroundColor: style.backgroundColor || 'rgba(0, 0, 0, 0.7)',
        borderRadius: '4px',
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: isSelected ? '2px solid #60a5fa' : '1px solid rgba(255, 255, 255, 0.2)',
        boxSizing: 'border-box'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Subtitle text */}
      <div
        className="text-center leading-tight overflow-hidden"
        style={{
          color: style.color || 'white',
          fontSize: `${fontSize}px`,
          fontFamily: style.fontFamily || 'Arial, sans-serif',
          fontWeight: style.fontWeight || 'bold',
          textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
          wordWrap: 'break-word',
          hyphens: 'auto'
        }}
      >
        {subtitle.text}
      </div>

      {/* Resize handle - only show when selected */}
      {isSelected && (
        <div
          className="resize-handle absolute bottom-0 right-0 w-3 h-3 bg-blue-400 cursor-se-resize opacity-75 hover:opacity-100"
          style={{
            clipPath: 'polygon(100% 0, 0 100%, 100% 100%)'
          }}
          onMouseDown={handleResizeStart}
        />
      )}

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute inset-0 pointer-events-none border-2 border-blue-400 border-dashed opacity-50" />
      )}
    </div>
  );
};
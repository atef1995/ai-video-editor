import React, { useState } from 'react';

export const GeneratedClips = ({ clips = [] }) => {
  const [selectedClip, setSelectedClip] = useState(null);

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getEngagementColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const handleExport = (clip) => {
    console.log('Exporting clip:', clip);
  };

  if (clips.length === 0) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Generated Clips
        </h2>
        
        <div className="text-center py-8 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-lg font-medium mb-2">No clips generated yet</p>
          <p className="text-sm">Upload a video and click "Generate AI Shorts" to start</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4 flex items-center justify-between">
        <span className="flex items-center">
          <svg className="w-5 h-5 mr-2 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Generated Clips
        </span>
        <span className="text-sm bg-primary-500 text-white px-2 py-1 rounded-full">
          {clips.length}
        </span>
      </h2>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {clips.map((clip, index) => (
          <div
            key={index}
            className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer"
            onClick={() => setSelectedClip(selectedClip === index ? null : index)}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-white">
                Clip {index + 1}
              </h3>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${getEngagementColor(clip.engagementScore || 75)}`}>
                  {clip.engagementScore || 75}%
                </span>
                <svg className={`w-4 h-4 transform transition-transform ${selectedClip === index ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
              <span>{formatDuration(clip.startTime || 0)} - {formatDuration(clip.endTime || 30)}</span>
              <span>{formatDuration((clip.endTime || 30) - (clip.startTime || 0))}</span>
            </div>

            {selectedClip === index && (
              <div className="mt-4 pt-4 border-t border-gray-600 animate-slide-up">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-1">Description</h4>
                    <p className="text-sm text-gray-400">
                      {clip.description || 'AI-generated short clip with high engagement potential'}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-1">Key Topics</h4>
                    <div className="flex flex-wrap gap-1">
                      {(clip.topics || ['AI', 'Technology', 'Innovation']).map((topic, idx) => (
                        <span key={idx} className="text-xs bg-gray-600 text-gray-300 px-2 py-1 rounded">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Preview functionality
                      }}
                      className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
                    >
                      Preview
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport(clip);
                      }}
                      className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
                    >
                      Export
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
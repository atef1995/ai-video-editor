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
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-2">Generated Clips</h2>
          <p className="text-gray-400 text-sm">Your AI-generated clips will appear here</p>
        </div>
        
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No clips yet</h3>
          <p className="text-gray-400 text-sm">Process a video to generate clips</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Generated Clips</h2>
          <p className="text-gray-400 text-sm">{clips.length} clips ready</p>
        </div>
        <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
          {clips.length}
        </div>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {clips.map((clip, index) => (
          <div
            key={index}
            className="bg-gray-700 rounded-xl p-6 hover:bg-gray-600 transition-colors cursor-pointer border border-gray-600"
            onClick={() => setSelectedClip(selectedClip === index ? null : index)}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white text-lg">
                Clip {index + 1}
              </h3>
              <div className="flex items-center space-x-3">
                <span className={`text-sm font-medium ${getEngagementColor(clip.engagementScore || 75)}`}>
                  {clip.engagementScore || 75}%
                </span>
                <svg className={`w-4 h-4 transform transition-transform duration-200 text-gray-400 ${selectedClip === index ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm mb-4">
              <span className="text-gray-300">{formatDuration(clip.startTime || 0)} - {formatDuration(clip.endTime || 30)}</span>
              <span className="text-primary-400 font-medium">{formatDuration((clip.endTime || 30) - (clip.startTime || 0))}</span>
            </div>

            {selectedClip === index && (
              <div className="mt-6 pt-6 border-t border-gray-600">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Description</h4>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {clip.description || 'AI-generated clip with high engagement potential.'}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Topics</h4>
                    <div className="flex flex-wrap gap-2">
                      {(clip.topics || ['AI', 'Technology', 'Innovation']).map((topic, idx) => (
                        <span key={idx} className="text-xs bg-gray-600 text-gray-300 px-3 py-1 rounded-full">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Preview functionality
                      }}
                      className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                    >
                      Preview
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport(clip);
                      }}
                      className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
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
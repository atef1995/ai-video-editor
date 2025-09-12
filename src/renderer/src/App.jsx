import React, { useState } from 'react';
import { VideoUpload } from './components/VideoUpload';
import { VideoPreview } from './components/VideoPreview';
import { ProcessingStatus } from './components/ProcessingStatus';
import { GeneratedClips } from './components/GeneratedClips';
import { Tabs, TabPanel } from './components/Tabs';
import { QuietPartsMode } from './components/QuietPartsMode';
import { SparklesIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';

function App() {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [generatedClips, setGeneratedClips] = useState([]);
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      name: 'AI Shorts Generator',
      icon: SparklesIcon,
    },
    {
      name: 'Cut Quiet Parts',
      icon: SpeakerXMarkIcon,
    },
  ];

  const handleVideoSelect = (videoPath) => {
    setSelectedVideo(videoPath);
    setGeneratedClips([]);
  };

  const handleProcessStart = () => {
    setIsProcessing(true);
    setProcessingProgress(0);
  };

  const handleProcessComplete = (clips) => {
    setIsProcessing(false);
    setProcessingProgress(100);
    setGeneratedClips(clips);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-white flex items-center">
            <svg className="w-8 h-8 mr-3 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            AI Video Editor
          </h1>
          <p className="text-gray-400 mt-1">
            Transform long-form videos into engaging short clips using AI
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs tabs={tabs} selectedIndex={activeTab} onChange={setActiveTab}>
          <TabPanel>
            {/* AI Shorts Generator Mode */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Video Upload and Preview */}
              <div className="lg:col-span-2 space-y-6 mt-4">
                <VideoUpload 
                  onVideoSelect={handleVideoSelect}
                  disabled={isProcessing}
                />
                
                {selectedVideo && (
                  <VideoPreview 
                    videoPath={selectedVideo}
                    onProcessStart={handleProcessStart}
                    disabled={isProcessing}
                  />
                )}
                
                {isProcessing && (
                  <ProcessingStatus progress={processingProgress} />
                )}
              </div>

              {/* Right Column - Generated Clips */}
              <div className="space-y-6">
                <GeneratedClips clips={generatedClips} />
              </div>
            </div>
          </TabPanel>
          
          <TabPanel>
            {/* Cut Quiet Parts Mode */}
            <QuietPartsMode />
          </TabPanel>
        </Tabs>
      </main>
    </div>
  );
}

export default App;
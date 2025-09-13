import React, { useState } from 'react';
import { VideoUpload } from './components/VideoUpload';
import { VideoPreview } from './components/VideoPreview';
import { ProcessingStatus } from './components/ProcessingStatus';
import { GeneratedClips } from './components/GeneratedClips';
import { Tabs } from './components/Tabs';
import { QuietPartsMode } from './components/QuietPartsMode';
import { TranscriptionMode } from './components/TranscriptionMode';
import { VideoProvider, useVideo } from './contexts/VideoContext';
import { SparklesIcon, SpeakerXMarkIcon, MicrophoneIcon } from '@heroicons/react/24/outline';

function AppContent() {
  const { selectedVideo, handleVideoSelect, hasVideo } = useVideo();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [generatedClips, setGeneratedClips] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [processingStep, setProcessingStep] = useState('');

  const tabs = [
    {
      name: 'AI Shorts Generator',
      icon: SparklesIcon,
    },
    {
      name: 'Cut Quiet Parts',
      icon: SpeakerXMarkIcon,
    },
    {
      name: 'Transcription',
      icon: MicrophoneIcon,
    },
  ];

  const handleVideoSelectLocal = (videoPath) => {
    handleVideoSelect(videoPath);
    setGeneratedClips([]);
    setShowWelcome(false);
  };

  const handleProcessStart = () => {
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStep('Starting AI analysis...');
  };

  const handleProcessComplete = (clips) => {
    setIsProcessing(false);
    setProcessingProgress(100);
    setGeneratedClips(clips);
    setProcessingStep('Complete!');
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div className='h-full'>
                <h1 className="text-xl font-semibold text-white">AI Video Editor</h1>
                <p className="text-gray-400 text-sm">Transform videos into engaging clips</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-sm text-gray-400">Ready</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* Welcome Section - Only show on first load */}
        {showWelcome && !selectedVideo && (
          <div className="mb-16 text-center">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-4xl font-bold text-white mb-6">Welcome to AI Video Editor</h2>
              <p className="text-xl text-gray-300 mb-12 leading-relaxed">
                Upload your video and let our AI create engaging short clips automatically. 
                Perfect for social media, marketing, and content creation.
              </p>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-xl">1</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Upload</h3>
                  <p className="text-gray-400">Select your video file</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-xl">2</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Process</h3>
                  <p className="text-gray-400">AI analyzes your content</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-xl">3</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Export</h3>
                  <p className="text-gray-400">Download your clips</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        
          <Tabs tabs={tabs} selectedIndex={activeTab} onChange={setActiveTab} />
        

        {/* Tab Content */}
        {activeTab === 0 && (
          <div className="space-y-12">
            {/* Progress Indicator - Only show when video is selected */}
            {selectedVideo && (
              <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Progress</h3>
                  {isProcessing && (
                    <div className="flex items-center space-x-2 text-primary-400">
                      <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">{processingStep}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between max-w-2xl">
                  <div className="flex flex-col items-center space-y-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedVideo ? 'bg-green-500' : 'bg-gray-600'}`}>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-300 font-medium">Upload</span>
                  </div>
                  
                  <div className={`flex-1 h-1 mx-8 rounded-full ${selectedVideo ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                  
                  <div className="flex flex-col items-center space-y-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isProcessing || generatedClips.length > 0 ? 'bg-blue-500' : 'bg-gray-600'}`}>
                      {isProcessing ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : generatedClips.length > 0 ? (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-white text-sm font-semibold">2</span>
                      )}
                    </div>
                    <span className="text-sm text-gray-300 font-medium">Process</span>
                  </div>
                  
                  <div className={`flex-1 h-1 mx-8 rounded-full ${generatedClips.length > 0 ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                  
                  <div className="flex flex-col items-center space-y-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${generatedClips.length > 0 ? 'bg-green-500' : 'bg-gray-600'}`}>
                      {generatedClips.length > 0 ? (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-white text-sm font-semibold">3</span>
                      )}
                    </div>
                    <span className="text-sm text-gray-300 font-medium">Complete</span>
                  </div>
                </div>
              </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-12">
              {/* Left Side - Upload and Preview */}
              <div className="2xl:col-span-8 space-y-8">
                <VideoUpload
                  onVideoSelect={handleVideoSelectLocal}
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

              {/* Right Side - Results and Info */}
              <div className="2xl:col-span-4 space-y-8">
                <GeneratedClips clips={generatedClips} />
                
                {/* Help Panel - Only show when no video is selected */}
                {!selectedVideo && !isProcessing && generatedClips.length === 0 && (
                  <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Tips</h3>
                    <div className="space-y-4 text-sm text-gray-300">
                      <div className="flex items-start space-x-3">
                        <div className="w-1.5 h-1.5 bg-primary-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Videos with clear speech work best</p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="w-1.5 h-1.5 bg-primary-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Longer videos provide more content options</p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="w-1.5 h-1.5 bg-primary-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Educational content performs well</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Processing Info */}
                {isProcessing && (
                  <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Processing
                    </h3>
                    <div className="space-y-4">
                      <p className="text-sm text-gray-300">Analyzing your video content...</p>
                      <div className="bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-primary-500 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${processingProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-400">This may take a few minutes</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 1 && (
          <div className="max-w-5xl mx-auto">
            <QuietPartsMode />
          </div>
        )}
        
        {activeTab === 2 && (
          <div className="max-w-5xl mx-auto">
            <TranscriptionMode />
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <VideoProvider>
      <AppContent />
    </VideoProvider>
  );
}

export default App;
import { useState } from "react";
import { Tabs } from "./components/Tabs";
import { QuietPartsMode } from "./components/QuietPartsMode";
import { TranscriptionMode } from "./components/TranscriptionMode";
import { VideoProvider, useVideo } from "./contexts/VideoContext";
import {
  SparklesIcon,
  SpeakerXMarkIcon,
  MicrophoneIcon,
  CogIcon,
} from "@heroicons/react/24/outline";
import AiShortsGenerator from "./components/AiShortsGenerator";
import Settings from "./components/Settings";

function AppContent() {
  const { selectedVideo, handleVideoSelect, hasVideo } = useVideo();

  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      name: "AI Shorts Generator",
      icon: SparklesIcon,
    },
    {
      name: "Cut Quiet Parts",
      icon: SpeakerXMarkIcon,
    },
    {
      name: "Transcription",
      icon: MicrophoneIcon,
    },
    {
      name: "Settings",
      icon: CogIcon,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
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
              </div>
              <div className="h-full">
                <h1 className="text-xl font-semibold text-white">
                  AI Video Editor
                </h1>
                <p className="text-gray-400 text-sm">
                  Transform videos into engaging clips
                </p>
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
        {!selectedVideo && (
          <div className="mb-16 text-center">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-4xl font-bold text-white mb-6">
                Welcome to AI Video Editor
              </h2>
              <p className="text-xl text-gray-300 mb-12 leading-relaxed">
                Upload your video and let our AI create engaging short clips
                automatically. Perfect for social media, marketing, and content
                creation.
              </p>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-xl">1</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Upload
                  </h3>
                  <p className="text-gray-400">Select your video file</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-xl">2</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Process
                  </h3>
                  <p className="text-gray-400">AI analyzes your content</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-xl">3</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Export
                  </h3>
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
          <AiShortsGenerator
            selectedVideo={selectedVideo}
            handleVideoSelect={handleVideoSelect}
            hasVideo={hasVideo}
          />
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

        {activeTab === 3 && <Settings />}
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

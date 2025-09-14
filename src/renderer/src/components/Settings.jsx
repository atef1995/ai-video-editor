import { useState, useEffect } from "react";

const Settings = () => {
  const [openaiKey, setOpenaiKey] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState(""); // "valid", "invalid", "unchecked"

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const result = await window.electronAPI.getSetting('openai_key');
      if (result.success && result.value) {
        setOpenaiKey(result.value);
        setKeyStatus("unchecked");
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateApiKey = (key) => {
    // Basic validation for OpenAI API key format
    if (!key) return false;
    if (key.length < 20) return false;
    if (!key.startsWith('sk-')) return false;
    return true;
  };

  const handleSave = async () => {
    if (!validateApiKey(openaiKey)) {
      setSaveMessage("Invalid API key format. OpenAI keys start with 'sk-' and are longer.");
      setKeyStatus("invalid");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");

    try {
      const result = await window.electronAPI.saveSetting('openai_key', openaiKey, true);
      if (result.success) {
        setSaveMessage("✓ API key saved successfully!");
        setKeyStatus("valid");
      } else {
        setSaveMessage(`Failed to save: ${result.error}`);
        setKeyStatus("invalid");
      }
    } catch (error) {
      setSaveMessage(`Error: ${error.message}`);
      setKeyStatus("invalid");
    } finally {
      setIsSaving(false);
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(""), 3000);
    }
  };

  const handleClear = async () => {
    try {
      await window.electronAPI.deleteSetting('openai_key');
      setOpenaiKey("");
      setKeyStatus("");
      setSaveMessage("✓ API key cleared!");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      setSaveMessage(`Error clearing key: ${error.message}`);
      setTimeout(() => setSaveMessage(""), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      {/* OpenAI API Key Section */}
      <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2a2 2 0 00-2 2m2-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2m6 0V9a2 2 0 00-2 2m0 0a2 2 0 002 2h4a2 2 0 002-2V9a2 2 0 00-2-2h-4z" />
          </svg>
          OpenAI API Key
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Key
              <span className="text-red-400 ml-1">*</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={openaiKey}
                onChange={(e) => {
                  setOpenaiKey(e.target.value);
                  setKeyStatus("");
                  setSaveMessage("");
                }}
                placeholder="sk-..."
                className={`
                  w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors
                  ${keyStatus === "valid"
                    ? "border-green-500 focus:ring-green-500"
                    : keyStatus === "invalid"
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-600 focus:ring-primary-500"
                  }
                `}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
              >
                {showKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L12 12m-3.172-3.172a4 4 0 015.656 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-400 space-y-2">
            <p>
              <strong>Get your API key:</strong> Visit{" "}
              <a
                href="#"
                onClick={() => window.electronAPI && window.electronAPI.openExternal && window.electronAPI.openExternal('https://platform.openai.com/api-keys')}
                className="text-primary-400 hover:text-primary-300 underline"
              >
                OpenAI API Keys
              </a>
            </p>
            <p>
              <strong>Security:</strong> Your API key is encrypted and stored locally on your device.
            </p>
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div className={`
              p-3 rounded-lg text-sm font-medium
              ${saveMessage.startsWith('✓')
                ? 'bg-green-900/20 border border-green-700 text-green-300'
                : 'bg-red-900/20 border border-red-700 text-red-300'
              }
            `}>
              {saveMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !openaiKey}
              className={`
                flex-1 py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center
                ${isSaving || !openaiKey
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
                }
              `}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Save API Key
                </>
              )}
            </button>

            {openaiKey && (
              <button
                onClick={handleClear}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-8 bg-blue-900/20 border border-blue-700 rounded-2xl p-6">
        <h3 className="text-blue-300 font-semibold mb-3 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          About OpenAI Integration
        </h3>
        <div className="text-blue-200 text-sm space-y-2">
          <p>
            This app uses OpenAI's GPT-4 to analyze video transcripts and identify the most engaging clips for short-form content.
          </p>
          <p>
            <strong>What it does:</strong> Analyzes your video transcript to find moments with high engagement potential, complete thoughts, and natural clip boundaries.
          </p>
          <p>
            <strong>Privacy:</strong> Only the transcript text (not the video) is sent to OpenAI for analysis.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
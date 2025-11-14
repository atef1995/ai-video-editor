/**
 * Download Tracker for AI Video Editor
 * Tracks downloads, detects OS, and fetches release data from GitHub
 */

class DownloadTracker {
  constructor() {
    this.repo = 'atef1995/ai-video-editor';
    this.apiEndpoint = `https://api.github.com/repos/${this.repo}/releases/latest`;
    this.releaseCache = null;
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
    this.cacheTimestamp = null;
  }

  /**
   * Detect user's operating system
   * @returns {string} OS name (Windows, macOS, Linux, or Unknown)
   */
  detectOS() {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const platform = window.navigator.platform.toLowerCase();

    // Check for macOS
    if (platform.includes('mac') || userAgent.includes('mac')) {
      return 'macOS';
    }

    // Check for Windows
    if (platform.includes('win') || userAgent.includes('win')) {
      return 'Windows';
    }

    // Check for Linux
    if (platform.includes('linux') || userAgent.includes('linux')) {
      return 'Linux';
    }

    return 'Unknown';
  }

  /**
   * Fetch latest release data from GitHub API
   * Uses caching to avoid rate limits
   * @returns {Promise<Object|null>} Release data or null on error
   */
  async getLatestRelease() {
    // Return cached data if still valid
    if (this.releaseCache && this.cacheTimestamp) {
      const cacheAge = Date.now() - this.cacheTimestamp;
      if (cacheAge < this.cacheDuration) {
        return this.releaseCache;
      }
    }

    try {
      const response = await fetch(this.apiEndpoint);

      if (!response.ok) {
        console.error('Failed to fetch release data:', response.status);
        return null;
      }

      const data = await response.json();

      // Process and structure the release data
      const releaseData = {
        version: data.tag_name || 'v1.0.0',
        releaseDate: new Date(data.published_at).toLocaleDateString(),
        downloadUrl: data.html_url,
        assets: data.assets.map(asset => ({
          name: asset.name,
          url: asset.browser_download_url,
          size: this.formatFileSize(asset.size),
          sizeBytes: asset.size,
          downloads: asset.download_count,
          contentType: asset.content_type
        }))
      };

      // Cache the result
      this.releaseCache = releaseData;
      this.cacheTimestamp = Date.now();

      return releaseData;
    } catch (error) {
      console.error('Failed to fetch release data:', error);
      return null;
    }
  }

  /**
   * Format file size in human-readable format
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Find appropriate download asset for given platform
   * @param {Array} assets - List of release assets
   * @param {string} platform - Target platform (Windows, macOS, Linux)
   * @returns {Object|null} Asset object or null
   */
  findAssetForPlatform(assets, platform) {
    if (!assets || assets.length === 0) return null;

    let matchingAsset = null;

    switch (platform) {
      case 'Windows':
        matchingAsset = assets.find(a =>
          a.name.toLowerCase().endsWith('.exe') ||
          a.name.toLowerCase().includes('setup') ||
          a.name.toLowerCase().includes('windows')
        );
        break;

      case 'macOS':
        matchingAsset = assets.find(a =>
          a.name.toLowerCase().endsWith('.dmg') ||
          a.name.toLowerCase().includes('mac') ||
          a.name.toLowerCase().includes('darwin')
        );
        break;

      case 'Linux':
        matchingAsset = assets.find(a =>
          a.name.toLowerCase().endsWith('.appimage') ||
          a.name.toLowerCase().endsWith('.deb') ||
          a.name.toLowerCase().includes('linux')
        );
        break;
    }

    return matchingAsset;
  }

  /**
   * Track download event
   * @param {string} platform - Platform being downloaded
   * @param {string} fileName - Name of downloaded file
   */
  trackDownload(platform, fileName) {
    const trackingData = {
      platform: platform,
      fileName: fileName,
      timestamp: new Date().toISOString(),
      referrer: document.referrer || 'direct',
      userAgent: navigator.userAgent,
      page: window.location.href
    };

    // Send to analytics services
    this.sendToGoogleAnalytics(trackingData);
    this.storeLocally(trackingData);

    console.log('Download tracked:', trackingData);
  }

  /**
   * Send tracking data to Google Analytics (if available)
   * @param {Object} data - Tracking data
   */
  sendToGoogleAnalytics(data) {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'download', {
        event_category: 'Downloads',
        event_label: data.platform,
        value: data.fileName
      });
    }
  }

  /**
   * Store download event in localStorage
   * @param {Object} data - Tracking data
   */
  storeLocally(data) {
    try {
      const downloads = JSON.parse(localStorage.getItem('downloads') || '[]');
      downloads.push(data);

      // Keep only last 100 downloads
      if (downloads.length > 100) {
        downloads.shift();
      }

      localStorage.setItem('downloads', JSON.stringify(downloads));
    } catch (error) {
      console.error('Failed to store download data locally:', error);
    }
  }

  /**
   * Handle download button click
   * @param {string} platform - Target platform
   */
  async handleDownload(platform) {
    const release = await this.getLatestRelease();

    if (!release) {
      alert('Unable to fetch download information. Please try again or visit the GitHub releases page.');
      window.open(`https://github.com/${this.repo}/releases`, '_blank');
      return;
    }

    const asset = this.findAssetForPlatform(release.assets, platform);

    if (asset) {
      this.trackDownload(platform, asset.name);

      // Initiate download
      window.location.href = asset.url;
    } else {
      alert(`No download available for ${platform}. Please visit the releases page.`);
      window.open(release.downloadUrl, '_blank');
    }
  }

  /**
   * Display download statistics on the page
   */
  async displayDownloadStats() {
    const release = await this.getLatestRelease();

    if (!release) {
      console.warn('Could not fetch release data for stats display');
      return;
    }

    // Update version number
    const versionElement = document.getElementById('latest-version');
    if (versionElement) {
      versionElement.textContent = release.version;
    }

    // Calculate total downloads
    const totalDownloads = release.assets.reduce((sum, asset) => sum + asset.downloads, 0);
    const downloadsElement = document.getElementById('total-downloads');
    if (downloadsElement) {
      downloadsElement.textContent = totalDownloads.toLocaleString();
    }

    // Update file sizes for each platform
    const platforms = ['windows', 'macos', 'linux'];
    platforms.forEach(platform => {
      const platformName = platform === 'macos' ? 'macOS' :
        platform.charAt(0).toUpperCase() + platform.slice(1);
      const asset = this.findAssetForPlatform(release.assets, platformName);

      if (asset) {
        const sizeElement = document.getElementById(`${platform}-size`);
        if (sizeElement) {
          sizeElement.textContent = asset.size;
        }
      }
    });
  }

  /**
   * Initialize the tracker
   */
  async init() {
    // Detect and display user's OS
    const detectedOS = this.detectOS();
    const osElements = document.querySelectorAll('#detected-os');
    osElements.forEach(el => {
      el.textContent = detectedOS;
    });

    // Display download statistics
    await this.displayDownloadStats();

    // Attach event listeners to all download buttons
    const downloadButtons = document.querySelectorAll('.download-btn');
    downloadButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();

        const platform = btn.dataset.platform === 'auto' ? detectedOS : btn.dataset.platform;

        if (platform === 'Unknown') {
          alert('Could not detect your operating system. Please select a platform manually.');
          return;
        }

        await this.handleDownload(platform);
      });
    });

    // Handle platform link clicks
    const platformLinks = document.querySelectorAll('.platform-link');
    platformLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const platform = link.dataset.platform;
        document.querySelector(`[data-platform="${platform}"].download-btn`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      });
    });
  }
}

// Initialize tracker when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const tracker = new DownloadTracker();
    tracker.init();
  });
} else {
  const tracker = new DownloadTracker();
  tracker.init();
}

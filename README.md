# AI Video Editor

An intelligent Electron desktop application that automatically generates engaging short clips from long-form videos using advanced AI analysis. Perfect for content creators looking to repurpose their videos for social media platforms like TikTok, YouTube Shorts, and Instagram Reels.

## Features

### AI-Powered Content Analysis

- **Quiet Part Removal**: Removes silent sections so you can focus on the good stuff
- **Accurate Transcription**: Uses Whisper to convert speech to text reliably
- **Content Analysis**: GPT identifies the most engaging segments automatically
- **Clip Generation**: Generates multiple short clips ready for social media

### Clean, Simple Interface

- **Drag & Drop Upload**: Just drag your video file in or click to browse
- **Progress Tracking**: See exactly what's happening and how long it'll take
- **Subtitle Editor**: Reposition subtitles by dragging, with live preview
- **Flexible Processing**: Different modes for different needs

### Video Processing

- **Common Formats**: MP4, MOV, AVI, MKV all work out of the box
- **Auto Format Conversion**: Converts to vertical 9:16 format for shorts
- **Quality**: Keeps your videos looking good throughout the process
- **Batch Mode**: Handle multiple videos at once

### Analytics

- **Engagement Scores**: See which clips are likely to perform best
- **Auto Tagging**: Topics get identified and tagged automatically
- **Detailed Breakdown**: Get a full analysis of each segment

## Quick Start

### What You'll Need

- **Node.js** (v16+)
- **Python** (v3.8+)
- **FFmpeg** (for video processing)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/ai-video-editor.git
   cd ai-video-editor
   ```

2. **Install dependencies**

   ```bash
   # Install Node.js dependencies
   npm install

   # Install Python dependencies
   pip install -r src/python/requirements.txt
   ```

3. **Add your OpenAI API key** (optional but recommended)

   - Grab your key from [OpenAI](https://platform.openai.com)
   - Pop it in the app settings after you launch

4. **Launch the application**
   ```bash
   npm run dev
   ```

## How to Use

### Basic Workflow

1. **Upload Video**

   - Click "Choose Video" or drag & drop your video file
   - Supported formats: MP4, MOV, AVI, MKV

2. **Configure Settings**

   - Add your OpenAI API key in Settings
   - Adjust processing parameters if needed

3. **Start Processing**

   - Click "Start AI Processing"
   - Monitor real-time progress updates

4. **Review Generated Clips**
   - Preview generated clips in the results panel
   - View engagement scores and descriptions
   - Export or save clips as needed

### Advanced Features

#### Transcription Mode

- Generate accurate subtitles using Whisper
- Interactive subtitle editor with drag-and-drop positioning
- Export SRT files for use in other applications

#### Quiet Parts Mode

- Remove silent sections from videos
- Configurable silence detection sensitivity
- Preserve natural speech flow with smart frame margins

## How the AI Pipeline Works

The application uses a sophisticated multi-step AI processing pipeline:

### Step 1: Quiet Parts Removal (0-15%)

- Uses jumpcutter algorithm to detect and remove silent sections
- Configurable silence threshold and processing speed
- Preserves context frames around speech segments

### Step 2: Metadata Extraction (15-25%)

- Extracts video properties and generates thumbnails
- Prepares audio tracks for transcription

### Step 3: Transcription (25-40%)

- Uses OpenAI Whisper for high-accuracy speech-to-text
- Processes the cleaned audio (quiet parts removed)
- Generates timestamped transcripts

### Step 4: Content Analysis (40-55%)

- Sends transcript to GPT for intelligent analysis
- Identifies engaging segments and topics
- Generates engagement scores and descriptions

### Step 5: Clip Generation (55-75%)

- Creates video clips based on AI analysis
- Converts to optimal format for social media
- Generates thumbnails and metadata

### Step 6: Finalization (75-100%)

- Saves processed files and metadata
- Cleans up temporary files
- Provides downloadable results

## API Integration

### OpenAI Integration

The application integrates with OpenAI services:

- **Whisper API**: For audio transcription
- **GPT-4/3.5**: For content analysis and clip selection

### Settings Management

- Secure API key storage using Electron's safeStorage
- Encrypted sensitive data handling
- User preference persistence

## Troubleshooting

### Common Issues

**Python Dependencies Missing**

```bash
pip install -r src/python/requirements.txt
```

**FFmpeg Not Found**

- Install FFmpeg and ensure it's in your PATH
- Download from: https://ffmpeg.org/download.html

**OpenAI API Errors**

- Verify your API key is correct and has sufficient credits
- Check API rate limits and usage

**Processing Fails**

- Ensure input video file is not corrupted
- Check available disk space in temp directory
- Verify Python environment has all required packages

### Debug Mode

Enable debug logging by setting environment variable:

```bash
DEBUG=true npm run dev
```

## For Developers

### Project Structure

```
ai-video-editor/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── main.js             # Application entry point
│   │   ├── preload.js          # IPC bridge
│   │   ├── ai-engine/          # AI processing bridges
│   │   └── database/           # SQLite database
│   ├── renderer/               # React frontend
│   │   ├── src/
│   │   │   ├── components/     # React components
│   │   │   ├── contexts/       # React contexts
│   │   │   └── App.jsx         # Main app component
│   └── python/                 # AI processing pipeline
│       ├── ai_pipeline.py      # Main coordinator
│       ├── analysis/           # Content analysis
│       ├── transcription/      # Whisper integration
│       ├── editing/            # Video processing
│       └── cut-quiet-parts/    # Silence removal
├── temp/                       # Temporary processing files
├── package.json
└── README.md
```

### Available Scripts

#### Development

```bash
npm run dev              # Start both renderer and electron
npm run dev:renderer     # Start Vite dev server only
npm run dev:electron     # Start Electron only
```

#### Building

```bash
npm run build           # Build both renderer and main
npm run build:renderer  # Build React frontend
npm run build:main      # Prepare main process
npm run dist           # Create distributable
```

#### Python Setup

```bash
# Core AI processing
pip install whisper openai moviepy

# Quiet parts removal
pip install numpy scipy pillow audiotsm pytube

# Additional dependencies
pip install -r src/python/requirements.txt
```

### Configuration

#### Environment Setup

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your_openai_api_key_here
TEMP_DIR=./temp
MAX_CLIPS=5
```

#### Processing Settings

The AI pipeline can be configured with various parameters:

- **Silent Threshold**: Volume level for silence detection (0.01-0.1)
- **Processing Speed**: Speed multiplier for quiet sections
- **Frame Quality**: Video frame extraction quality (1-31)
- **Max Clips**: Maximum number of clips to generate

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

- Follow existing code style and conventions
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

### Reporting Issues

- Use the GitHub issue tracker
- Provide detailed reproduction steps
- Include system information and error logs

## Support

- **Documentation**: Check this README and inline code comments
- **Issues**: [GitHub Issues](https://github.com/atef1995/ai-video-editor/issues)
- **Discussions**: [GitHub Discussions](https://github.com/atef1995/ai-video-editor/discussions)

## Acknowledgments

Thanks to:
- **OpenAI** for Whisper and GPT APIs
- **Electron** for the desktop framework
- **React** for the UI
- **Python Community** for the excellent libraries
- **Jumpcutter** for the quiet parts detection algorithm

---

Built for content creators

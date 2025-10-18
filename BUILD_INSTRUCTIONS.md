# Build Instructions for AI Video Editor

This document provides comprehensive instructions for building and distributing the AI Video Editor application.

## Prerequisites

- Node.js (v16 or higher)
- Python 3.8 or higher
- FFmpeg (for development and testing)
- PyInstaller (`pip install pyinstaller`)

## Build Process Overview

The application requires two main build steps:

1. **Build Python executables** - Creates standalone Python executables with PyInstaller
2. **Build Electron app** - Builds and packages the complete application

**Note:** FFmpeg is NOT bundled with the application. Users must install it separately on their system.

## Step 1: Build Python Executables

Bundle Python scripts with all dependencies into standalone executables:

```bash
npm run build:python
```

This creates:
- `python-dist/jumpcutter/jumpcutter.exe` (or `jumpcutter` on Unix)
- `python-dist/ai_pipeline/ai_pipeline.exe` (or `ai_pipeline` on Unix)

### Python Dependencies Included

The build process automatically includes:
- **audiotsm** - Audio time-scale modification
- **whisper** - Audio transcription
- **numpy, scipy** - Numerical computing
- **PIL (Pillow)** - Image processing
- All required submodules and data files

### Troubleshooting Python Build

If you get missing module errors:

1. **Verify Python dependencies are installed:**
   ```bash
   pip install -r requirements.txt
   pip install -r src/python/cut-quiet-parts/requirements.txt
   ```

2. **Check PyInstaller version:**
   ```bash
   pip install --upgrade pyinstaller
   ```

3. **Clean build cache:**
   ```bash
   rmdir /s python-dist  # Windows
   rm -rf python-dist    # Unix
   npm run build:python
   ```

## Step 2: Build Electron Application

Build the frontend and package the complete application:

```bash
npm run dist
```

This will:
1. Build Python executables with all dependencies
2. Build the React frontend with Vite
3. Copy Electron main process files
4. Bundle Python executables (FFmpeg is NOT bundled)
5. Create distributable installers in `release/` directory

### Platform-Specific Builds

**Windows only:**
```bash
npm run dist:win
```

**macOS only:**
```bash
npm run dist:mac
```

**Linux only:**
```bash
npm run dist:linux
```

**All platforms:**
```bash
npm run dist:all
```

## Complete Build from Scratch

To build everything from a clean state:

```bash
# Install Node dependencies
npm install

# Build Python executables
npm run build:python

# Build and package app
npm run dist
```

**Important:** Ensure FFmpeg is installed on your development machine for testing.

## Development Mode

For development without bundling:

```bash
npm run dev
```

This runs:
- Vite dev server for React frontend
- Electron in development mode
- Uses system Python and FFmpeg (must be installed)

## Verifying the Build

After building, test the application:

### On a clean machine WITHOUT Python:
1. Install the built application from `release/`
2. Install FFmpeg on the test machine (see User Requirements below)
3. Try processing a video with the jumpcutter feature
4. Verify no "module not found" errors occur
5. Check that video processing completes successfully

### User Requirements
Users MUST install FFmpeg separately. The app will detect and display instructions if FFmpeg is missing:

**Windows:**
- Download from https://www.gyan.dev/ffmpeg/builds/
- Add FFmpeg to system PATH

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# RedHat/CentOS
sudo yum install ffmpeg
```

## Bundled Resources Structure

The final application includes:

```
resources/
├── python/
│   ├── jumpcutter/
│   │   └── jumpcutter.exe (or jumpcutter)
│   └── ai_pipeline/
│       └── ai_pipeline.exe (or ai_pipeline)
└── src/
    └── python/
        └── [Python source files as fallback]
```

**Note:** FFmpeg is NOT bundled and must be installed by users.

## Common Issues

### Issue: "ModuleNotFoundError: No module named 'audiotsm'"

**Solution:** Rebuild Python executables with updated hidden imports:
```bash
npm run build:python
```

### Issue: "FFmpeg not found"

**Solution:** Users must install FFmpeg on their system. The app will show instructions when FFmpeg is missing.

For development/testing, ensure FFmpeg is installed:
- Windows: Download from https://www.gyan.dev/ffmpeg/builds/ and add to PATH
- macOS: `brew install ffmpeg`
- Linux: `sudo apt install ffmpeg`

### Issue: Build fails on macOS

**Solution:** macOS requires code signing. Add signing certificate or disable:
```json
// In package.json build section
"mac": {
  "identity": null
}
```

### Issue: Large application size

The bundled application is large (~300MB-800MB) because it includes:
- Python interpreter and libraries
- Whisper models and dependencies

This is normal for a standalone Python application. FFmpeg is NOT bundled, reducing overall size.

## Release Checklist

Before releasing:

- [ ] Build Python executables successfully
- [ ] Test on clean Windows machine without Python (with FFmpeg installed)
- [ ] Test on clean macOS machine without Python (with FFmpeg installed)
- [ ] Test on clean Linux machine without Python (with FFmpeg installed)
- [ ] Verify FFmpeg detection UI works correctly
- [ ] Verify video processing works end-to-end when FFmpeg is installed
- [ ] Verify app shows proper error/instructions when FFmpeg is missing
- [ ] Check application size is reasonable
- [ ] Update version number in package.json
- [ ] Create release notes with FFmpeg installation requirement

## Support

For build issues, check:
- Console logs during build process
- Electron DevTools console in the built app
- Python script output (visible in console window)
- GitHub Issues: https://github.com/atef1995/ai-video-editor/issues

# Python Bundling Fix for Production

## Problem

The error `ModuleNotFoundError: No module named 'moviepy'` occurs in production because PyInstaller is not including all required dependencies in the bundled executable.

## Solution

### 1. Updated Spec File

The `python-dist/specs/ai_pipeline.spec` file has been updated with:

- **Hidden Imports**: All moviepy submodules are now explicitly listed
- **Data Files**: Python source modules are included as data files
- **Path Configuration**: Proper pathex setup for module discovery

### 2. Updated Build Script

The `build-python.js` script now:

- Uses spec files when available (recommended)
- Includes moviepy and all video processing dependencies
- Collects moviepy, imageio, and imageio_ffmpeg packages with data files
- Properly handles both development and production builds

## Rebuild Instructions

### Option 1: Using Spec File (Recommended)

```bash
# Install dependencies
pip install -r requirements.txt
pip install pyinstaller

# Build using spec file
cd python-dist/specs
python -m PyInstaller ai_pipeline.spec --clean --noconfirm
```

### Option 2: Using Build Script

```bash
# Run the Node.js build script
node build-python.js
```

### Option 3: Full Electron Build

```bash
# Build Python executables and Electron app
npm run build:python
npm run dist
```

## Key Dependencies in Bundle

The following packages are now explicitly included:

### Video Processing

- `moviepy` - Core video editing
- `moviepy.editor` - High-level editor interface
- `moviepy.video.io` - Video I/O operations
- `moviepy.audio.io` - Audio I/O operations
- `imageio` - Image and video reading
- `imageio_ffmpeg` - FFmpeg bindings
- `decorator` - Required by moviepy
- `proglog` - Progress logging for moviepy

### Audio Processing

- `audiotsm` - Time stretching
- `scipy` - Signal processing
- `pydub` - Audio manipulation

### AI/ML

- `whisper` - Speech recognition
- `openai` - GPT API
- `tiktoken` - Token counting
- `numpy` - Numerical computing

### Image Processing

- `PIL/Pillow` - Image operations

## Testing the Fix

### 1. Clean Build

```bash
# Remove old builds
rm -rf python-dist/temp
rm -rf python-dist/ai_pipeline
rm -rf python-dist/jumpcutter

# Rebuild
node build-python.js
```

### 2. Test Executable Locally

```bash
# Test the bundled executable directly
cd python-dist/ai_pipeline
./ai_pipeline.exe path/to/video.mp4 --output-dir ./output --openai-key YOUR_KEY
```

### 3. Test in Electron App

```bash
# Build and package the app
npm run build:python
npm run dist:win

# Install and test the packaged app
```

## Verification Checklist

After rebuilding, verify:

- [ ] `ai_pipeline.exe` exists in `python-dist/ai_pipeline/`
- [ ] Executable size is reasonable (50-200 MB)
- [ ] Running executable shows no import errors
- [ ] Video processing works in production app
- [ ] Transcription with Whisper works
- [ ] Audio extraction works
- [ ] Clip generation completes successfully

## Common Issues

### Issue: "Cannot find module 'X'"

**Solution**: Add the module to `hiddenimports` in the spec file

### Issue: "DLL load failed"

**Solution**: Install Visual C++ Redistributable on target machine

### Issue: Executable crashes immediately

**Solution**: Run with `--debug` flag to see detailed error messages

### Issue: Large executable size

**Solution**: This is normal with ML libraries. Typical size: 100-200 MB

## Spec File Maintenance

When adding new Python dependencies:

1. Update `requirements.txt`
2. Add to `hiddenimports` in `ai_pipeline.spec`
3. If it has data files, add to `datas` section
4. Test build locally before deploying

## Production Deployment

After successful build:

1. Test executable on clean Windows machine
2. Verify all features work (transcription, video processing, clip generation)
3. Build final Electron package with `npm run dist`
4. Test installer on multiple Windows versions
5. Deploy to GitHub releases

## Debugging Production Issues

If issues occur in production:

1. Check logs in `%APPDATA%/ai-video-editor/logs/`
2. Run executable manually with full paths to see errors
3. Verify FFmpeg is accessible (usually bundled with app)
4. Check Python version compatibility (3.8-3.11 supported)

## Additional Notes

- Spec file uses absolute paths - update if project moves
- Excluded large unnecessary packages (tensorflow, torch) to reduce size
- Console mode enabled for debugging - disable for production if needed
- UPX compression enabled to reduce executable size

## Related Files

- `python-dist/specs/ai_pipeline.spec` - PyInstaller spec file
- `build-python.js` - Node.js build script
- `requirements.txt` - Python dependencies
- `src/main/ai-engine/python-bridge.js` - Electron-Python bridge

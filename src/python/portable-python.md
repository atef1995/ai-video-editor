# Python Bundling Strategy

## Recommended Approach: Portable Python Distribution

Instead of using PyInstaller (which can be complex), we'll use a portable Python distribution with pre-installed dependencies.

### Steps:

1. **Download Portable Python**
   - Use python-build-standalone or WinPython
   - Include in app bundle

2. **Pre-install Dependencies**
   - Bundle requirements.txt libraries with the portable Python

3. **Update Bridge to Use Portable Python**
   - Point to bundled Python executable
   - Use bundled Python for all operations

### Simpler Alternative: Bundle Python Executable

For the quickest implementation:

1. Create standalone executables using PyInstaller
2. Bundle these .exe files with the Electron app
3. No need for Python installation on client machines

### Production Build Process:

```bash
# Build Python executables
npm run build:python

# Build Electron app with bundled executables
npm run dist
```

This ensures clients get a complete, self-contained application.
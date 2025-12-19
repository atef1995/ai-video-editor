#!/usr/bin/env python3
"""
Verify all required dependencies are installed and importable
Run this before building with PyInstaller to catch issues early
"""

import sys
import importlib
from typing import List, Tuple

# List of all required modules
REQUIRED_MODULES = [
    # Core video/audio processing
    ('moviepy', 'Video editing'),
    ('moviepy.editor', 'MoviePy editor interface'),
    ('imageio', 'Image/video I/O'),
    ('imageio_ffmpeg', 'FFmpeg bindings'),

    # Audio processing
    ('audiotsm', 'Audio time-stretching'),
    ('scipy', 'Scientific computing'),
    ('scipy.io.wavfile', 'WAV file I/O'),

    # AI/ML - Using faster-whisper (no PyTorch!)
    ('faster_whisper', 'Speech recognition (lightweight)'),
    ('ctranslate2', 'Fast inference engine'),
    ('openai', 'OpenAI API'),
    ('tiktoken', 'Token counting'),
    ('tiktoken_ext', 'Tiktoken extensions'),

    # Image processing
    ('PIL', 'Image processing'),
    ('PIL.Image', 'Image manipulation'),

    # Core Python libs
    ('numpy', 'Numerical computing'),
    ('json', 'JSON handling'),
    ('pathlib', 'Path operations'),
    ('subprocess', 'Process management'),
]


def check_module(module_name: str, description: str) -> Tuple[bool, str]:
    """
    Check if a module can be imported

    Args:
        module_name: Name of the module to import
        description: Description of what the module does

    Returns:
        Tuple of (success, message)
    """
    try:
        importlib.import_module(module_name)
        return True, f"✓ {module_name:<30} - {description}"
    except ImportError as e:
        return False, f"✗ {module_name:<30} - MISSING: {str(e)}"
    except Exception as e:
        return False, f"✗ {module_name:<30} - ERROR: {str(e)}"


def main():
    """Run all dependency checks"""
    print("=" * 80)
    print("AI Video Editor - Dependency Verification")
    print("=" * 80)
    print()

    results = []
    failed = []

    for module_name, description in REQUIRED_MODULES:
        success, message = check_module(module_name, description)
        results.append((success, message))
        if not success:
            failed.append(module_name)
        print(message)

    print()
    print("=" * 80)

    total = len(results)
    passed = total - len(failed)

    print(f"Results: {passed}/{total} modules available")

    if failed:
        print()
        print("❌ FAILED - Missing modules:")
        for module in failed:
            print(f"   - {module}")
        print()
        print("To install missing dependencies:")
        print("   pip install -r requirements.txt")
        print()
        sys.exit(1)
    else:
        print("✅ SUCCESS - All dependencies are available!")
        print()
        print("You can now build with PyInstaller:")
        print("   node build-python.js")
        print()
        sys.exit(0)


if __name__ == '__main__':
    main()

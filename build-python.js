const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Build script to create standalone Python executables for distribution
 * This script uses PyInstaller to bundle Python scripts with all dependencies
 */

const pythonSrcDir = path.join(__dirname, 'src', 'python');
const buildDir = path.join(__dirname, 'python-dist');
const scriptsToBundle = [
  {
    name: 'jumpcutter',
    entry: path.join(pythonSrcDir, 'cut-quiet-parts', 'jumpcutter.py'),
    requirements: path.join(pythonSrcDir, 'cut-quiet-parts', 'requirements.txt')
  },
  {
    name: 'ai_pipeline', 
    entry: path.join(pythonSrcDir, 'ai_pipeline.py'),
    requirements: path.join(__dirname, 'requirements.txt')
  }
];

async function buildPythonExecutables() {
  console.log('🐍 Building Python executables...');
  
  // Ensure build directory exists
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  for (const script of scriptsToBundle) {
    console.log(`\n📦 Building ${script.name}...`);
    
    try {
      // Install dependencies first
      console.log('📥 Installing dependencies...');
      execSync(`pip install -r "${script.requirements}"`, { 
        stdio: 'inherit',
        cwd: path.dirname(script.entry)
      });
      
      // Install PyInstaller if not present
      try {
        execSync('python -c "import PyInstaller; print(PyInstaller.__version__)"', { stdio: 'pipe' });
      } catch {
        console.log('📥 Installing PyInstaller...');
        execSync('pip install pyinstaller', { stdio: 'inherit' });
      }

      // Build executable with PyInstaller
      console.log('🔨 Creating executable...');
      const outputDir = path.join(buildDir, script.name);

      const excludes = [
        'tensorflow', 'torch', 'torchvision', 'matplotlib', 'jupyter',
        'IPython', 'notebook', 'tkinter', 'PyQt5', 'PyQt6', 'PySide2', 'PySide6'
      ];

      // Hidden imports required for proper bundling of all dependencies
      const hiddenImports = [
        // Audio processing dependencies
        'audiotsm',
        'audiotsm.io',
        'audiotsm.io.wav',
        'audiotsm.phasevocoder',
        'audiotsm.wsola',
        // Whisper and its dependencies (for ai_pipeline)
        'whisper',
        'tiktoken_ext.openai_public',
        'tiktoken_ext',
        // NumPy submodules often missed by PyInstaller
        'numpy.core._methods',
        'numpy.lib.format',
        // SciPy submodules
        'scipy.io.wavfile',
        'scipy.io',
        'scipy.signal',
        'scipy.fft',
        'scipy.fftpack',
        // PIL/Pillow submodules
        'PIL',
        'PIL.Image',
        'PIL.ImageDraw',
        'PIL.ImageFont',
        // Other dependencies
        'pkg_resources.py2_warn'
      ];

      // Collect all data files for whisper (models, tokenizer data)
      const collectPackages = script.name === 'ai_pipeline'
        ? ['whisper', 'tiktoken_ext']
        : [];

      const pyinstallerCmd = [
        `python "${path.join(__dirname, 'run_pyinstaller.py')}"`,
        '--onefile',  // Create single executable
        '--console',  // Keep console for debugging
        '--name', script.name,
        '--distpath', outputDir,
        '--workpath', path.join(buildDir, 'temp', script.name),
        '--specpath', path.join(buildDir, 'specs'),
        '--clean',
        ...hiddenImports.map(imp => `--hidden-import ${imp}`),
        ...collectPackages.map(pkg => `--collect-all ${pkg}`),
        ...excludes.map(exc => `--exclude-module ${exc}`),
        `"${script.entry}"`
      ].join(' ');
      
      console.log(`Running: ${pyinstallerCmd}`);
      execSync(pyinstallerCmd, {
        stdio: 'inherit',
        cwd: path.dirname(script.entry),
        timeout: 600000 // 10 minutes timeout
      });
      
      console.log(`✅ ${script.name} built successfully!`);
      
    } catch (error) {
      console.error(`❌ Failed to build ${script.name}:`, error.message);
      process.exit(1);
    }
  }
  
  console.log('\n🎉 All Python executables built successfully!');
  console.log(`📁 Executables are in: ${buildDir}`);
}

// Alternative approach: Bundle Python interpreter with libraries
async function createPortablePython() {
  console.log('\n🐍 Creating portable Python distribution...');
  
  const portablePythonDir = path.join(buildDir, 'python-portable');
  
  // This would use python-build-standalone or embed Python
  // For now, we'll use the PyInstaller approach above
  console.log('💡 Using PyInstaller approach for better compatibility');
}

if (require.main === module) {
  buildPythonExecutables().catch(console.error);
}

module.exports = { buildPythonExecutables, createPortablePython };
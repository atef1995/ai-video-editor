#!/usr/bin/env node

/**
 * Multi-platform build script
 * Builds the application for multiple platforms locally
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.join(__dirname, '..');

function runCommand(command, options = {}) {
  console.log(`\n🔨 Running: ${command}`);
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: PROJECT_ROOT,
      ...options
    });
    return true;
  } catch (error) {
    console.error(`❌ Command failed: ${error.message}`);
    return false;
  }
}

function buildForPlatform(platform) {
  console.log(`\n📦 Building for ${platform}...`);

  const buildCommand = platform === 'all'
    ? 'npm run dist:quick'
    : `npm run dist:quick -- --${platform}`;

  return runCommand(buildCommand);
}

function cleanBuildArtifacts() {
  console.log('🧹 Cleaning previous build artifacts...');

  const dirsToClean = ['release', 'dist'];

  dirsToClean.forEach(dir => {
    const dirPath = path.join(PROJECT_ROOT, dir);
    if (fs.existsSync(dirPath)) {
      try {
        runCommand(`rmdir /s /q "${dirPath}"`, { stdio: 'pipe' }); // Windows
      } catch {
        runCommand(`rm -rf "${dirPath}"`, { stdio: 'pipe' }); // Unix
      }
      console.log(`✅ Cleaned ${dir}/`);
    }
  });
}

function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...');

  const checks = [
    { name: 'Node.js', command: 'node --version' },
    { name: 'NPM', command: 'npm --version' },
    { name: 'Python', command: 'python --version' },
    { name: 'FFmpeg', command: 'ffmpeg -version' }
  ];

  let allPassed = true;

  checks.forEach(check => {
    try {
      const version = execSync(check.command, { encoding: 'utf8', stdio: 'pipe' });
      console.log(`✅ ${check.name}: ${version.split('\n')[0]}`);
    } catch (error) {
      console.log(`❌ ${check.name}: Not found`);
      allPassed = false;
    }
  });

  if (!allPassed) {
    console.error('\n❌ Some prerequisites are missing. Please install them before building.');
    process.exit(1);
  }

  return true;
}

function main() {
  const args = process.argv.slice(2);
  const platform = args[0] || 'current';

  console.log('🏗️  AI Video Editor - Multi-Platform Builder');
  console.log('==========================================\n');

  // Check prerequisites
  if (!checkPrerequisites()) {
    process.exit(1);
  }

  // Install dependencies
  console.log('\n📦 Installing dependencies...');
  if (!runCommand('npm ci')) {
    process.exit(1);
  }

  // Clean previous builds
  cleanBuildArtifacts();

  // Build the application
  console.log('\n🔨 Building application...');
  if (!runCommand('npm run build')) {
    process.exit(1);
  }

  // Build for specified platform(s)
  const platforms = {
    'win': 'windows',
    'mac': 'mac',
    'linux': 'linux',
    'all': 'all platforms',
    'current': 'current platform'
  };

  const selectedPlatform = platforms[platform] || 'current platform';
  console.log(`\n🎯 Building for: ${selectedPlatform}`);

  let success = false;
  switch (platform) {
    case 'win':
      success = buildForPlatform('win');
      break;
    case 'mac':
      success = buildForPlatform('mac');
      break;
    case 'linux':
      success = buildForPlatform('linux');
      break;
    case 'all':
      success = buildForPlatform('all');
      break;
    default:
      success = buildForPlatform('current');
      break;
  }

  if (success) {
    console.log('\n🎉 Build completed successfully!');
    console.log('\n📁 Build artifacts are in:');
    console.log('   release/');

    // List build artifacts
    const releasePath = path.join(PROJECT_ROOT, 'release');
    if (fs.existsSync(releasePath)) {
      const files = fs.readdirSync(releasePath);
      files.forEach(file => {
        if (!file.includes('unpacked') && !fs.statSync(path.join(releasePath, file)).isDirectory()) {
          console.log(`   📦 ${file}`);
        }
      });
    }
  } else {
    console.error('\n❌ Build failed!');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
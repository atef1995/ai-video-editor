#!/usr/bin/env node

/**
 * Release preparation script
 * This script helps prepare a new release by:
 * - Updating version numbers
 * - Generating changelog
 * - Creating git tags
 * - Running pre-release checks
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const PACKAGE_JSON = path.join(PROJECT_ROOT, 'package.json');

function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  return pkg.version;
}

function updateVersion(newVersion) {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  pkg.version = newVersion;
  fs.writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✅ Updated version to ${newVersion}`);
}

function runPreReleaseChecks() {
  console.log('🔍 Running pre-release checks...');

  try {
    // Check if working directory is clean
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim()) {
      console.warn('⚠️  Working directory has uncommitted changes');
      console.log(status);
      return false;
    }

    // Test build
    console.log('🔨 Testing build...');
    execSync('npm run build', { stdio: 'inherit' });

    // Check Python dependencies
    console.log('🐍 Checking Python dependencies...');
    execSync('python -c "import sys; print(f\\"Python {sys.version}\\")"', { stdio: 'inherit' });

    console.log('✅ All pre-release checks passed');
    return true;
  } catch (error) {
    console.error('❌ Pre-release checks failed:', error.message);
    return false;
  }
}

function createGitTag(version) {
  try {
    const tagName = `v${version}`;
    execSync(`git tag -a ${tagName} -m "Release ${version}"`, { stdio: 'inherit' });
    console.log(`✅ Created git tag: ${tagName}`);

    console.log('📤 To push the tag, run:');
    console.log(`   git push origin ${tagName}`);

    return tagName;
  } catch (error) {
    console.error('❌ Failed to create git tag:', error.message);
    return null;
  }
}

function generateChangelog() {
  console.log('📝 Generating changelog...');

  try {
    // Get recent commits for changelog
    const commits = execSync('git log --oneline -10', { encoding: 'utf8' });
    const changelogPath = path.join(PROJECT_ROOT, 'CHANGELOG.md');

    let changelog = '';
    if (fs.existsSync(changelogPath)) {
      changelog = fs.readFileSync(changelogPath, 'utf8');
    }

    const version = getCurrentVersion();
    const date = new Date().toISOString().split('T')[0];

    const newEntry = `
## [${version}] - ${date}

### Changes
${commits.split('\n').filter(line => line.trim()).map(line => `- ${line}`).join('\n')}

${changelog}`;

    fs.writeFileSync(changelogPath, newEntry.trim() + '\n');
    console.log('✅ Changelog updated');

  } catch (error) {
    console.error('❌ Failed to generate changelog:', error.message);
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('🚀 AI Video Editor - Release Preparation');
  console.log(`Current version: ${getCurrentVersion()}\n`);

  switch (command) {
    case 'check':
      runPreReleaseChecks();
      break;

    case 'version':
      const newVersion = args[1];
      if (!newVersion) {
        console.error('❌ Please specify a version number');
        process.exit(1);
      }
      updateVersion(newVersion);
      break;

    case 'tag':
      const version = getCurrentVersion();
      createGitTag(version);
      break;

    case 'changelog':
      generateChangelog();
      break;

    case 'prepare':
      // Full preparation workflow
      if (!runPreReleaseChecks()) {
        console.error('❌ Pre-release checks failed. Please fix issues before preparing release.');
        process.exit(1);
      }

      generateChangelog();

      const tag = createGitTag(getCurrentVersion());
      if (tag) {
        console.log('\n🎉 Release preparation complete!');
        console.log('\nNext steps:');
        console.log(`1. Review and commit any changes`);
        console.log(`2. Push the tag: git push origin ${tag}`);
        console.log(`3. GitHub Actions will automatically build and create a release`);
      }
      break;

    default:
      console.log('Usage: node scripts/prepare-release.js <command>');
      console.log('\nCommands:');
      console.log('  check      - Run pre-release checks');
      console.log('  version    - Update version number');
      console.log('  tag        - Create git tag for current version');
      console.log('  changelog  - Generate/update changelog');
      console.log('  prepare    - Full preparation workflow');
      break;
  }
}

if (require.main === module) {
  main();
}
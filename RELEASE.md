# Release Guide

This document outlines the process for creating releases of the AI Video Editor application.

## 🚀 Quick Release Process

### 1. Test Local Build
```bash
# Test the build locally first
npm run release:check
npm run dist:quick
```

### 2. Prepare Release
```bash
# Run full preparation workflow
npm run release:prepare

# Or step by step:
npm run release:check        # Check prerequisites
node scripts/prepare-release.js changelog  # Update changelog
node scripts/prepare-release.js tag       # Create git tag
```

### 3. Push and Release
```bash
# Push the tag to trigger GitHub Actions
git push origin v1.0.0  # Replace with your version

# GitHub Actions will automatically:
# - Build for Windows, macOS, and Linux
# - Create GitHub release with artifacts
# - Upload distributables
```

## 📋 Release Checklist

### Pre-Release
- [ ] All tests pass locally
- [ ] Build succeeds on all target platforms
- [ ] Python dependencies are properly bundled
- [ ] FFmpeg is available in CI environment
- [ ] OpenAI API integration works correctly
- [ ] Documentation is up to date

### Version Management
- [ ] Update version in `package.json`
- [ ] Update changelog with new features/fixes
- [ ] Create git tag with version number
- [ ] Ensure commit messages follow conventional format

### Build Artifacts
- [ ] Windows: `.exe` installer and portable version
- [ ] macOS: `.dmg` and `.zip` packages (Intel & Apple Silicon)
- [ ] Linux: AppImage and `.deb` packages
- [ ] All artifacts are signed (where applicable)

### Post-Release
- [ ] Test installation on clean systems
- [ ] Update download links in documentation
- [ ] Announce release in appropriate channels
- [ ] Monitor for issues and user feedback

## 🔧 Build Configuration

### Supported Platforms
- **Windows**: x64, ia32 (NSIS installer + Portable)
- **macOS**: x64, arm64 (DMG + ZIP)
- **Linux**: x64 (AppImage + DEB)

### Build Scripts
```bash
npm run dist           # Full build with Python bundling
npm run dist:quick     # Quick build (current platform)
npm run dist:win       # Windows only
npm run dist:mac       # macOS only
npm run dist:linux     # Linux only
npm run dist:all       # All platforms (local)
```

### GitHub Actions
Releases are automated via GitHub Actions:
- **Trigger**: Push tag starting with `v` (e.g., `v1.0.0`)
- **Matrix Build**: Windows, macOS, Linux
- **Artifacts**: Automatic upload to GitHub Releases
- **Publishing**: Auto-publish non-beta releases

## 🐛 Troubleshooting

### Build Failures

**Python Dependencies**
- Ensure all Python packages are in `requirements.txt`
- Test Python script execution locally
- Verify FFmpeg is accessible

**Native Modules**
- Run `npm run rebuild` if SQLite issues occur
- Check Node.js version compatibility
- Verify electron-builder configuration

**Signing Issues**
- macOS: Configure code signing certificates
- Windows: Set up code signing certificates
- Linux: No signing required

### CI/CD Issues

**GitHub Actions Failures**
- Check action logs for specific errors
- Verify secrets are properly configured
- Ensure all dependencies are installable in CI

**Release Creation**
- Verify `GITHUB_TOKEN` permissions
- Check tag format (must start with `v`)
- Ensure release workflow syntax is correct

## 📝 Version Numbering

We follow [Semantic Versioning](https://semver.org/):
- `MAJOR.MINOR.PATCH` (e.g., 1.2.3)
- **Major**: Breaking changes
- **Minor**: New features (backwards compatible)
- **Patch**: Bug fixes (backwards compatible)

### Pre-release Versions
- `1.0.0-beta.1` - Beta releases
- `1.0.0-alpha.1` - Alpha releases
- Automatically marked as pre-release in GitHub

## 📊 Release Metrics

Track these metrics for each release:
- Download counts per platform
- Issue reports and bug fixes
- User feedback and feature requests
- Performance improvements

## 🔐 Security Considerations

### Code Signing
- Windows executables should be signed
- macOS apps require notarization
- Verify all third-party dependencies

### Dependency Security
- Regularly update dependencies
- Run security audits: `npm audit`
- Monitor for vulnerable packages
- Keep Python packages updated

## 📞 Support

For release-related questions:
- Check existing GitHub issues
- Review build logs in Actions tab
- Consult electron-builder documentation
- Test locally before creating issues
# Contributing to AI Video Editor

Thank you for your interest in contributing to AI Video Editor! We welcome contributions from the community and are grateful for your support.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Coding Guidelines](#coding-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Questions](#questions)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. We expect all contributors to:

- Be respectful and considerate in communication
- Welcome newcomers and help them get started
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ai-video-editor.git
   cd ai-video-editor
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/atef1995/ai-video-editor.git
   ```
4. **Create a branch** for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## How to Contribute

There are many ways to contribute to AI Video Editor:

### 💻 Code Contributions

- Fix bugs or implement new features
- Improve performance or optimize code
- Add tests or improve test coverage
- Refactor code for better maintainability

### 📖 Documentation

- Fix typos or clarify existing documentation
- Write tutorials or guides
- Improve code comments
- Translate documentation

### 🐛 Bug Reports

- Report bugs with detailed reproduction steps
- Suggest fixes or workarounds

### 💡 Feature Requests

- Propose new features or enhancements
- Discuss feature designs and implementations

### 🎨 Design

- Improve UI/UX
- Create icons or graphics
- Suggest design improvements

## Development Setup

### Prerequisites

- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher)
- **FFmpeg** (for video processing)
- **Git**

### Installation

1. **Install Node.js dependencies**:

   ```bash
   npm install
   ```

2. **Install Python dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables**:

   - Create a `.env` file (if needed)
   - Add your OpenAI API key for testing (optional)

4. **Run the development server**:
   ```bash
   npm run dev
   ```

### Project Structure

```
ai-video-editor/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.js        # Application entry
│   │   ├── preload.js     # IPC bridge
│   │   ├── ai-engine/     # AI processing
│   │   └── database/      # SQLite database
│   ├── renderer/          # React frontend
│   │   └── src/
│   │       ├── components/
│   │       ├── hooks/
│   │       └── stores/
│   └── python/            # Python AI pipeline
│       ├── ai_pipeline.py
│       ├── analysis/
│       ├── transcription/
│       ├── editing/
│       └── cut-quiet-parts/
├── docs/                  # GitHub Pages website
├── tests/                 # Test files
└── scripts/               # Build scripts
```

## Coding Guidelines

### JavaScript/React

- Use **ES6+** syntax
- Follow **functional programming** patterns where possible
- Use **hooks** for React components
- Keep components **small and focused**
- Use **meaningful variable names**
- Add **JSDoc comments** for complex functions

Example:

```javascript
/**
 * Process video and generate clips
 * @param {string} videoPath - Path to the video file
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} Array of generated clips
 */
async function processVideo(videoPath, options) {
  // Implementation
}
```

### Python

- Follow **PEP 8** style guide
- Use **type hints** where appropriate
- Write **docstrings** for all functions and classes
- Keep functions **small and focused**
- Use **meaningful variable names**

Example:

```python
def transcribe_video(video_path: str, model: str = "base") -> dict:
    """
    Transcribe video audio using Whisper AI.

    Args:
        video_path: Path to the video file
        model: Whisper model size (tiny, base, small, medium, large)

    Returns:
        Dictionary containing transcription results
    """
    # Implementation
```

### CSS

- Use **CSS variables** for colors and spacing
- Write **mobile-first** responsive styles
- Use **semantic class names**
- Keep specificity **low**
- Group related styles together

### General Guidelines

- **DRY** (Don't Repeat Yourself) - Avoid code duplication
- **KISS** (Keep It Simple, Stupid) - Prefer simple solutions
- **YAGNI** (You Aren't Gonna Need It) - Don't add unnecessary features
- Write **self-documenting code**
- Add comments for **complex logic only**

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

### Examples

```bash
feat(ai-pipeline): add support for multiple languages in transcription

fix(ui): resolve video preview not loading on Windows

docs(readme): update installation instructions for macOS

refactor(jumpcutter): optimize silence detection algorithm

perf(transcription): reduce memory usage during Whisper processing
```

### Best Practices

- Use **present tense** ("add feature" not "added feature")
- Use **imperative mood** ("move cursor to..." not "moves cursor to...")
- Keep first line **under 72 characters**
- Add detailed description in body if needed
- Reference issues and PRs in footer

## Pull Request Process

1. **Update your fork** with the latest upstream changes:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Make your changes** and commit them following the commit guidelines

3. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```

4. **Open a Pull Request** on GitHub with:

   - Clear title describing the change
   - Detailed description of what changed and why
   - Screenshots/GIFs for UI changes
   - Reference to related issues
   - Test results (if applicable)

5. **Respond to feedback** from reviewers

6. **Ensure CI passes** (tests, linting, build)

### Pull Request Template

```markdown
## Description

Brief description of the changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues

Fixes #(issue number)

## How Has This Been Tested?

Describe the tests you ran

## Screenshots (if applicable)

Add screenshots here

## Checklist

- [ ] My code follows the project's style guidelines
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing tests pass locally
```

## Reporting Bugs

When reporting bugs, please include:

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:

1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**

- OS: [e.g., Windows 11, macOS 14, Ubuntu 22.04]
- App Version: [e.g., 1.0.0]
- Node Version: [e.g., 18.0.0]
- Python Version: [e.g., 3.10.0]

**Additional context**
Any other relevant information.

**Logs**
```

Paste relevant logs here

```

```

## Suggesting Features

When suggesting features, please include:

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features you've considered.

**Additional context**
Any other context, screenshots, or mockups.

**Would you like to implement this feature?**

- [ ] Yes, I'd like to implement it
- [ ] No, just suggesting
```

## Development Tips

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run Python tests
python -m pytest
```

### Building for Production

```bash
# Build the app
npm run build

# Build for all platforms
npm run dist:all

# Build for specific platform
npm run dist:win    # Windows
npm run dist:mac    # macOS
npm run dist:linux  # Linux
```

### Debugging

- **Main Process**: Use Chrome DevTools or VS Code debugger
- **Renderer Process**: Use Chrome DevTools (Ctrl+Shift+I / Cmd+Option+I)
- **Python**: Use print statements or Python debugger (pdb)

### Performance Profiling

```bash
# Profile Python code
python -m cProfile -o output.prof src/python/ai_pipeline.py

# Analyze profile
python -m pstats output.prof
```

## Code Review Guidelines

### For Contributors

- Keep PRs **focused and small**
- Write **clear commit messages**
- Add **tests** for new features
- Update **documentation** as needed
- Be **responsive** to feedback

### For Reviewers

- Be **constructive** and **respectful**
- Focus on **code quality** and **maintainability**
- Test changes **locally** when possible
- Ask **questions** rather than making demands
- Approve when **ready**, request changes when **needed**

## Community

### Getting Help

- **GitHub Discussions**: Ask questions and discuss features
- **GitHub Issues**: Report bugs and request features
- **Pull Requests**: Get feedback on your code

### Recognition

Contributors will be recognized in:

- README.md contributors section
- Release notes
- Project documentation

## License

By contributing to AI Video Editor, you agree that your contributions will be licensed under the same license as the project (ISC License).

## Thank You! 🎉

Thank you for taking the time to contribute to AI Video Editor! Every contribution, no matter how small, helps make this project better for everyone.

---

**Questions?** Feel free to open an issue or discussion on GitHub!

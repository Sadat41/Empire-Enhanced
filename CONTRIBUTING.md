# Contributing to Empire Enhanced

Thank you for your interest in contributing to Empire Enhanced! This guide will help you understand the codebase and contribute effectively.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Overview](#project-overview)
- [Architecture Overview](#architecture-overview)
- [File Structure](#file-structure)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting Changes](#submitting-changes)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Issue Guidelines](#issue-guidelines)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing](#testing)
- [Getting Help](#getting-help)

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Chrome or Firefox browser for testing
- Git for version control
- Text editor or IDE

### First Steps

1. Fork the repository on GitHub
2. Clone your fork locally
3. Install dependencies
4. Set up the development environment
5. Make your changes
6. Test thoroughly
7. Submit a pull request

## Project Overview

Empire Enhanced is a browser extension that enhances the CSGOEmpire trading experience with:

- Real-time WebSocket monitoring of marketplace items
- Smart filtering and notifications for target items  
- Price comparison with external sources (CSFloat, Buff163)
- Custom theming for the CSGOEmpire website
- Comprehensive notification history tracking

**Technology Stack:**
- JavaScript (ES6+)
- Chrome Extension Manifest V3
- Socket.IO for WebSocket connections
- Chrome Storage API for settings persistence

## Architecture Overview

Empire Enhanced follows a modular Chrome extension architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Background    │    │  Content Script │    │   Popup UI      │
│   Service       │◄──►│   (Injected)    │    │  (Extension)    │
│   Worker        │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
    ┌────▼────┐             ┌────▼────┐             ┌────▼────┐
    │WebSocket│             │DOM Mods │             │Settings │
    │Manager  │             │Theming  │             │Storage  │
    └─────────┘             └─────────┘             └─────────┘
```

### Core Components

1. **Background Script** (`background.js`) - Core logic hub
   - Manages WebSocket connections to CSGOEmpire
   - Processes incoming item data
   - Handles notifications and cross-tab communication

2. **Content Scripts** - Page interaction layer
   - `content-script.js` - DOM manipulation and notifications
   - `site-themeing.js` - Visual theming system
   - `features/tradeit-price-compare.js` - Price comparison integration

3. **Popup Interface** (`popup.js/html`) - User configuration
   - Settings management
   - Item target list configuration
   - Real-time status display

4. **Modular Core System** (`core/`)
   - Event bus for component communication
   - Dynamic module loading system
   - Base module architecture

## File Structure

### Root Level Files
```
Empire-Enhanced/
├── background.js              # Core extension logic (3,015 lines)
├── content-script.js          # DOM manipulation & notifications (1,433 lines)
├── popup.js                   # Extension UI logic (1,564 lines)
├── popup.html                 # Extension popup interface
├── site-themeing.js           # Website theming system (541 lines)
├── starfield.js               # Animated background effects
├── history.js                 # Notification history manager (695 lines)
├── history.html               # History page interface
├── offscreen.js               # Audio notification handler
├── offscreen.html             # Offscreen document for audio
├── manifest.json              # Extension configuration
├── server-settings.json       # Auto-sync configuration
└── socket.io.min.js           # WebSocket client library
```

### Directory Structure
```
├── core/                      # Modular architecture system
│   ├── base-module.js         # Base class for all modules
│   ├── event-bus.js           # Inter-component communication
│   └── module-loader.js       # Dynamic module loading
├── features/                  # Feature-specific modules
│   └── tradeit-price-compare.js # Price comparison integration
├── icons/                     # Extension icons (16x16, 48x48, 128x128)
├── tracker/                   # Analytics and tracking system
│   ├── tracker.html           # Analytics dashboard
│   ├── tracker-complete.js    # Full tracking implementation
│   ├── tracker.css            # Styling for tracker
│   └── [various libraries]    # Chart.js, ApexCharts, etc.
└── Demo/                      # Screenshots and demo assets
```

### Key File Responsibilities

**Background Script (`background.js`)** - 3,015 lines
- WebSocket connection management
- Item processing and filtering
- Notification system
- Cross-tab communication
- API integration

**Content Script (`content-script.js`)** - 1,433 lines
- DOM manipulation
- In-page notifications
- UI integration
- Event handling

**Popup Interface (`popup.js`)** - 1,564 lines
- Settings management
- Target item configuration
- Status display
- Theme controls

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/Empire-Enhanced.git
cd Empire-Enhanced
```

### 2. Install Dependencies

```bash
# Install any dependencies
npm install
```

### 3. Load Extension in Browser

**For Chrome:**
1. Open `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the project root directory

**For Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.json` from the project root

### 4. Configure for Testing

1. Get a CSGOEmpire API key from [csgoempire.com/trading/apikey](https://csgoempire.com/trading/apikey)
2. Open the extension popup in your browser
3. Navigate to API Configuration and enter your key
4. Visit CSGOEmpire marketplace to test functionality

## Making Changes

### Development Workflow

1. **Create a new branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow existing code patterns
   - Add appropriate logging for debugging
   - Test changes thoroughly

3. **Test your changes**
   - Reload the extension in browser
   - Test all affected functionality
   - Check browser console for errors

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: brief description of your changes"
   ```

### Common Contribution Areas

**1. New Filtering Options**
- Location: `background.js` - `checkItemCriteria()` function
- Examples: wear condition filters, sticker filtering, market trends

```javascript
// Example: Adding wear condition filter
if (settings.wearFilter && !item.wear.includes(settings.targetWear)) {
    return false; // Item doesn't match wear criteria
}
```

**2. UI/UX Improvements**
- Locations: `popup.html/js`, `content-script.js`, `site-themeing.js`
- Examples: notification styles, settings organization, new themes

**3. Price Comparison Enhancements**
- Location: `features/tradeit-price-compare.js`
- Examples: new price sources, accuracy improvements, trend indicators

**4. Notification System**
- Locations: `background.js`, `offscreen.js`, `history.js`
- Examples: custom sounds, notification grouping, scheduling

**5. Performance Optimizations**
- Areas: WebSocket efficiency, memory usage, background script performance

## Submitting Changes

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass (if applicable)
- [ ] Extension loads without errors
- [ ] Changes have been tested thoroughly
- [ ] Commit messages are clear and descriptive

### Push Changes

```bash
git push origin feature/your-feature-name
```

### Create Pull Request

1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Select your feature branch
4. Fill out the pull request template
5. Submit for review

## Pull Request Guidelines

### PR Title Format
Use conventional commit format:
- `feat: add new filtering option`
- `fix: resolve WebSocket connection issue`
- `docs: update installation instructions`
- `refactor: improve notification system`

### PR Description Template

```
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Extension loads without errors
- [ ] WebSocket connection works
- [ ] Notifications trigger correctly
- [ ] Settings save and load properly
- [ ] No console errors

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Additional Notes
Any additional information about the changes.
```

### Review Process

1. Maintainers will review your PR
2. Address any requested changes
3. Once approved, your PR will be merged
4. Delete your feature branch after merge

## Issue Guidelines

### Reporting Bugs

Use the bug report template and include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Browser and extension version
- Console error messages (if any)

### Feature Requests

Use the feature request template and include:
- Clear description of desired functionality
- Use cases and benefits
- Possible implementation approach

### Questions

For questions about usage or development:
- Check existing documentation first
- Search existing issues for similar questions
- Provide context about what you're trying to achieve

## Code Style Guidelines

### JavaScript Style

- Use descriptive variable and function names
- Follow existing error handling patterns
- Keep functions focused and modular
- Use ES6+ features appropriately

```javascript
// Good
async function fetchItemPriceData(itemId) {
    try {
        const response = await fetch(`/api/price/${itemId}`);
        return await response.json();
    } catch (error) {
        console.error('Price fetch failed:', error);
        throw error;
    }
}
```

### Chrome Extension Patterns

- Use `chrome.runtime.sendMessage()` for component communication
- Store settings in `chrome.storage.sync` for persistence
- Handle Manifest V3 service worker limitations properly

### Console Logging

Use consistent prefixes for different types of logs:
- Main operations: `[Empire Enhanced]`
- Success states: `[SUCCESS]`
- Error states: `[ERROR]`
- Network operations: `[NETWORK]`
- Item targeting: `[TARGET]`

### Error Handling

Always wrap async operations in try-catch blocks:

```javascript
try {
    await someAsyncOperation();
} catch (error) {
    console.error('[ERROR] Operation failed:', error.message);
    // Handle error appropriately
}
```

## Testing

### Manual Testing Checklist

- [ ] Extension loads without errors in browser console
- [ ] WebSocket connection establishes successfully
- [ ] Item filtering works with various criteria
- [ ] Notifications appear and play sounds correctly
- [ ] Settings persist after browser restart
- [ ] Price comparison data displays accurately
- [ ] Site theming applies without conflicts
- [ ] All UI interactions work as expected

### Debug Console

Monitor these areas during testing:
- Background script console for WebSocket and processing logs
- Content script console for DOM manipulation issues
- Network tab for WebSocket traffic and API calls
- Chrome storage for settings persistence

### Common Debug Scenarios

```javascript
// Check WebSocket connection
console.log('WebSocket connected:', manager.isConnected);

// Verify item processing
// Look for item processing logs in background console

// Test notifications
// Use "Test Notification" button in popup
```

## Getting Help

### Documentation

- Start with this contributing guide
- Check the main README.md for project overview
- Review existing code for patterns and examples

### Common Questions

**Q: How do I add a new filter option?**
A: Modify the `checkItemCriteria()` function in `background.js` and add UI controls in `popup.html/js`

**Q: Where do I add new notification types?**
A: Update notification logic in `background.js` and display handling in `content-script.js`

**Q: How can I test WebSocket functionality?**
A: Use browser Network tab to monitor WebSocket traffic and background script console for logs

**Q: Extension not loading properly?**
A: Check `chrome://extensions` for error messages and verify `manifest.json` syntax

### Getting Support

- Open an issue on GitHub for bugs or feature requests
- Join project discussions for questions and ideas
- Review existing issues and pull requests for context

### Contributing Tips

1. **Start Small** - Begin with minor UI improvements or bug fixes
2. **Understand the Flow** - Trace how data moves through the system
3. **Test Thoroughly** - Use a real CSGOEmpire API key for testing
4. **Ask Questions** - Don't hesitate to seek clarification
5. **Follow Patterns** - Look at existing code for style guidance

---

Thank you for contributing to Empire Enhanced! Your contributions help make this project better for everyone.
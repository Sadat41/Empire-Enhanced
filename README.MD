#### Option 2. Download & extract the Files
Extract the downloaded ZIP file to a location on your computer. You should find a folder named `Empire-Enhanced-main` (or similar). This folder contains the `extension` directory needed for the next steps.

### Step 2: Load the Browser Extension

[![Chrome](https://img.shields.io/badge/Google_chrome-4285F4?style=for-the-badge&logo=Google-chrome&logoColor=white)](https://github.com/Sadat41)
- Go to `chrome://extensions/`
- Enable Developer Mode (top-right)
- Click Load unpacked
- Select the `/extension` folder inside the project

[![FireFox](https://img.shields.io/badge/Firefox_Browser-FF7139?style=for-the-badge&logo=Firefox-Browser&logoColor=white)](https://github.com/Sadat41)
- Visit `about:debugging#/runtime/this-firefox`
- Click Load Temporary Add-on
- Choose the `manifest.json` inside the `/extension` folder

### Step 3: Use the Extension
Once the extension is loaded in your browser:
* Click the Empire Enhanced icon in your browser toolbar.
* **Configure your API Key:** In the popup, navigate to the API Configuration section to enter your CSGOEmpire API key and save it.
* Get your CSGOEmpire [API key](https://csgoempire.com/trading/apikey) here
* Use the popup to:
    * Add items to the Item Target List
    * Set float and price filters
    * Choose notification sounds
    * Enable site theming (Nebula or Shooting Star)

The extension will automatically connect to CSGOEmpire and start monitoring items based on your configuration.

---

# 💻 Development

## 🛠️ The Tech Stack

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-4F4F4F?style=for-the-badge&logo=websocket&logoColor=white)

## 🏗️ Build Instructions

### 1. Prerequisites

Ensure you have the following installed:
- **Node.js** (v16 or higher) - for package management and development scripts
- **Chrome/Firefox** - for testing the extension
- **Git** - for version control

### 2. Clone & Setup

```bash
# Clone the repository
git clone https://github.com/Sadat41/Empire-Enhanced.git
cd Empire-Enhanced

# Install dependencies
npm install

# Setup your development environment
# Copy server-settings.json.example to server-settings.json (if needed)
cp server-settings.json.example server-settings.json
```

### 3. Development Workflow

#### For Extension Development:
```bash
# Start development mode (watches for changes)
npm run dev

# For Firefox development
npm run dev:firefox

# Build for production
npm run build

# Package extension for distribution
npm run package
```

#### For Backend Server Development:
```bash
# Start the backend server
npm start

# Start with auto-reload for development
npm run dev
```

### 4. Load the Extension for Development

#### For Chrome:
```bash
# Go to chrome://extensions/
# Enable "Developer mode" (top-right toggle)
# Click "Load unpacked"
# Select the /extension folder from this project
```

#### For Firefox:
```bash
# Go to about:debugging#/runtime/this-firefox
# Click "Load Temporary Add-on"
# Select manifest.json from the /extension folder
```

### 5. Architecture Overview

```
Empire Enhanced Extension
├── extension/
│   ├── background.js          # Main extension logic & WebSocket connections
│   ├── content-script.js      # CSGOEmpire page integration & notifications
│   ├── popup.js              # Extension UI management
│   ├── site-themeing.js      # Site theming with starfield effects
│   ├── tradeit-price-compare.js # Price comparison feature
│   ├── offscreen.js          # Audio notification handling
│   ├── socket.io.min.js      # Socket.IO client library
│   └── manifest.json         # Extension manifest v3
├── server/
│   ├── keychain-monitor-server.js # Backend monitoring server
│   └── server-settings.json  # Auto-sync configuration
└── package.json              # Dependencies and scripts
```

### 6. Key Technologies & Dependencies

**Extension Stack:**
- **Socket.IO Client** - Real-time WebSocket communication with CSGOEmpire
- **Chrome Extension APIs** - Storage, notifications, tabs, offscreen documents
- **Vanilla JavaScript** - No frameworks for maximum performance

**Backend Stack (Optional):**
- **Node.js** - Server runtime
- **Socket.IO** - WebSocket server implementation
- **Axios** - HTTP client for API requests
- **Express** - Web server framework

### 7. Configuration

#### Auto-Sync Settings (Optional)
Create a `server-settings.json` file in the extension root for automatic configuration:

```json
{
  "minAboveRecommended": -50,
  "maxAboveRecommended": 5,
  "keychainPercentageThreshold": 50,
  "enabledKeychains": [
    "Hot Howl",
    "Baby Karat T",
    "Semi-Precious",
    "Diamond Dog"
  ],
  "itemTargetList": [
    {
      "id": "item1",
      "name": "AK-47 | Redline",
      "floatFilter": {
        "enabled": true,
        "min": 0.15,
        "max": 0.35
      }
    }
  ],
  "floatFilterEnabled": true,
  "lastUpdated": "2024-01-01T00:00:00.000Z",
  "version": "1.0"
}
```

#### API Integration
The extension requires a CSGOEmpire API key:
1. Get your API key from [CSGOEmpire API](https://csgoempire.com/trading/apikey)
2. Configure it through the extension popup
3. The extension will automatically connect and start monitoring

### 8. Testing & Debugging

#### Manual Testing
1. Load the extension in developer mode
2. Navigate to CSGOEmpire.com
3. Configure your API key in the extension popup
4. Test item filtering and notifications

#### Debug Console
```bash
# Enable debug logging in browser console
# Look for Empire Enhanced log messages with these prefixes:
# 🔥 - Main operations
# ✅ - Success states
# ❌ - Error states
# 📤/📥 - Network operations
# 🎯 - Item targeting
# 🔑 - Keychain detection
```

#### Common Debug Scenarios
```javascript
// Check WebSocket connection
// In background.js console:
console.log('WebSocket connected:', manager.isConnected);

// Verify item processing
// Look for item processing logs in background console

// Test notifications
// Use "Test Notification" button in popup
```

### 9. Building for Release

#### Create Distribution Package
```bash
# Clean previous builds
npm run clean

# Build optimized version
npm run build

# Create zip for Chrome Web Store
npm run package

# The packaged extension will be in /dist folder
```

#### Release Checklist
- [ ] Update version in `manifest.json`
- [ ] Update version in `package.json`
- [ ] Test all core features (notifications, theming, price comparison)
- [ ] Verify API connections work with fresh API key
- [ ] Check notification permissions
- [ ] Test on both Chrome and Firefox
- [ ] Verify auto-sync settings load correctly
- [ ] Update README.md changelog

### 10. Development Scripts

```bash
# Extension Development
npm run dev              # Start development with file watching
npm run build            # Build for production
npm run clean            # Clean build artifacts
npm run package          # Create distribution zip
npm run lint             # Check code style
npm run test             # Run tests (if available)

# Server Development
npm start                # Start backend server
npm run dev              # Start server with auto-reload

# Utility Scripts
npm run validate         # Validate manifest.json
npm run docs             # Generate documentation
```

### 11. Debugging Common Issues

#### WebSocket Connection Problems
```bash
# Check API key configuration
# Verify CSGOEmpire.com is accessible
# Look for CORS or network blocking issues
# Check background.js console for connection logs
```

#### Notifications Not Working
```bash
# Verify notification permissions in Chrome settings
# Check if popup blocker is interfering
# Test with "Test Notification" button in popup
# Look for audio context errors in console
```

#### Extension Not Loading
```bash
# Check manifest.json syntax with JSON validator
# Verify all file paths exist in manifest
# Look for console errors in chrome://extensions
# Check for Content Security Policy violations
```

#### Site Theming Issues
```bash
# Verify site theming is enabled in popup
# Check for CSS conflicts in CSGOEmpire page
# Look for starfield.js errors in content script console
# Test theme switching between Nebula and Shooting Star
```

### 12. Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Follow the existing code style and patterns
4. Test thoroughly on both Chrome and Firefox
5. Update documentation for any new features
6. Commit with descriptive messages following conventional commits
7. Push and create a Pull Request

#### Code Style Guidelines
- Use descriptive variable names and function names
- Add console.log statements with emoji prefixes for debugging
- Follow the existing error handling patterns
- Keep functions focused and modular
- Add comments for complex logic

### 13. Advanced Development

#### Module System
The extension uses a modular architecture:
```javascript
// Extensions can be loaded as modules
await import('./core/event-bus.js');
await import('./core/module-loader.js'); 
await import('./core/base-module.js');
```

#### WebSocket Integration
```javascript
// Direct Socket.IO integration in background.js
importScripts('socket.io.min.js');

// WebSocket connection with authentication
this.socket = io(socketEndpoint, {
  transports: ["websocket"],
  query: {
    uid: this.userData.user.id,
    token: this.userData.socket_token,
  }
});
```

#### Price Data Integration
```javascript
// Fetch external price data for comparison
const response = await chrome.runtime.sendMessage({ 
  type: 'FETCH_TRADEIT_DATA' 
});
```

---

## API Usage
Checkout CSGOEmpire API documentation:
[CSGOEmpire API Documentation](https://docs.csgoempire.com/reference/getting-started-with-your-api)

## ⚠️ Note
Please be aware of the following:
* **Prohibited Activities:** We explicitly forbid the use of the Empire-Enhanced extension for illegal activities. This includes, but is not limited to, using the extension to engage in any form of malicious behavior, or violating platform terms of service.

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Sadat41)


<p align="center">
  <a href="https://betterfloat.com/">
    <img width="128" src="https://github.com/Sadat41/Empire-Enhanced/blob/main/icon128.png?raw=true"/>
  </a>
  <h1 align="center">Empire Enhanced</h1>
</p>
<p align="center"><strong> Real-Time Monitoring, Smart Filters, and Seamless Customization. </strong></p>

****
---
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Sadat41/Empire-Enhanced)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.md)
[![Repo Size](https://img.shields.io/github/repo-size/Sadat41/Empire-Enhanced?label=repo%20size&color=orange)](https://github.com/Sadat41/Empire-Enhanced)
[![Last Commit](https://img.shields.io/github/last-commit/Sadat41/Empire-Enhanced?label=last%20commit&color=lightgrey)](https://github.com/Sadat41/Empire-Enhanced/commits/main)



## 🤝 Community & Support
<p align="center">
  <a href="https://discord.gg/tmX4HjmQKz">
    <picture>
      <source srcset="https://i.postimg.cc/Fzj7T05w/discord.png" media="(prefers-color-scheme: dark)">
      <img height="58" src="https://i.postimg.cc/Fzj7T05w/discord.png" alt="Discord"></picture></a>
</p>

---

## Key Features
**Empire Enhanced** is built to extend and streamline the experience on [CSGOEmpire](https://csgoempire.com) through a set of practical and performance-focused tools:
#### Custom Item Tracking  
- Track any item by name using the Item Target List. Supports partial keyword matching and optional float (wear) value filtering.
#### Real-Time Notifications  
- Receive instant alerts when matching items appear in the marketplace. Includes customizable notification sounds with live preview.
#### Persistent Filters and Settings  
- Price ranges, keychain thresholds, and item lists are saved locally and restored automatically after browser or system restarts.
#### Theming
- The extension offers different themes ("Nebula" and "Shooting Star") for both the popup and the CSGOEmpire website itself.
#### Modular and Scalable Design  
- Features are designed as self-contained modules to allow for easy expansion without modifying core files.
---
## 📸 Preview

Take a sneak peek at Empire Enhanced in action.

### Main Dashboard

![Dashboard Screenshot](https://github.com/Sadat41/Empire-Enhanced/blob/main/Demo/Extension%20Menu.png)
*An intuitive and powerful dashboard providing an overview of your settings and active enhancements.*

### Notification History Page

![History Page](https://github.com/Sadat41/Empire-Enhanced/blob/main/Demo/History%20Page.png)
*Easily track missed or past alerts with the integrated Notification History page.*

### CSGOEmpire Home Page

![Home Page](https://github.com/Sadat41/Empire-Enhanced/blob/main/Demo/Homepage.png)
*The CSGOEmpire site reimagined with Empire Enhanced’s custom themes.*

### Short Demo Video (Optional)

[![Demo Video Thumbnail](https://placehold.co/1200x675/777777/ffffff?text=YOUR_VIDEO_THUMBNAIL_HERE)](YOUR_VIDEO_LINK_HERE)
*Click to watch a quick demonstration of Empire-Enhanced's key functionalities on [YouTube/Vimeo/etc.](YOUR_VIDEO_LINK_HERE)*

---

## ❓How It Works
**Empire Enhanced** injects JavaScript into CSGOEmpire and listens to WebSocket data for real-time item monitoring.
To use it:
- Run a local Node.js server that filters and processes data
- Provide your CSGOEmpire [API key](https://csgoempire.com/trading/apikey)
- The extension UI connects to the server and lets you configure:
  -  Target items + optional float range
  -  Notification sounds
  -  Site-wide theming
  -  Price and keychain filters

All settings are saved using `chrome.storage` and `server-settings.json`.

## Get the Extension

Ready to command your Browse experience? Install Empire-Enhanced now and start building your digital empire!

### Step 1: Set Up the Backend Server

#### 1. Clone the Project
```bash
git clone https://github.com/Sadat41/Empire-Enhanced.git
```
#### 2. Navigate to the server directory:
``` bash
cd Empire-Enhanced/server
```
#### 3. Install required packages:
```bash
npm install
```
#### 4. Open server.js and replace the placeholder API key:
```bash
const CONFIG = {
  apiKey: "YOUR_CSGOEMPIRE_API_KEY",
  ...
};
```
#### 5. Start the server
```bash
npm run dev  # For development (auto restarts)
```
or
```bash
npm start     # For production
```
#### 6. Visit http://localhost:3001/health to confirm it's running.

### Step 2: Load the Browser Extension

For Chrome:
#### 1. Go to `chrome://extensions/`
#### 2. Enable Developer Mode (top-right)
#### 3. Click Load unpacked
#### 4. Select the `/extension` folder inside the project

For Firefox:
#### 1. Visit `about:debugging#/runtime/this-firefox`
#### 2. Click Load Temporary Add-on
#### 3. Choose the `manifest.json` inside the `/extension` folder

### Step 3: Use the Extension
Once both the server and extension are running:
- Click the Empire Enhanced icon in your browser toolbar
- Use the popup to:
- Add items to the Item Target List
- Set float and price filters
- Choose notification sounds
- Enable site theming (Nebula or Shooting Star)

The extension will automatically connect to `http://localhost:3001` and start monitoring items based on your configuration.

## 📋 Notes
Checkout CSGOEmpire API documentation:
```
[CSGOEmpire API Documentation](https://docs.csgoempire.com/reference/getting-started-with-your-api)
```

## ⚠️ Note

Please be aware of the following:

* **Prohibited Activities:** We explicitly forbid the use of the Empire-Enhanced extension for illegal activities. This includes, but is not limited to, using the extension to gain an unfair advantage over other users, engaging in any form of malicious behavior, or violating platform terms of service. 

# Empire-Enhanced

![Empire-Enhanced Logo](https://github.com/Sadat41/Empire-Enhanced/blob/main/icon128.png?raw=true)

**Elevate Your Digital Realm. Experience Unprecedented Control and Customization.**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Sadat41/Empire-Enhanced)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.md)
[![Repo Size](https://img.shields.io/github/repo-size/Sadat41/Empire-Enhanced?label=repo%20size&color=orange)](https://github.com/Sadat41/Empire-Enhanced)
[![Last Commit](https://img.shields.io/github/last-commit/Sadat41/Empire-Enhanced?label=last%20commit&color=lightgrey)](https://github.com/Sadat41/Empire-Enhanced/commits/main)

---

## Get the Extension

Ready to command your Browse experience? Install Empire-Enhanced now and start building your digital empire!



## 🤝 Community & Support

Join our thriving community! Whether you have questions, need support, want to report a bug, or have brilliant ideas for new features, our Discord server is the place to be.

[![Join our Discord Server](https://img.shields.io/badge/-JOIN%20OUR%20DISCORD-7289DA?style=for-the-badge&logo=discord&logoColor=white&link=https://discord.gg/tmX4HjmQKz)](https://discord.gg/tmX4HjmQKz)

---

## Key Features

**Empire Enhanced** is built to extend and streamline the experience on [CSGOEmpire](https://csgoempire.com) through a set of practical and performance-focused tools:

### Custom Item Tracking  
Track any item by name using the Item Target List. Supports partial keyword matching and optional float (wear) value filtering.

### Real-Time Notifications  
Receive instant alerts when matching items appear in the marketplace. Includes customizable notification sounds with live preview.

### Persistent Filters and Settings  
Price ranges, keychain thresholds, and item lists are saved locally and restored automatically after browser or system restarts.

### Theme and UI Customization  
Apply consistent visual themes to both the extension and the target site. Built-in themes like Nebula and Shooting Star are supported, with modular theme architecture for easy additions.

### Modular and Scalable Design  
Features are designed as self-contained modules to allow for easy expansion without modifying core files.


---

## 📸 Preview

Take a sneak peek at Empire-Enhanced in action.

### Main Dashboard

![Dashboard Screenshot](https://placehold.co/1200x675/333333/ffffff?text=YOUR_DASHBOARD_SCREENSHOT_HERE)
*An intuitive and powerful dashboard providing an overview of your settings and active enhancements.*

### Feature X in Use

![Feature X Screenshot](https://placehold.co/1200x675/555555/ffffff?text=YOUR_FEATURE_X_SCREENSHOT_HERE)
*See how [Feature X] seamlessly integrates into your Browse, offering [benefit of feature X].*

### Short Demo Video (Optional)

[![Demo Video Thumbnail](https://placehold.co/1200x675/777777/ffffff?text=YOUR_VIDEO_THUMBNAIL_HERE)](YOUR_VIDEO_LINK_HERE)
*Click to watch a quick demonstration of Empire-Enhanced's key functionalities on [YouTube/Vimeo/etc.](YOUR_VIDEO_LINK_HERE)*

---

## ⚠️ Note

Please be aware of the following:

* **Prohibited Activities:** We explicitly forbid the use of the Empire-Enhanced extension for illegal activities. This includes, but is not limited to, using the extension to gain an unfair advantage over other users, engaging in any form of malicious behavior, or violating platform terms of service. 

---

## ❓How It Works

Empire Enhanced operates by injecting JavaScript into the target website and listening to websocket data streams from CSGOEmpire. It intercepts and processes real-time data such as item listings, wear values, and pricing information.

Upon installation, the extension adds a toolbar icon that opens a popup interface. From this UI, users can:
- Add or remove items in the tracking list
- Adjust price and float filters
- Preview and select notification sounds
- Enable or disable site theming

Data from the popup interface is stored using `chrome.storage` or equivalent local storage APIs. This allows settings and tracked items to persist between sessions. The local server syncs with the extension to ensure notifications and filters are consistent and reliable.
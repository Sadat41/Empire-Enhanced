const { io } = require('socket.io-client');
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Settings file for persistent storage
const SETTINGS_FILE = path.join(__dirname, 'server-settings.json');

// Configuration - EDIT THESE VALUES
const CONFIG = {
  // Replace with your CSGOEmpire API key
  apiKey: "YOUR_API_KEY_HERE", // Get your API key from here: https://csgoempire.com/trading/apikey
  
  // Change to '.gg' if '.com' is blocked
  domain: "csgoempire.com",
  
  // Port for the local server (extension will connect to this)
  port: 3001,
  
  // Connection resilience settings
  maxReconnectAttempts: 50,        // Maximum reconnection attempts
  reconnectDelay: 5000,            // Base delay between reconnection attempts (ms)
  maxReconnectDelay: 60000,        // Maximum delay between reconnection attempts (ms)
  heartbeatInterval: 30000,        // Send heartbeat every 30 seconds
  connectionTimeout: 10000,        // Timeout for initial connection (ms)
  
  // Price filter range - will be loaded from file if available
  minAboveRecommended: -50, // Default: Allow items up to 50% below recommended
  maxAboveRecommended: 5,   // Default: Allow items up to 5% above recommended
  
  // Keychain filter settings - will be loaded from file if available
  keychainPercentageThreshold: 50, // Default: Only notify if charm price is >= 50% of market value
  enabledKeychains: new Set([     // Default: All keychains enabled initially
    "Hot Howl", "Baby Karat T", "Hot Wurst", "Baby Karat CT", "Semi-Precious", 
    "Diamond Dog", "Titeenium AWP", "Lil' Monster", "Diner Dog", "Lil' Squirt", 
    "Die-cast AK", "Lil' Teacup", "Chicken Lil'", "That's Bananas", "Lil' Whiskers", 
    "Glamour Shot", "Lil' Sandy", "Hot Hands", "POP Art", "Disco MAC", "Lil' Squatch", 
    "Lil' SAS", "Baby's AK", "Hot Sauce", "Pinch O' Salt", "Big Kev", "Whittle Knife", 
    "Lil' Crass", "Pocket AWP", "Lil' Ava", "Stitch-Loaded", "Backsplash", "Lil' Cap Gun"
  ]),
  
  // Item Target List settings - will be loaded from file if available
  itemTargetList: [], // Default: Empty array
  floatFilterEnabled: false, // Default: Float filter disabled
  
  // Target keychains to monitor for (kept for backward compatibility)
  targetKeychains: [
    "Hot Howl", "Baby Karat T", "Hot Wurst", "Baby Karat CT", "Semi-Precious", 
    "Diamond Dog", "Titeenium AWP", "Lil' Monster", "Diner Dog", "Lil' Squirt", 
    "Die-cast AK", "Lil' Teacup", "Chicken Lil'", "That's Bananas", "Lil' Whiskers", 
    "Glamour Shot", "Lil' Sandy", "Hot Hands", "POP Art", "Disco MAC", "Lil' Squatch", 
    "Lil' SAS", "Baby's AK", "Hot Sauce", "Pinch O' Salt", "Big Kev", "Whittle Knife", 
    "Lil' Crass", "Pocket AWP", "Lil' Ava", "Stitch-Loaded", "Backsplash", "Lil' Cap Gun"
  ],

  // Enhanced Charm Pricing Data with better organization
  charmPricing: {
    "Red": {
      "Hot Howl": 70.0,
      "Baby Karat T": 50.0,
      "Hot Wurst": 30.0,
      "Baby Karat CT": 30.0
    },
    "Pink": {
      "Semi-Precious": 40.0,
      "Diamond Dog": 25.0,
      "Titeenium AWP": 10.0,
      "Lil' Monster": 10.0,
      "Diner Dog": 5.00,
      "Lil' Squirt": 5.00
    },
    "Purple": {
      "Die-cast AK": 9.00,
      "Lil' Teacup": 4.50,
      "Chicken Lil'": 3.00,
      "That's Bananas": 3.00,
      "Lil' Whiskers": 3.00,
      "Glamour Shot": 2.50,
      "Lil' Sandy": 2.50,
      "Hot Hands": 2.00,
      "POP Art": 2.00,
      "Disco MAC": 1.60,
      "Lil' Squatch": 1.50
    },
    "Blue": {
      "Lil' SAS": 1.00,
      "Baby's AK": 0.80,
      "Hot Sauce": 0.90,
      "Pinch O' Salt": 1.0,
      "Big Kev": 0.70,
      "Whittle Knife": 0.65,
      "Lil' Crass": 0.60,
      "Pocket AWP": 0.60,
      "Lil' Ava": 0.50,
      "Stitch-Loaded": 0.30,
      "Backsplash": 0.28,
      "Lil' Cap Gun": 0.30
    }
  }
};

// Persistent storage functions
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      console.log('📂 Loading settings from file...');
      const settingsData = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(settingsData);
      
      // Apply loaded settings to CONFIG with validation
      if (typeof settings.minAboveRecommended === 'number') {
        CONFIG.minAboveRecommended = settings.minAboveRecommended;
        console.log(`✅ Loaded minAboveRecommended: ${settings.minAboveRecommended}%`);
      }
      
      if (typeof settings.maxAboveRecommended === 'number') {
        CONFIG.maxAboveRecommended = settings.maxAboveRecommended;
        console.log(`✅ Loaded maxAboveRecommended: ${settings.maxAboveRecommended}%`);
      }
      
      if (typeof settings.keychainPercentageThreshold === 'number') {
        CONFIG.keychainPercentageThreshold = settings.keychainPercentageThreshold;
        console.log(`✅ Loaded keychainPercentageThreshold: ${settings.keychainPercentageThreshold}%`);
      }
      
      if (Array.isArray(settings.enabledKeychains)) {
        CONFIG.enabledKeychains = new Set(settings.enabledKeychains);
        console.log(`✅ Loaded enabledKeychains: ${settings.enabledKeychains.length} keychains`);
      }
      
      if (Array.isArray(settings.itemTargetList)) {
        CONFIG.itemTargetList = settings.itemTargetList;
        console.log(`✅ Loaded itemTargetList: ${settings.itemTargetList.length} items`);
      }
      
      if (typeof settings.floatFilterEnabled === 'boolean') {
        CONFIG.floatFilterEnabled = settings.floatFilterEnabled;
        console.log(`✅ Loaded floatFilterEnabled: ${settings.floatFilterEnabled}`);
      }
      
      console.log('🎉 All settings loaded successfully from file');
      console.log(`📊 Current settings summary:`);
      console.log(`   💰 Price range: ${CONFIG.minAboveRecommended}% to ${CONFIG.maxAboveRecommended}%`);
      console.log(`   🔑 Keychain threshold: ${CONFIG.keychainPercentageThreshold}%`);
      console.log(`   🔗 Enabled keychains: ${CONFIG.enabledKeychains.size}/${getAllKeychainNames().length}`);
      console.log(`   🎯 Target items: ${CONFIG.itemTargetList.length}`);
      console.log(`   📏 Float filter: ${CONFIG.floatFilterEnabled ? 'enabled' : 'disabled'}`);
      
      return true;
    } else {
      console.log('📁 No settings file found, using defaults and creating new file...');
      saveSettings(); // Create the file with current defaults
      return false;
    }
  } catch (error) {
    console.error('❌ Error loading settings:', error);
    console.log('🔄 Using default settings and attempting to create new settings file...');
    saveSettings(); // Try to create the file with defaults
    return false;
  }
}

function saveSettings() {
  try {
    const settings = {
      // Save current CONFIG values
      minAboveRecommended: CONFIG.minAboveRecommended,
      maxAboveRecommended: CONFIG.maxAboveRecommended,
      keychainPercentageThreshold: CONFIG.keychainPercentageThreshold,
      enabledKeychains: Array.from(CONFIG.enabledKeychains), // Convert Set to Array for JSON
      itemTargetList: CONFIG.itemTargetList,
      floatFilterEnabled: CONFIG.floatFilterEnabled,
      
      // Metadata
      lastUpdated: new Date().toISOString(),
      version: "1.0"
    };
    
    // Write to file with pretty formatting
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    console.log('💾 Settings saved to file successfully');
    console.log(`📊 Saved settings summary:`);
    console.log(`   💰 Price range: ${CONFIG.minAboveRecommended}% to ${CONFIG.maxAboveRecommended}%`);
    console.log(`   🔑 Keychain threshold: ${CONFIG.keychainPercentageThreshold}%`);
    console.log(`   🔗 Enabled keychains: ${CONFIG.enabledKeychains.size}`);
    console.log(`   🎯 Target items: ${CONFIG.itemTargetList.length}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error saving settings:', error);
    return false;
  }
}

// Helper function to get all keychain names (needed for loadSettings)
function getAllKeychainNames() {
  const keychains = [];
  for (const category in CONFIG.charmPricing) {
    keychains.push(...Object.keys(CONFIG.charmPricing[category]));
  }
  return keychains.sort();
}

class KeychainMonitorServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.wss = null;
    this.csgoSocket = null;
    this.userData = null;
    this.userDataRefreshedAt = null;
    this.connectedClients = new Set();
    this.notifiedItems = new Set(); // Track notified items to prevent duplicates
    this.notificationHistory = []; // Store only successful notifications
    
    // Connection management
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    this.heartbeatTimer = null;
    this.connectionStartTime = null;
    this.lastConnectionError = null;
    this.connectionState = 'disconnected'; // disconnected, connecting, connected, error
    
    this.stats = {
      keychainsFound: 0,
      itemsFound: 0,
      startTime: Date.now(),
      lastKeychainFound: null,
      lastItemFound: null,
      itemsProcessed: 0,
      itemsFiltered: 0,
      filterReasons: {},
      // Connection stats
      totalConnections: 0,
      totalDisconnections: 0,
      lastSuccessfulConnection: null,
      lastDisconnection: null,
      uptime: 0
    };
    
    // Load persistent settings before starting
    console.log('🔧 Loading persistent settings...');
    loadSettings();
    
    
    this.setupProcessHandlers();
    
    this.setupExpressServer();
    this.startServer();
  }

  // Setup process handlers for graceful shutdown and error handling
  setupProcessHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      console.log('🔄 Server will continue running...');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Promise Rejection:', reason);
      console.log('🔄 Server will continue running...');
    });

    // Handle SIGTERM (PM2 and Docker)
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      this.gracefulShutdown();
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      console.log('\n🛑 SIGINT received, shutting down gracefully...');
      this.gracefulShutdown();
    });

    // Keep process alive
    setInterval(() => {
      this.stats.uptime = Date.now() - this.stats.startTime;
    }, 10000); // Update uptime every 10 seconds
  }

  
  gracefulShutdown() {
    console.log('💾 Saving settings before shutdown...');
    saveSettings();
    
    console.log('🔌 Closing connections...');
    if (this.csgoSocket) {
      this.csgoSocket.disconnect();
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    if (this.server) {
      this.server.close(() => {
        console.log('✅ Server closed gracefully');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }

  setupExpressServer() {
    // Enable CORS for all routes
    this.app.use(cors());
    this.app.use(express.json());

    // Health check endpoint with connection status
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'running',
        connected: this.csgoSocket !== null,
        connectionState: this.connectionState,
        stats: {
          ...this.stats,
          uptime: Date.now() - this.stats.startTime,
          connectionHealth: {
            totalConnections: this.stats.totalConnections,
            totalDisconnections: this.stats.totalDisconnections,
            reconnectAttempts: this.reconnectAttempts,
            lastSuccessfulConnection: this.stats.lastSuccessfulConnection,
            lastDisconnection: this.stats.lastDisconnection,
            lastConnectionError: this.lastConnectionError
          }
        },
        notificationCount: this.notificationHistory.length,
        config: {
          keychainPercentageThreshold: CONFIG.keychainPercentageThreshold,
          enabledKeychainsCount: CONFIG.enabledKeychains.size,
          itemTargetListCount: CONFIG.itemTargetList.length,
          priceRange: {
            min: CONFIG.minAboveRecommended,
            max: CONFIG.maxAboveRecommended
          }
        }
      });
    });

    // Notification history endpoint - only last 30 minutes
    this.app.get('/history', (req, res) => {
      const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
      
      const recentNotifications = this.notificationHistory
        .filter(item => item.timestamp > thirtyMinutesAgo)
        .sort((a, b) => b.timestamp - a.timestamp);

      console.log(`📊 History request: ${recentNotifications.length} notifications in last 30 minutes`);

      res.json({
        items: recentNotifications,
        total: recentNotifications.length,
        timeRange: "30 minutes"
      });
    });

    // Stats endpoint with enhanced debugging info
    this.app.get('/stats', (req, res) => {
      res.json({
        ...this.stats,
        uptime: Date.now() - this.stats.startTime,
        isConnectedToCSGO: this.csgoSocket !== null,
        connectionState: this.connectionState,
        notificationCount: this.notificationHistory.length,
        config: {
          keychainPercentageThreshold: CONFIG.keychainPercentageThreshold,
          enabledKeychainsCount: CONFIG.enabledKeychains.size,
          totalKeychains: this.getAllKeychainNames().length,
          itemTargetListCount: CONFIG.itemTargetList.length
        }
      });
    });

    // Manual test endpoint with float value and debugging
    this.app.post('/test', (req, res) => {
      const testItem = {
        id: 'test-' + Date.now(),
        market_name: 'Test AK-47 | Redline (Field-Tested)',
        market_value: 3907,
        purchase_price: 3907,
        suggested_price: 4100,
        above_recommended_price: -4.7,
        wear: 0.1234567,
        keychains: [{ name: 'Hot Howl', wear: null }],
        published_at: new Date().toISOString()
      };
      
      console.log('🧪 Sending test notification...');
      
      const charmDetails = this.getCharmDetails(testItem);
      if (charmDetails) {
        testItem.charm_category = charmDetails.category;
        testItem.charm_name = charmDetails.name;
        testItem.charm_price = charmDetails.price;
        testItem.charm_price_display = this.formatCharmPrice(charmDetails.price, testItem.purchase_price);
      }
      
      this.storeNotification(testItem);
      this.notifyClients('KEYCHAIN_FOUND', testItem);
      
      res.json({ 
        message: 'Test notification sent and stored in history',
        item: {
          name: testItem.market_name,
          price: `${(testItem.market_value / 100).toFixed(2)}`,
          float: testItem.wear.toFixed(6),
          keychains: testItem.keychains.map(k => k.name),
          charmDetails: charmDetails || 'No charm found'
        }
      });
    });

    // Update filter endpoint with storage
    this.app.post('/update-filter', (req, res) => {
      const { minPercentage, maxPercentage } = req.body;
      
      if (typeof minPercentage !== 'number' || typeof maxPercentage !== 'number') {
        return res.status(400).json({ 
          error: 'Invalid input: minPercentage and maxPercentage must be numbers' 
        });
      }
      
      if (minPercentage > maxPercentage) {
        return res.status(400).json({ 
          error: 'Invalid range: minPercentage cannot be greater than maxPercentage' 
        });
      }
      
      // Update the config
      CONFIG.minAboveRecommended = minPercentage;
      CONFIG.maxAboveRecommended = maxPercentage;
      
      // Save to storage
      const saveSuccess = saveSettings();
      
      console.log(`🔧 Price filter updated: ${minPercentage}% to ${maxPercentage}% ${saveSuccess ? '(saved)' : '(save failed)'}`);
      
      res.json({ 
        message: `Price filter updated to ${minPercentage}% to ${maxPercentage}%${saveSuccess ? ' and saved persistently' : ' (warning: save failed)'}`,
        filter: {
          min: minPercentage,
          max: maxPercentage
        },
        persistent: saveSuccess
      });
    });

    // Update Item Target List endpoint with storage
    this.app.post('/update-item-target-list', (req, res) => {
      const { itemTargetList, floatFilterEnabled } = req.body;
      
      if (!Array.isArray(itemTargetList)) {
        return res.status(400).json({ 
          error: 'Invalid input: itemTargetList must be an array' 
        });
      }
      
      // Validate item structure
      for (const item of itemTargetList) {
        if (!item.name || typeof item.name !== 'string') {
          return res.status(400).json({ 
            error: 'Invalid item: each item must have a name string' 
          });
        }
        
        if (item.floatFilter && typeof item.floatFilter !== 'object') {
          return res.status(400).json({ 
            error: 'Invalid item: floatFilter must be an object' 
          });
        }
      }
      
      const oldCount = CONFIG.itemTargetList.length;
      CONFIG.itemTargetList = itemTargetList;
      CONFIG.floatFilterEnabled = floatFilterEnabled !== undefined ? floatFilterEnabled : CONFIG.floatFilterEnabled;
      
      // Save to storage
      const saveSuccess = saveSettings();
      
      console.log(`🔧 Item Target List updated: ${oldCount} → ${itemTargetList.length} items ${saveSuccess ? '(saved)' : '(save failed)'}`);
      console.log(`🎯 Float filter enabled: ${CONFIG.floatFilterEnabled}`);
      
      if (itemTargetList.length > 0) {
        console.log(`🎯 Target items: ${itemTargetList.slice(0, 3).map(i => i.name).join(', ')}${itemTargetList.length > 3 ? ` +${itemTargetList.length - 3} more` : ''}`);
      }
      
      res.json({ 
        message: `Item Target List updated: ${itemTargetList.length} items being monitored${saveSuccess ? ' and saved persistently' : ' (warning: save failed)'}`,
        itemTargetList: itemTargetList.map(item => ({
          name: item.name,
          floatFilter: item.floatFilter || { enabled: false, min: 0, max: 1 }
        })),
        count: itemTargetList.length,
        previousCount: oldCount,
        floatFilterEnabled: CONFIG.floatFilterEnabled,
        persistent: saveSuccess
      });
    });

    // Update keychain percentage threshold with storage
    this.app.post('/update-keychain-percentage', (req, res) => {
      const { percentageThreshold } = req.body;
      
      if (typeof percentageThreshold !== 'number' || percentageThreshold < 0 || percentageThreshold > 100) {
        return res.status(400).json({ 
          error: 'Invalid input: percentageThreshold must be a number between 0 and 100' 
        });
      }
      
      const oldThreshold = CONFIG.keychainPercentageThreshold;
      CONFIG.keychainPercentageThreshold = percentageThreshold;
      
      // Save to storage
      const saveSuccess = saveSettings();
      
      console.log(`🔧 Keychain percentage threshold updated: ${oldThreshold}% → ${percentageThreshold}% ${saveSuccess ? '(saved)' : '(save failed)'}`);
      
      res.json({ 
        message: `Keychain percentage threshold updated to ${percentageThreshold}%${saveSuccess ? ' and saved persistently' : ' (warning: save failed)'}`,
        threshold: percentageThreshold,
        previousThreshold: oldThreshold,
        persistent: saveSuccess
      });
    });

    // Update enabled keychains with storage
    this.app.post('/update-enabled-keychains', (req, res) => {
      const { enabledKeychains } = req.body;
      
      if (!Array.isArray(enabledKeychains)) {
        return res.status(400).json({ 
          error: 'Invalid input: enabledKeychains must be an array' 
        });
      }
      
      // Validate that all keychains exist in our pricing data
      const allKeychains = this.getAllKeychainNames();
      const invalidKeychains = enabledKeychains.filter(k => !allKeychains.includes(k));
      
      if (invalidKeychains.length > 0) {
        return res.status(400).json({ 
          error: `Invalid keychains: ${invalidKeychains.join(', ')}`,
          validKeychains: allKeychains
        });
      }
      
      const oldCount = CONFIG.enabledKeychains.size;
      CONFIG.enabledKeychains = new Set(enabledKeychains);
      
      // Save to persistent storage
      const saveSuccess = saveSettings();
      
      console.log(`🔧 Enabled keychains updated: ${oldCount} → ${enabledKeychains.length} keychains enabled ${saveSuccess ? '(saved)' : '(save failed)'}`);
      console.log(`🔑 Enabled: ${enabledKeychains.slice(0, 5).join(', ')}${enabledKeychains.length > 5 ? ` +${enabledKeychains.length - 5} more` : ''}`);
      
      res.json({ 
        message: `Enabled keychains updated: ${enabledKeychains.length} keychains enabled${saveSuccess ? ' and saved persistently' : ' (warning: save failed)'}`,
        enabledKeychains: enabledKeychains,
        count: enabledKeychains.length,
        previousCount: oldCount,
        persistent: saveSuccess
      });
    });

    // Get current keychain filter settings with full details
    this.app.get('/keychain-filter-settings', (req, res) => {
      console.log('📊 Keychain filter settings requested');
      
      const allKeychains = this.getAllKeychainNames();
      const enabledKeychainsArray = Array.from(CONFIG.enabledKeychains);
      
      const response = {
        percentageThreshold: CONFIG.keychainPercentageThreshold,
        enabledKeychains: enabledKeychainsArray,
        allKeychains: allKeychains.map(name => {
          const category = this.getKeychainCategory(name);
          const price = category ? CONFIG.charmPricing[category][name] : 0;
          return {
            name,
            category,
            price,
            enabled: CONFIG.enabledKeychains.has(name)
          };
        }),
        totalKeychains: allKeychains.length,
        enabledCount: enabledKeychainsArray.length,
        stats: {
          itemsProcessed: this.stats.itemsProcessed,
          itemsFiltered: this.stats.itemsFiltered,
          successfulNotifications: this.stats.keychainsFound
        }
      };
      
      console.log(`📊 Returning settings: ${enabledKeychainsArray.length}/${allKeychains.length} keychains enabled, ${CONFIG.keychainPercentageThreshold}% threshold`);
      
      res.json(response);
    });

    // Get current Item Target List settings
    this.app.get('/item-target-list-settings', (req, res) => {
      console.log('📊 Item Target List settings requested');
      
      const response = {
        itemTargetList: CONFIG.itemTargetList,
        floatFilterEnabled: CONFIG.floatFilterEnabled,
        count: CONFIG.itemTargetList.length,
        stats: {
          itemsProcessed: this.stats.itemsProcessed,
          itemsFiltered: this.stats.itemsFiltered,
          itemsFound: this.stats.itemsFound,
          keychainsFound: this.stats.keychainsFound
        }
      };
      
      console.log(`📊 Returning Item Target List: ${CONFIG.itemTargetList.length} items being monitored`);
      
      res.json(response);
    });

    // Connection status endpoint
    this.app.get('/connection-status', (req, res) => {
      res.json({
        connectionState: this.connectionState,
        isConnected: this.csgoSocket !== null,
        reconnectAttempts: this.reconnectAttempts,
        lastConnectionError: this.lastConnectionError,
        connectionHealth: {
          totalConnections: this.stats.totalConnections,
          totalDisconnections: this.stats.totalDisconnections,
          lastSuccessfulConnection: this.stats.lastSuccessfulConnection,
          lastDisconnection: this.stats.lastDisconnection,
          uptime: Date.now() - this.stats.startTime
        }
      });
    });
  }

  // Helper methods for keychain management
  getAllKeychainNames() {
    const keychains = [];
    for (const category in CONFIG.charmPricing) {
      keychains.push(...Object.keys(CONFIG.charmPricing[category]));
    }
    return keychains.sort();
  }

  getKeychainCategory(keychainName) {
    for (const category in CONFIG.charmPricing) {
      if (CONFIG.charmPricing[category].hasOwnProperty(keychainName)) {
        return category;
      }
    }
    return null;
  }

  startServer() {
    this.server = this.app.listen(CONFIG.port, () => {
      console.log(`🔑 Enhanced Monitor Server started on port ${CONFIG.port}`);
      console.log(`📊 Health check: http://localhost:${CONFIG.port}/health`);
      console.log(`📜 History endpoint: http://localhost:${CONFIG.port}/history`);
      console.log(`🧪 Test notification: POST http://localhost:${CONFIG.port}/test`);
      console.log(`🔧 Keychain filter settings: GET http://localhost:${CONFIG.port}/keychain-filter-settings`);
      console.log(`🎯 Item Target List settings: GET http://localhost:${CONFIG.port}/item-target-list-settings`);
      console.log(`🔌 Connection status: GET http://localhost:${CONFIG.port}/connection-status`);
      console.log(`💾 Settings file: ${SETTINGS_FILE}`);
    });

    // Setup WebSocket server for extension connections
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.wss.on('connection', (ws) => {
      console.log('🔌 Extension connected');
      this.connectedClients.add(ws);
      
      // Send current status
      ws.send(JSON.stringify({
        type: 'STATUS',
        data: {
          connected: this.csgoSocket !== null,
          stats: this.stats
        }
      }));

      ws.on('close', () => {
        console.log('🔌 Extension disconnected');
        this.connectedClients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.connectedClients.delete(ws);
      });
    });

    // Start CSGOEmpire connection
    this.connectToCSGOEmpire();
  }

  async refreshUserData() {
    if (this.userDataRefreshedAt && this.userDataRefreshedAt > Date.now() - 15 * 1000) {
      return;
    }
    
    try {
      console.log('🔄 Refreshing user data...');
      const response = await axios.get(`https://${CONFIG.domain}/api/v2/metadata/socket`, {
        headers: {
          'Authorization': `Bearer ${CONFIG.apiKey}`
        },
        timeout: CONFIG.connectionTimeout
      });
      
      this.userData = response.data;
      this.userDataRefreshedAt = Date.now();
      console.log('✅ User data refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh user data:', error.message);
      throw error;
    }
  }

  // Improved connection method with better resilience
  async connectToCSGOEmpire() {
    if (this.isConnecting) {
      console.log('🔄 Connection already in progress, skipping...');
      return;
    }

    this.isConnecting = true;
    this.connectionState = 'connecting';
    this.connectionStartTime = Date.now();

    try {
      console.log(`🔑 Connecting to CSGOEmpire... (Attempt ${this.reconnectAttempts + 1}/${CONFIG.maxReconnectAttempts})`);
      
      if (!CONFIG.apiKey || CONFIG.apiKey === "YOUR_API_KEY_HERE") {
        throw new Error('Please set your API key in the CONFIG object');
      }

      await this.refreshUserData();

      const socketEndpoint = `wss://trade.${CONFIG.domain}/trade`;
      
      this.csgoSocket = io(socketEndpoint, {
        transports: ["websocket"],
        path: "/s/",
        secure: true,
        rejectUnauthorized: false,
        reconnect: false, // We handle reconnection manually
        timeout: CONFIG.connectionTimeout,
        query: {
          uid: this.userData.user.id,
          token: this.userData.socket_token,
        },
        extraHeaders: { 
          'User-agent': `${this.userData.user.id} API Bot` 
        }
      });

      // Enhanced connection event handlers
      this.csgoSocket.on('connect', async () => {
        console.log('✅ Connected to CSGOEmpire websocket');
        this.connectionState = 'connected';
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.lastConnectionError = null;
        this.stats.totalConnections++;
        this.stats.lastSuccessfulConnection = Date.now();
        
        // Start heartbeat
        this.startHeartbeat();
        
        this.notifyClients('STATUS', { connected: true });
      });

      this.csgoSocket.on('init', async (data) => {
        if (data && data.authenticated) {
          console.log(`✅ Successfully authenticated as ${data.name}`);
          
          this.csgoSocket.emit('filters', {
            price_max: 9999999
          });
          
        } else {
          await this.refreshUserData();
          this.csgoSocket.emit('identify', {
            uid: this.userData.user.id,
            model: this.userData.user,
            authorizationToken: this.userData.socket_token,
            signature: this.userData.socket_signature
          });
        }
      });

      this.csgoSocket.on('timesync', (data) => {
        console.log(`🕐 Timesync: ${JSON.stringify(data)}`);
      });

      this.csgoSocket.on('new_item', (data) => {
        console.log(`📦 New items received (${Array.isArray(data) ? data.length : 1})`);
        this.processItems(data);
      });

      this.csgoSocket.on('updated_item', (data) => {
        console.log(`📦 Updated items received (${Array.isArray(data) ? data.length : 1})`);
        this.processItems(data);
      });

      this.csgoSocket.on('auction_update', (data) => {
        console.log(`🔨 Auction update received`);
      });

      this.csgoSocket.on('deleted_item', (data) => {
        console.log(`🗑️ Items deleted: ${Array.isArray(data) ? data.length : 1}`);
      });

      this.csgoSocket.on('trade_status', (data) => {
        console.log(`📊 Trade status update received`);
      });

      // Better disconnect handling
      this.csgoSocket.on("disconnect", (reason) => {
        console.log(`❌ Socket disconnected: ${reason}`);
        this.handleDisconnection(reason);
      });

      this.csgoSocket.on("close", (reason) => {
        console.log(`❌ Socket closed: ${reason}`);
        this.handleDisconnection(`close: ${reason}`);
      });

      this.csgoSocket.on('error', (error) => {
        console.error(`❌ WS Error: ${error}`);
        this.lastConnectionError = error.toString();
        this.handleDisconnection(`error: ${error}`);
      });

      this.csgoSocket.on('connect_error', (error) => {
        console.error(`❌ Connect Error: ${error}`);
        this.lastConnectionError = error.toString();
        this.handleDisconnection(`connect_error: ${error}`);
      });

    } catch (error) {
      console.error('❌ Error while initializing socket:', error.message);
      this.lastConnectionError = error.message;
      this.handleDisconnection(`initialization_error: ${error.message}`);
    }
  }

  // Handle disconnections with smart reconnection
  handleDisconnection(reason) {
    this.connectionState = 'disconnected';
    this.isConnecting = false;
    this.stats.totalDisconnections++;
    this.stats.lastDisconnection = Date.now();
    
    if (this.csgoSocket) {
      this.csgoSocket = null;
    }
    
    this.stopHeartbeat();
    this.notifyClients('STATUS', { connected: false });
    
    // Smart reconnection logic
    if (this.reconnectAttempts < CONFIG.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      // Exponential backoff with jitter
      const baseDelay = CONFIG.reconnectDelay;
      const exponentialDelay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), CONFIG.maxReconnectDelay);
      const jitter = Math.random() * 1000; // Add up to 1 second of jitter
      const delay = exponentialDelay + jitter;
      
      console.log(`🔄 Attempting reconnection in ${(delay / 1000).toFixed(1)}s (${this.reconnectAttempts}/${CONFIG.maxReconnectAttempts})`);
      
      setTimeout(() => {
        if (this.reconnectAttempts <= CONFIG.maxReconnectAttempts) {
          this.connectToCSGOEmpire();
        }
      }, delay);
    } else {
      console.error(`❌ Max reconnection attempts reached (${CONFIG.maxReconnectAttempts}). Stopping automatic reconnection.`);
      console.log('🔄 You can restart the server to begin reconnection attempts again.');
      this.connectionState = 'error';
    }
  }

  
  startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing heartbeat
    
    this.heartbeatTimer = setInterval(() => {
      if (this.csgoSocket && this.connectionState === 'connected') {
        try {
          // Send a lightweight ping to keep connection alive
          this.csgoSocket.emit('ping', { timestamp: Date.now() });
        } catch (error) {
          console.error('❌ Heartbeat failed:', error);
          this.handleDisconnection('heartbeat_failed');
        }
      }
    }, CONFIG.heartbeatInterval);
    
    console.log(`💓 Heartbeat started (every ${CONFIG.heartbeatInterval / 1000}s)`);
  }

  
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Store only successful notifications (items that passed all filters) with float value
  storeNotification(item) {
    const notificationItem = {
      id: item.id,
      market_name: item.market_name,
      market_value: item.market_value,
      purchase_price: item.purchase_price,
      suggested_price: item.suggested_price,
      above_recommended_price: item.above_recommended_price,
      wear: item.wear,
      keychains: item.keychains ? item.keychains.map(k => k.name) : [],
      charm_category: item.charm_category,
      charm_name: item.charm_name,
      charm_price: item.charm_price,
      charm_price_display: item.charm_price_display,
      notification_type: item.notification_type || 'keychain',
      target_item_matched: item.target_item_matched,
      published_at: item.published_at,
      timestamp: Date.now()
    };

    this.notificationHistory.unshift(notificationItem);

    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.notificationHistory = this.notificationHistory.filter(item => item.timestamp > oneHourAgo);

    console.log(`💾 Stored notification in history: ${item.market_name} (Float: ${item.wear ? item.wear.toFixed(6) : 'N/A'}) (Total: ${this.notificationHistory.length})`);
  }

  // Process items with comprehensive filtering and Item Target List support
processItems(items) {
  if (!Array.isArray(items)) {
    items = [items];
  }

  items.forEach(item => {
    this.stats.itemsProcessed++;
    
    if (this.notifiedItems.has(item.id)) {
      return;
    }

    console.log(`🔍 Processing item: ${item.market_name}`);
    console.log(`💰 Market: $${(item.market_value / 100).toFixed(2)}, Float: ${item.wear ? item.wear.toFixed(6) : 'N/A'}`);

    // Check Item Target List first (higher priority)
    const targetItemMatch = this.checkItemTargetList(item);
    if (targetItemMatch) {
      console.log(`🎯 Found target item match: ${targetItemMatch.name}`);
      
      const priceCheck = this.isGoodPrice(item);
      if (!priceCheck.isGood) {
        this.stats.itemsFiltered++;
        this.incrementFilterReason('price_filter_target_item');
        console.log(`🚫 FILTERED: Target item price filter failed`);
        return;
      }
      
      const floatCheck = this.checkFloatFilter(item, targetItemMatch);
      if (!floatCheck.isGood) {
        this.stats.itemsFiltered++;
        this.incrementFilterReason('float_filter_target_item');
        console.log(`🚫 FILTERED: Target item float filter failed`);
        return;
      }

      console.log('🎉 🎯 TARGET ITEM FOUND - ALL FILTERS PASSED! 🎯 🎉');
      
      item.notification_type = 'target_item';
      item.target_item_matched = targetItemMatch;

      this.storeNotification(item);
      this.notifiedItems.add(item.id);
      
      if (this.notifiedItems.size > 1000) {
        const itemsArray = Array.from(this.notifiedItems);
        this.notifiedItems = new Set(itemsArray.slice(-500));
      }

      this.stats.itemsFound++;
      this.stats.lastItemFound = Date.now();

      this.notifyClients('ITEM_TARGET_FOUND', item);
      
      return;
    }

    // Check for keychains if no target item match
    if (item.keychains && item.keychains.length > 0) {
      console.log(`🔑 Keychains: ${item.keychains.map(k => k.name).join(', ')}`);
      
      //  Check if market name exactly matches any keychain name ***
      const itemName = item.market_name.toLowerCase();
      const allKeychainNames = this.getAllKeychainNames().map(name => name.toLowerCase());
      
      if (allKeychainNames.includes(itemName)) {
        this.stats.itemsFiltered++;
        this.incrementFilterReason('market_name_matches_keychain');
        console.log(`🚫 FILTERED: Item market name "${item.market_name}" exactly matches a keychain keyword - skipping keychain notification`);
        return;
      }
      
      // Also check if market name contains "Charm |" or "charm |" followed by keychain name
      const cleanedMarketName = itemName.replace(/^charm\s*\|\s*/, '').trim();
      if (allKeychainNames.includes(cleanedMarketName)) {
        this.stats.itemsFiltered++;
        this.incrementFilterReason('market_name_is_charm_keychain');
        console.log(`🚫 FILTERED: Item market name "${item.market_name}" is a charm with keychain name - skipping keychain notification`);
        return;
      }
      
      const charmDetails = this.getCharmDetails(item);

      if (charmDetails) {
        console.log(`🎯 Found target charm: ${charmDetails.name} (${charmDetails.category}) - $${charmDetails.price.toFixed(2)}`);
        
        if (!CONFIG.enabledKeychains.has(charmDetails.name)) {
          this.stats.itemsFiltered++;
          this.incrementFilterReason('keychain_disabled');
          console.log(`🚫 FILTERED: Keychain "${charmDetails.name}" disabled in settings`);
          return;
        }

        const priceCheck = this.isGoodPrice(item);
        if (!priceCheck.isGood) {
          this.stats.itemsFiltered++;
          this.incrementFilterReason('price_filter');
          console.log(`🚫 FILTERED: Price filter failed`);
          return;
        }
        
        const keychainPercentageCheck = this.checkKeychainPercentage(item, charmDetails);
        if (!keychainPercentageCheck.isGood) {
          this.stats.itemsFiltered++;
          this.incrementFilterReason('keychain_percentage');
          console.log(`🚫 FILTERED: Keychain percentage too low`);
          return;
        }

        console.log('🎉 🔑 TARGET FOUND - ALL FILTERS PASSED! 🔑 🎉');

        item.charm_category = charmDetails.category;
        item.charm_name = charmDetails.name;
        item.charm_price = charmDetails.price;
        item.charm_price_display = this.formatCharmPrice(charmDetails.price, item.purchase_price);
        item.notification_type = 'keychain';

        this.storeNotification(item);
        this.notifiedItems.add(item.id);
        
        if (this.notifiedItems.size > 1000) {
          const itemsArray = Array.from(this.notifiedItems);
          this.notifiedItems = new Set(itemsArray.slice(-500));
        }

        this.stats.keychainsFound++;
        this.stats.lastKeychainFound = Date.now();

        this.notifyClients('KEYCHAIN_FOUND', item);
      } else {
        console.log(`🔍 Unknown keychains found: ${item.keychains.map(k => k.name).join(', ')}`);
        this.stats.itemsFiltered++;
        this.incrementFilterReason('unknown_keychain');
      }
    }
  });
}

  // Fixed checkItemTargetList function to prevent keychain keyword conflicts
checkItemTargetList(item) {
  if (!item.market_name || CONFIG.itemTargetList.length === 0) {
    return null;
  }

  const itemName = item.market_name.toLowerCase();
  
  // Get all keychain names to avoid false positives
  const allKeychainNames = this.getAllKeychainNames().map(name => name.toLowerCase());
  
  // If the item name exactly matches a keychain name, don't treat it as an item target
  if (allKeychainNames.includes(itemName)) {
    console.log(`🚫 SKIPPED: Item name "${item.market_name}" exactly matches a keychain keyword, not treating as item target`);
    return null;
  }
  
  for (const targetItem of CONFIG.itemTargetList) {
    const targetName = targetItem.name.toLowerCase();
    
    if (itemName.includes(targetName) || targetName.includes(itemName)) {
      console.log(`✅ Item name match found: "${targetItem.name}" matches "${item.market_name}"`);
      return targetItem;
    }
  }
  
  return null;
}

  // Check float filter for target items
  checkFloatFilter(item, targetItem) {
    if (!targetItem.floatFilter || !targetItem.floatFilter.enabled) {
      return { 
        isGood: true, 
        reason: 'Float filter disabled for this item' 
      };
    }

    if (item.wear === undefined || item.wear === null) {
      return { 
        isGood: false, 
        reason: 'Item has no float value but float filter is enabled' 
      };
    }

    const itemFloat = parseFloat(item.wear);
    const minFloat = targetItem.floatFilter.min;
    const maxFloat = targetItem.floatFilter.max;

    if (itemFloat >= minFloat && itemFloat <= maxFloat) {
      return { 
        isGood: true, 
        reason: `Float ${itemFloat.toFixed(6)} is within range ${minFloat.toFixed(3)}-${maxFloat.toFixed(3)}` 
      };
    } else {
      return { 
        isGood: false, 
        reason: `Float ${itemFloat.toFixed(6)} is outside range ${minFloat.toFixed(3)}-${maxFloat.toFixed(3)}` 
      };
    }
  }

  // Track filter reasons for debugging
  incrementFilterReason(reason) {
    if (!this.stats.filterReasons[reason]) {
      this.stats.filterReasons[reason] = 0;
    }
    this.stats.filterReasons[reason]++;
  }

  // get charm details from CONFIG.charmPricing
  getCharmDetails(item) {
    if (!item.keychains || !Array.isArray(item.keychains) || item.keychains.length === 0) {
      return null;
    }

    for (const keychain of item.keychains) {
      const keychainName = keychain.name;
      if (!keychainName) continue;

      for (const category in CONFIG.charmPricing) {
        if (CONFIG.charmPricing[category].hasOwnProperty(keychainName)) {
          return {
            category: category,
            name: keychainName,
            price: CONFIG.charmPricing[category][keychainName]
          };
        }
      }
    }
    return null;
  }

  // Check if keychain meets percentage threshold with detailed logging
  checkKeychainPercentage(item, charmDetails) {
    const marketValue = item.market_value ? (item.market_value / 100) : 0;
    const charmPrice = charmDetails.price;
    
    if (marketValue <= 0) {
      return { 
        isGood: false, 
        reason: 'Market value is zero or unknown',
        percentage: 0
      };
    }
    
    const percentage = (charmPrice / marketValue) * 100;
    
    if (percentage >= CONFIG.keychainPercentageThreshold) {
      return { 
        isGood: true, 
        reason: `Charm is ${percentage.toFixed(2)}% of market value (≥${CONFIG.keychainPercentageThreshold}%)`,
        percentage: percentage
      };
    } else {
      return { 
        isGood: false, 
        reason: `Charm is ${percentage.toFixed(2)}% of market value (<${CONFIG.keychainPercentageThreshold}%)`,
        percentage: percentage
      };
    }
  }

  // function to format charm price display
  formatCharmPrice(charmPrice, purchasePriceCents) {
    if (purchasePriceCents === undefined || purchasePriceCents === null) {
      return "N/A (Purchase Price Unknown)";
    }

    const purchasePriceDollars = purchasePriceCents / 100;

    if (purchasePriceDollars === 0) {
        return "N/A (Purchase Price is Zero)";
    }

    if (charmPrice > purchasePriceDollars) {
      const multiplier = (charmPrice / purchasePriceDollars).toFixed(2);
      return `${multiplier}× above purchase`;
    } else {
      const percentage = (charmPrice / purchasePriceDollars * 100).toFixed(2);
      return `${percentage}% of purchase price`;
    }
  }

  isGoodPrice(item) {
    const aboveRecommended = item.above_recommended_price;
    
    if (aboveRecommended === undefined || aboveRecommended === null || isNaN(aboveRecommended)) {
      return { isGood: false, reason: 'Unknown percentage above recommended' };
    }
    
    if (aboveRecommended >= CONFIG.minAboveRecommended && aboveRecommended <= CONFIG.maxAboveRecommended) {
      return { isGood: true, reason: `Within range ${CONFIG.minAboveRecommended}% to ${CONFIG.maxAboveRecommended}% (${aboveRecommended}%)` };
    } else {
      return { isGood: false, reason: `${aboveRecommended}% outside range ${CONFIG.minAboveRecommended}% to ${CONFIG.maxAboveRecommended}%` };
    }
  }

  hasTargetKeychain(item) {
    return !!this.getCharmDetails(item);
  }

  notifyClients(type, data) {
    const message = JSON.stringify({ type, data });
    
    this.connectedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      } else {
        this.connectedClients.delete(client);
      }
    });
  }
}

// Start the server
console.log('🚀 Starting Enhanced Monitor Server with Persistent Storage & High Availability...');
console.log('📋 Monitoring for keychains:', CONFIG.targetKeychains.length);
console.log('🎯 Item Target List:', CONFIG.itemTargetList.length, 'items');
console.log('💰 Price filter range:', CONFIG.minAboveRecommended + '% to ' + CONFIG.maxAboveRecommended + '% above recommended');
console.log('📊 Keychain percentage threshold:', CONFIG.keychainPercentageThreshold + '% of market value');
console.log('🔑 Enabled keychains:', Array.from(CONFIG.enabledKeychains).length + '/' + CONFIG.targetKeychains.length);
console.log('🎯 Float filter enabled:', CONFIG.floatFilterEnabled);
console.log('🔑 API Key configured:', CONFIG.apiKey !== "YOUR_API_KEY_HERE" ? '✅' : '❌');
console.log('💾 Settings will be saved to:', SETTINGS_FILE);
console.log('🔄 Max reconnection attempts:', CONFIG.maxReconnectAttempts);
console.log('💓 Heartbeat interval:', CONFIG.heartbeatInterval / 1000 + 's');

if (CONFIG.apiKey === "YOUR_API_KEY_HERE") {
  console.error('❌ Please set your CSGOEmpire API key in the CONFIG object at the top of this file');
  process.exit(1);
}

new KeychainMonitorServer();
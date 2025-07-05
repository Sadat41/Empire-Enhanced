const { io } = require('socket.io-client');
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

// Configuration - EDIT THESE VALUES
const CONFIG = {
  // Replace with your CSGOEmpire API key
  apiKey: "1bbf0df01915e7159f82076fb64638d8",
  
  // Change to '.gg' if '.com' is blocked
  domain: "csgoempire.com",
  
  // Port for the local server (extension will connect to this)
  port: 3001,
  
  // Price filter range: reject items outside this range
  minAboveRecommended: -50, // Allow items up to 50% below recommended
  maxAboveRecommended: 5,   // Allow items up to 5% above recommended
  
  // Target keychains to monitor for
  targetKeychains: [
    "Hot Howl", "Baby Karat T", "Hot Wurst", "Baby Karat CT", "Semi-Precious", 
    "Diamond Dog", "Titeenium AWP", "Lil' Monster", "Diner Dog", "Lil' Squirt", 
    "Die-cast AK", "Lil' Teacup", "Chicken Lil'", "That's Bananas", "Lil' Whiskers", 
    "Glamour Shot", "Lil' Sandy", "Hot Hands", "POP Art", "Disco MAC", "Lil' Squatch", 
    "Lil' SAS", "Baby's AK", "Hot Sauce", "Pinch O' Salt", "Big Kev", "Whittle Knife", 
    "Lil' Crass", "Pocket AWP", "Lil' Ava", "Stitch-Loaded", "Backsplash", "Lil' Cap Gun"
  ]
};

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
    this.stats = {
      keychainsFound: 0,
      startTime: Date.now(),
      lastKeychainFound: null
    };
    
    this.setupExpressServer();
    this.startServer();
  }

  setupExpressServer() {
    // Enable CORS for all routes
    this.app.use(cors());
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'running',
        connected: this.csgoSocket !== null,
        stats: this.stats,
        notificationCount: this.notificationHistory.length
      });
    });

    // Notification history endpoint - only last 30 minutes
    this.app.get('/history', (req, res) => {
      const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000); // 30 minutes in milliseconds
      
      const recentNotifications = this.notificationHistory
        .filter(item => item.timestamp > thirtyMinutesAgo)
        .sort((a, b) => b.timestamp - a.timestamp); // Newest first

      console.log(`📊 History request: ${recentNotifications.length} notifications in last 30 minutes`);

      res.json({
        items: recentNotifications,
        total: recentNotifications.length,
        timeRange: "30 minutes"
      });
    });

    // Stats endpoint
    this.app.get('/stats', (req, res) => {
      res.json({
        ...this.stats,
        uptime: Date.now() - this.stats.startTime,
        isConnectedToCSGO: this.csgoSocket !== null,
        notificationCount: this.notificationHistory.length
      });
    });

    // Manual test endpoint with float value
    this.app.post('/test', (req, res) => {
      const testItem = {
        id: 'test-' + Date.now(),
        market_name: 'Test AK-47 | Redline (Field-Tested)',
        market_value: 3907, // $39.07 in cents
        purchase_price: 3907,
        suggested_price: 4100,
        above_recommended_price: -4.7,
        wear: 0.1234567, // 🔥 NEW: Include float value for testing
        keychains: [{ name: 'Hot Howl', wear: null }],
        published_at: new Date().toISOString()
      };
      
      console.log('🧪 Sending test notification...');
      
      // Store in notification history
      this.storeNotification(testItem);
      
      // Send notification
      this.notifyClients('KEYCHAIN_FOUND', testItem);
      
      res.json({ 
        message: 'Test notification sent and stored in history',
        item: {
          name: testItem.market_name,
          price: `${(testItem.market_value / 100).toFixed(2)}`,
          float: testItem.wear.toFixed(6),
          keychains: testItem.keychains.map(k => k.name)
        }
      });
    });

    // Update filter endpoint
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
      
      console.log(`🔧 Price filter updated: ${minPercentage}% to ${maxPercentage}%`);
      
      res.json({ 
        message: `Price filter updated to ${minPercentage}% to ${maxPercentage}%`,
        filter: {
          min: minPercentage,
          max: maxPercentage
        }
      });
    });
  }

  startServer() {
    this.server = this.app.listen(CONFIG.port, () => {
      console.log(`🔑 Keychain Monitor Server started on port ${CONFIG.port}`);
      console.log(`📊 Health check: http://localhost:${CONFIG.port}/health`);
      console.log(`📜 History endpoint: http://localhost:${CONFIG.port}/history`);
      console.log(`🧪 Test notification: POST http://localhost:${CONFIG.port}/test`);
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
      // Refreshed less than 15s ago, should be still valid
      return;
    }
    
    try {
      console.log('🔄 Refreshing user data...');
      const response = await axios.get(`https://${CONFIG.domain}/api/v2/metadata/socket`, {
        headers: {
          'Authorization': `Bearer ${CONFIG.apiKey}`
        }
      });
      
      this.userData = response.data;
      this.userDataRefreshedAt = Date.now();
      console.log('✅ User data refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh user data:', error.message);
      throw error;
    }
  }

  async connectToCSGOEmpire() {
    try {
      console.log('🔑 Connecting to CSGOEmpire...');
      
      if (!CONFIG.apiKey || CONFIG.apiKey === "YOUR_API_KEY_HERE") {
        throw new Error('Please set your API key in the CONFIG object');
      }

      // Refresh user data
      await this.refreshUserData();

      const socketEndpoint = `wss://trade.${CONFIG.domain}/trade`;
      
      // Initialize socket connection
      this.csgoSocket = io(socketEndpoint, {
        transports: ["websocket"],
        path: "/s/",
        secure: true,
        rejectUnauthorized: false,
        reconnect: true,
        query: {
          uid: this.userData.user.id,
          token: this.userData.socket_token,
        },
        extraHeaders: { 
          'User-agent': `${this.userData.user.id} API Bot` 
        }
      });

      this.csgoSocket.on('connect', async () => {
        console.log('✅ Connected to CSGOEmpire websocket');
        this.notifyClients('STATUS', { connected: true });
      });

      // Handle the Init event
      this.csgoSocket.on('init', async (data) => {
        if (data && data.authenticated) {
          console.log(`✅ Successfully authenticated as ${data.name}`);
          
          // Emit the default filters to ensure we receive events
          this.csgoSocket.emit('filters', {
            price_max: 9999999
          });
          
        } else {
          await this.refreshUserData();
          // When the server asks for it, emit the data we got earlier to identify this client
          this.csgoSocket.emit('identify', {
            uid: this.userData.user.id,
            model: this.userData.user,
            authorizationToken: this.userData.socket_token,
            signature: this.userData.socket_signature
          });
        }
      });

      // Listen for websocket events
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

      this.csgoSocket.on("disconnect", (reason) => {
        console.log(`❌ Socket disconnected: ${reason}`);
        this.csgoSocket = null;
        this.notifyClients('STATUS', { connected: false });
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.connectToCSGOEmpire(), 5000);
      });

      this.csgoSocket.on("close", (reason) => {
        console.log(`❌ Socket closed: ${reason}`);
      });

      this.csgoSocket.on('error', (data) => {
        console.error(`❌ WS Error: ${data}`);
      });

      this.csgoSocket.on('connect_error', (data) => {
        console.error(`❌ Connect Error: ${data}`);
      });

    } catch (error) {
      console.error('❌ Error while initializing socket:', error.message);
      
      // Retry connection after 10 seconds
      setTimeout(() => this.connectToCSGOEmpire(), 10000);
    }
  }

  // Store only successful notifications (items that passed all filters) with float value
  storeNotification(item) {
    const notificationItem = {
      id: item.id,
      market_name: item.market_name,
      market_value: item.market_value,
      suggested_price: item.suggested_price,
      above_recommended_price: item.above_recommended_price,
      wear: item.wear, // 🔥 NEW: Store float value
      keychains: item.keychains ? item.keychains.map(k => k.name) : [],
      published_at: item.published_at,
      timestamp: Date.now() // When notification was created
    };

    // Add to beginning of array (newest first)
    this.notificationHistory.unshift(notificationItem);

    // Keep only notifications from last 30 minutes + some buffer
    const oneHourAgo = Date.now() - (60 * 60 * 1000); // Keep 1 hour for safety
    this.notificationHistory = this.notificationHistory.filter(item => item.timestamp > oneHourAgo);

    console.log(`💾 Stored notification in history: ${item.market_name} (Float: ${item.wear ? item.wear.toFixed(6) : 'N/A'}) (Total: ${this.notificationHistory.length})`);
  }

  processItems(items) {
    if (!Array.isArray(items)) {
      items = [items];
    }

    items.forEach(item => {
      // Skip if we've already notified about this item
      if (this.notifiedItems.has(item.id)) {
        return;
      }

      // Check if item has target keychain and good price
      if (this.hasTargetKeychain(item)) {
        const priceCheck = this.isGoodPrice(item);
        
        if (priceCheck.isGood) {
          console.log('🔑 TARGET FOUND!');
          console.log(`📦 Item: ${item.market_name}`);
          console.log(`🔑 Keychains: ${item.keychains.map(k => k.name).join(', ')}`);
          console.log(`💰 Market Value: ${(item.market_value / 100).toFixed(2)}`);
          console.log(`💰 Purchase Price: ${(item.purchase_price / 100).toFixed(2)}`);
          console.log(`🎯 Float: ${item.wear ? item.wear.toFixed(6) : 'Unknown'}`); // 🔥 NEW: Log float
          console.log(`📈 Above Recommended: ${item.above_recommended_price}%`);
          console.log(`✅ Reason: ${priceCheck.reason}`);
          console.log(`🆔 ID: ${item.id}`);
          console.log('─'.repeat(50));

          // STORE IN NOTIFICATION HISTORY with float value
          this.storeNotification(item);

          // Add to notified items to prevent duplicates
          this.notifiedItems.add(item.id);
          
          // Clean up old entries to prevent memory leak
          if (this.notifiedItems.size > 1000) {
            const itemsArray = Array.from(this.notifiedItems);
            this.notifiedItems = new Set(itemsArray.slice(-500));
          }

          this.stats.keychainsFound++;
          this.stats.lastKeychainFound = Date.now();

          // Notify all connected extensions
          this.notifyClients('KEYCHAIN_FOUND', item);
        } else {
          console.log('🚫 Keychain found but price filtering failed:');
          console.log(`📦 Item: ${item.market_name}`);
          console.log(`🔑 Keychains: ${item.keychains.map(k => k.name).join(', ')}`);
          console.log(`💰 Purchase Price: ${(item.purchase_price / 100).toFixed(2)}`);
          console.log(`🎯 Float: ${item.wear ? item.wear.toFixed(6) : 'Unknown'}`);
          console.log(`📈 Above Recommended: ${item.above_recommended_price}%`);
          console.log(`❌ Reason: ${priceCheck.reason}`);
          console.log('─'.repeat(50));
        }
      }
    });
  }

  isGoodPrice(item) {
    // Use the above_recommended_price field directly from CSGOEmpire
    const aboveRecommended = item.above_recommended_price;
    
    // Reject items with unknown percentage
    if (aboveRecommended === undefined || aboveRecommended === null || isNaN(aboveRecommended)) {
      return { isGood: false, reason: 'Unknown percentage above recommended' };
    }
    
    // Check if within the configured range
    if (aboveRecommended >= CONFIG.minAboveRecommended && aboveRecommended <= CONFIG.maxAboveRecommended) {
      return { isGood: true, reason: `Within range ${CONFIG.minAboveRecommended}% to ${CONFIG.maxAboveRecommended}% (${aboveRecommended}%)` };
    } else {
      return { isGood: false, reason: `${aboveRecommended}% outside range ${CONFIG.minAboveRecommended}% to ${CONFIG.maxAboveRecommended}%` };
    }
  }

  hasTargetKeychain(item) {
    // Check if item has keychains
    if (!item.keychains || !Array.isArray(item.keychains) || item.keychains.length === 0) {
      return false;
    }

    // Check if any keychain matches our target list
    return item.keychains.some(keychain => {
      if (!keychain.name) return false;
      
      return CONFIG.targetKeychains.some(targetName => 
        keychain.name.toLowerCase().includes(targetName.toLowerCase()) ||
        targetName.toLowerCase().includes(keychain.name.toLowerCase())
      );
    });
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
console.log('🚀 Starting Keychain Monitor Server...');
console.log('📋 Monitoring for keychains:', CONFIG.targetKeychains.length);
console.log('💰 Price filter range:', CONFIG.minAboveRecommended + '% to ' + CONFIG.maxAboveRecommended + '% above recommended');
console.log('🔑 API Key configured:', CONFIG.apiKey !== "YOUR_API_KEY_HERE" ? '✅' : '❌');

if (CONFIG.apiKey === "YOUR_API_KEY_HERE") {
  console.error('❌ Please set your CSGOEmpire API key in the CONFIG object at the top of this file');
  process.exit(1);
}

new KeychainMonitorServer();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});
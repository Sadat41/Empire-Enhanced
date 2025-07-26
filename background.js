// Enhanced background.js with AUTOMATIC JSON sync from server-settings.json
// Import Socket.IO at the top level
importScripts('socket.io.min.js');

class ExtensionManager {
  constructor() {
    // WebSocket connection properties
    this.socket = null;
    this.userData = null;
    this.userDataRefreshedAt = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.connectionStartTime = null;
    this.lastEventTime = null;
    this.identificationAttempts = 0;
    this.maxIdentificationAttempts = 3;
    
    // Settings and state
    this.isMonitoringEnabled = true;
    this.isSoundEnabled = true;
    this.currentTheme = 'nebula';
    this.isSiteThemingEnabled = true;
    
    // Connection management
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.maxReconnectDelay = 60000;
    
    // API Key and domain
    this.apiKey = null;
    this.domain = 'csgoempire.com';
    
    // Auto JSON sync status
    this.lastAutoJsonSync = 0;
    
    // Statistics
    this.stats = {
      keychainsFound: 0,
      itemsFound: 0,
      startTime: Date.now(),
      lastKeychainFound: null,
      lastItemFound: null,
      itemsProcessed: 0,
      itemsFiltered: 0,
      filterReasons: {},
      totalConnections: 0,
      totalDisconnections: 0,
      lastSuccessfulConnection: null,
      lastDisconnection: null,
      uptime: 0
    };
    
    // Filtering and targeting
    this.priceFilter = {
      minAboveRecommended: -50,
      maxAboveRecommended: 5
    };
    
    this.keychainFilter = {
      percentageThreshold: 50,
      enabledKeychains: new Set([
        "Hot Howl", "Baby Karat T", "Hot Wurst", "Baby Karat CT", "Semi-Precious", 
        "Diamond Dog", "Titeenium AWP", "Lil' Monster", "Diner Dog", "Lil' Squirt"
      ])
    };
    
    this.itemTargetList = [];
    
    // Notification management
    this.lastNotificationTimestamp = 0;
    this.notifiedItemIds = new Set();
    
    // Price data caching for tradeit-price-compare.js
    this.priceDataCache = null;
    this.priceCacheTimestamp = 0;
    
    // Charm pricing data (same as server)
    this.charmPricing = {
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
    };
    
    this.init();
  }

async init() {
  console.log('♔ Empire Enhanced Extension with AUTO JSON loading initialized');
  
  // Load settings first
  await this.loadSettings();
  
  // AUTO-LOAD JSON SETTINGS ON STARTUP (HIGHEST PRIORITY)
  await this.autoLoadJsonSettings();
  
  // Load API key and connect if available
  await this.loadAPIKey();
  
  // Setup periodic stats update
  setInterval(() => {
    this.stats.uptime = Date.now() - this.stats.startTime;
  }, 10000);
  
  this.updateBadge();
}

  // ========== AUTOMATIC JSON SYNC FUNCTIONALITY ==========
  
  async autoLoadJsonSettings() {
    try {
      console.log('📄 AUTO-LOADING settings from server-settings.json...');
      
      // Fetch the server-settings.json file from extension directory
      const fileUrl = chrome.runtime.getURL('server-settings.json');
      const response = await fetch(fileUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch server-settings.json: ${response.status} ${response.statusText}`);
      }
      
      const jsonText = await response.text();
      const jsonData = JSON.parse(jsonText);
      
      console.log('📄 server-settings.json loaded successfully');
      console.log('📄 JSON content preview:', JSON.stringify(jsonData, null, 2).substring(0, 200) + '...');
      
      // Import the settings using existing logic
      const result = await this.importSettingsFromJson(jsonData);
      
      if (result.success) {
        this.lastAutoJsonSync = Date.now();
        console.log('✅ AUTO JSON SYNC COMPLETED SUCCESSFULLY');
        console.log('📊 Auto-sync summary:', result.summary);
      } else {
        console.error('❌ Auto JSON sync failed:', result.error);
      }
      
      return result;
      
    } catch (error) {
      console.warn('⚠️ Auto JSON loading failed (this is OK if server-settings.json doesn\'t exist):', error.message);
      
      // Return a non-error result since missing file is acceptable
      return {
        success: false,
        error: `server-settings.json not found or invalid: ${error.message}`,
        isWarning: true
      };
    }
  }

  async importSettingsFromJson(jsonData) {
    try {
      console.log('📥 Importing settings from JSON...');
      
      let settings;
      if (typeof jsonData === 'string') {
        settings = JSON.parse(jsonData);
      } else {
        settings = jsonData;
      }
      
      let importStats = {
        priceFilter: false,
        keychainThreshold: false,
        enabledKeychains: 0,
        itemTargets: 0
      };
      
      // Import price filter settings
      if (typeof settings.minAboveRecommended === 'number') {
        this.priceFilter.minAboveRecommended = settings.minAboveRecommended;
        await chrome.storage.sync.set({ priceFilterMin: settings.minAboveRecommended });
        importStats.priceFilter = true;
      }
      
      if (typeof settings.maxAboveRecommended === 'number') {
        this.priceFilter.maxAboveRecommended = settings.maxAboveRecommended;
        await chrome.storage.sync.set({ priceFilterMax: settings.maxAboveRecommended });
        importStats.priceFilter = true;
      }
      
      // Import keychain settings
      if (typeof settings.keychainPercentageThreshold === 'number') {
        this.keychainFilter.percentageThreshold = settings.keychainPercentageThreshold;
        await chrome.storage.sync.set({ keychainPercentageThreshold: settings.keychainPercentageThreshold });
        importStats.keychainThreshold = true;
      }
      
      if (Array.isArray(settings.enabledKeychains)) {
        this.keychainFilter.enabledKeychains = new Set(settings.enabledKeychains);
        await chrome.storage.local.set({ enabledKeychains: settings.enabledKeychains });
        importStats.enabledKeychains = settings.enabledKeychains.length;
      }
      
      // Import item target list with proper conversion
      if (Array.isArray(settings.itemTargetList)) {
        const convertedItems = settings.itemTargetList.map(serverItem => ({
          id: serverItem.id || Date.now().toString() + Math.random().toString(36),
          keyword: serverItem.name,
          name: serverItem.name,
          minFloat: serverItem.floatFilter?.enabled ? serverItem.floatFilter.min : 0.00,
          maxFloat: serverItem.floatFilter?.enabled ? serverItem.floatFilter.max : 1.00,
          floatFilter: {
            enabled: serverItem.floatFilter?.enabled || false,
            min: serverItem.floatFilter?.min || 0.00,
            max: serverItem.floatFilter?.max || 1.00
          },
          addedAt: Date.now(),
          source: 'auto_json_import'
        }));
        
        this.itemTargetList = convertedItems;
        await chrome.storage.local.set({ itemTargetList: convertedItems });
        importStats.itemTargets = convertedItems.length;
        
        console.log(`📥 Auto-imported ${convertedItems.length} items from server-settings.json`);
      }
      
      console.log('✅ Auto JSON import completed successfully');
      console.log(`📊 Import summary:`);
      console.log(`   💰 Price range: ${this.priceFilter.minAboveRecommended}% to ${this.priceFilter.maxAboveRecommended}%`);
      console.log(`   🔑 Keychain threshold: ${this.keychainFilter.percentageThreshold}%`);
      console.log(`   🔗 Enabled keychains: ${this.keychainFilter.enabledKeychains.size}`);
      console.log(`   🎯 Target items: ${this.itemTargetList.length}`);
      
      return {
        success: true,
        message: `Auto-imported settings from server-settings.json`,
        stats: importStats,
        summary: {
          priceFilter: this.priceFilter,
          keychainThreshold: this.keychainFilter.percentageThreshold,
          enabledKeychains: this.keychainFilter.enabledKeychains.size,
          itemTargets: this.itemTargetList.length
        }
      };
      
    } catch (error) {
      console.error('❌ Error importing JSON settings:', error);
      return { success: false, error: error.message };
    }
  }

  // Export settings to JSON format (for compatibility/debugging)
  async exportSettingsToJson() {
    try {
      const settings = {
        minAboveRecommended: this.priceFilter.minAboveRecommended,
        maxAboveRecommended: this.priceFilter.maxAboveRecommended,
        keychainPercentageThreshold: this.keychainFilter.percentageThreshold,
        enabledKeychains: Array.from(this.keychainFilter.enabledKeychains),
        itemTargetList: this.itemTargetList.map(item => ({
          id: item.id,
          name: item.keyword || item.name,
          floatFilter: {
            enabled: item.floatFilter?.enabled || (item.minFloat !== 0.00 || item.maxFloat !== 1.00),
            min: item.minFloat || 0.00,
            max: item.maxFloat || 1.00
          }
        })),
        floatFilterEnabled: true,
        lastUpdated: new Date().toISOString(),
        version: "1.0"
      };
      
      return {
        success: true,
        data: settings,
        json: JSON.stringify(settings, null, 2)
      };
      
    } catch (error) {
      console.error('❌ Error exporting settings:', error);
      return { success: false, error: error.message };
    }
  }

  // ========== REST OF THE ORIGINAL CODE (unchanged) ==========

// FIXED: Proper item target list checking - replace the existing method around line 420

checkItemTargetList(item) {
  if (!item.market_name || this.itemTargetList.length === 0) {
    return null;
  }

  const itemName = item.market_name.toLowerCase().trim();
  
  // Get all keychain names to avoid false positives
  const allKeychainNames = this.getAllKeychainNames().map(name => name.toLowerCase());
  
  // CRITICAL FIX: If the item name exactly matches a keychain name, skip it
  // This prevents "Charm | Lil' Squirt" from matching the "Lil' Squirt" keychain
  if (allKeychainNames.includes(itemName)) {
    console.log(`🚫 SKIPPED: Item name "${item.market_name}" exactly matches a keychain keyword`);
    return null;
  }
  
  // Also check for charm prefix patterns
  const cleanedMarketName = itemName.replace(/^charm\s*\|\s*/, '').trim();
  if (allKeychainNames.includes(cleanedMarketName)) {
    console.log(`🚫 SKIPPED: Item "${item.market_name}" is a charm with keychain name`);
    return null;
  }
  
  // FIXED: Only exact matches or very specific containment for item targets
  for (const targetItem of this.itemTargetList) {
    const targetName = (targetItem.keyword || targetItem.name || '').toLowerCase().trim();
    
    if (!targetName) continue;
    
    // Method 1: Exact match (highest priority)
    if (itemName === targetName) {
      console.log(`✅ EXACT match found: "${targetItem.keyword || targetItem.name}" === "${item.market_name}"`);
      return targetItem;
    }
    
    // Method 2: Target is a substantial substring of item (must be >50% of item name)
    if (itemName.includes(targetName) && targetName.length > itemName.length * 0.5) {
      console.log(`✅ SUBSTANTIAL match found: "${targetItem.keyword || targetItem.name}" in "${item.market_name}"`);
      return targetItem;
    }
    
    // Method 3: Item is a substantial substring of target (for cases like "AK-47 | Redline" matching "AK-47 | Redline (Field-Tested)")
    if (targetName.includes(itemName) && itemName.length > targetName.length * 0.5) {
      console.log(`✅ REVERSE match found: "${item.market_name}" in "${targetItem.keyword || targetItem.name}"`);
      return targetItem;
    }
  }
  
  // No match found
  return null;
}

// Process items - handles both new and updated items
processItems(items) {
  if (!Array.isArray(items)) {
    items = [items];
  }

  items.forEach(item => {
    this.stats.itemsProcessed++;
    
    if (this.notifiedItemIds.has(item.id)) {
      return;
    }

    console.log(`🔍 Processing item: ${item.market_name}`);
    console.log(`💰 Market: ${(item.market_value / 100).toFixed(2)}, Float: ${item.wear ? item.wear.toFixed(6) : 'N/A'}`);

    // PRIORITY 1: Check Item Target List first (higher priority than keychains)
    const targetItemMatch = this.checkItemTargetList(item);
    if (targetItemMatch) {
      console.log(`🎯 Found target item match: ${targetItemMatch.name || targetItemMatch.keyword}`);
      
      const priceCheck = this.isGoodPrice(item);
      if (!priceCheck.isGood) {
        this.stats.itemsFiltered++;
        this.incrementFilterReason('price_filter_target_item');
        console.log(`🚫 FILTERED: Target item price filter failed - ${priceCheck.reason}`);
        return;
      }
      
      const floatCheck = this.checkFloatFilter(item, targetItemMatch);
      if (!floatCheck.isGood) {
        this.stats.itemsFiltered++;
        this.incrementFilterReason('float_filter_target_item');
        console.log(`🚫 FILTERED: Target item float filter failed - ${floatCheck.reason}`);
        return;
      }

      console.log('🎉 🎯 TARGET ITEM FOUND - ALL FILTERS PASSED! 🎯 🎉');
      
      item.notification_type = 'target_item';
      item.target_item_matched = targetItemMatch;

      this.handleNotificationFound(item);
      return; // IMPORTANT: Return here to prevent keychain processing
    }

    // PRIORITY 2: Check for keychains (only if no target item match)
    if (item.keychains && item.keychains.length > 0) {
      console.log(`🔑 Keychains detected: ${item.keychains.map(k => k.name).join(', ')}`);
      
      // Get item name for filtering checks
      const itemName = item.market_name.toLowerCase();
      const allKeychainNames = this.getAllKeychainNames().map(name => name.toLowerCase());
      
      // CRITICAL FIX 1: Check if market name exactly matches any keychain name
      if (allKeychainNames.includes(itemName)) {
        this.stats.itemsFiltered++;
        this.incrementFilterReason('market_name_matches_keychain');
        console.log(`🚫 FILTERED: Item market name "${item.market_name}" exactly matches a keychain keyword`);
        return;
      }
      
      // CRITICAL FIX 2: Check if market name is a charm with keychain name (e.g., "Charm | Lil' Squirt")
      const cleanedMarketName = itemName.replace(/^charm\s*\|\s*/, '').trim();
      if (allKeychainNames.includes(cleanedMarketName)) {
        this.stats.itemsFiltered++;
        this.incrementFilterReason('market_name_is_charm_keychain');
        console.log(`🚫 FILTERED: Item market name "${item.market_name}" is a charm with keychain name - skipping keychain notification`);
        return;
      }
      
      // ADDITIONAL SAFETY CHECK: Prevent keychain notifications for items that might be in target list
      const isInTargetList = this.itemTargetList.some(target => {
        const targetName = (target.keyword || target.name || '').toLowerCase();
        return itemName.includes(targetName) || targetName.includes(itemName);
      });
      
      if (isInTargetList) {
        console.log(`🚫 FILTERED: Item is in target list, skipping keychain processing`);
        this.stats.itemsFiltered++;
        this.incrementFilterReason('item_in_target_list');
        return;
      }
      
      const charmDetails = this.getCharmDetails(item);

      if (charmDetails) {
        console.log(`🎯 Found target charm: ${charmDetails.name} (${charmDetails.category}) - ${charmDetails.price.toFixed(2)}`);
        
        if (!this.keychainFilter.enabledKeychains.has(charmDetails.name)) {
          this.stats.itemsFiltered++;
          this.incrementFilterReason('keychain_disabled');
          console.log(`🚫 FILTERED: Keychain "${charmDetails.name}" disabled in settings`);
          return;
        }

        const priceCheck = this.isGoodPrice(item);
        if (!priceCheck.isGood) {
          this.stats.itemsFiltered++;
          this.incrementFilterReason('price_filter');
          console.log(`🚫 FILTERED: Price filter failed - ${priceCheck.reason}`);
          return;
        }
        
        const keychainPercentageCheck = this.checkKeychainPercentage(item, charmDetails);
        if (!keychainPercentageCheck.isGood) {
          this.stats.itemsFiltered++;
          this.incrementFilterReason('keychain_percentage');
          console.log(`🚫 FILTERED: Keychain percentage too low - ${keychainPercentageCheck.reason}`);
          return;
        }

        console.log('🎉 🔑 TARGET FOUND - ALL FILTERS PASSED! 🔑 🎉');

        item.charm_category = charmDetails.category;
        item.charm_name = charmDetails.name;
        item.charm_price = charmDetails.price;
        item.charm_price_display = this.formatCharmPrice(charmDetails.price, item.purchase_price);
        item.notification_type = 'keychain';

        this.handleNotificationFound(item);
      } else {
        console.log(`🔍 Unknown keychains found: ${item.keychains.map(k => k.name).join(', ')}`);
        this.stats.itemsFiltered++;
        this.incrementFilterReason('unknown_keychain');
      }
    }
  });
}

  // ========== REST OF THE ORIGINAL CODE (unchanged) ==========

  async loadSettings() {
    try {
      const settings = await chrome.storage.sync.get({
        monitoringEnabled: true,
        soundEnabled: true,
        selectedTheme: 'nebula',
        siteThemingEnabled: true,
        lastNotificationTimestamp: 0,
        priceFilterMin: -50,
        priceFilterMax: 5,
        keychainPercentageThreshold: 50
      });
      
      this.isMonitoringEnabled = settings.monitoringEnabled;
      this.isSoundEnabled = settings.soundEnabled;
      this.currentTheme = settings.selectedTheme;
      this.isSiteThemingEnabled = settings.siteThemingEnabled;
      this.lastNotificationTimestamp = settings.lastNotificationTimestamp || 0;
      
      this.priceFilter.minAboveRecommended = settings.priceFilterMin;
      this.priceFilter.maxAboveRecommended = settings.priceFilterMax;
      this.keychainFilter.percentageThreshold = settings.keychainPercentageThreshold;
      
      // Load item target list and keychain settings
      const localData = await chrome.storage.local.get(['itemTargetList', 'enabledKeychains']);
      this.itemTargetList = localData.itemTargetList || [];
      
      if (localData.enabledKeychains) {
        this.keychainFilter.enabledKeychains = new Set(localData.enabledKeychains);
      }
      
      console.log('Settings loaded:', { 
        monitoring: this.isMonitoringEnabled, 
        sound: this.isSoundEnabled,
        theme: this.currentTheme,
        siteTheming: this.isSiteThemingEnabled,
        itemTargets: this.itemTargetList.length,
        enabledKeychains: this.keychainFilter.enabledKeychains.size
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async loadAPIKey() {
    try {
      const result = await chrome.storage.local.get(['csgoempire_api_key', 'csgoempire_domain']);
      this.apiKey = result.csgoempire_api_key;
      this.domain = result.csgoempire_domain || 'csgoempire.com';
      
      if (this.apiKey && this.isMonitoringEnabled) {
        console.log('API key found, starting connection...');
        await this.connectToCSGOEmpire();
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    }
  }

  async saveAPIKey(apiKey, domain = 'csgoempire.com') {
    try {
      await chrome.storage.local.set({
        csgoempire_api_key: apiKey,
        csgoempire_domain: domain
      });
      this.apiKey = apiKey;
      this.domain = domain;
      console.log('API key saved successfully');
    } catch (error) {
      console.error('Error saving API key:', error);
      throw error;
    }
  }

  async refreshUserData() {
    if (this.userDataRefreshedAt && this.userDataRefreshedAt > Date.now() - 15 * 1000) {
      return;
    }
    
    try {
      console.log('🔄 Refreshing user data...');
      const response = await fetch(`https://${this.domain}/api/v2/metadata/socket`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      this.userData = await response.json();
      this.userDataRefreshedAt = Date.now();
      console.log('✅ User data refreshed');
      console.log(`👤 User: ${this.userData.user?.name || 'Unknown'} (ID: ${this.userData.user?.id})`);
    } catch (error) {
      console.error(`❌ Failed to refresh user data: ${error.message}`);
      throw error;
    }
  }

  async connectToCSGOEmpire() {
    if (this.isConnected) {
      console.log('⚠️ Already connected');
      return;
    }

    if (!this.apiKey || this.apiKey === "YOUR_API_KEY_HERE") {
      console.error('❌ No API key configured');
      return;
    }

    try {
      console.log('🚀 Starting connection process...');
      this.connectionStartTime = Date.now();
      this.identificationAttempts = 0;
      this.isAuthenticated = false;
      this.reconnectAttempts = 0;
      
      // Get initial user data
      await this.refreshUserData();

      const socketEndpoint = `wss://trade.${this.domain}/trade`;
      console.log(`🔗 Connecting to ${socketEndpoint}...`);
      
      // Disconnect any existing socket
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      
      this.socket = io(socketEndpoint, {
        transports: ["websocket"],
        path: "/s/",
        secure: true,
        rejectUnauthorized: false,
        reconnect: false, // We handle reconnection manually
        timeout: 10000,
        query: {
          uid: this.userData.user.id,
          token: this.userData.socket_token,
        },
        extraHeaders: { 
          'User-agent': `${this.userData.user.id} Empire Enhanced Extension` 
        }
      });

      this.setupSocketEvents();
      
    } catch (error) {
      console.error(`❌ Connection failed: ${error.message}`);
      this.isConnected = false;
      this.isAuthenticated = false;
      this.connectionStartTime = null;
      this.updateBadge();
      this.scheduleReconnect();
      throw error;
    }
  }

  setupSocketEvents() {
    // Connection established
    this.socket.on('connect', () => {
      console.log('✅ Connected to CSGOEmpire websocket');
      console.log(`🆔 Socket ID: ${this.socket.id}`);
      this.isConnected = true;
      this.stats.totalConnections++;
      this.stats.lastSuccessfulConnection = Date.now();
      this.reconnectAttempts = 0;
      this.updateBadge();
    });

    this.socket.on('init', async (data) => {
      this.lastEventTime = Date.now();
      
      console.log('🎉 INIT event received from server!');
      
      if (data && data.authenticated) {
        this.isAuthenticated = true;
        console.log(`✅ Successfully authenticated as ${data.name}`);
        
        // Send filters
        this.socket.emit('filters', {
          price_max: 9999999
        });
        console.log('📤 Filters sent to server');
        
      } else {
        console.log('🔄 Need to authenticate - refreshing data and sending identify...');
        
        // Refresh data and authenticate
        await this.refreshUserData();
        this.socket.emit('identify', {
          uid: this.userData.user.id,
          model: this.userData.user,
          authorizationToken: this.userData.socket_token,
          signature: this.userData.socket_signature
        });
        console.log('📤 Identify packet sent to server');
      }
      
      this.updateBadge();
    });

    // Timesync handler
    this.socket.on('timesync', (data) => {
      this.lastEventTime = Date.now();
      console.log(`🕐 Timesync: ${JSON.stringify(data)}`);
    });

    // Item event handlers + processing logic
    this.socket.on('new_item', (data) => {
      this.lastEventTime = Date.now();
      
      const itemCount = Array.isArray(data) ? data.length : 1;
      console.log(`📦 New items received (${itemCount})`);
      
      if (this.isMonitoringEnabled) {
        this.processItems(data);
      }
    });

    this.socket.on('updated_item', (data) => {
      this.lastEventTime = Date.now();
      
      const itemCount = Array.isArray(data) ? data.length : 1;
      console.log(`📦 Updated items received (${itemCount})`);
      
      if (this.isMonitoringEnabled) {
        this.processItems(data);
      }
    });

    this.socket.on('auction_update', (data) => {
      this.lastEventTime = Date.now();
      console.log(`🔨 Auction update received`);
    });

    this.socket.on('deleted_item', (data) => {
      this.lastEventTime = Date.now();
      
      const itemCount = Array.isArray(data) ? data.length : 1;
      console.log(`🗑️ Items deleted: ${itemCount}`);
    });

    this.socket.on('trade_status', (data) => {
      this.lastEventTime = Date.now();
      console.log(`📊 Trade status update received`);
    });

    // Disconnect handlers
    this.socket.on("disconnect", (reason) => {
      console.log(`❌ Socket disconnected: ${reason}`);
      this.handleDisconnection(reason);
    });

    this.socket.on("close", (reason) => {
      console.log(`❌ Socket closed: ${reason}`);
      this.handleDisconnection(`close: ${reason}`);
    });

    this.socket.on('error', (error) => {
      console.error(`❌ WS Error: ${error}`);
      this.handleDisconnection(`error: ${error}`);
    });

    this.socket.on('connect_error', (error) => {
      console.error(`❌ Connect Error: ${error}`);
      this.handleDisconnection(`connect_error: ${error}`);
    });
  }

  // Helper methods (same logic as original server)
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
    const minFloat = targetItem.floatFilter.min || targetItem.minFloat || 0;
    const maxFloat = targetItem.floatFilter.max || targetItem.maxFloat || 1;

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

  getCharmDetails(item) {
    if (!item.keychains || !Array.isArray(item.keychains) || item.keychains.length === 0) {
      return null;
    }

    for (const keychain of item.keychains) {
      const keychainName = keychain.name;
      if (!keychainName) continue;

      for (const category in this.charmPricing) {
        if (this.charmPricing[category].hasOwnProperty(keychainName)) {
          return {
            category: category,
            name: keychainName,
            price: this.charmPricing[category][keychainName]
          };
        }
      }
    }
    return null;
  }

  getAllKeychainNames() {
    const keychains = [];
    for (const category in this.charmPricing) {
      keychains.push(...Object.keys(this.charmPricing[category]));
    }
    return keychains.sort();
  }

  getKeychainCategory(keychainName) {
    for (const category in this.charmPricing) {
      if (this.charmPricing[category].hasOwnProperty(keychainName)) {
        return category;
      }
    }
    return null;
  }

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
    
    if (percentage >= this.keychainFilter.percentageThreshold) {
      return { 
        isGood: true, 
        reason: `Charm is ${percentage.toFixed(2)}% of market value (≥${this.keychainFilter.percentageThreshold}%)`,
        percentage: percentage
      };
    } else {
      return { 
        isGood: false, 
        reason: `Charm is ${percentage.toFixed(2)}% of market value (<${this.keychainFilter.percentageThreshold}%)`,
        percentage: percentage
      };
    }
  }

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
    
    if (aboveRecommended >= this.priceFilter.minAboveRecommended && aboveRecommended <= this.priceFilter.maxAboveRecommended) {
      return { isGood: true, reason: `Within range ${this.priceFilter.minAboveRecommended}% to ${this.priceFilter.maxAboveRecommended}% (${aboveRecommended}%)` };
    } else {
      return { isGood: false, reason: `${aboveRecommended}% outside range ${this.priceFilter.minAboveRecommended}% to ${this.priceFilter.maxAboveRecommended}%` };
    }
  }

  incrementFilterReason(reason) {
    if (!this.stats.filterReasons[reason]) {
      this.stats.filterReasons[reason] = 0;
    }
    this.stats.filterReasons[reason]++;
  }

  async handleNotificationFound(itemData) {
    if (!this.isMonitoringEnabled) {
      console.log('🚫 Notification found but monitoring is disabled - ignoring');
      return;
    }

    console.log('🔔 Processing notification:', itemData);
    
    const now = Date.now();
    if (now - this.lastNotificationTimestamp < 2000) {
      console.log('🚫 Notification throttled');
      return;
    }
    
    // Update stats based on notification type
    if (itemData.notification_type === 'target_item') {
      this.stats.itemsFound = (this.stats.itemsFound || 0) + 1;
      this.stats.lastItemFound = now;
    } else {
      this.stats.keychainsFound++;
      this.stats.lastKeychainFound = now;
    }
    
    // Store notification
    this.storeNotificationHistory(itemData);
    
    // Add to notified items
    this.notifiedItemIds.add(itemData.id);
    if (this.notifiedItemIds.size > 1000) {
      const itemsArray = Array.from(this.notifiedItemIds);
      this.notifiedItemIds = new Set(itemsArray.slice(-500));
    }
    
    this.lastNotificationTimestamp = now;
    
    // Save last notification timestamp
    chrome.storage.sync.set({
      lastNotification: now,
      lastNotificationTimestamp: now
    });
    
    console.log('📱 Showing Chrome notification');
    await this.showBackgroundNotification(itemData);

    // Send appropriate notification type to content script
    const notificationType = itemData.notification_type === 'target_item' ? 'ITEM_TARGET_FOUND' : 'KEYCHAIN_FOUND';
    this.sendToContentScript(notificationType, {
      ...itemData,
      soundEnabled: false
    });

    this.updateBadge();
  }

  async showBackgroundNotification(itemData) {
    const isTargetItem = itemData.notification_type === 'target_item';
    
    let displayInfo = '';
    if (isTargetItem) {
      const targetKeyword = itemData.target_item_matched?.name || itemData.target_item_matched?.keyword || 'Unknown';
      displayInfo = `🎯 Target: ${targetKeyword}`;
    } else {
      const keychainNames = itemData.keychains ? 
        (Array.isArray(itemData.keychains) ? itemData.keychains.map(k => k.name).join(', ') : itemData.keychains) : 
        'Unknown';
      displayInfo = `🔑 ${keychainNames}`;
    }
    
    const marketValue = itemData.market_value ? (itemData.market_value / 100).toFixed(2) : 'Unknown';
    const floatValue = itemData.wear !== undefined && itemData.wear !== null ? 
      parseFloat(itemData.wear).toFixed(6) : 'Unknown';
    const aboveRecommended = itemData.above_recommended_price !== undefined ? 
      itemData.above_recommended_price.toFixed(1) : 'Unknown';

    try {
      const notificationId = `notification_${itemData.id}_${Date.now()}`;
      
      const title = isTargetItem ? 'EMPIRE ENHANCED - TARGET ITEM FOUND!' : 'EMPIRE ENHANCED - TARGET FOUND!';
      
      const detailedMessage = [
        displayInfo,
        `💰 Market: ${marketValue}`,
        `🎯 Float: ${floatValue}`,
        `📈 ${aboveRecommended}% above recommended`
      ].join('\n');
      
      chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icon128.png',
        title: title,
        message: `${itemData.market_name}\n${detailedMessage}`,
        priority: 2,
        requireInteraction: true,
        buttons: [
          {title: '🔗 View Item'},
          {title: '📜 View History'}
        ]
      }, (createdId) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Chrome notification failed:', chrome.runtime.lastError);
        } else {
          console.log('✅ Chrome notification created:', createdId);
          
          chrome.storage.local.set({
            [`notification_${createdId}`]: {
              itemId: itemData.id,
              marketName: itemData.market_name,
              timestamp: Date.now()
            }
          });

          setTimeout(() => {
            chrome.notifications.clear(createdId);
            chrome.storage.local.remove(`notification_${createdId}`);
          }, 30000);
        }
      });

      console.log('📱 Chrome notification sent for item:', itemData.id);

    } catch (error) {
      console.error('❌ Error creating Chrome notification:', error);
    }

    if (this.isSoundEnabled) {
      try {
        await this.playNotificationSound();
      } catch (error) {
        console.error('❌ Error playing notification sound:', error);
      }
    }

    const badgeText = isTargetItem ? '🎯' : '🔑';
    chrome.action.setBadgeText({text: badgeText});
    chrome.action.setBadgeBackgroundColor({color: isTargetItem ? '#10b981' : '#ff6b35'});
    
    setTimeout(() => {
      this.updateBadge();
    }, 10000);
  }

  async playNotificationSound() {
    try {
      if (chrome.offscreen) {
        try {
          let existingContexts = [];
          try {
            existingContexts = await chrome.runtime.getContexts({
              contextTypes: ['OFFSCREEN_DOCUMENT']
            });
          } catch (error) {
            // getContexts might not be available
          }

          if (existingContexts.length === 0) {
            await chrome.offscreen.createDocument({
              url: 'offscreen.html',
              reasons: ['AUDIO_PLAYBACK'],
              justification: 'Play notification sound for keychain alerts'
            });
          }

          setTimeout(() => {
            chrome.runtime.sendMessage({
              type: 'PLAY_NOTIFICATION_SOUND'
            }).catch(error => {
              console.log('🔊 Offscreen message failed, using TTS fallback');
              this.playTTSSound();
            });
          }, 100);

          setTimeout(async () => {
            try {
              await chrome.offscreen.closeDocument();
            } catch (error) {
              // Document might already be closed
            }
          }, 3000);

        } catch (error) {
          console.log('🔊 Offscreen audio not available, using alternative method');
          this.playTTSSound();
        }
      } else {
        this.playTTSSound();
      }
    } catch (error) {
      console.error('❌ Sound playback failed:', error);
      this.playTTSSound();
    }
  }

  playTTSSound() {
    try {
      chrome.tts.speak('Target found', {
        rate: 1.8,
        pitch: 1.3,
        volume: 0.8,
        onEvent: (event) => {
          if (event.type === 'error') {
            console.log('🔊 TTS failed, trying alternative sound');
          }
        }
      });
    } catch (error) {
      console.log('🔊 TTS not available');
    }
  }

  async storeNotificationHistory(itemData) {
    try {
      const result = await chrome.storage.local.get(['notificationHistory']);
      let history = result.notificationHistory || [];
      
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      history = history.filter(item => item.timestamp > twentyFourHoursAgo);
      
      const historyItem = {
        id: itemData.id,
        market_name: itemData.market_name,
        market_value: itemData.market_value,
        purchase_price: itemData.purchase_price,
        suggested_price: itemData.suggested_price,
        above_recommended_price: itemData.above_recommended_price,
        wear: itemData.wear,
        keychains: itemData.keychains ? 
          (Array.isArray(itemData.keychains) ? itemData.keychains : [itemData.keychains]) : 
          [],
        notification_type: itemData.notification_type || 'keychain',
        target_item_matched: itemData.target_item_matched,
        charm_category: itemData.charm_category,
        charm_name: itemData.charm_name,
        charm_price: itemData.charm_price,
        published_at: itemData.published_at || new Date().toISOString(),
        timestamp: Date.now()
      };
      
      history.unshift(historyItem);
      
      if (history.length > 100) {
        history = history.slice(0, 100);
      }
      
      await chrome.storage.local.set({notificationHistory: history});
      
      console.log('💾 Notification stored in history');
    } catch (error) {
      console.error('❌ Error storing notification history:', error);
    }
  }

  handleDisconnection(reason) {
    this.isConnected = false;
    this.isAuthenticated = false;
    this.stats.totalDisconnections++;
    this.stats.lastDisconnection = Date.now();
    
    if (this.socket) {
      this.socket = null;
    }
    
    this.updateBadge();
    
    // Smart reconnection logic (only if monitoring is enabled and not manually disconnected)
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.isMonitoringEnabled && this.apiKey && !reason.includes('manual')) {
      this.scheduleReconnect();
    } else {
      console.error(`❌ Max reconnection attempts reached (${this.maxReconnectAttempts}) or monitoring disabled.`);
    }
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    
    // Exponential backoff
    const baseDelay = this.reconnectDelay;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const delay = exponentialDelay + jitter;
    
    console.log(`🔄 Attempting reconnection in ${(delay / 1000).toFixed(1)}s (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts && this.isMonitoringEnabled && this.apiKey) {
        this.connectToCSGOEmpire();
      }
    }, delay);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.isAuthenticated = false;
    this.connectionStartTime = null;
    this.reconnectAttempts = 0;
    this.updateBadge();
    console.log('🔌 Manually disconnected');
  }

  // Price data fetching for tradeit-price-compare.js
  async fetchPriceData() {
    // Use cache if it's less than 1 hour old
    if (this.priceDataCache && (Date.now() - this.priceCacheTimestamp < 3600000)) {
      return this.priceDataCache;
    }

    console.log('📡 Fetching fresh prices from csgotrader.app APIs...');
    const csfloatUrl = 'https://prices.csgotrader.app/latest/csfloat.json';
    const buffUrl = 'https://prices.csgotrader.app/latest/buff163.json';

    try {
      const [csfloatResponse, buffResponse] = await Promise.all([
        fetch(csfloatUrl),
        fetch(buffUrl)
      ]);

      if (!csfloatResponse.ok || !buffResponse.ok) {
        throw new Error('Failed to fetch price data from one or more sources.');
      }

      const csfloatData = await csfloatResponse.json();
      const buffData = await buffResponse.json();
      const combinedPrices = new Map();

      // Process CSFloat prices - PASSING THE ENTIRE PRICE OBJECT
      for (const [name, data] of Object.entries(csfloatData)) {
        combinedPrices.set(name.toLowerCase(), { csfloatPrice: data });
      }
      
      // Merge Buff163 prices - PASSING THE ENTIRE 'starting_at' OBJECT
      for (const [name, data] of Object.entries(buffData)) {
        const lowerName = name.toLowerCase();
        const existingEntry = combinedPrices.get(lowerName) || {};
        // The 'starting_at' object contains both the base price and the nested doppler data
        if (data && data.starting_at) {
          combinedPrices.set(lowerName, { ...existingEntry, buffPrice: data.starting_at });
        }
      }
      
      this.priceDataCache = Object.fromEntries(combinedPrices);
      this.priceCacheTimestamp = Date.now();
      console.log(`✅ Price cache updated with ${combinedPrices.size} items.`);
      
      return this.priceDataCache;

    } catch (error) {
      console.error('❌ Error fetching prices directly:', error.message);
      return this.priceDataCache || {}; // Return old cache if fetching fails
    }
  }

  // Theme management
  async setTheme(themeName) {
    console.log(`🎨 Background setting theme to: ${themeName}`);
    
    this.currentTheme = themeName;
    
    try {
      await chrome.storage.sync.set({ selectedTheme: themeName });
      console.log(`✅ Theme "${themeName}" saved to storage by background`);
      
      // Notify all content scripts about theme change
      const success = await this.sendToContentScript('THEME_CHANGED', { 
        theme: themeName,
        siteThemingEnabled: this.isSiteThemingEnabled 
      });
      
      if (success) {
        console.log(`📤 Theme change notification sent to content scripts`);
      }
      
    } catch (error) {
      console.error('Error saving theme in background:', error);
    }
  }

  async setSiteThemingState(enabled) {
    console.log(`🎨 Background setting site theming to: ${enabled ? 'enabled' : 'disabled'}`);
    
    this.isSiteThemingEnabled = enabled;
    
    try {
      await chrome.storage.sync.set({ siteThemingEnabled: enabled });
      console.log(`✅ Site theming "${enabled}" saved to storage by background`);
      
      // Notify all content scripts about site theming change
      const success = await this.sendToContentScript('SITE_THEMING_CHANGED', { 
        enabled: enabled,
        theme: this.currentTheme 
      });
      
      if (success) {
        console.log(`📤 Site theming change notification sent to content scripts`);
      }
      
    } catch (error) {
      console.error('Error saving site theming state in background:', error);
    }
  }

  setMonitoringState(enabled) {
    this.isMonitoringEnabled = enabled;
    
    if (enabled) {
      console.log('🔍 Monitoring enabled');
      if (this.apiKey && !this.isConnected) {
        this.connectToCSGOEmpire();
      }
    } else {
      console.log('🚫 Monitoring disabled');
      this.disconnect();
    }
    
    this.updateBadge();
    chrome.storage.sync.set({ monitoringEnabled: enabled });
    this.sendToContentScript('MONITORING_STATE_CHANGED', { enabled });
  }

  setSoundState(enabled) {
    this.isSoundEnabled = enabled;
    console.log('🔊 Sound state:', enabled ? 'enabled' : 'disabled');
    
    chrome.storage.sync.set({ soundEnabled: enabled });
    this.sendToContentScript('SOUND_STATE_CHANGED', { enabled });
  }

  // Settings management
  async updatePriceFilter(minPercentage, maxPercentage) {
    this.priceFilter.minAboveRecommended = minPercentage;
    this.priceFilter.maxAboveRecommended = maxPercentage;
    
    await chrome.storage.sync.set({
      priceFilterMin: minPercentage,
      priceFilterMax: maxPercentage
    });
    
    console.log(`🔧 Price filter updated: ${minPercentage}% to ${maxPercentage}%`);
  }

  async updateKeychainPercentage(percentageThreshold) {
    this.keychainFilter.percentageThreshold = percentageThreshold;
    
    await chrome.storage.sync.set({
      keychainPercentageThreshold: percentageThreshold
    });
    
    console.log(`🔧 Keychain percentage threshold updated: ${percentageThreshold}%`);
  }

  async updateEnabledKeychains(enabledKeychains) {
    this.keychainFilter.enabledKeychains = new Set(enabledKeychains);
    
    await chrome.storage.local.set({
      enabledKeychains: enabledKeychains
    });
    
    console.log(`🔧 Enabled keychains updated: ${enabledKeychains.length} keychains enabled`);
  }

  async updateItemTargetList(itemTargetList) {
    this.itemTargetList = itemTargetList;
    
    await chrome.storage.local.set({
      itemTargetList: itemTargetList
    });
    
    console.log(`🔧 Item Target List updated: ${itemTargetList.length} items`);
  }

  async sendToContentScript(type, data) {
    try {
      const tabs = await chrome.tabs.query({});
      
      const csgoTabs = tabs.filter(tab => 
        tab.url && (
          tab.url.includes('csgoempire.com') || 
          tab.url.includes('csgoempire.gg')
        )
      );

      console.log(`📤 Sending ${type} to ${csgoTabs.length} CSGOEmpire tabs`);

      let successCount = 0;
      
      for (const tab of csgoTabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type, data });
          console.log(`✅ Message sent to tab ${tab.id}`);
          successCount++;
        } catch (error) {
          console.log(`❌ Failed to send message to tab ${tab.id}:`, error.message);
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content-script.js']
            });
            await chrome.tabs.sendMessage(tab.id, { type, data });
            console.log(`✅ Message sent to tab ${tab.id} after script injection`);
            successCount++;
          } catch (injectionError) {
            console.log(`❌ Failed to inject script or send message to tab ${tab.id}:`, injectionError.message);
          }
        }
      }

      return successCount > 0;

    } catch (error) {
      console.error('❌ Error sending message to content script:', error);
      return false;
    }
  }

  updateBadge() {
    if (!this.isMonitoringEnabled) {
      chrome.action.setBadgeText({text: '⏸'});
      chrome.action.setBadgeBackgroundColor({color: '#95a5a6'});
      chrome.action.setTitle({title: 'Empire Enhanced - Disabled'});
    } else if (this.isConnected && this.isAuthenticated) {
      const totalFound = this.stats.keychainsFound + (this.stats.itemsFound || 0);
      chrome.action.setBadgeText({text: totalFound > 0 ? totalFound.toString() : '●'});
      chrome.action.setBadgeBackgroundColor({color: '#00ff00'});
      chrome.action.setTitle({title: 'Empire Enhanced - Connected'});
    } else if (this.isConnected && !this.isAuthenticated) {
      chrome.action.setBadgeText({text: '🔐'});
      chrome.action.setBadgeBackgroundColor({color: '#ff9900'});
      chrome.action.setTitle({title: 'Empire Enhanced - Authenticating'});
    } else {
      chrome.action.setBadgeText({text: '○'});
      chrome.action.setBadgeBackgroundColor({color: '#ff0000'});
      chrome.action.setTitle({title: 'Empire Enhanced - Disconnected'});
    }
  }

  async testNotification() {
    const testItem = {
      id: 'test-' + Date.now(),
      market_name: 'Test AK-47 | Redline (Field-Tested)',
      market_value: 3907,
      purchase_price: 3907,
      suggested_price: 4100,
      above_recommended_price: -4.7,
      wear: 0.1234567,
      keychains: [{ name: 'Hot Howl', wear: null }],
      published_at: new Date().toISOString(),
      notification_type: 'keychain'
    };
    
    console.log('🧪 Sending test notification...');
    
    const charmDetails = this.getCharmDetails(testItem);
    if (charmDetails) {
      testItem.charm_category = charmDetails.category;
      testItem.charm_name = charmDetails.name;
      testItem.charm_price = charmDetails.price;
      testItem.charm_price_display = this.formatCharmPrice(charmDetails.price, testItem.purchase_price);
    }
    
    await this.handleNotificationFound(testItem);
    
    return {
      success: true,
      message: 'Test notification sent successfully!'
    };
  }

  getStats() {
    return {
      stats: {
        ...this.stats,
        uptime: Date.now() - this.stats.startTime
      },
      connected: this.isConnected,
      authenticated: this.isAuthenticated,
      monitoringEnabled: this.isMonitoringEnabled,
      soundEnabled: this.isSoundEnabled,
      currentTheme: this.currentTheme,
      siteThemingEnabled: this.isSiteThemingEnabled,
      connectionStartTime: this.connectionStartTime,
      lastEventTime: this.lastEventTime,
      apiKeyConfigured: !!this.apiKey,
      domain: this.domain,
      priceFilter: this.priceFilter,
      keychainFilter: {
        percentageThreshold: this.keychainFilter.percentageThreshold,
        enabledKeychainsCount: this.keychainFilter.enabledKeychains.size,
        totalKeychains: this.getAllKeychainNames().length
      },
      itemTargetListCount: this.itemTargetList.length,
      autoJsonSync: {
        lastSync: this.lastAutoJsonSync
      }
    };
  }
}

// Message listener with AUTOMATIC JSON sync support (REMOVED MANUAL CONTROLS)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const manager = getManager();
  
  if (message.type === 'GET_STATS') {
    sendResponse(manager.getStats());
  } else if (message.type === 'SET_API_KEY') {
    manager.saveAPIKey(message.data.apiKey, message.data.domain)
      .then(() => {
        if (manager.isMonitoringEnabled) {
          return manager.connectToCSGOEmpire();
        }
      })
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === 'SET_MONITORING_STATE') {
    manager.setMonitoringState(message.data.enabled);
    sendResponse({success: true});
  } else if (message.type === 'SET_SOUND_STATE') {
    manager.setSoundState(message.data.enabled);
    sendResponse({success: true});
  } else if (message.type === 'THEME_CHANGED') {
    manager.setTheme(message.data.theme);
    sendResponse({success: true});
  } else if (message.type === 'SET_SITE_THEMING_STATE') {
    manager.setSiteThemingState(message.data.enabled);
    sendResponse({success: true});
  } else if (message.type === 'CONNECT') {
    if (manager.apiKey && manager.isMonitoringEnabled) {
      manager.connectToCSGOEmpire()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
    } else {
      sendResponse({ success: false, error: 'No API key configured or monitoring disabled' });
    }
    return true;
  } else if (message.type === 'DISCONNECT') {
    manager.disconnect();
    sendResponse({ success: true });
  } else if (message.type === 'UPDATE_PRICE_FILTER') {
    manager.updatePriceFilter(message.data.minPercentage, message.data.maxPercentage)
      .then(() => sendResponse({ success: true, message: 'Price filter updated successfully!' }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === 'UPDATE_KEYCHAIN_PERCENTAGE') {
    manager.updateKeychainPercentage(message.data.percentageThreshold)
      .then(() => sendResponse({ success: true, message: 'Keychain percentage updated successfully!' }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === 'UPDATE_ENABLED_KEYCHAINS') {
    manager.updateEnabledKeychains(message.data.enabledKeychains)
      .then(() => sendResponse({ success: true, message: 'Enabled keychains updated successfully!' }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === 'UPDATE_ITEM_TARGET_LIST') {
    manager.updateItemTargetList(message.data.itemTargetList)
      .then(() => sendResponse({ success: true, message: 'Item target list updated successfully!' }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === 'GET_KEYCHAIN_FILTER_SETTINGS') {
    const allKeychains = manager.getAllKeychainNames();
    const enabledKeychainsArray = Array.from(manager.keychainFilter.enabledKeychains);
    
    const response = {
      percentageThreshold: manager.keychainFilter.percentageThreshold,
      enabledKeychains: enabledKeychainsArray,
      allKeychains: allKeychains.map(name => {
        const category = manager.getKeychainCategory(name);
        const price = category ? manager.charmPricing[category][name] : 0;
        return {
          name,
          category,
          price,
          enabled: manager.keychainFilter.enabledKeychains.has(name)
        };
      }),
      totalKeychains: allKeychains.length,
      enabledCount: enabledKeychainsArray.length
    };
    
    sendResponse({ success: true, data: response });
  } else if (message.type === 'TEST_NOTIFICATION') {
    manager.testNotification()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === 'REQUEST_NOTIFICATION_PERMISSION') {
    chrome.notifications.getPermissionLevel((level) => {
      if (level === 'granted') {
        chrome.notifications.create('permission_test_' + Date.now(), {
          type: 'basic',
          title: '♔ Empire Enhanced',
          message: 'Notifications are now enabled and working perfectly.',
          priority: 1
        }, (testId) => {
          if (chrome.runtime.lastError) {
            sendResponse({ granted: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ granted: true });
            setTimeout(() => chrome.notifications.clear(testId), 3000);
          }
        });
      } else {
        sendResponse({ 
          granted: false, 
          error: 'Please enable notifications in Chrome settings.' 
        });
      }
    });
    return true;
  } else if (message.type === 'FETCH_TRADEIT_DATA') {
    // Handle price data fetching for tradeit-price-compare.js
    (async () => {
      const priceData = await manager.fetchPriceData();
      sendResponse({ success: true, data: priceData });
    })();
    return true;
  } else if (message.type === 'PLAY_NOTIFICATION_SOUND') {
    console.log('🔊 Playing notification sound from offscreen');
    sendResponse({success: true});
  // Export functionality kept for debugging/compatibility
  } else if (message.type === 'EXPORT_JSON_SETTINGS') {
    manager.exportSettingsToJson()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  return true;
});

// Global instance management
let extensionManager;

function getManager() {
  if (!extensionManager) {
    console.log('Creating new ExtensionManager instance...');
    extensionManager = new ExtensionManager();
  }
  return extensionManager;
}

// Initialize the extension
console.log('🚀 Starting Empire Enhanced with AUTOMATIC JSON Sync...');
getManager();
/**
 * ============================================================================
 * EMPIRE ENHANCED CHROME EXTENSION - BACKGROUND SCRIPT
 * ============================================================================
 * 
 * Main background service worker for the Empire Enhanced extension.
 * Handles WebSocket connections, item monitoring, notifications, and settings.
 * 
 * Features:
 * - Real-time CSGOEmpire WebSocket monitoring
 * - Item filtering and target matching
 * - Keychain/charm detection and pricing
 * - Buff163 price comparison integration
 * - Automatic JSON settings sync
 * - Chrome notifications and sound alerts
 * - Theme and settings management
 * 
 * @version 6.4.0
 * @author github.com/Sadat41
 */

// Import Socket.IO for WebSocket connections
importScripts('socket.io.min.js');

/**
 * ============================================================================
 * MAIN EXTENSION MANAGER CLASS
 * ============================================================================
 */
class ExtensionManager {
  constructor() {
    // Initialize all manager components
    this.initializeProperties();
    this.init();
  }

  /**
   * Initialize all class properties with default values
   */
  initializeProperties() {
    // === CONNECTION PROPERTIES ===
    this.socket = null;
    this.userData = null;
    this.userDataRefreshedAt = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.connectionStartTime = null;
    this.lastEventTime = null;
    this.identificationAttempts = 0;
    this.maxIdentificationAttempts = 3;
    
    // === SETTINGS AND STATE ===
    this.isMonitoringEnabled = true;
    this.isSoundEnabled = true;
    this.currentTheme = 'nebula';
    this.isSiteThemingEnabled = true;
    
    // === CONNECTION MANAGEMENT ===
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.maxReconnectDelay = 60000;
    
    // === API CONFIGURATION ===
    this.apiKey = null;
    this.domain = 'csgoempire.com';
    
    // === AUTO SYNC STATUS ===
    this.lastAutoJsonSync = 0;
    
    // === STATISTICS TRACKING ===
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
    
    // === FILTERING CONFIGURATION ===
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
    
    // === NOTIFICATION MANAGEMENT ===
    this.lastNotificationTimestamp = 0;
    this.notifiedItemIds = new Set();
    
    // === PRICE DATA CACHING ===
    this.priceDataCache = null;
    this.priceCacheTimestamp = 0;
    
    // === CHARM PRICING DATA ===
    this.charmPricing = this.getCharmPricingData();
  }

  /**
   * Get the official charm pricing data
   * @returns {Object} Charm pricing data organized by category
   */
  getCharmPricingData() {
    return {
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
  }

  /**
   * ========================================================================
   * INITIALIZATION AND SETTINGS MANAGEMENT
   * ========================================================================
   */

  /**
   * Initialize the extension manager
   */
  async init() {
    console.log('♔ Empire Enhanced Extension with AUTO JSON loading initialized');
    
    try {
      // Check if this is first run or if Chrome storage is empty
      const isFirstRun = await this.checkIfFirstRun();
      
      if (isFirstRun) {
        console.log('🔄 First run detected - loading from server-settings.json');
        await this.autoLoadJsonSettings();
      } else {
        console.log('🔄 Loading existing settings from Chrome storage');
        await this.loadSettings();
      }
      
      // Load API key and connect if available
      await this.loadAPIKey();
      
      // Setup periodic stats update
      this.setupPeriodicUpdates();
      
      this.updateBadge();
      
    } catch (error) {
      console.error('❌ Initialization error:', error);
      this.useDefaultSettings();
    }
  }

  /**
   * Setup periodic background tasks
   */
  setupPeriodicUpdates() {
    // Update uptime stats every 10 seconds
    setInterval(() => {
      this.stats.uptime = Date.now() - this.stats.startTime;
    }, 10000);
  }

  /**
   * Check if this is the first run of the extension
   * @returns {Promise<boolean>} True if first run
   */
  async checkIfFirstRun() {
    try {
      const result = await chrome.storage.local.get(['extensionInitialized', 'itemTargetList']);
      
      // Consider it first run if:
      // 1. Extension has never been initialized, OR
      // 2. No item target list exists in storage
      const isFirstRun = !result.extensionInitialized || 
                         !result.itemTargetList || 
                         result.itemTargetList.length === 0;
      
      if (isFirstRun) {
        // Mark as initialized
        await chrome.storage.local.set({ extensionInitialized: true });
      }
      
      return isFirstRun;
    } catch (error) {
      console.error('❌ Error checking first run status:', error);
      return true; // Default to first run on error
    }
  }

  /**
   * ========================================================================
   * AUTOMATIC JSON SYNC FUNCTIONALITY
   * ========================================================================
   */

  /**
   * Automatically load settings from server-settings.json file
   * @returns {Promise<Object>} Import result
   */
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
      
      // Import the settings
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
      
      return {
        success: false,
        error: `server-settings.json not found or invalid: ${error.message}`,
        isWarning: true
      };
    }
  }

  /**
   * Import settings from JSON data
   * @param {Object|string} jsonData - Settings data to import
   * @returns {Promise<Object>} Import result
   */
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
      
      // Import item target list with enhanced filter properties
      if (Array.isArray(settings.itemTargetList)) {
        const importResult = await this.importItemTargetList(settings.itemTargetList);
        importStats.itemTargets = importResult.totalItems;
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

  /**
   * Import item target list from server settings
   * @param {Array} serverItemList - Server item list to import
   * @returns {Promise<Object>} Import result
   */
  async importItemTargetList(serverItemList) {
    // Load existing items from Chrome storage first
    const existingData = await chrome.storage.local.get(['itemTargetList']);
    const existingItems = existingData.itemTargetList || [];
    
    const convertedItems = serverItemList.map(serverItem => ({
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
      percentDiffFilter: {
        enabled: serverItem.percentDiffFilter?.enabled || false,
        min: serverItem.percentDiffFilter?.min || null,
        max: serverItem.percentDiffFilter?.max || null
      },
      priceFilter: {
        enabled: serverItem.priceFilter?.enabled || false,
        min: serverItem.priceFilter?.min || null,
        max: serverItem.priceFilter?.max || null
      },
      addedAt: Date.now(),
      source: 'auto_json_import'
    }));
    
    // Merge with existing items (avoid duplicates by name)
    const mergedItems = [...existingItems];
    for (const newItem of convertedItems) {
      const existingIndex = mergedItems.findIndex(item => 
        (item.keyword || item.name) === newItem.keyword
      );
      if (existingIndex === -1) {
        mergedItems.push(newItem);
      }
    }
    
    this.itemTargetList = mergedItems;
    await chrome.storage.local.set({ itemTargetList: mergedItems });
    
    console.log(`📥 Merged ${convertedItems.length} JSON items with ${existingItems.length} existing items = ${mergedItems.length} total`);
    
    return {
      totalItems: mergedItems.length,
      newItems: convertedItems.length,
      existingItems: existingItems.length
    };
  }

  /**
   * Load settings from Chrome storage
   */
  async loadSettings() {
    try {
      console.log('📥 Loading settings from storage...');
      
      // Try to load from both local and sync storage
      const [syncSettings, localSettings] = await Promise.all([
        chrome.storage.sync.get({
          monitoringEnabled: true,
          soundEnabled: true,
          selectedTheme: 'nebula',
          siteThemingEnabled: true,
          lastNotificationTimestamp: 0,
          priceFilterMin: -50,
          priceFilterMax: 5,
          keychainPercentageThreshold: 50,
          itemTargetList: []
        }).catch(() => ({})),
        chrome.storage.local.get({
          itemTargetList: [],
          enabledKeychains: [],
          lastSettingsSync: 0
        }).catch(() => ({}))
      ]);
      
      // Apply loaded settings
      this.applyLoadedSettings(syncSettings, localSettings);
      
      console.log('✅ Settings loaded successfully:', this.getSettingsSummary());
      
    } catch (error) {
      console.error('❌ Error loading settings:', error);
      this.useDefaultSettings();
    }
  }

  /**
   * Apply loaded settings from storage
   * @param {Object} syncSettings - Settings from sync storage
   * @param {Object} localSettings - Settings from local storage
   */
  applyLoadedSettings(syncSettings, localSettings) {
    // Apply basic settings
    this.isMonitoringEnabled = syncSettings.monitoringEnabled ?? true;
    this.isSoundEnabled = syncSettings.soundEnabled ?? true;
    this.currentTheme = syncSettings.selectedTheme ?? 'nebula';
    this.isSiteThemingEnabled = syncSettings.siteThemingEnabled ?? true;
    this.lastNotificationTimestamp = syncSettings.lastNotificationTimestamp || 0;
    
    // Apply filter settings
    this.priceFilter.minAboveRecommended = syncSettings.priceFilterMin ?? -50;
    this.priceFilter.maxAboveRecommended = syncSettings.priceFilterMax ?? 5;
    this.keychainFilter.percentageThreshold = syncSettings.keychainPercentageThreshold ?? 50;
    
    // Use local storage only for large arrays
    this.itemTargetList = localSettings.itemTargetList || [];
    
    // Apply enabled keychains
    if (localSettings.enabledKeychains && localSettings.enabledKeychains.length > 0) {
      this.keychainFilter.enabledKeychains = new Set(localSettings.enabledKeychains);
    } else {
      // Use default enabled keychains
      this.keychainFilter.enabledKeychains = new Set([
        "Hot Howl", "Baby Karat T", "Hot Wurst", "Baby Karat CT", "Semi-Precious", 
        "Diamond Dog", "Titeenium AWP", "Lil' Monster", "Diner Dog", "Lil' Squirt"
      ]);
    }
  }

  /**
   * Get a summary of current settings for logging
   * @returns {Object} Settings summary
   */
  getSettingsSummary() {
    return {
      monitoring: this.isMonitoringEnabled,
      sound: this.isSoundEnabled,
      theme: this.currentTheme,
      siteTheming: this.isSiteThemingEnabled,
      itemTargets: this.itemTargetList.length,
      enabledKeychains: this.keychainFilter.enabledKeychains.size,
      priceFilter: `${this.priceFilter.minAboveRecommended}% to ${this.priceFilter.maxAboveRecommended}%`
    };
  }

  /**
   * Use default settings as fallback
   */
  useDefaultSettings() {
    console.log('🔧 Using default settings as fallback');
    
    this.isMonitoringEnabled = true;
    this.isSoundEnabled = true;
    this.currentTheme = 'nebula';
    this.isSiteThemingEnabled = true;
    this.lastNotificationTimestamp = 0;
    
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
  }

  /**
   * ========================================================================
   * API KEY AND CONNECTION MANAGEMENT
   * ========================================================================
   */

  /**
   * Load API key from storage and connect if available
   */
  async loadAPIKey() {
    try {
      const result = await chrome.storage.local.get(['csgoempire_api_key', 'csgoempire_domain']);
      this.apiKey = result.csgoempire_api_key;
      this.domain = result.csgoempire_domain || 'csgoempire.com';
      
      if (this.apiKey && this.isMonitoringEnabled) {
        console.log('🔑 API key found, starting connection...');
        await this.connectToCSGOEmpire();
      }
    } catch (error) {
      console.error('❌ Error loading API key:', error);
    }
  }

  /**
   * Save API key to storage
   * @param {string} apiKey - API key to save
   * @param {string} domain - Domain to save
   */
  async saveAPIKey(apiKey, domain = 'csgoempire.com') {
    try {
      await chrome.storage.local.set({
        csgoempire_api_key: apiKey,
        csgoempire_domain: domain
      });
      this.apiKey = apiKey;
      this.domain = domain;
      console.log('✅ API key saved successfully');
    } catch (error) {
      console.error('❌ Error saving API key:', error);
      throw error;
    }
  }

/**
 * Refresh user data from CSGOEmpire API
 */
async refreshUserData() {
  // Don't refresh if recently updated (keep reasonable 15 second cooldown)
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

  /**
   * ========================================================================
   * WEBSOCKET CONNECTION MANAGEMENT
   * ========================================================================
   */

/**
 * Connect to CSGOEmpire WebSocket
 */
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
    this.initializeConnectionState();
    
    // Get initial user data - if this fails due to rate limiting, wait and retry once
    try {
      await this.refreshUserData();
    } catch (error) {
      if (error.message.includes('429')) {
        console.log('⏰ Rate limited, waiting 30 seconds before retry...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        await this.refreshUserData();
      } else {
        throw error;
      }
    }

    const socketEndpoint = `wss://trade.${this.domain}/trade`;
    console.log(`🔗 Connecting to ${socketEndpoint}...`);
    
    // Disconnect any existing socket
    this.disconnectExistingSocket();
    
    // Create new socket connection
    this.createSocketConnection(socketEndpoint);
    
  } catch (error) {
    console.error(`❌ Connection failed: ${error.message}`);
    this.handleConnectionFailure();
    throw error;
  }
}

  /**
   * Initialize connection state
   */
  initializeConnectionState() {
    this.connectionStartTime = Date.now();
    this.identificationAttempts = 0;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Disconnect existing socket if present
   */
  disconnectExistingSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  
/**
 * Create Socket.IO connection
 * @param {string} socketEndpoint - WebSocket endpoint URL
 */
createSocketConnection(socketEndpoint) {
  // Ensure userData exists before creating socket
  if (!this.userData || !this.userData.user || !this.userData.socket_token) {
    console.error('❌ Cannot create socket connection: userData is incomplete');
    console.log('userData:', this.userData);
    this.handleConnectionFailure();
    return;
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
}


  /**
   * Handle connection failure
   */
  handleConnectionFailure() {
    this.isConnected = false;
    this.isAuthenticated = false;
    this.connectionStartTime = null;
    this.updateBadge();
    this.scheduleReconnect();
  }

  /**
   * Setup Socket.IO event handlers
   */
  setupSocketEvents() {
    // Connection events
    this.socket.on('connect', () => this.handleSocketConnect());
    this.socket.on('init', (data) => this.handleSocketInit(data));
    this.socket.on('timesync', (data) => this.handleTimesync(data));

    // Item events
    this.socket.on('new_item', (data) => this.handleNewItems(data));
    this.socket.on('updated_item', (data) => this.handleUpdatedItems(data));
    this.socket.on('deleted_item', (data) => this.handleDeletedItems(data));
    this.socket.on('auction_update', (data) => this.handleAuctionUpdate(data));
    this.socket.on('trade_status', (data) => this.handleTradeStatus(data));

    // Disconnection events
    this.socket.on('disconnect', (reason) => this.handleDisconnection(reason));
    this.socket.on('close', (reason) => this.handleDisconnection(`close: ${reason}`));
    this.socket.on('error', (error) => this.handleDisconnection(`error: ${error}`));
    this.socket.on('connect_error', (error) => this.handleDisconnection(`connect_error: ${error}`));
  }

  /**
   * Handle socket connection established
   */
  handleSocketConnect() {
    console.log('✅ Connected to CSGOEmpire websocket');
    console.log(`🆔 Socket ID: ${this.socket.id}`);
    this.isConnected = true;
    this.stats.totalConnections++;
    this.stats.lastSuccessfulConnection = Date.now();
    this.reconnectAttempts = 0;
    this.updateBadge();
  }

  /**
   * Handle socket initialization
   * @param {Object} data - Init data from server
   */
  async handleSocketInit(data) {
    this.lastEventTime = Date.now();
    
    console.log('🎉 INIT event received from server!');
    
    if (data && data.authenticated) {
      this.isAuthenticated = true;
      console.log(`✅ Successfully authenticated as ${data.name}`);
      
      // Send filters to server
      this.sendFiltersToServer();
    } else {
      console.log('🔄 Need to authenticate - refreshing data and sending identify...');
      await this.authenticateWithServer();
    }
    
    this.updateBadge();
  }


/**
 * Send filters to server
 */
sendFiltersToServer() {
  if (!this.socket || !this.socket.connected) {
    console.warn('⚠️ Cannot send filters: socket not connected');
    return;
  }
  
  this.socket.emit('filters', {
    price_max: 9999999
  });
  console.log('📤 Filters sent to server');
}


/**
 * Authenticate with server
 */
async authenticateWithServer() {
  if (!this.socket || !this.socket.connected) {
    console.warn('⚠️ Cannot authenticate: socket not connected');
    return;
  }
  
  if (!this.userData || !this.userData.user || !this.userData.socket_token) {
    console.warn('⚠️ Cannot authenticate: userData incomplete');
    return;
  }
  
  this.socket.emit('identify', {
    uid: this.userData.user.id,
    model: this.userData.user,
    authorizationToken: this.userData.socket_token,
    signature: this.userData.socket_signature
  });
  console.log('📤 Identify packet sent to server');
}

  /**
   * Handle timesync events
   * @param {Object} data - Timesync data
   */
  handleTimesync(data) {
    this.lastEventTime = Date.now();
    console.log(`🕐 Timesync: ${JSON.stringify(data)}`);
  }

  /**
   * Handle new items
   * @param {Array|Object} data - New item data
   */
  handleNewItems(data) {
    this.lastEventTime = Date.now();
    const itemCount = Array.isArray(data) ? data.length : 1;
    console.log(`📦 New items received (${itemCount})`);
    
    if (this.isMonitoringEnabled) {
      this.processItems(data);
    }
  }

  /**
   * Handle updated items
   * @param {Array|Object} data - Updated item data
   */
  handleUpdatedItems(data) {
    this.lastEventTime = Date.now();
    const itemCount = Array.isArray(data) ? data.length : 1;
    console.log(`📦 Updated items received (${itemCount})`);
    
    if (this.isMonitoringEnabled) {
      this.processItems(data);
    }
  }

  /**
   * Handle deleted items
   * @param {Array|Object} data - Deleted item data
   */
  handleDeletedItems(data) {
    this.lastEventTime = Date.now();
    const itemCount = Array.isArray(data) ? data.length : 1;
    console.log(`🗑️ Items deleted: ${itemCount}`);
  }

  /**
   * Handle auction updates
   * @param {Object} data - Auction data
   */
  handleAuctionUpdate(data) {
    this.lastEventTime = Date.now();
    console.log(`🔨 Auction update received`);
  }

  /**
   * Handle trade status updates
   * @param {Object} data - Trade status data
   */
  handleTradeStatus(data) {
    this.lastEventTime = Date.now();
    console.log(`📊 Trade status update received`);
  }

  /**
   * ========================================================================
   * DISCONNECTION AND RECONNECTION LOGIC
   * ========================================================================
   */

  /**
   * Handle socket disconnection
   * @param {string} reason - Disconnection reason
   */
  handleDisconnection(reason) {
    console.log(`❌ Socket disconnected: ${reason}`);
    
    this.isConnected = false;
    this.isAuthenticated = false;
    this.stats.totalDisconnections++;
    this.stats.lastDisconnection = Date.now();
    
    if (this.socket) {
      this.socket = null;
    }
    
    this.updateBadge();
    
    // Smart reconnection logic (only if monitoring is enabled and not manually disconnected)
    if (this.shouldAttemptReconnection(reason)) {
      this.scheduleReconnect();
    } else {
      console.error(`❌ Max reconnection attempts reached (${this.maxReconnectAttempts}) or monitoring disabled.`);
    }
  }

  /**
   * Determine if reconnection should be attempted
   * @param {string} reason - Disconnection reason
   * @returns {boolean} Should attempt reconnection
   */
  shouldAttemptReconnection(reason) {
    return this.reconnectAttempts < this.maxReconnectAttempts && 
           this.isMonitoringEnabled && 
           this.apiKey && 
           !reason.includes('manual');
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    
    // Exponential backoff with jitter
    const baseDelay = this.reconnectDelay;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const delay = exponentialDelay + jitter;
    
    console.log(`🔄 Attempting reconnection in ${(delay / 1000).toFixed(1)}s (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.shouldContinueReconnection()) {
        this.connectToCSGOEmpire();
      }
    }, delay);
  }

  /**
   * Check if reconnection should continue
   * @returns {boolean} Should continue reconnection
   */
  shouldContinueReconnection() {
    return this.reconnectAttempts <= this.maxReconnectAttempts && 
           this.isMonitoringEnabled && 
           this.apiKey;
  }

  /**
   * Manually disconnect from server
   */
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

  /**
   * ========================================================================
   * ITEM PROCESSING AND FILTERING
   * ========================================================================
   */

  /**
   * Process incoming items from WebSocket
   * @param {Array|Object} items - Items to process
   */
  async processItems(items) {
    if (!Array.isArray(items)) {
      items = [items];
    }

    // Process items one by one to handle async filter checks
    for (const item of items) {
      await this.processIndividualItem(item);
    }
  }

  /**
   * Process a single item
   * @param {Object} item - Item to process
   */
  async processIndividualItem(item) {
    this.stats.itemsProcessed++;
    
    // Skip already notified items
    if (this.notifiedItemIds.has(item.id)) {
      return;
    }

    console.log(`🔍 Processing item: ${item.market_name}`);
    console.log(`💰 Market: ${(item.market_value / 100).toFixed(2)}, Float: ${item.wear ? item.wear.toFixed(6) : 'N/A'}`);

    // Get both specific and universal matches
    const targetMatches = this.checkItemTargetList(item);
    let itemProcessed = false;

    // PRIORITY 1: Process specific target item matches
    if (targetMatches.specificMatch) {
      itemProcessed = await this.processSpecificTargetMatch(item, targetMatches.specificMatch);
    }

    // PRIORITY 2: Process keychains (INDEPENDENT of universal filters)
    if (!itemProcessed && item.keychains && item.keychains.length > 0) {
      itemProcessed = await this.processKeychainMatch(item);
    }

    // PRIORITY 3: Apply universal filters (ONLY if no specific match or keychain processed)
    if (!itemProcessed && targetMatches.universalMatch) {
      itemProcessed = await this.processUniversalFilterMatch(item, targetMatches.universalMatch);
    }

    // Log if item was filtered out
    if (!itemProcessed) {
      this.stats.itemsFiltered++;
      this.incrementFilterReason('no_match_or_failed_filters');
    }
  }

  /**
   * Process specific target item match
   * @param {Object} item - Item data
   * @param {Object} targetMatch - Matched target item
   * @returns {Promise<boolean>} True if item was processed
   */
  async processSpecificTargetMatch(item, targetMatch) {
    console.log(`🎯 Found specific target item match: ${targetMatch.name || targetMatch.keyword}`);
    
    const priceCheck = this.isGoodPrice(item);
    if (priceCheck.isGood) {
      const filtersCheck = await this.checkItemFilters(item, targetMatch);
      if (filtersCheck.isGood) {
        console.log('🎉 🎯 SPECIFIC TARGET ITEM FOUND - ALL FILTERS PASSED! 🎯 🎉');
        
        item.notification_type = 'target_item';
        item.target_item_matched = targetMatch;
        await this.handleNotificationFound(item);
        return true;
      }
    }
    return false;
  }

  /**
   * Process keychain match
   * @param {Object} item - Item data
   * @returns {Promise<boolean>} True if item was processed
   */
  async processKeychainMatch(item) {
    console.log(`🔑 Keychains detected: ${item.keychains.map(k => k.name).join(', ')}`);
    
    // Safety checks to prevent false keychain notifications
    if (this.shouldSkipKeychainProcessing(item)) {
      return false;
    }
    
    const charmDetails = this.getCharmDetails(item);

    if (charmDetails) {
      console.log(`🎯 Found target charm: ${charmDetails.name} (${charmDetails.category}) - ${charmDetails.price.toFixed(2)}`);
      
      if (!this.keychainFilter.enabledKeychains.has(charmDetails.name)) {
        this.stats.itemsFiltered++;
        this.incrementFilterReason('keychain_disabled');
        console.log(`🚫 FILTERED: Keychain "${charmDetails.name}" disabled in settings`);
        return false;
      }

      const priceCheck = this.isGoodPrice(item);
      if (!priceCheck.isGood) {
        this.stats.itemsFiltered++;
        this.incrementFilterReason('price_filter');
        console.log(`🚫 FILTERED: Price filter failed - ${priceCheck.reason}`);
        return false;
      }
      
      const keychainPercentageCheck = this.checkKeychainPercentage(item, charmDetails);
      if (!keychainPercentageCheck.isGood) {
        this.stats.itemsFiltered++;
        this.incrementFilterReason('keychain_percentage');
        console.log(`🚫 FILTERED: Keychain percentage too low - ${keychainPercentageCheck.reason}`);
        return false;
      }

      console.log('🎉 🔑 TARGET FOUND - ALL FILTERS PASSED! 🔑 🎉');

      item.charm_category = charmDetails.category;
      item.charm_name = charmDetails.name;
      item.charm_price = charmDetails.price;
      item.charm_price_display = this.formatCharmPrice(charmDetails.price, item.purchase_price);
      item.notification_type = 'keychain';

      await this.handleNotificationFound(item);
      return true;
    } else {
      console.log(`🔍 Unknown keychains found: ${item.keychains.map(k => k.name).join(', ')}`);
      this.stats.itemsFiltered++;
      this.incrementFilterReason('unknown_keychain');
      return false;
    }
  }

  /**
   * Process universal filter match
   * @param {Object} item - Item data
   * @param {Object} universalMatch - Universal filter
   * @returns {Promise<boolean>} True if item was processed
   */
  async processUniversalFilterMatch(item, universalMatch) {
    console.log(`🌐 Applying universal filter: ${universalMatch.name}`);
    
    const priceCheck = this.isGoodPrice(item);
    if (priceCheck.isGood) {
      const filtersCheck = await this.checkItemFilters(item, universalMatch);
      if (filtersCheck.isGood) {
        console.log('🎉 🌐 UNIVERSAL FILTER MATCH - ALL FILTERS PASSED! 🌐 🎉');
        
        item.notification_type = 'target_item';
        item.target_item_matched = universalMatch;
        await this.handleNotificationFound(item);
        return true;
      }
    }
    return false;
  }

  /**
   * Check if keychain processing should be skipped
   * @param {Object} item - Item data
   * @returns {boolean} True if should skip
   */
  shouldSkipKeychainProcessing(item) {
    const itemName = item.market_name.toLowerCase();
    const allKeychainNames = this.getAllKeychainNames().map(name => name.toLowerCase());
    
    // CRITICAL FIX 1: Check if market name exactly matches any keychain name
    if (allKeychainNames.includes(itemName)) {
      this.stats.itemsFiltered++;
      this.incrementFilterReason('market_name_matches_keychain');
      console.log(`🚫 FILTERED: Item market name "${item.market_name}" exactly matches a keychain keyword`);
      return true;
    }
    
    // CRITICAL FIX 2: Check if market name is a charm with keychain name (e.g., "Charm | Lil' Squirt")
    const cleanedMarketName = itemName.replace(/^charm\s*\|\s*/, '').trim();
    if (allKeychainNames.includes(cleanedMarketName)) {
      this.stats.itemsFiltered++;
      this.incrementFilterReason('market_name_is_charm_keychain');
      console.log(`🚫 FILTERED: Item market name "${item.market_name}" is a charm with keychain name - skipping keychain notification`);
      return true;
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
      return true;
    }

    return false;
  }

  /**
   * ========================================================================
   * ITEM FILTERING AND MATCHING LOGIC
   * ========================================================================
   */

  /**
   * Check if item matches target list (specific or universal)
   * @param {Object} item - Item to check
   * @returns {Object} Match results
   */
  checkItemTargetList(item) {
    if (!item.market_name || this.itemTargetList.length === 0) {
      return { specificMatch: null, universalMatch: null };
    }

    let universalMatch = null;
    
    const itemName = item.market_name.toLowerCase().trim();
    const allKeychainNames = this.getAllKeychainNames().map(name => name.toLowerCase());
    
    // Skip if item name exactly matches a keychain name
    if (allKeychainNames.includes(itemName)) {
      console.log(`🚫 SKIPPED: Item name "${item.market_name}" exactly matches a keychain keyword`);
      return { specificMatch: null, universalMatch: null };
    }
    
    // Check for charm prefix patterns
    const cleanedMarketName = itemName.replace(/^charm\s*\|\s*/, '').trim();
    if (allKeychainNames.includes(cleanedMarketName)) {
      console.log(`🚫 SKIPPED: Item "${item.market_name}" is a charm with keychain name`);
      return { specificMatch: null, universalMatch: null };
    }
    
    // SEPARATE specific matches from universal filters
    for (const targetItem of this.itemTargetList) {
      // Check for universal filters (no keyword specified)
      if (targetItem.isUniversalFilter || !targetItem.keyword || targetItem.keyword.includes('Universal Filter')) {
        console.log(`🌟 Found universal filter: ${targetItem.name}`);
        universalMatch = targetItem;
        continue; // Don't return immediately, check for specific matches first
      }
      
      const targetName = (targetItem.keyword || targetItem.name || '').toLowerCase().trim();
      if (!targetName) continue;
      
      // Method 1: Exact match (highest priority)
      if (itemName === targetName) {
        console.log(`✅ EXACT match found: "${targetItem.keyword || targetItem.name}" === "${item.market_name}"`);
        return { specificMatch: targetItem, universalMatch: null };
      }
      
      // Method 2: Substantial substring match
      if (itemName.includes(targetName) && targetName.length > itemName.length * 0.5) {
        console.log(`✅ SUBSTANTIAL match found: "${targetItem.keyword || targetItem.name}" in "${item.market_name}"`);
        return { specificMatch: targetItem, universalMatch: null };
      }
      
      // Method 3: Reverse substantial substring match
      if (targetName.includes(itemName) && itemName.length > targetName.length * 0.5) {
        console.log(`✅ REVERSE match found: "${item.market_name}" in "${targetItem.keyword || targetItem.name}"`);
        return { specificMatch: targetItem, universalMatch: null };
      }
    } 
    // Return results: specific match takes priority, universal match as fallback
    return { specificMatch: null, universalMatch: universalMatch };
  }

  /**
   * Check all item filters (async for Buff163 integration)
   * @param {Object} item - Item to check
   * @param {Object} targetItem - Target item with filters
   * @returns {Promise<Object>} Filter check result
   */
  async checkItemFilters(item, targetItem) {
    console.log(`🔍 Checking enhanced filters for item: ${item.market_name}`);
    
    // Check float filter
    const floatCheck = this.checkFloatFilter(item, targetItem);
    if (!floatCheck.isGood) {
      return floatCheck;
    }
    
    // Check percentage difference filter (with Buff163 support)
    if (targetItem.percentDiffFilter?.enabled) {
      const percentDiffCheck = await this.checkPercentDiffFilter(item, targetItem);
      if (!percentDiffCheck.isGood) {
        return percentDiffCheck;
      }
    }
    
    // Check price filter
    if (targetItem.priceFilter?.enabled) {
      const priceFilterCheck = this.checkPriceRangeFilter(item, targetItem);
      if (!priceFilterCheck.isGood) {
        return priceFilterCheck;
      }
    }
    
    return { isGood: true, reason: 'All filters passed' };
  }

  /**
   * Check float filter
   * @param {Object} item - Item to check
   * @param {Object} targetItem - Target with float filter
   * @returns {Object} Filter result
   */
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

  /**
   * Check percentage difference filter with Buff163 support
   * @param {Object} item - Item to check
   * @param {Object} targetItem - Target with percentage filter
   * @returns {Promise<Object>} Filter result
   */
  async checkPercentDiffFilter(item, targetItem) {
    if (!targetItem.percentDiffFilter?.enabled) {
      return { 
        isGood: true, 
        reason: 'Percentage difference filter disabled for this item' 
      };
    }

    // Try to get Buff163 vs Empire difference first
    const buff163Difference = await this.calculateBuff163Difference(item);
    
    let percentageToCheck;
    let sourceDescription;
    
    if (buff163Difference !== null) {
      percentageToCheck = buff163Difference;
      sourceDescription = 'Buff163 vs Empire';
    } else {
      // Fallback to above_recommended_price if Buff163 data not available
      percentageToCheck = item.above_recommended_price;
      sourceDescription = 'above recommended';
      
      if (percentageToCheck === undefined || percentageToCheck === null || isNaN(percentageToCheck)) {
        return { 
          isGood: false, 
          reason: 'No percentage data available (neither Buff163 nor above_recommended)' 
        };
      }
    }

    const minPercent = targetItem.percentDiffFilter.min;
    const maxPercent = targetItem.percentDiffFilter.max;

    // Check minimum percentage
    if (minPercent !== null && percentageToCheck < minPercent) {
      return { 
        isGood: false, 
        reason: `${sourceDescription} ${percentageToCheck.toFixed(2)}% is below minimum ${minPercent}%` 
      };
    }

    // Check maximum percentage
    if (maxPercent !== null && percentageToCheck > maxPercent) {
      return { 
        isGood: false, 
        reason: `${sourceDescription} ${percentageToCheck.toFixed(2)}% is above maximum ${maxPercent}%` 
      };
    }

    return { 
      isGood: true, 
      reason: `${sourceDescription} ${percentageToCheck.toFixed(2)}% is within range ${minPercent ?? '-∞'}% to ${maxPercent ?? '+∞'}%` 
    };
  }

  /**
   * Check price range filter
   * @param {Object} item - Item to check
   * @param {Object} targetItem - Target with price filter
   * @returns {Object} Filter result
   */
  checkPriceRangeFilter(item, targetItem) {
    if (!targetItem.priceFilter?.enabled) {
      return { 
        isGood: true, 
        reason: 'Price filter disabled for this item' 
      };
    }

    const marketValue = item.market_value ? (item.market_value / 100) : 0;
    
    if (marketValue <= 0) {
      return { 
        isGood: false, 
        reason: 'Item has no valid market value' 
      };
    }

    const minPrice = targetItem.priceFilter.min;
    const maxPrice = targetItem.priceFilter.max;

    // Check minimum price
    if (minPrice !== null && marketValue < minPrice) {
      return { 
        isGood: false, 
        reason: `Price ${marketValue.toFixed(2)} is below minimum ${minPrice.toFixed(2)}` 
      };
    }

    // Check maximum price
    if (maxPrice !== null && marketValue > maxPrice) {
      return { 
        isGood: false, 
        reason: `Price ${marketValue.toFixed(2)} is above maximum ${maxPrice.toFixed(2)}` 
      };
    }

    return { 
      isGood: true, 
      reason: `Price ${marketValue.toFixed(2)} is within range ${minPrice ?? '0'} to ${maxPrice ?? '∞'}` 
    };
  }

  /**
   * Check if item has good price (within allowed range)
   * @param {Object} item - Item to check
   * @returns {Object} Price check result
   */
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

  /**
   * ========================================================================
   * BUFF163 PRICE COMPARISON INTEGRATION
   * ========================================================================
   */

  /**
   * Calculate Buff163 vs Empire price difference
   * @param {Object} item - Item to analyze
   * @returns {Promise<number|null>} Percentage difference or null
   */
  async calculateBuff163Difference(item) {
    try {
      const priceData = await this.fetchPriceData();
      
      if (!priceData || Object.keys(priceData).length === 0) {
        console.log('⚠️ No price data available for Buff163 comparison');
        return null;
      }

      const itemName = item.market_name;
      if (!itemName) {
        return null;
      }

      // Clean and format the item name to match price data keys
      const cleanedItemName = this.cleanMarketHashName(itemName).toLowerCase();
      
      // Check for Doppler items (special handling)
      if (this.isDopplerItem(itemName)) {
        return this.calculateDopplerPrice(itemName, priceData, item);
      }
      
      // Standard item lookup
      const priceInfo = priceData[cleanedItemName];
      if (priceInfo?.buffPrice?.price) {
        const buff163Price = priceInfo.buffPrice.price;
        return this.calculatePriceDifference(item, buff163Price);
      }
      
      console.log(`🔍 No Buff163 price found for: ${itemName}`);
      return null;
      
    } catch (error) {
      console.error('❌ Error calculating Buff163 difference:', error);
      return null;
    }
  }

  /**
   * Check if item is a Doppler variant
   * @param {string} itemName - Item name to check
   * @returns {boolean} True if Doppler item
   */
  isDopplerItem(itemName) {
    return itemName.toLowerCase().includes('doppler') || 
           itemName.toLowerCase().includes('ruby') || 
           itemName.toLowerCase().includes('sapphire') || 
           itemName.toLowerCase().includes('emerald') || 
           itemName.toLowerCase().includes('black pearl');
  }

  /**
   * Calculate price for Doppler items
   * @param {string} itemName - Item name
   * @param {Object} priceData - Price data cache
   * @param {Object} item - Item object
   * @returns {number|null} Price difference percentage
   */
  calculateDopplerPrice(itemName, priceData, item) {
    const dopplerPattern = /(Ruby|Sapphire|Emerald|Black Pearl|Phase [1-4])$/i;
    const match = itemName.match(dopplerPattern);
    
    if (match) {
      const phaseOrGem = this.toTitleCase(match[0].trim());
      const baseItemName = itemName.replace(dopplerPattern, '').trim().replace(/-$/, '').trim();
      const baseKey = this.cleanMarketHashName(baseItemName).toLowerCase();
      
      const priceInfo = priceData[baseKey];
      if (priceInfo?.buffPrice?.doppler?.[phaseOrGem]) {
        const buff163Price = priceInfo.buffPrice.doppler[phaseOrGem];
        return this.calculatePriceDifference(item, buff163Price);
      }
    }
    return null;
  }

  /**
   * Calculate the actual price difference percentage
   * @param {Object} item - Item data
   * @param {number} buff163Price - Buff163 price
   * @returns {number|null} Percentage difference
   */
  calculatePriceDifference(item, buff163Price) {
    const empirePrice = item.market_value ? (item.market_value / 100) : 0;
    
    if (empirePrice <= 0 || buff163Price <= 0) {
      return null;
    }
    
    // Calculate percentage difference: (Buff163 / Empire) * 100
    const percentageDifference = (buff163Price / empirePrice) * 100;
    
    console.log(`💰 Price comparison for ${item.market_name}:`);
    console.log(`   Empire: ${empirePrice.toFixed(2)}`);
    console.log(`   Buff163: ${buff163Price.toFixed(2)}`);
    console.log(`   Difference: ${percentageDifference.toFixed(1)}%`);
    
    return percentageDifference;
  }

  /**
   * ========================================================================
   * KEYCHAIN/CHARM DETECTION AND PRICING
   * ========================================================================
   */

  /**
   * Get charm details from item keychains
   * @param {Object} item - Item with keychains
   * @returns {Object|null} Charm details or null
   */
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

  /**
   * Get all available keychain names
   * @returns {Array<string>} Array of keychain names
   */
  getAllKeychainNames() {
    const keychains = [];
    for (const category in this.charmPricing) {
      keychains.push(...Object.keys(this.charmPricing[category]));
    }
    return keychains.sort();
  }

  /**
   * Get keychain category by name
   * @param {string} keychainName - Keychain name
   * @returns {string|null} Category or null
   */
  getKeychainCategory(keychainName) {
    for (const category in this.charmPricing) {
      if (this.charmPricing[category].hasOwnProperty(keychainName)) {
        return category;
      }
    }
    return null;
  }

  /**
   * Check keychain percentage value
   * @param {Object} item - Item data
   * @param {Object} charmDetails - Charm details
   * @returns {Object} Percentage check result
   */
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

  /**
   * Format charm price display
   * @param {number} charmPrice - Charm price
   * @param {number} purchasePriceCents - Purchase price in cents
   * @returns {string} Formatted price display
   */
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

  /**
   * ========================================================================
   * NOTIFICATION HANDLING
   * ========================================================================
   */

  /**
   * Handle when a target item is found
   * @param {Object} itemData - Item data
   */
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
    
    // Enhanced: Get price comparison data for notifications
    let enhancedItemData = await this.enhanceItemDataWithPrices(itemData);
    
    // Update stats based on notification type
    this.updateNotificationStats(enhancedItemData, now);
    
    // Store notification and manage cache
    this.storeNotificationHistory(enhancedItemData);
    this.manageNotifiedItemsCache(enhancedItemData.id);
    
    this.lastNotificationTimestamp = now;
    
    // Save last notification timestamp
    chrome.storage.sync.set({
      lastNotification: now,
      lastNotificationTimestamp: now
    });
    
    console.log('📱 Showing Chrome notification');
    await this.showBackgroundNotification(enhancedItemData);

    // Send notification to content script
    const notificationType = enhancedItemData.notification_type === 'target_item' ? 'ITEM_TARGET_FOUND' : 'KEYCHAIN_FOUND';
    this.sendToContentScript(notificationType, {
      ...enhancedItemData,
      soundEnabled: false
    });

    this.updateBadge();
  }

  /**
   * Enhance item data with price comparison information
   * @param {Object} itemData - Original item data
   * @returns {Promise<Object>} Enhanced item data
   */
  async enhanceItemDataWithPrices(itemData) {
    let enhancedItemData = { ...itemData };
    
    try {
      const buff163Difference = await this.calculateBuff163Difference(itemData);
      const priceData = await this.fetchPriceData();
      
      if (priceData && itemData.market_name) {
        const cleanedItemName = this.cleanMarketHashName(itemData.market_name).toLowerCase();
        
        if (this.isDopplerItem(itemData.market_name)) {
          this.addDopplerPriceData(enhancedItemData, itemData.market_name, priceData);
        } else {
          this.addStandardPriceData(enhancedItemData, cleanedItemName, priceData);
        }
      }
      
      if (buff163Difference !== null) {
        enhancedItemData.buff163_percentage = buff163Difference;
      }
      
      console.log('💰 Enhanced notification with price data:', {
        buff163_price: enhancedItemData.buff163_price,
        csfloat_price: enhancedItemData.csfloat_price,
        empire_price: itemData.market_value ? (itemData.market_value / 100) : 0,
        buff163_percentage: enhancedItemData.buff163_percentage
      });
      
    } catch (error) {
      console.log('⚠️ Could not get price comparison data for notification:', error.message);
    }
    
    return enhancedItemData;
  }

  /**
   * Add Doppler-specific price data
   * @param {Object} enhancedItemData - Item data to enhance
   * @param {string} itemName - Item name
   * @param {Object} priceData - Price data cache
   */
  addDopplerPriceData(enhancedItemData, itemName, priceData) {
    const dopplerPattern = /(Ruby|Sapphire|Emerald|Black Pearl|Phase [1-4])$/i;
    const match = itemName.match(dopplerPattern);
    
    if (match) {
      const phaseOrGem = this.toTitleCase(match[0].trim());
      const baseItemName = itemName.replace(dopplerPattern, '').trim().replace(/-$/, '').trim();
      const baseKey = this.cleanMarketHashName(baseItemName).toLowerCase();
      
      const priceInfo = priceData[baseKey];
      if (priceInfo?.buffPrice?.doppler?.[phaseOrGem]) {
        enhancedItemData.buff163_price = priceInfo.buffPrice.doppler[phaseOrGem];
      }
      if (priceInfo?.csfloatPrice?.doppler?.[phaseOrGem]) {
        enhancedItemData.csfloat_price = priceInfo.csfloatPrice.doppler[phaseOrGem];
      }
    }
  }

  /**
   * Add standard price data
   * @param {Object} enhancedItemData - Item data to enhance
   * @param {string} cleanedItemName - Cleaned item name
   * @param {Object} priceData - Price data cache
   */
  addStandardPriceData(enhancedItemData, cleanedItemName, priceData) {
    const priceInfo = priceData[cleanedItemName];
    if (priceInfo?.buffPrice?.price) {
      enhancedItemData.buff163_price = priceInfo.buffPrice.price;
    }
    if (priceInfo?.csfloatPrice?.price) {
      enhancedItemData.csfloat_price = priceInfo.csfloatPrice.price;
    }
  }

  /**
   * Update notification statistics
   * @param {Object} enhancedItemData - Enhanced item data
   * @param {number} now - Current timestamp
   */
  updateNotificationStats(enhancedItemData, now) {
    if (enhancedItemData.notification_type === 'target_item') {
      this.stats.itemsFound = (this.stats.itemsFound || 0) + 1;
      this.stats.lastItemFound = now;
    } else {
      this.stats.keychainsFound++;
      this.stats.lastKeychainFound = now;
    }
  }

  /**
   * Manage notified items cache
   * @param {string} itemId - Item ID to add
   */
  manageNotifiedItemsCache(itemId) {
    this.notifiedItemIds.add(itemId);
    
    // Limit cache size
    if (this.notifiedItemIds.size > 1000) {
      const itemsArray = Array.from(this.notifiedItemIds);
      this.notifiedItemIds = new Set(itemsArray.slice(-500));
    }
  }

/**
 * Show Chrome background notification
 * @param {Object} itemData - Item data for notification
 */
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

    
// Chrome notification
chrome.notifications.create(notificationId, {
  type: 'basic',
  iconUrl: 'icons/icon128.png',
  title: title,
  message: `${itemData.market_name}\n${detailedMessage}`,
  priority: 2,
  requireInteraction: true
}, (createdId) => {
  if (chrome.runtime.lastError) {
    console.error('❌ Chrome notification error:', chrome.runtime.lastError);
  } else {
    console.log('✅ Chrome notification created:', createdId);
    
    setTimeout(() => {
      chrome.notifications.clear(createdId);
    }, 30000);
  }
});

    // Store notification in history
    console.log('📱 Chrome notification sent for item:', itemData.id);

  } catch (error) {
    console.error('❌ Error creating Chrome notification:', error.message);
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

  /**
   * Play notification sound using various methods
   */
  async playNotificationSound() {
    try {
      if (chrome.offscreen) {
        await this.playOffscreenSound();
      } else {
        this.playTTSSound();
      }
    } catch (error) {
      console.error('❌ Sound playback failed:', error);
      this.playTTSSound();
    }
  }

  /**
   * Play sound using offscreen document
   */
  async playOffscreenSound() {
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
  }

  /**
   * Play sound using Text-to-Speech as fallback
   */
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

  /**
   * Store notification in history
   * @param {Object} itemData - Item data to store
   */
  async storeNotificationHistory(itemData) {
    try {
      const result = await chrome.storage.local.get(['notificationHistory']);
      let history = result.notificationHistory || [];
      
      // Clean old entries (24 hours)
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      history = history.filter(item => item.timestamp > twentyFourHoursAgo);
      
      const historyItem = this.createHistoryItem(itemData);
      
      history.unshift(historyItem);
      
      // Limit history size
      if (history.length > 100) {
        history = history.slice(0, 100);
      }
      
      await chrome.storage.local.set({notificationHistory: history});
      
      console.log('💾 Notification stored in history');
    } catch (error) {
      console.error('❌ Error storing notification history:', error);
    }
  }

  /**
   * Create history item from notification data
   * @param {Object} itemData - Item data
   * @returns {Object} History item
   */
  createHistoryItem(itemData) {
    return {
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
      timestamp: Date.now(),
      
      // Price fields
      buff163_price: itemData.buff163_price,
      csfloat_price: itemData.csfloat_price,
      buff163_percentage: itemData.buff163_percentage,
      empire_price: itemData.market_value ? (itemData.market_value / 100) : 0
    };
  }

  /**
   * ========================================================================
   * PRICE DATA FETCHING AND CACHING
   * ========================================================================
   */

  /**
   * Fetch price data from external APIs with caching
   * @returns {Promise<Object>} Price data
   */
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
      
      this.priceDataCache = this.combinePriceData(csfloatData, buffData);
      this.priceCacheTimestamp = Date.now();
      
      console.log(`✅ Price cache updated with ${Object.keys(this.priceDataCache).length} items.`);
      
      return this.priceDataCache;

    } catch (error) {
      console.error('❌ Error fetching prices directly:', error.message);
      return this.priceDataCache || {}; // Return old cache if fetching fails
    }
  }

  /**
   * Combine CSFloat and Buff163 price data
   * @param {Object} csfloatData - CSFloat price data
   * @param {Object} buffData - Buff163 price data
   * @returns {Object} Combined price data
   */
  combinePriceData(csfloatData, buffData) {
    const combinedPrices = new Map();

    // Process CSFloat prices
    for (const [name, data] of Object.entries(csfloatData)) {
      combinedPrices.set(name.toLowerCase(), { csfloatPrice: data });
    }
    
    // Merge Buff163 prices
    for (const [name, data] of Object.entries(buffData)) {
      const lowerName = name.toLowerCase();
      const existingEntry = combinedPrices.get(lowerName) || {};
      
      if (data && data.starting_at) {
        combinedPrices.set(lowerName, { ...existingEntry, buffPrice: data.starting_at });
      }
    }
    
    return Object.fromEntries(combinedPrices);
  }

  /**
   * ========================================================================
   * UTILITY METHODS
   * ========================================================================
   */

  /**
   * Convert string to title case
   * @param {string} str - String to convert
   * @returns {string} Title case string
   */
  toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  }

  /**
   * Clean market hash name for price lookups
   * @param {string} itemName - Item name to clean
   * @returns {string} Cleaned name
   */
  cleanMarketHashName(itemName) {
    if (!itemName) return '';
    
    let cleaned = itemName.replace(/\s+/g, ' ').trim();
    
    // Handle knife star prefix
    if (cleaned.startsWith('★') && !cleaned.startsWith('★ ')) {
      cleaned = cleaned.replace('★', '★ ');
    }
    
    return cleaned;
  }

  /**
   * Increment filter reason counter
   * @param {string} reason - Filter reason
   */
  incrementFilterReason(reason) {
    if (!this.stats.filterReasons[reason]) {
      this.stats.filterReasons[reason] = 0;
    }
    this.stats.filterReasons[reason]++;
  }

  /**
   * ========================================================================
   * SETTINGS MANAGEMENT METHODS
   * ========================================================================
   */

  /**
   * Update price filter settings
   * @param {number} minPercentage - Minimum percentage
   * @param {number} maxPercentage - Maximum percentage
   */
  async updatePriceFilter(minPercentage, maxPercentage) {
    console.log(`🔧 Updating Price Filter: ${minPercentage}% to ${maxPercentage}%`);
    
    this.priceFilter.minAboveRecommended = minPercentage;
    this.priceFilter.maxAboveRecommended = maxPercentage;
    
    try {
      await Promise.all([
        chrome.storage.local.set({
          priceFilterMin: minPercentage,
          priceFilterMax: maxPercentage
        }),
        chrome.storage.sync.set({
          priceFilterMin: minPercentage,
          priceFilterMax: maxPercentage
        }).catch(e => console.warn('Sync storage failed:', e.message))
      ]);
      
      console.log(`✅ Price Filter saved: ${minPercentage}% to ${maxPercentage}%`);
      
      // Auto-sync to server settings
      await this.autoSyncToServerSettings();
      
    } catch (error) {
      console.error('❌ Error saving Price Filter:', error);
      throw error;
    }
  }

  /**
   * Update keychain percentage threshold
   * @param {number} percentageThreshold 
   */
  async updateKeychainPercentage(percentageThreshold) {
    console.log(`🔧 Updating Keychain Percentage: ${percentageThreshold}%`);
    
    this.keychainFilter.percentageThreshold = percentageThreshold;
    
    try {
      await Promise.all([
        chrome.storage.local.set({ keychainPercentageThreshold: percentageThreshold }),
        chrome.storage.sync.set({ keychainPercentageThreshold: percentageThreshold })
          .catch(e => console.warn('Sync storage failed:', e.message))
      ]);
      
      console.log(`✅ Keychain Percentage saved: ${percentageThreshold}%`);
      
      await this.autoSyncToServerSettings();
      
    } catch (error) {
      console.error('❌ Error saving Keychain Percentage:', error);
      throw error;
    }
  }

  /**
   * Update enabled keychains list
   * @param {Array<string>} enabledKeychains - Array of enabled keychain names
   */
  async updateEnabledKeychains(enabledKeychains) {
    console.log(`🔧 Updating Enabled Keychains: ${enabledKeychains.length} keychains`);
    
    this.keychainFilter.enabledKeychains = new Set(enabledKeychains);
    
    try {
      await Promise.all([
        chrome.storage.local.set({ enabledKeychains: enabledKeychains }),
        chrome.storage.sync.set({ enabledKeychains: enabledKeychains })
          .catch(e => console.warn('Sync storage failed:', e.message))
      ]);
      
      console.log(`✅ Enabled Keychains saved: ${enabledKeychains.length} keychains`);
      
      await this.autoSyncToServerSettings();
      
    } catch (error) {
      console.error('❌ Error saving Enabled Keychains:', error);
      throw error;
    }
  }

  /**
 * Update item target list
 * @param {Array<Object>} itemTargetList 
 */
async updateItemTargetList(itemTargetList) {
  console.log(`🔧 Updating Item Target List: ${itemTargetList.length} items`);
  
  this.itemTargetList = itemTargetList;
  
  try {
    // Only use local storage for large item lists
    await chrome.storage.local.set({ itemTargetList: itemTargetList });
    
    console.log(`✅ Item Target List saved to local storage: ${itemTargetList.length} items`);
    
    await this.autoSyncToServerSettings();
    
  } catch (error) {
    console.error('❌ Error saving Item Target List:', error);
    throw error;
  }
}

  /**
   * Auto-sync all settings to server-settings.json
   */
  async autoSyncToServerSettings() {
    try {
      console.log('📤 Auto-syncing current settings to server-settings.json...');
      
      const exportResult = await this.exportSettingsToJson();
      
      if (exportResult.success) {
        await chrome.storage.local.set({
          'pending_server_settings_update': exportResult.data,
          'last_settings_export': Date.now()
        });
        
        console.log('✅ Settings saved for next auto-sync');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Auto-sync to server settings failed:', error);
      return false;
    }
  }

  /**
   * Export settings to JSON format
   * @returns {Promise<Object>} Export result
   */
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
          },
          percentDiffFilter: {
            enabled: item.percentDiffFilter?.enabled || false,
            min: item.percentDiffFilter?.min || null,
            max: item.percentDiffFilter?.max || null
          },
          priceFilter: {
            enabled: item.priceFilter?.enabled || false,
            min: item.priceFilter?.min || null,
            max: item.priceFilter?.max || null
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

  /**
   * ========================================================================
   * THEME AND STATE MANAGEMENT
   * ========================================================================
   */

  /**
   * Set theme and notify content scripts
   * @param {string} themeName - Theme name
   */
  async setTheme(themeName) {
    console.log(`🎨 Background setting theme to: ${themeName}`);
    
    this.currentTheme = themeName;
    
    try {
      await chrome.storage.sync.set({ selectedTheme: themeName });
      console.log(`✅ Theme "${themeName}" saved to storage by background`);
      
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

  /**
   * Set site theming state
   * @param {boolean} enabled - Whether site theming is enabled
   */
  async setSiteThemingState(enabled) {
    console.log(`🎨 Background setting site theming to: ${enabled ? 'enabled' : 'disabled'}`);
    
    this.isSiteThemingEnabled = enabled;
    
    try {
      await chrome.storage.sync.set({ siteThemingEnabled: enabled });
      console.log(`✅ Site theming "${enabled}" saved to storage by background`);
      
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

  /**
   * Set monitoring state
   * @param {boolean} enabled - Whether monitoring is enabled
   */
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

  /**
   * Sound state
   * @param {boolean} enabled - Whether sound is enabled
   */
  setSoundState(enabled) {
    this.isSoundEnabled = enabled;
    console.log('🔊 Sound state:', enabled ? 'enabled' : 'disabled');
    
    chrome.storage.sync.set({ soundEnabled: enabled });
    this.sendToContentScript('SOUND_STATE_CHANGED', { enabled });
  }

  /**
   * ========================================================================
   * COMMUNICATION WITH CONTENT SCRIPTS
   * ========================================================================
   */

  /**
   * Send message to content scripts
   * @param {string} type 
   * @param {Object} data 
   * @returns {Promise<boolean>} 
   */
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

  /**
   * ========================================================================
   * BADGE AND UI UPDATES
   * ========================================================================
   */

  /**
   * Update extension badge based on current state
   */
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

  /**
   * ========================================================================
   * TESTING AND DEBUGGING
   * ========================================================================
   */

  /**
   * Send test notification for debugging
   * @returns {Promise<Object>}
   */
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

  /**
   * Stats for debugging
   * @returns {Object}
   */
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

/**
 * ============================================================================
 * MESSAGE LISTENER AND EVENT HANDLERS
 * ============================================================================
 */

/**
 * Chrome runtime message listener with comprehensive command handling
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const manager = getManager();
  
  // Handle different message types
  switch (message.type) {
    case 'GET_STATS':
      sendResponse(manager.getStats());
      break;
      
    case 'SET_API_KEY':
      handleAsyncMessage(async () => {
        await manager.saveAPIKey(message.data.apiKey, message.data.domain);
        if (manager.isMonitoringEnabled) {
          await manager.connectToCSGOEmpire();
        }
      }, sendResponse);
      return true;
      
    case 'SET_MONITORING_STATE':
      manager.setMonitoringState(message.data.enabled);
      sendResponse({success: true});
      break;
      
    case 'SET_SOUND_STATE':
      manager.setSoundState(message.data.enabled);
      sendResponse({success: true});
      break;
      
    case 'THEME_CHANGED':
      manager.setTheme(message.data.theme);
      sendResponse({success: true});
      break;
      
    case 'SET_SITE_THEMING_STATE':
      manager.setSiteThemingState(message.data.enabled);
      sendResponse({success: true});
      break;
      
    case 'CONNECT':
      handleAsyncMessage(async () => {
        if (manager.apiKey && manager.isMonitoringEnabled) {
          await manager.connectToCSGOEmpire();
        } else {
          throw new Error('No API key configured or monitoring disabled');
        }
      }, sendResponse);
      return true;
      
    case 'DISCONNECT':
      manager.disconnect();
      sendResponse({ success: true });
      break;
      
    case 'UPDATE_PRICE_FILTER':
      handleAsyncMessage(async () => {
        await manager.updatePriceFilter(message.data.minPercentage, message.data.maxPercentage);
        return { message: 'Price filter updated successfully!' };
      }, sendResponse);
      return true;
      
    case 'UPDATE_KEYCHAIN_PERCENTAGE':
      handleAsyncMessage(async () => {
        await manager.updateKeychainPercentage(message.data.percentageThreshold);
        return { message: 'Keychain percentage updated successfully!' };
      }, sendResponse);
      return true;
      
    case 'UPDATE_ENABLED_KEYCHAINS':
      handleAsyncMessage(async () => {
        await manager.updateEnabledKeychains(message.data.enabledKeychains);
        return { message: 'Enabled keychains updated successfully!' };
      }, sendResponse);
      return true;
      
    case 'UPDATE_ITEM_TARGET_LIST':
      handleAsyncMessage(async () => {
        await manager.updateItemTargetList(message.data.itemTargetList);
        return { message: 'Item target list updated successfully!' };
      }, sendResponse);
      return true;
      
    case 'GET_KEYCHAIN_FILTER_SETTINGS':
      sendResponse(getKeychainFilterSettings(manager));
      break;
      
    case 'TEST_NOTIFICATION':
      handleAsyncMessage(() => manager.testNotification(), sendResponse);
      return true;
      
    case 'REQUEST_NOTIFICATION_PERMISSION':
      handleNotificationPermission(sendResponse);
      return true;
      
    case 'FETCH_TRADEIT_DATA':
      handleAsyncMessage(async () => {
        const priceData = await manager.fetchPriceData();
        return { data: priceData };
      }, sendResponse);
      return true;
      
    case 'PLAY_NOTIFICATION_SOUND':
      console.log('🔊 Playing notification sound from offscreen');
      sendResponse({success: true});
      break;
      
    case 'EXPORT_JSON_SETTINGS':
      handleAsyncMessage(() => manager.exportSettingsToJson(), sendResponse);
      return true;
      
    default:
      console.warn(`Unknown message type: ${message.type}`);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
  
  return true;
});

/**
 * Handle async message operations
 * @param {Function} asyncOperation - Async operation to execute
 * @param {Function} sendResponse - Response callback
 */
async function handleAsyncMessage(asyncOperation, sendResponse) {
  try {
    const result = await asyncOperation();
    sendResponse({ success: true, ...result });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Get keychain filter settings
 * @param {ExtensionManager} manager - Manager instance
 * @returns {Object} Keychain filter settings
 */
function getKeychainFilterSettings(manager) {
  const allKeychains = manager.getAllKeychainNames();
  const enabledKeychainsArray = Array.from(manager.keychainFilter.enabledKeychains);
  
  return {
    success: true,
    data: {
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
    }
  };
}

/**
 * Handle notification permission requests
 * @param {Function} sendResponse 
 */
function handleNotificationPermission(sendResponse) {
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
}

/**
 * ============================================================================
 * GLOBAL INSTANCE MANAGEMENT
 * ============================================================================
 */

let extensionManager;

/**
 * Get or create the global ExtensionManager instance
 * @returns {ExtensionManager} Manager instance
 */
function getManager() {
  if (!extensionManager) {
    console.log('Creating new ExtensionManager instance...');
    extensionManager = new ExtensionManager();
  }
  return extensionManager;
}

/**
 * ============================================================================
 * INITIALIZATION
 * ============================================================================
 */

// Initialize the extension
console.log('🚀 Starting Empire Enhanced with AUTOMATIC JSON Sync and Buff163 Price Filtering...');
getManager();

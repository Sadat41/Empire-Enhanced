// background.js 

class ExtensionManager {
  constructor() {
    this.httpUrl = 'http://localhost:3001';
    this.isMonitoringEnabled = true;
    this.isSoundEnabled = true;
    this.currentTheme = 'nebula';
    this.isSiteThemingEnabled = true;
    this.stats = {
      keychainsFound: 0,
      lastConnection: null,
      serverConnected: false,
      startTime: Date.now() 
    };
    
    this.lastNotificationTimestamp = 0;
    this.notifiedItemIds = new Set();
    this.httpPollingInterval = null;
    this.httpPollingFrequency = 3000;
    this.lastSuccessfulPoll = 0;
    
    // Sync management
    this.lastSyncAttempt = 0;
    this.syncRetryInterval = null;
    this.isInitialSyncComplete = false;
    
    this.init();

    this.tradeitDataCache = null;
    this.tradeitCacheExpiry = 0;
    
    // backend now handles everything locally
    this.buffBackendUrl = 'http://localhost:5002/scrape-prices'; // Flask backend URL
    this.buffCacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  }

  async init() {
    console.log('♔ Empire Enhanced Extension initialized');
    
    // Load local settings first
    await this.loadSettings();
    
    
    await this.performInitialServerSync();
    
    // Set up storage sync
    chrome.storage.sync.set({
      serverUrl: this.httpUrl,
      notificationSound: this.isSoundEnabled,
      monitoringEnabled: this.isMonitoringEnabled,
      selectedTheme: this.currentTheme,
      siteThemingEnabled: this.isSiteThemingEnabled,
      lastNotification: 0
    });

    if (this.isMonitoringEnabled) {
      this.startHttpPolling();
      this.setupBackgroundPolling();
    }

    
    this.setupPeriodicSync();

    this.updateBadge();
  }

    async fetchTradeItDataWithFallback(itemName = null) {
    console.log('📡 Background: Fetching TradeIt.gg data with fallback logic...');
    
    let tradeitData = null;

    // 1. Try Tradeit.gg API (direct fetch)
    try {
      console.log('📡 Background: Attempting to fetch from TradeIt.gg...');
      const tradeitResponse = await fetch('https://api.tradeit.gg/items/730');
      if (tradeitResponse.ok) {
        tradeitData = await tradeitResponse.json();
        console.log(`✅ Background: Fetched ${tradeitData.length} items from TradeIt.gg`);
      } else {
        console.warn(`⚠️ TradeIt.gg API returned status: ${tradeitResponse.status}. Falling back.`);
      }
    } catch (error) {
      console.error('❌ Background: Error fetching from TradeIt.gg API:', error);
      console.log('🔄 Falling back to backend for Buff.163.com data.');
    }

    // Prepare combined data structure for the extension
    const combinedPrices = new Map();

    if (tradeitData) {
      tradeitData.forEach(item => {
        if (item.item && item.price) {
          combinedPrices.set(item.item.toLowerCase(), {
            source: 'tradeit.gg',
            price: item.price,
            timestamp: Date.now()
          });
        }
      });
    }

    // 2. Get Buff.163.com data from Flask backend (which manages local JSON file)
    const localBuffCacheKey = 'buffOverridesCache';
    const localBuffCache = await chrome.storage.local.get(localBuffCacheKey);
    let cachedBuffData = localBuffCache[localBuffCacheKey]?.data || {};
    let cachedBuffTimestamp = localBuffCache[localBuffCacheKey]?.timestamp || 0;

    const isBuffCacheStale = (Date.now() - cachedBuffTimestamp) > this.buffCacheExpiry;

    if (isBuffCacheStale) {
      console.log('🔄 Background: Buff.163.com cache is stale or missing. Fetching from backend...');
      try {
        // Get current data status from backend
        const statusResponse = await fetch('http://localhost:5002/data-status');
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log(`✅ Background: Backend has ${statusData.stats.total_items} items available.`);
          
          // For now, we'll trigger a scrape of common items or use existing data
          // The backend maintains its own local JSON file
          console.log(`✅ Background: Using backend-managed Buff.163.com data.`);
        } else {
          console.warn(`⚠️ Backend status check failed: ${statusResponse.status}.`);
        }
      } catch (error) {
        console.error('❌ Background: Error communicating with backend:', error);
      }
    } else {
      console.log(`✅ Background: Using cached Buff.163.com data (${Object.keys(cachedBuffData).length} items).`);
    }

    // Merge cached Buff data into combined prices, prioritizing TradeIt.gg
    for (const itemKey in cachedBuffData) {
      if (cachedBuffData.hasOwnProperty(itemKey)) {
        const buffItem = cachedBuffData[itemKey];
        if (!combinedPrices.has(itemKey.toLowerCase())) { // Simple merge: Buff as fallback
          combinedPrices.set(itemKey.toLowerCase(), {
            source: 'buff.163.com (Backend)',
            price: buffItem.usd_price,
            timestamp: buffItem.timestamp ? new Date(buffItem.timestamp).getTime() : Date.now()
          });
        }
      }
    }

    // 3. Request updated data from Flask backend if specific item is needed
    if (itemName && !combinedPrices.has(itemName.toLowerCase())) {
        console.log(`🔄 Background: Item '${itemName}' not found in TradeIt or cached data. Requesting scrape from Flask backend.`);
        try {
            const backendResponse = await fetch(this.buffBackendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item: itemName }) // Request specific item
            });

            if (backendResponse.ok) {
                const result = await backendResponse.json();
                if (result.status === "success" && result.data) {
                    console.log(`✅ Background: Scraped '${itemName}' from backend.`);
                    cachedBuffData[itemName] = {
                        usd_price: result.data.usd_price,
                        yuan_price: result.data.yuan_price,
                        timestamp: result.data.timestamp
                    };
                    await chrome.storage.local.set({
                        [localBuffCacheKey]: {
                            data: cachedBuffData,
                            timestamp: Date.now() // Update cache timestamp
                        }
                    });
                    combinedPrices.set(itemName.toLowerCase(), {
                        source: 'buff.163.com (Backend Scrape)',
                        price: result.data.usd_price,
                        timestamp: new Date(result.data.timestamp).getTime()
                    });
                } else {
                    console.warn(`⚠️ Backend scrape for '${itemName}' failed: ${result.message}`);
                }
            } else {
                console.error(`❌ Background: Flask backend request failed with status: ${backendResponse.status}`);
            }
        } catch (error) {
            console.error('❌ Background: Error communicating with Flask backend:', error);
        }
    }

    // Convert the Map back to an array for the content script
    const finalDataArray = Array.from(combinedPrices.values()).map((val, idx) => ({
      item: Array.from(combinedPrices.keys())[idx], // Reconstruct item name
      price: val.price,
      source: val.source,
      timestamp: val.timestamp
    }));

    return {
      success: true,
      data: finalDataArray
    };
  }
  // --- END OF fetchTradeItDataWithFallback METHOD ---


 
  async pollServerForNotifications() { /* ... */ }
  setupBackgroundPolling() { /* ... */ }


  async performInitialServerSync() {
    console.log('🔄 Performing initial server sync...');
    
    try {
      
      const healthResponse = await fetch(`${this.httpUrl}/health`, { 
        method: 'GET',
        timeout: 5000 
      });
      
      if (!healthResponse.ok) {
        throw new Error(`Server health check failed: ${healthResponse.status}`);
      }
      
      console.log('✅ Server is available, syncing data...');
      
      // Sync Item Target List from server
      await this.syncItemTargetListFromServer();
      
      // Sync other settings from server  
      await this.syncSettingsFromServer();
      
      this.isInitialSyncComplete = true;
      console.log('✅ Initial server sync completed successfully');
      
    } catch (error) {
      console.error('❌ Initial server sync failed:', error);
      console.log('⚠️ Using local settings, will retry sync in background');
      
      
      await this.loadItemTargetListFromLocal();
      
      
      this.setupSyncRetry();
    }
  }

  // Sync Item Target List FROM server TO extension
  async syncItemTargetListFromServer() {
    try {
      console.log('📥 Syncing Item Target List from server...');
      
      const response = await fetch(`${this.httpUrl}/item-target-list-settings`);
      if (!response.ok) {
        throw new Error(`Failed to fetch item target list: ${response.status}`);
      }
      
      const data = await response.json();
      const serverItemList = data.itemTargetList || [];
      
      console.log(`📥 Server has ${serverItemList.length} items in target list`);
      
      // Convert server format to extension format
      const convertedServerList = serverItemList.map(serverItem => {
        const extensionItem = {
          id: serverItem.id || Date.now().toString(),
          keyword: serverItem.name,
          name: serverItem.name,
          addedAt: Date.now()
        };
        
        // Properly convert float filter from server format
        if (serverItem.floatFilter && serverItem.floatFilter.enabled) {
          extensionItem.minFloat = serverItem.floatFilter.min;
          extensionItem.maxFloat = serverItem.floatFilter.max;
          console.log(`📏 Restored float range for "${serverItem.name}": ${serverItem.floatFilter.min} - ${serverItem.floatFilter.max}`);
        } else {
          // Default values for items without custom float ranges
          extensionItem.minFloat = 0.00;
          extensionItem.maxFloat = 1.00;
        }
        
        return extensionItem;
      });
      
      // Get current local list
      const localResult = await chrome.storage.local.get(['itemTargetList']);
      const localItemList = localResult.itemTargetList || [];
      
      console.log(`📱 Extension has ${localItemList.length} items in local storage`);
      
      // Merge strategy: Server is the source of truth, but preserve any local-only items
      const mergedList = this.mergeItemTargetLists(convertedServerList, localItemList);
      
      // Save merged list locally
      await chrome.storage.local.set({ itemTargetList: mergedList });
      
      console.log(`🔄 Merged and saved ${mergedList.length} items to local storage`);
      
      // If merged list is different from server, update server
      if (JSON.stringify(this.convertToServerFormat(mergedList)) !== JSON.stringify(serverItemList)) {
        console.log('📤 Syncing merged list back to server...');
        await this.syncItemTargetListToServer(mergedList);
      }
      
    } catch (error) {
      console.error('❌ Error syncing Item Target List from server:', error);
      throw error;
    }
  }

  
  mergeItemTargetLists(serverList, localList) {
    const merged = [...serverList];
    const serverIds = new Set(serverList.map(item => item.id));
    
    
    for (const localItem of localList) {
      if (!serverIds.has(localItem.id)) {
        console.log(`📱 Found local-only item: ${localItem.keyword || localItem.name}`);
        merged.push(localItem);
      }
    }
    
    return merged;
  }

  // Convert extension format to server format
  convertToServerFormat(extensionList) {
    return extensionList.map(item => ({
      id: item.id,
      name: item.keyword || item.name,
      floatFilter: {
        enabled: item.minFloat !== undefined && item.maxFloat !== undefined && 
                 (item.minFloat !== 0.00 || item.maxFloat !== 1.00),
        min: item.minFloat || 0.00,
        max: item.maxFloat || 1.00
      }
    }));
  }

 
  async syncItemTargetListToServer(itemTargetList) {
    try {
      console.log(`📤 Syncing ${itemTargetList.length} items to server...`);
      
      // Properly detect custom float ranges
      const serverFormatItems = itemTargetList.map(item => {
        const hasCustomFloat = item.minFloat !== undefined && item.maxFloat !== undefined &&
                              (item.minFloat !== 0.00 || item.maxFloat !== 1.00);
        
        console.log(`📏 Item "${item.keyword || item.name}": minFloat=${item.minFloat}, maxFloat=${item.maxFloat}, hasCustom=${hasCustomFloat}`);
        
        return {
          id: item.id,
          name: item.keyword || item.name,
          floatFilter: {
            enabled: hasCustomFloat,
            min: item.minFloat || 0.00,
            max: item.maxFloat || 1.00
          }
        };
      });
      
      const response = await fetch(`${this.httpUrl}/update-item-target-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemTargetList: serverFormatItems,
          floatFilterEnabled: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`✅ Successfully synced to server: ${result.message}`);
      
    } catch (error) {
      console.error('❌ Failed to sync item targets to server:', error);
      throw error;
    }
  }

  // Load Item Target List from local storage (fallback)
  async loadItemTargetListFromLocal() {
    try {
      const result = await chrome.storage.local.get(['itemTargetList']);
      const itemTargetList = result.itemTargetList || [];
      console.log(`📱 Loaded ${itemTargetList.length} items from local storage (fallback)`);
    } catch (error) {
      console.error('❌ Error loading Item Target List from local storage:', error);
    }
  }

  
  async syncSettingsFromServer() {
    try {
      console.log('📥 Syncing other settings from server...');
      
      // Get keychain filter settings
      const keychainResponse = await fetch(`${this.httpUrl}/keychain-filter-settings`);
      if (keychainResponse.ok) {
        const keychainData = await keychainResponse.json();
        
        // Store server keychain settings for popup to use
        await chrome.storage.local.set({
          serverKeychainSettings: {
            percentageThreshold: keychainData.percentageThreshold,
            enabledKeychains: keychainData.enabledKeychains,
            allKeychains: keychainData.allKeychains,
            lastSynced: Date.now()
          }
        });
        
        console.log(`📥 Synced keychain settings: ${keychainData.enabledKeychains?.length || 0} enabled keychains`);
      }
      
    } catch (error) {
      console.error('❌ Error syncing settings from server:', error);
    }
  }

  
  setupSyncRetry() {
    if (this.syncRetryInterval) {
      clearInterval(this.syncRetryInterval);
    }
    
    // Retry every 30 seconds until successful
    this.syncRetryInterval = setInterval(async () => {
      if (!this.isInitialSyncComplete) {
        console.log('🔄 Retrying server sync...');
        try {
          await this.performInitialServerSync();
          
          if (this.isInitialSyncComplete && this.syncRetryInterval) {
            clearInterval(this.syncRetryInterval);
            this.syncRetryInterval = null;
            console.log('✅ Sync retry successful, stopping retry mechanism');
          }
        } catch (error) {
          console.error('❌ Sync retry failed:', error);
        }
      }
    }, 30000); // Retry every 30 seconds
  }

 
  setupPeriodicSync() {
    // Sync every 5 minutes to ensure consistency
    setInterval(async () => {
      if (this.isInitialSyncComplete) {
        try {
          await this.syncItemTargetListFromServer();
        } catch (error) {
          console.error('❌ Periodic sync failed:', error);
        }
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

 
  async loadAndSyncItemTargetList() {
    try {
      if (!this.isInitialSyncComplete) {
        console.log('⏳ Initial sync not complete, attempting now...');
        await this.performInitialServerSync();
        return;
      }
      
      const result = await chrome.storage.local.get(['itemTargetList']);
      const itemTargetList = result.itemTargetList || [];
      
      if (itemTargetList.length > 0) {
        console.log(`📋 Syncing ${itemTargetList.length} item targets to server`);
        await this.syncItemTargetListToServer(itemTargetList);
      }
      
    } catch (error) {
      console.error('❌ Error in loadAndSyncItemTargetList:', error);
    }
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.sync.get({
        monitoringEnabled: true,
        soundEnabled: true,
        selectedTheme: 'nebula',
        siteThemingEnabled: true,
        lastNotificationTimestamp: 0
      });
      
      this.isMonitoringEnabled = settings.monitoringEnabled;
      this.isSoundEnabled = settings.soundEnabled;
      this.currentTheme = settings.selectedTheme;
      this.isSiteThemingEnabled = settings.siteThemingEnabled;
      this.lastNotificationTimestamp = settings.lastNotificationTimestamp || 0;
      
      console.log('Settings loaded:', { 
        monitoring: this.isMonitoringEnabled, 
        sound: this.isSoundEnabled,
        theme: this.currentTheme,
        siteTheming: this.isSiteThemingEnabled
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  // Theme management
  async setTheme(themeName) {
    console.log(`🎨 Background setting theme to: ${themeName}`);
    
    this.currentTheme = themeName;
    
    try {
      await chrome.storage.sync.set({ selectedTheme: themeName });
      console.log(`✅ Theme "${themeName}" saved to storage by background`);
      
      // Notify all content scripts about theme change, including site theming state
      const success = await this.sendToContentScript('THEME_CHANGED', { 
        theme: themeName,
        siteThemingEnabled: this.isSiteThemingEnabled 
      });
      
      if (success) {
        console.log(`📤 Theme change notification sent to content scripts`);
      } else {
        console.log(`⚠️ No content scripts received theme change notification`);
      }
      
    } catch (error) {
      console.error('Error saving theme in background:', error);
    }
  }

  // Site theming management
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
      } else {
        console.log(`⚠️ No content scripts received site theming change notification`);
      }
      
    } catch (error) {
      console.error('Error saving site theming state in background:', error);
    }
  }

  setMonitoringState(enabled) {
    this.isMonitoringEnabled = enabled;
    
    if (enabled) {
      console.log('🔍 Monitoring enabled');
      this.startHttpPolling();
      this.setupBackgroundPolling();
    } else {
      console.log('🚫 Monitoring disabled');
      this.stopHttpPolling();
      this.stats.serverConnected = false;
      chrome.alarms.clear('pollNotifications');
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

  startHttpPolling() {
    console.log('🔄 Starting HTTP polling (primary method)');
    
    if (this.httpPollingInterval) {
      clearInterval(this.httpPollingInterval);
    }
    
    this.pollServerForNotifications();
    
    this.httpPollingInterval = setInterval(() => {
      if (this.isMonitoringEnabled) {
        this.pollServerForNotifications();
      }
    }, this.httpPollingFrequency);
  }

  stopHttpPolling() {
    console.log('🛑 Stopping HTTP polling');
    if (this.httpPollingInterval) {
      clearInterval(this.httpPollingInterval);
      this.httpPollingInterval = null;
    }
  }

  async pollServerForNotifications() {
    if (!this.isMonitoringEnabled) return;
    
    try {
      console.log('📡 HTTP polling for notifications...');
      
      const response = await fetch(`${this.httpUrl}/history`);
      if (!response.ok) {
        console.log(`❌ HTTP poll failed: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      const notifications = data.items || [];
      
      console.log(`📦 HTTP poll found ${notifications.length} recent notifications`);
      
      this.lastSuccessfulPoll = Date.now();
      this.stats.serverConnected = true;
      
      let newNotificationsCount = 0;
      
      for (const item of notifications) {
        const itemKey = `${item.id}_${item.timestamp}`;
        
        if (!this.notifiedItemIds.has(itemKey) && 
            item.timestamp > this.lastNotificationTimestamp) {
          
          console.log('🔔 NEW notification found via HTTP polling:', item.market_name);
          
          this.notifiedItemIds.add(itemKey);
          this.lastNotificationTimestamp = Math.max(this.lastNotificationTimestamp, item.timestamp);
          
          await this.handleNotificationFound(item);
          newNotificationsCount++;
        }
      }
      
      if (newNotificationsCount > 0) {
        console.log(`✅ Processed ${newNotificationsCount} new notifications via HTTP`);
      }
      
      if (this.notifiedItemIds.size > 1000) {
        const idsArray = Array.from(this.notifiedItemIds);
        this.notifiedItemIds = new Set(idsArray.slice(-500));
      }
      
      this.updateBadge();
      
    } catch (error) {
      console.error('❌ HTTP polling error:', error);
      this.stats.serverConnected = false;
      this.updateBadge();
    }
  }

  setupBackgroundPolling() {
    chrome.alarms.clear('pollNotifications');
    chrome.alarms.create('pollNotifications', {
      periodInMinutes: 1
    });
    console.log('⏰ Chrome alarms backup polling setup');
  }

  // Handle both keychain and item target notifications
  async handleNotificationFound(itemData) {
    if (!this.isMonitoringEnabled) {
      console.log('🚫 Notification found but monitoring is disabled - ignoring');
      return;
    }

    console.log('🔔 Processing notification:', itemData);
    
    const settings = await chrome.storage.sync.get(['notificationSound', 'lastNotification']);
    
    const now = Date.now();
    if (now - (settings.lastNotification || 0) < 2000) {
      console.log('🚫 Notification throttled');
      return;
    }
    
    chrome.storage.sync.set({
      lastNotification: now,
      lastNotificationTimestamp: itemData.timestamp || now
    });
    
    // Update stats based on notification type
    if (itemData.notification_type === 'target_item') {
      this.stats.itemsFound = (this.stats.itemsFound || 0) + 1;
    } else {
      this.stats.keychainsFound++;
    }
    
    this.storeNotificationHistory(itemData);
    
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

  // Legacy method for backward compatibility
  async handleKeychainFound(itemData) {
    return this.handleNotificationFound(itemData);
  }

  async showBackgroundNotification(itemData) {
    const isTargetItem = itemData.notification_type === 'target_item';
    
    let displayInfo = '';
    if (isTargetItem) {
      const targetKeyword = itemData.target_item_matched?.name || itemData.matched_keyword || 'Unknown';
      displayInfo = `🎯 Target: ${targetKeyword}`;
    } else {
      const keychainNames = itemData.keychains ? 
        (Array.isArray(itemData.keychains) ? itemData.keychains.join(', ') : itemData.keychains) : 
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
            this.playAlternativeSound();
          }
        }
      });
    } catch (error) {
      console.log('🔊 TTS not available, trying alternative');
      this.playAlternativeSound();
    }
  }

  playAlternativeSound() {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsF');
      audio.volume = 0.1;
      audio.play().catch(() => {
        console.log('🔊 All sound methods failed - notifications will be silent');
      });
    } catch (error) {
      console.log('🔊 All sound methods failed - notifications will be silent');
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
      chrome.action.setTitle({title: 'Keychain Monitor - Disabled'});
    } else if (this.stats.serverConnected || (Date.now() - this.lastSuccessfulPoll < 10000)) {
      const totalFound = this.stats.keychainsFound + (this.stats.itemsFound || 0);
      chrome.action.setBadgeText({text: totalFound > 0 ? totalFound.toString() : '●'});
      chrome.action.setBadgeBackgroundColor({color: '#00ff00'});
      chrome.action.setTitle({title: 'Enhanced Monitor - Server Connected'});
    } else {
      chrome.action.setBadgeText({text: '○'});
      chrome.action.setBadgeBackgroundColor({color: '#ff0000'});
      chrome.action.setTitle({title: 'Enhanced Monitor - Server Disconnected'});
    }
  }
}

// Chrome alarms listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pollNotifications') {
    console.log('⏰ Chrome alarm fired (backup polling)');
    if (extensionManager) {
      extensionManager.pollServerForNotifications();
    }
  }
});

// Notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  const result = await chrome.storage.local.get(`notification_${notificationId}`);
  const notificationData = result[`notification_${notificationId}`];
  
  if (buttonIndex === 0) {
    if (notificationData && notificationData.itemId) {
      chrome.tabs.create({url: `https://csgoempire.com/item/${notificationData.itemId}`});
    } else {
      chrome.tabs.create({url: 'https://csgoempire.com/trade'});
    }
  } else if (buttonIndex === 1) {
    chrome.tabs.create({url: chrome.runtime.getURL('history.html')});
  }
  
  chrome.notifications.clear(notificationId);
  chrome.storage.local.remove(`notification_${notificationId}`);
});

chrome.notifications.onClosed.addListener((notificationId) => {
  chrome.storage.local.remove(`notification_${notificationId}`);
});

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATS') {
    sendResponse({
      stats: extensionManager.stats,
      connected: extensionManager.stats.serverConnected || (Date.now() - extensionManager.lastSuccessfulPoll < 10000),
      monitoringEnabled: extensionManager.isMonitoringEnabled,
      soundEnabled: extensionManager.isSoundEnabled,
      currentTheme: extensionManager.currentTheme,
      siteThemingEnabled: extensionManager.isSiteThemingEnabled,
      syncStatus: {
        isInitialSyncComplete: extensionManager.isInitialSyncComplete,
        lastSyncAttempt: extensionManager.lastSyncAttempt
      }
    });
  } else if (message.type === 'SET_MONITORING_STATE') {
    extensionManager.setMonitoringState(message.data.enabled);
    sendResponse({success: true});
  } else if (message.type === 'SET_SOUND_STATE') {
    extensionManager.setSoundState(message.data.enabled);
    sendResponse({success: true});
  } else if (message.type === 'THEME_CHANGED') {
    extensionManager.setTheme(message.data.theme);
    sendResponse({success: true});
  } else if (message.type === 'SET_SITE_THEMING_STATE') {
    extensionManager.setSiteThemingState(message.data.enabled);
    sendResponse({success: true});
  } else if (message.type === 'TEST_CONNECTION') {
    if (extensionManager.isMonitoringEnabled) {
      extensionManager.connectToServer();
    }
    sendResponse({success: true});
  } else if (message.type === 'UPDATE_ITEM_TARGET_LIST') {
    
    (async () => {
      try {
        // Get current server state first
        await extensionManager.syncItemTargetListFromServer();
        
        // Get current local list
        const result = await chrome.storage.local.get(['itemTargetList']);
        let currentList = result.itemTargetList || [];
        
        
        const newList = message.data.itemTargetList;
        
        // Ensure float values are preserved
        const processedNewList = newList.map(item => {
          console.log(`📏 Processing item "${item.keyword || item.name}": minFloat=${item.minFloat}, maxFloat=${item.maxFloat}`);
          
          return {
            ...item,
            minFloat: item.minFloat !== undefined ? item.minFloat : 0.00,
            maxFloat: item.maxFloat !== undefined ? item.maxFloat : 1.00,
            hasCustomFloat: item.hasCustomFloat !== undefined ? item.hasCustomFloat : 
                           (item.minFloat !== 0.00 || item.maxFloat !== 1.00)
          };
        });
        
        
        let finalList;
        if (processedNewList.length === 1 && currentList.length > 0) {
          
          const newItem = processedNewList[0];
          const exists = currentList.some(item => 
            item.id === newItem.id || 
            (item.keyword || item.name) === (newItem.keyword || newItem.name)
          );
          
          if (!exists) {
            finalList = [...currentList, newItem];
            console.log(`📝 Appending new item: ${newItem.keyword || newItem.name} with float range ${newItem.minFloat}-${newItem.maxFloat}`);
          } else {
            finalList = processedNewList; // Replace if it already exists
            console.log(`📝 Replacing existing item: ${newItem.keyword || newItem.name}`);
          }
        } else {
          // Full list replacement
          finalList = processedNewList;
          console.log(`📝 Full list replacement: ${processedNewList.length} items`);
        }
        
        // Save to local storage
        await chrome.storage.local.set({ itemTargetList: finalList });
        
        // Sync to server
        await extensionManager.syncItemTargetListToServer(finalList);
        
        sendResponse({
          success: true,
          message: `Item Target List updated: ${finalList.length} items`
        });
      } catch (error) {
        console.error('❌ Error updating item target list:', error);
        sendResponse({
          success: false,
          error: 'Failed to update item target list'
        });
      }
    })();
    return true; // Keep message channel open for async response
  } else if (message.type === 'GET_KEYCHAIN_FILTER_SETTINGS') {
    // Get keychain filter settings from server with local fallback
    (async () => {
      try {
        // Try to get from server first
        const response = await fetch('http://localhost:3001/keychain-filter-settings');
        if (response.ok) {
          const data = await response.json();
          sendResponse({
            success: true,
            data: data
          });
        } else {
          throw new Error('Server request failed');
        }
      } catch (error) {
        // Fallback to local storage
        try {
          const result = await chrome.storage.local.get(['serverKeychainSettings']);
          if (result.serverKeychainSettings) {
            sendResponse({
              success: true,
              data: result.serverKeychainSettings
            });
          } else {
            throw new Error('No local data available');
          }
        } catch (localError) {
          sendResponse({
            success: false,
            error: 'Failed to load keychain filter settings from server and local storage'
          });
        }
      }
    })();
    return true;
  } else if (message.type === 'UPDATE_KEYCHAIN_PERCENTAGE') {
    // Update keychain percentage threshold
    fetch('http://localhost:3001/update-keychain-percentage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        percentageThreshold: message.data.percentageThreshold
      })
    })
      .then(response => response.json())
      .then(data => {
        sendResponse({
          success: true,
          message: data.message
        });
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: 'Failed to update keychain percentage threshold'
        });
      });
    return true;
  } else if (message.type === 'UPDATE_ENABLED_KEYCHAINS') {
    // Update enabled keychains list
    fetch('http://localhost:3001/update-enabled-keychains', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        enabledKeychains: message.data.enabledKeychains
      })
    })
      .then(response => response.json())
      .then(data => {
        sendResponse({
          success: true,
          message: data.message
        });
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: 'Failed to update enabled keychains'
        });
      });
    return true;
  } else if (message.type === 'TEST_SERVER_CONNECTION') {
    fetch('http://localhost:3001/health')
      .then(response => response.json())
      .then(data => {
        sendResponse({
          success: true,
          data: {
            ...data,
            csgoConnected: data.connected || false
          }
        });
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: 'Cannot connect to server on port 3001. Make sure the Node.js server is running.'
        });
      });
    return true;
  } else if (message.type === 'TEST_NOTIFICATION') {
    if (!extensionManager.isMonitoringEnabled) {
      sendResponse({
        success: false,
        error: 'Monitoring is disabled'
      });
      return;
    }
    
    fetch('http://localhost:3001/test', { method: 'POST' })
      .then(response => response.json())
      .then(data => {
        sendResponse({
          success: true,
          message: data.message
        });
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: 'Failed to send test notification to server'
        });
      });
    return true;
  } else if (message.type === 'REQUEST_NOTIFICATION_PERMISSION') {
    chrome.notifications.getPermissionLevel((level) => {
      console.log('Current notification permission level:', level);
      
      if (level === 'granted') {
        chrome.notifications.create('permission_test_' + Date.now(), {
          type: 'basic',
          title: '♔ Empire Enhanced',
          message: 'Notifications are now enabled and working perfectly.',
          priority: 1
        }, (testId) => {
          if (chrome.runtime.lastError) {
            console.error('Test notification failed:', chrome.runtime.lastError);
            sendResponse({ granted: false, error: chrome.runtime.lastError.message });
          } else {
            console.log('Test notification created successfully');
            sendResponse({ granted: true });
            
            setTimeout(() => {
              chrome.notifications.clear(testId);
            }, 3000);
          }
        });
      } else {
        sendResponse({ 
          granted: false, 
          error: 'Please enable notifications in Chrome settings. Go to Settings > Privacy and Security > Site Settings > Notifications and allow this extension.' 
        });
      }
    });
    return true;
  } else if (message.type === 'UPDATE_PRICE_FILTER') {
    fetch('http://localhost:3001/update-filter', { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        minPercentage: message.data.minPercentage,
        maxPercentage: message.data.maxPercentage
      })
    })
      .then(response => response.json())
      .then(data => {
        sendResponse({
          success: true,
          message: data.message
        });
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: 'Failed to update server filter settings'
        });
      });
    return true;
  } else if (message.type === 'PLAY_NOTIFICATION_SOUND') {
    console.log('🔊 Playing notification sound from offscreen');
    sendResponse({success: true});
  } else if (message.type === 'FORCE_SYNC') {
    // Force sync with server
    (async () => {
      try {
        await extensionManager.performInitialServerSync();
        sendResponse({
          success: true,
          message: 'Sync completed successfully'
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    return true;


} else if (message.type === 'FETCH_TRADEIT_DATA') {
  // Pass the item name if available in the message for targeted scraping
  (async () => {
    const response = await extensionManager.fetchTradeItDataWithFallback(message.data?.itemName);
    sendResponse(response);
  })();
  return true; // Keep message channel open for async response
}
  return true;
});


// Extension lifecycle events
chrome.runtime.onStartup.addListener(() => {
  console.log('🚀 Extension starting up...');
  new ExtensionManager();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('🔧 Extension installed/updated');
  new ExtensionManager();
});

// Global instance
let extensionManager = new ExtensionManager();


(async function initModuleSystem() {
  try {
    // Load core framework
    await import('./core/event-bus.js');
    await import('./core/module-loader.js'); 
    await import('./core/base-module.js');
    
    // Set context and auto-load modules
    window.empireModuleLoader.setContext('background');
    await window.empireModuleLoader.autoLoadModules();
    
    console.log('🎉 Empire Enhanced: Module system ready for infinite scalability!');
  } catch (error) {
    console.log('⚠️ Module system not ready yet (this is normal during initial setup)');
  }
})();

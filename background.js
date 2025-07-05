// Background service worker for the keychain monitor extension
// 🔥 FIX: Use HTTP polling as PRIMARY method, WebSocket as secondary

class ExtensionManager {
  constructor() {
    this.httpUrl = 'http://localhost:3001';
    // Removed WebSocket client connection - HTTP polling only!
    this.isMonitoringEnabled = true;
    this.isSoundEnabled = true;
    this.currentTheme = 'nebula'; // Default theme
    this.stats = {
      keychainsFound: 0,
      lastConnection: null,
      serverConnected: false
    };
    
    // Track last notification timestamp to avoid duplicates
    this.lastNotificationTimestamp = 0;
    this.notifiedItemIds = new Set();
    
    // 🔥 HTTP polling configuration - MORE AGGRESSIVE
    this.httpPollingInterval = null;
    this.httpPollingFrequency = 3000; // Poll every 3 seconds
    this.lastSuccessfulPoll = 0;
    
    this.init();
  }

  async init() {
    console.log('♔ Empire Enhanced Extension initialized');
    
    // Load settings including theme
    await this.loadSettings();
    
    // Set default settings
    chrome.storage.sync.set({
      serverUrl: this.serverUrl,
      notificationSound: this.isSoundEnabled,
      monitoringEnabled: this.isMonitoringEnabled,
      selectedTheme: this.currentTheme,
      lastNotification: 0
    });

    if (this.isMonitoringEnabled) {
      // 🔥 HTTP polling as PRIMARY method - no WebSocket client needed!
      this.startHttpPolling();
      
      // Setup Chrome alarms as backup
      this.setupBackgroundPolling();
    }

    this.updateBadge();
  }

  // 🔥 NEW: HTTP polling as primary notification method
  startHttpPolling() {
    console.log('🔄 Starting HTTP polling (primary method)');
    
    // Clear any existing interval
    if (this.httpPollingInterval) {
      clearInterval(this.httpPollingInterval);
    }
    
    // Start immediate poll
    this.pollServerForNotifications();
    
    // Set up regular polling
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

  // 🔥 IMPROVED: More robust HTTP polling
  async pollServerForNotifications() {
    if (!this.isMonitoringEnabled) return;
    
    try {
      console.log('📡 HTTP polling for notifications...');
      
      // Fetch recent notifications from server
      const response = await fetch(`${this.httpUrl}/history`);
      if (!response.ok) {
        console.log(`❌ HTTP poll failed: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      const notifications = data.items || [];
      
      console.log(`📦 HTTP poll found ${notifications.length} recent notifications`);
      
      // Track successful poll
      this.lastSuccessfulPoll = Date.now();
      this.stats.serverConnected = true;
      
      // Process new notifications that we haven't seen
      let newNotificationsCount = 0;
      
      for (const item of notifications) {
        // Use both ID and timestamp to avoid duplicates
        const itemKey = `${item.id}_${item.timestamp}`;
        
        if (!this.notifiedItemIds.has(itemKey) && 
            item.timestamp > this.lastNotificationTimestamp) {
          
          console.log('🔔 NEW notification found via HTTP polling:', item.market_name);
          
          // Mark as notified
          this.notifiedItemIds.add(itemKey);
          this.lastNotificationTimestamp = Math.max(this.lastNotificationTimestamp, item.timestamp);
          
          // Trigger notification
          await this.handleKeychainFound(item);
          newNotificationsCount++;
        }
      }
      
      if (newNotificationsCount > 0) {
        console.log(`✅ Processed ${newNotificationsCount} new notifications via HTTP`);
      }
      
      // Clean up old IDs to prevent memory leak
      if (this.notifiedItemIds.size > 1000) {
        const idsArray = Array.from(this.notifiedItemIds);
        this.notifiedItemIds = new Set(idsArray.slice(-500));
      }
      
      // Update connection status
      this.updateBadge();
      
    } catch (error) {
      console.error('❌ HTTP polling error:', error);
      this.stats.serverConnected = false;
      this.updateBadge();
    }
  }

  // Setup background polling using Chrome alarms (tertiary backup)
  setupBackgroundPolling() {
    // Clear any existing alarm
    chrome.alarms.clear('pollNotifications');
    
    // Create an alarm that fires every minute (Chrome minimum for production)
    chrome.alarms.create('pollNotifications', {
      periodInMinutes: 1 // Every minute as backup to HTTP polling
    });
    
    console.log('⏰ Chrome alarms backup polling setup');
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.sync.get({
        monitoringEnabled: true,
        soundEnabled: true,
        selectedTheme: 'nebula',
        lastNotificationTimestamp: 0
      });
      
      this.isMonitoringEnabled = settings.monitoringEnabled;
      this.isSoundEnabled = settings.soundEnabled;
      this.currentTheme = settings.selectedTheme;
      this.lastNotificationTimestamp = settings.lastNotificationTimestamp || 0;
      
      console.log('Settings loaded:', { 
        monitoring: this.isMonitoringEnabled, 
        sound: this.isSoundEnabled,
        theme: this.currentTheme
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  setMonitoringState(enabled) {
    this.isMonitoringEnabled = enabled;
    
    if (enabled) {
      console.log('🔍 Monitoring enabled');
      this.startHttpPolling(); // HTTP polling only
      this.setupBackgroundPolling(); // Chrome alarms backup
    } else {
      console.log('🚫 Monitoring disabled');
      this.stopHttpPolling(); // Stop HTTP polling
      this.stats.serverConnected = false;
      chrome.alarms.clear('pollNotifications');
    }
    
    this.updateBadge();
    
    // Save to storage
    chrome.storage.sync.set({ monitoringEnabled: enabled });
    
    // Notify content scripts
    this.sendToContentScript('MONITORING_STATE_CHANGED', { enabled });
  }

  setSoundState(enabled) {
    this.isSoundEnabled = enabled;
    console.log('🔊 Sound state:', enabled ? 'enabled' : 'disabled');
    
    // Save to storage
    chrome.storage.sync.set({ soundEnabled: enabled });
    
    // Notify content scripts
    this.sendToContentScript('SOUND_STATE_CHANGED', { enabled });
  }

  // 🎨 NEW: Theme management
  async setTheme(themeName) {
    console.log(`🎨 Background setting theme to: ${themeName}`);
    
    this.currentTheme = themeName;
    
    // Save to storage
    try {
      await chrome.storage.sync.set({ selectedTheme: themeName });
      console.log(`✅ Theme "${themeName}" saved to storage by background`);
      
      // Notify all content scripts about theme change
      this.sendToContentScript('THEME_CHANGED', { theme: themeName });
      
    } catch (error) {
      console.error('Error saving theme in background:', error);
    }
  }

  formatPrice(priceValue) {
    if (!priceValue || priceValue <= 0) {
      return 'Unknown';
    }
    
    // If the price is less than 10, it's probably already in dollars
    // If it's greater than 1000, it's probably in cents
    if (priceValue < 10) {
      return priceValue.toFixed(2);
    } else if (priceValue > 1000) {
      return (priceValue / 100).toFixed(2);
    } else {
      // Ambiguous range - check if it has decimals
      if (priceValue % 1 === 0) {
        // Whole number, probably cents
        return (priceValue / 100).toFixed(2);
      } else {
        // Has decimals, probably dollars
        return priceValue.toFixed(2);
      }
    }
  }

  async handleKeychainFound(itemData) {
    if (!this.isMonitoringEnabled) {
      console.log('🚫 Keychain found but monitoring is disabled - ignoring');
      return;
    }

    console.log('🔑 Processing keychain notification:', itemData);
    
    const settings = await chrome.storage.sync.get(['notificationSound', 'lastNotification']);
    
    // Prevent spam notifications (minimum 2 seconds between notifications)
    const now = Date.now();
    if (now - (settings.lastNotification || 0) < 2000) {
      console.log('🚫 Notification throttled');
      return;
    }
    
    // Update last notification time and stats
    chrome.storage.sync.set({
      lastNotification: now,
      lastNotificationTimestamp: itemData.timestamp || now
    });
    this.stats.keychainsFound++;
    
    // Store notification in history (24-hour retention)
    this.storeNotificationHistory(itemData);
    
    // 🟢 PRIMARY: Show Chrome notifications (always works)
    console.log('📱 Showing Chrome notification');
    await this.showBackgroundNotification(itemData);

    // Secondary: Try to send to content scripts (but disable their sound)
    this.sendToContentScript('KEYCHAIN_FOUND', {
      ...itemData,
      soundEnabled: false // 🔥 FIX: Always disable sound in content script to prevent duplicates
    });

    // Update badge with count
    this.updateBadge();
  }

  async showBackgroundNotification(itemData) {
    const keychainNames = itemData.keychains ? 
      (Array.isArray(itemData.keychains) ? itemData.keychains.join(', ') : itemData.keychains) : 
      'Unknown';
    const marketValue = itemData.market_value ? (itemData.market_value / 100).toFixed(2) : 'Unknown';
    const purchasePrice = itemData.purchase_price ? (itemData.purchase_price / 100).toFixed(2) : marketValue;
    
    // 🔥 NEW: Get Float value from wear field
    const floatValue = itemData.wear !== undefined && itemData.wear !== null ? 
      parseFloat(itemData.wear).toFixed(6) : 'Unknown';
    
    const aboveRecommended = itemData.above_recommended_price !== undefined ? 
      itemData.above_recommended_price.toFixed(1) : 'Unknown';

    // 🚨 ENHANCED CHROME NOTIFICATION with better styling info
    try {
      const notificationId = `keychain_${itemData.id}_${Date.now()}`;
      
      // Create more detailed message that matches the card style
      const detailedMessage = [
        `🔑 ${keychainNames}`,
        `💰 Market: ${marketValue}`,
        `🎯 Float: ${floatValue}`,
        `📈 ${aboveRecommended}% above recommended`
      ].join('\n');
      
      chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'EMPIRE ENHANCED - TARGET FOUND!',
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
          
          // Store notification data for button clicks
          chrome.storage.local.set({
            [`notification_${createdId}`]: {
              itemId: itemData.id,
              marketName: itemData.market_name,
              timestamp: Date.now()
            }
          });

          // Auto-clear after 30 seconds to prevent notification buildup
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

    // 🔔 SOUND NOTIFICATION (if enabled)
    if (this.isSoundEnabled) {
      try {
        // Create an offscreen document for playing sound
        await this.playNotificationSound();
      } catch (error) {
        console.error('❌ Error playing notification sound:', error);
      }
    }

    // 🎯 SYSTEM TRAY/BADGE UPDATE
    chrome.action.setBadgeText({text: '🔑'});
    chrome.action.setBadgeBackgroundColor({color: '#ff6b35'});
    
    // Reset badge after 10 seconds
    setTimeout(() => {
      this.updateBadge();
    }, 10000);
  }

  async playNotificationSound() {
    try {
      // For Chrome Extensions, we need to use the offscreen API for audio
      // This works even when tabs are inactive
      
      // Check if we can create offscreen document
      if (chrome.offscreen) {
        try {
          // Check if offscreen document already exists
          let existingContexts = [];
          try {
            existingContexts = await chrome.runtime.getContexts({
              contextTypes: ['OFFSCREEN_DOCUMENT']
            });
          } catch (error) {
            // getContexts might not be available in all Chrome versions
          }

          // Only create if doesn't exist
          if (existingContexts.length === 0) {
            await chrome.offscreen.createDocument({
              url: 'offscreen.html',
              reasons: ['AUDIO_PLAYBACK'],
              justification: 'Play notification sound for keychain alerts'
            });
          }

          // Send message to offscreen document to play sound
          setTimeout(() => {
            chrome.runtime.sendMessage({
              type: 'PLAY_NOTIFICATION_SOUND'
            }).catch(error => {
              console.log('🔊 Offscreen message failed, using TTS fallback');
              this.playTTSSound();
            });
          }, 100);

          // Clean up offscreen document after 3 seconds
          setTimeout(async () => {
            try {
              await chrome.offscreen.closeDocument();
            } catch (error) {
              // Document might already be closed
            }
          }, 3000);

        } catch (error) {
          console.log('🔊 Offscreen audio not available, using alternative method');
          // Fallback: Use chrome.tts for sound
          this.playTTSSound();
        }
      } else {
        this.playTTSSound();
      }
    } catch (error) {
      console.error('❌ Sound playback failed:', error);
      // Final fallback to TTS
      this.playTTSSound();
    }
  }

  playTTSSound() {
    // Enhanced TTS fallback with multiple attempts
    try {
      // First attempt: Standard TTS
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
    // Create a simple data URL audio as last resort
    try {
      // Create a short beep using data URL
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsF');
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
      // Get existing history
      const result = await chrome.storage.local.get(['notificationHistory']);
      let history = result.notificationHistory || [];
      
      // Clean up old entries (older than 24 hours)
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      history = history.filter(item => item.timestamp > twentyFourHoursAgo);
      
      // Add new notification with enhanced data including float
      const historyItem = {
        id: itemData.id,
        market_name: itemData.market_name,
        market_value: itemData.market_value,
        purchase_price: itemData.purchase_price,
        suggested_price: itemData.suggested_price,
        above_recommended_price: itemData.above_recommended_price,
        wear: itemData.wear, // 🔥 NEW: Store float value
        keychains: itemData.keychains ? 
          (Array.isArray(itemData.keychains) ? itemData.keychains : [itemData.keychains]) : 
          [],
        timestamp: Date.now()
      };
      
      // Add to beginning of array (newest first)
      history.unshift(historyItem);
      
      // Keep only last 100 items to prevent storage bloat
      if (history.length > 100) {
        history = history.slice(0, 100);
      }
      
      // Save back to storage
      await chrome.storage.local.set({notificationHistory: history});
      
      console.log('💾 Notification stored in history');
    } catch (error) {
      console.error('❌ Error storing notification history:', error);
    }
  }

  async sendToContentScript(type, data) {
    try {
      // Get all tabs
      const tabs = await chrome.tabs.query({});
      
      // Find CSGOEmpire tabs
      const csgoTabs = tabs.filter(tab => 
        tab.url && (
          tab.url.includes('csgoempire.com') || 
          tab.url.includes('csgoempire.gg')
        )
      );

      console.log(`📤 Sending ${type} to ${csgoTabs.length} CSGOEmpire tabs`);

      let successCount = 0;
      
      // Send message to all CSGOEmpire tabs
      for (const tab of csgoTabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type, data });
          console.log(`✅ Message sent to tab ${tab.id}`);
          successCount++;
        } catch (error) {
          console.log(`❌ Failed to send message to tab ${tab.id}:`, error.message);
          // Try to inject content script if it's not loaded
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content-script.js']
            });
            // Try sending message again after injection
            await chrome.tabs.sendMessage(tab.id, { type, data });
            console.log(`✅ Message sent to tab ${tab.id} after script injection`);
            successCount++;
          } catch (injectionError) {
            console.log(`❌ Failed to inject script or send message to tab ${tab.id}:`, injectionError.message);
          }
        }
      }

      // Return true if we successfully sent to at least one tab
      return successCount > 0;

    } catch (error) {
      console.error('❌ Error sending message to content script:', error);
      return false;
    }
  }

  handleStatusUpdate(statusData) {
    console.log('📊 Status update:', statusData);
    
    if (statusData.stats) {
      this.stats.keychainsFound = statusData.stats.keychainsFound || 0;
    }
    
    this.updateBadge();
  }

  updateBadge() {
    if (!this.isMonitoringEnabled) {
      chrome.action.setBadgeText({text: '⏸'});
      chrome.action.setBadgeBackgroundColor({color: '#95a5a6'});
      chrome.action.setTitle({title: 'Keychain Monitor - Disabled'});
    } else if (this.stats.serverConnected || (Date.now() - this.lastSuccessfulPoll < 10000)) {
      // Consider connected if HTTP poll was successful within last 10 seconds
      chrome.action.setBadgeText({text: this.stats.keychainsFound > 0 ? this.stats.keychainsFound.toString() : '●'});
      chrome.action.setBadgeBackgroundColor({color: '#00ff00'});
      chrome.action.setTitle({title: 'Keychain Monitor - Server Connected'});
    } else {
      chrome.action.setBadgeText({text: '○'});
      chrome.action.setBadgeBackgroundColor({color: '#ff0000'});
      chrome.action.setTitle({title: 'Keychain Monitor - Server Disconnected'});
    }
  }
}

// 🔥 CRITICAL: Listen for alarm events (backup method)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pollNotifications') {
    console.log('⏰ Chrome alarm fired (backup polling)');
    if (extensionManager) {
      extensionManager.pollServerForNotifications();
    }
  }
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  // Get the stored notification data
  const result = await chrome.storage.local.get(`notification_${notificationId}`);
  const notificationData = result[`notification_${notificationId}`];
  
  if (buttonIndex === 0) {
    // View Item - use the stored item ID
    if (notificationData && notificationData.itemId) {
      chrome.tabs.create({url: `https://csgoempire.com/item/${notificationData.itemId}`});
    } else {
      // Fallback to trade page
      chrome.tabs.create({url: 'https://csgoempire.com/trade'});
    }
  } else if (buttonIndex === 1) {
    // Open history page
    chrome.tabs.create({url: chrome.runtime.getURL('history.html')});
  }
  
  // Clear the notification
  chrome.notifications.clear(notificationId);
  
  // Clean up stored notification data
  chrome.storage.local.remove(`notification_${notificationId}`);
});

// Clean up when notification is closed
chrome.notifications.onClosed.addListener((notificationId) => {
  chrome.storage.local.remove(`notification_${notificationId}`);
});

// Listen for messages from popup and other components
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATS') {
    sendResponse({
      stats: extensionManager.stats,
      connected: extensionManager.stats.serverConnected || (Date.now() - extensionManager.lastSuccessfulPoll < 10000),
      monitoringEnabled: extensionManager.isMonitoringEnabled,
      soundEnabled: extensionManager.isSoundEnabled,
      currentTheme: extensionManager.currentTheme // 🎨 NEW: Include current theme
    });
  } else if (message.type === 'SET_MONITORING_STATE') {
    extensionManager.setMonitoringState(message.data.enabled);
    sendResponse({success: true});
  } else if (message.type === 'SET_SOUND_STATE') {
    extensionManager.setSoundState(message.data.enabled);
    sendResponse({success: true});
  } else if (message.type === 'THEME_CHANGED') {
    // 🎨 NEW: Handle theme change from popup
    extensionManager.setTheme(message.data.theme);
    sendResponse({success: true});
  } else if (message.type === 'TEST_CONNECTION') {
    if (extensionManager.isMonitoringEnabled) {
      extensionManager.connectToServer();
    }
    sendResponse({success: true});
  } else if (message.type === 'TEST_SERVER_CONNECTION') {
    // Test HTTP connection to server
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
    return true; // Keep the message channel open for async response
  } else if (message.type === 'TEST_NOTIFICATION') {
    if (!extensionManager.isMonitoringEnabled) {
      sendResponse({
        success: false,
        error: 'Monitoring is disabled'
      });
      return;
    }
    
    // Send test notification to server
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
    return true; // Keep the message channel open for async response
  } else if (message.type === 'REQUEST_NOTIFICATION_PERMISSION') {
    // Check and request notification permission
    chrome.notifications.getPermissionLevel((level) => {
      console.log('Current notification permission level:', level);
      
      if (level === 'granted') {
        // Test with a simple notification
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
            
            // Clear test notification after 3 seconds
            setTimeout(() => {
              chrome.notifications.clear(testId);
            }, 3000);
          }
        });
      } else {
        // Permission not granted, provide instructions
        sendResponse({ 
          granted: false, 
          error: 'Please enable notifications in Chrome settings. Go to Settings > Privacy and Security > Site Settings > Notifications and allow this extension.' 
        });
      }
    });
    return true;
  } else if (message.type === 'UPDATE_PRICE_FILTER') {
    // Send updated price filter to server
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
    return true; // Keep the message channel open for async response
  } else if (message.type === 'PLAY_NOTIFICATION_SOUND') {
    // Handle sound request from offscreen document
    console.log('🔊 Playing notification sound from offscreen');
    sendResponse({success: true});
  }
  
  return true; // Keep the message channel open for async response
});

// Initialize extension on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('🚀 Extension starting up...');
  new ExtensionManager();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('🔧 Extension installed/updated');
  new ExtensionManager();
});

// Create global instance
let extensionManager;

// Initialize immediately
extensionManager = new ExtensionManager();
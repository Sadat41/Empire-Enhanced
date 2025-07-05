// background.js - Complete version with site theming support

class ExtensionManager {
  constructor() {
    this.httpUrl = 'http://localhost:3001';
    this.isMonitoringEnabled = true;
    this.isSoundEnabled = true;
    this.currentTheme = 'nebula';
    this.isSiteThemingEnabled = true; // NEW: Track site theming state
    this.stats = {
      keychainsFound: 0,
      lastConnection: null,
      serverConnected: false
    };
    
    this.lastNotificationTimestamp = 0;
    this.notifiedItemIds = new Set();
    this.httpPollingInterval = null;
    this.httpPollingFrequency = 3000;
    this.lastSuccessfulPoll = 0;
    
    this.init();
  }

  async init() {
    console.log('♔ Empire Enhanced Extension initialized');
    
    await this.loadSettings();
    
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

    this.updateBadge();
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

  // 🎨 Theme management
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

  // 🌟 NEW: Site theming management
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
          
          await this.handleKeychainFound(item);
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

  async handleKeychainFound(itemData) {
    if (!this.isMonitoringEnabled) {
      console.log('🚫 Keychain found but monitoring is disabled - ignoring');
      return;
    }

    console.log('🔑 Processing keychain notification:', itemData);
    
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
    this.stats.keychainsFound++;
    
    this.storeNotificationHistory(itemData);
    
    console.log('📱 Showing Chrome notification');
    await this.showBackgroundNotification(itemData);

    this.sendToContentScript('KEYCHAIN_FOUND', {
      ...itemData,
      soundEnabled: false
    });

    this.updateBadge();
  }

  async showBackgroundNotification(itemData) {
    const keychainNames = itemData.keychains ? 
      (Array.isArray(itemData.keychains) ? itemData.keychains.join(', ') : itemData.keychains) : 
      'Unknown';
    const marketValue = itemData.market_value ? (itemData.market_value / 100).toFixed(2) : 'Unknown';
    
    const floatValue = itemData.wear !== undefined && itemData.wear !== null ? 
      parseFloat(itemData.wear).toFixed(6) : 'Unknown';
    
    const aboveRecommended = itemData.above_recommended_price !== undefined ? 
      itemData.above_recommended_price.toFixed(1) : 'Unknown';

    try {
      const notificationId = `keychain_${itemData.id}_${Date.now()}`;
      
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

    chrome.action.setBadgeText({text: '🔑'});
    chrome.action.setBadgeBackgroundColor({color: '#ff6b35'});
    
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
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBTuY3PLLeCsF');
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
      siteThemingEnabled: extensionManager.isSiteThemingEnabled // NEW: Include site theming state
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
    // 🌟 NEW: Handle site theming state change from popup
    extensionManager.setSiteThemingState(message.data.enabled);
    sendResponse({success: true});
  } else if (message.type === 'TEST_CONNECTION') {
    if (extensionManager.isMonitoringEnabled) {
      extensionManager.connectToServer();
    }
    sendResponse({success: true});
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
// Enhanced Popup script with enable/disable functionality
class PopupManager {
  constructor() {
    this.startTime = Date.now();
    this.uptimeTimer = null;
    this.currentTab = 'status';
    this.isMonitoringEnabled = true;
    this.isSoundEnabled = true;
    
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setupTabs();
    this.setupToggleSwitches();
    this.loadSettings();
    this.updateUI();
    this.startUptimeTimer();
    
    // Get initial stats from background script
    this.getStatsFromBackground();
  }

  setupToggleSwitches() {
    const monitoringToggle = document.getElementById('monitoringToggle');
    const soundToggle = document.getElementById('soundToggle');

    monitoringToggle.addEventListener('click', () => {
      this.isMonitoringEnabled = !this.isMonitoringEnabled;
      this.updateMonitoringState();
      this.saveSettings();
    });

    soundToggle.addEventListener('click', () => {
      this.isSoundEnabled = !this.isSoundEnabled;
      this.updateSoundState();
      this.saveSettings();
    });
  }

  updateMonitoringState() {
    const toggle = document.getElementById('monitoringToggle');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const actionButtons = document.getElementById('actionButtons');

    if (this.isMonitoringEnabled) {
      toggle.classList.add('active');
      actionButtons.classList.remove('disabled-overlay');
      // Check server status when enabling monitoring
      this.checkServerStatus();
    } else {
      toggle.classList.remove('active');
      statusIndicator.className = 'status-indicator disabled';
      statusText.textContent = 'Monitoring Disabled';
      actionButtons.classList.add('disabled-overlay');
    }

    // Send state to background script
    chrome.runtime.sendMessage({
      type: 'SET_MONITORING_STATE',
      data: { enabled: this.isMonitoringEnabled }
    });
  }

  updateSoundState() {
    const toggle = document.getElementById('soundToggle');
    
    if (this.isSoundEnabled) {
      toggle.classList.add('active');
    } else {
      toggle.classList.remove('active');
    }

    // Send state to background script
    chrome.runtime.sendMessage({
      type: 'SET_SOUND_STATE',
      data: { enabled: this.isSoundEnabled }
    });
  }

  setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update tab buttons
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update tab content
        tabContents.forEach(content => {
          content.classList.remove('active');
          if (content.id === `${tabName}Tab`) {
            content.classList.add('active');
          }
        });
        
        this.currentTab = tabName;
      });
    });
  }

  setupEventListeners() {
    // Status tab buttons
    document.getElementById('testNotification').addEventListener('click', () => {
      if (this.isMonitoringEnabled) this.testNotification();
    });

    document.getElementById('viewHistory').addEventListener('click', () => {
      this.openHistoryPage();
    });

    document.getElementById('openServer').addEventListener('click', () => {
      chrome.tabs.create({url: 'http://localhost:3001/health'});
    });

    document.getElementById('openCSGOEmpire').addEventListener('click', () => {
      chrome.tabs.create({url: 'https://csgoempire.com/withdraw/steam/market'});
    });

    // Settings tab buttons
    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveFilterSettings();
    });

    document.getElementById('enableNotifications').addEventListener('click', () => {
      this.enableNotifications();
    });

    document.getElementById('viewKeychains').addEventListener('click', () => {
      this.viewKeychains();
    });

    // Range input listeners
    document.getElementById('minPercentage').addEventListener('input', () => {
      this.updateRangeDisplay();
    });

    document.getElementById('maxPercentage').addEventListener('input', () => {
      this.updateRangeDisplay();
    });
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.sync.get({
        minPercentage: -50,
        maxPercentage: 5,
        monitoringEnabled: true,
        soundEnabled: true
      });

      document.getElementById('minPercentage').value = settings.minPercentage;
      document.getElementById('maxPercentage').value = settings.maxPercentage;
      this.isMonitoringEnabled = settings.monitoringEnabled;
      this.isSoundEnabled = settings.soundEnabled;
      
      this.updateRangeDisplay();
      this.updateMonitoringState();
      this.updateSoundState();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({
        monitoringEnabled: this.isMonitoringEnabled,
        soundEnabled: this.isSoundEnabled
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  updateRangeDisplay() {
    const min = parseInt(document.getElementById('minPercentage').value);
    const max = parseInt(document.getElementById('maxPercentage').value);
    
    const display = document.getElementById('rangeDisplay');
    
    if (min > max) {
      display.textContent = 'Invalid range: Min cannot be greater than Max';
      display.style.color = '#e74c3c';
      return;
    }
    
    display.style.color = '#95a5a6';
    
    if (min < 0 && max > 0) {
      display.textContent = `Range: ${min}% to +${max}% above recommended price`;
    } else if (min >= 0) {
      display.textContent = `Range: +${min}% to +${max}% above recommended price`;
    } else {
      display.textContent = `Range: ${min}% to ${max}% above recommended price`;
    }
  }

  async saveFilterSettings() {
    const min = parseInt(document.getElementById('minPercentage').value);
    const max = parseInt(document.getElementById('maxPercentage').value);
    
    if (min > max) {
      this.showError('Invalid range: Minimum cannot be greater than maximum');
      return;
    }

    try {
      // Save to Chrome storage
      await chrome.storage.sync.set({
        minPercentage: min,
        maxPercentage: max
      });

      // Send to background script to update server
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_PRICE_FILTER',
        data: { minPercentage: min, maxPercentage: max }
      });

      if (response && response.success) {
        this.showSuccess(`Settings saved! Range: ${min}% to ${max}%`);
      } else {
        this.showError('Settings saved locally, but failed to update server');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showError('Failed to save settings');
    }
  }

  async getStatsFromBackground() {
    try {
      const response = await chrome.runtime.sendMessage({type: 'GET_STATS'});
      
      if (response && response.stats) {
        this.updateStats(response.stats, response.connected);
        
        // Update states from background script
        if (response.monitoringEnabled !== undefined) {
          this.isMonitoringEnabled = response.monitoringEnabled;
          this.updateMonitoringState();
        }
        if (response.soundEnabled !== undefined) {
          this.isSoundEnabled = response.soundEnabled;
          this.updateSoundState();
        }
      }
      
      // Also check server status independently
      this.checkServerStatus();
    } catch (error) {
      console.error('Error getting stats from background:', error);
      this.showError('Cannot communicate with background script');
    }
  }

  async checkServerStatus() {
    try {
      const response = await chrome.runtime.sendMessage({type: 'TEST_SERVER_CONNECTION'});
      
      if (response && response.success) {
        this.updateServerStatus(true, response.data);
      } else {
        this.updateServerStatus(false);
      }
    } catch (error) {
      console.error('Server status check failed:', error);
      this.updateServerStatus(false);
    }
  }

  async enableNotifications() {
    try {
      const response = await chrome.runtime.sendMessage({type: 'REQUEST_NOTIFICATION_PERMISSION'});
      
      if (response && response.granted) {
        this.showSuccess('Notifications enabled successfully!');
      } else {
        this.showError('Please enable notifications in Chrome settings for this extension');
        
        chrome.tabs.create({
          url: `chrome://extensions/?id=${chrome.runtime.id}`
        });
      }
    } catch (error) {
      console.error('Enable notifications failed:', error);
      this.showError('Failed to enable notifications');
    }
  }

  async testNotification() {
    if (!this.isMonitoringEnabled) return;
    
    try {
      const response = await chrome.runtime.sendMessage({type: 'TEST_NOTIFICATION'});
      
      if (response && response.success) {
        this.showSuccess('Test notification sent to server!');
      } else {
        this.showError('Failed to send test notification');
      }
    } catch (error) {
      console.error('Test notification failed:', error);
      this.showError('Failed to send test notification');
    }
  }

  openHistoryPage() {
    // Open the history page
    chrome.tabs.create({url: chrome.runtime.getURL('history.html')});
  }

  viewKeychains() {
    // Create a popup showing all target keychains
    const keychains = [
      "Hot Howl", "Baby Karat T", "Hot Wurst", "Baby Karat CT", "Semi-Precious", 
      "Diamond Dog", "Titeenium AWP", "Lil' Monster", "Diner Dog", "Lil' Squirt", 
      "Die-cast AK", "Lil' Teacup", "Chicken Lil'", "That's Bananas", "Lil' Whiskers", 
      "Glamour Shot", "Lil' Sandy", "Hot Hands", "POP Art", "Disco MAC", "Lil' Squatch", 
      "Lil' SAS", "Baby's AK", "Hot Sauce", "Pinch O' Salt", "Big Kev", "Whittle Knife", 
      "Lil' Crass", "Pocket AWP", "Lil' Ava", "Stitch-Loaded", "Backsplash", "Lil' Cap Gun"
    ];

    const keychainList = keychains.map(name => `• ${name}`).join('\n');
    
    // Show in a simple alert for now
    alert(`Target Keychains (${keychains.length}):\n\n${keychainList}`);
  }

  updateStats(stats, connected) {
    document.getElementById('keychainsFound').textContent = stats.keychainsFound || 0;
    
    if (stats.lastConnection) {
      const lastConn = new Date(stats.lastConnection);
      document.getElementById('lastConnection').textContent = lastConn.toLocaleTimeString();
    }
    
    if (this.isMonitoringEnabled) {
      this.updateServerStatus(connected);
    }
  }

  updateServerStatus(connected, serverData = null) {
    if (!this.isMonitoringEnabled) return;
    
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const serverStatus = document.getElementById('serverStatus');
    
    if (connected) {
      statusIndicator.className = 'status-indicator connected';
      statusText.textContent = 'Connected';
      serverStatus.textContent = 'Connected';
      
      if (serverData && serverData.csgoConnected) {
        statusText.textContent = 'Connected - CSGOEmpire Connected';
      }
    } else {
      statusIndicator.className = 'status-indicator disconnected';
      statusText.textContent = 'Server Disconnected';
      serverStatus.textContent = 'Disconnected';
    }
  }

  showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    successDiv.style.display = 'none';
    
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }

  showSuccess(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    errorDiv.style.display = 'none';
    
    setTimeout(() => {
      successDiv.style.display = 'none';
    }, 3000);
  }

  updateUI() {
    // Auto-refresh stats and server status when UI loads
    this.getStatsFromBackground();
    this.checkServerStatus();
  }

  startUptimeTimer() {
    this.uptimeTimer = setInterval(() => {
      this.updateUptime();
    }, 1000);
  }

  updateUptime() {
    const elapsed = Date.now() - this.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    document.getElementById('uptime').textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
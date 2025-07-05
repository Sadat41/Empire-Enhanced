// Content script for CSGOEmpire keychain notifications overlay

class CSGOEmpireNotificationOverlay {
  constructor() {
    this.notifications = [];
    this.maxNotifications = 3;
    this.notificationContainer = null;
    this.soundEnabled = true;
    this.monitoringEnabled = true;
    
    this.init();
  }

  async init() {
    console.log('♔ Empire Enhanced overlay initialized');
    
    // Load settings from storage
    await this.loadSettings();
    
    // Create notification container
    this.createNotificationContainer();
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'KEYCHAIN_FOUND':
          if (this.monitoringEnabled) {
            this.showKeychainNotification(message.data);
          }
          sendResponse({success: true});
          break;
        case 'MONITORING_STATE_CHANGED':
          this.setMonitoringState(message.data.enabled);
          sendResponse({success: true});
          break;
        case 'SOUND_STATE_CHANGED':
          this.setSoundState(message.data.enabled);
          sendResponse({success: true});
          break;
      }
      return true;
    });

    // Note: Removed direct WebSocket connection to prevent duplicate notifications
    // All notifications now come through the background script
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.sync.get({
        monitoringEnabled: true,
        soundEnabled: true
      });
      
      this.monitoringEnabled = settings.monitoringEnabled;
      this.soundEnabled = settings.soundEnabled;
      
      console.log('Content script settings loaded:', { monitoring: this.monitoringEnabled, sound: this.soundEnabled });
    } catch (error) {
      console.error('Error loading settings in content script:', error);
    }
  }

  setMonitoringState(enabled) {
    this.monitoringEnabled = enabled;
    console.log('Content script monitoring state:', enabled ? 'enabled' : 'disabled');
    
    // Update or hide notification container based on state
    if (!enabled && this.notificationContainer) {
      this.notificationContainer.style.display = 'none';
    } else if (enabled && this.notificationContainer) {
      this.notificationContainer.style.display = 'block';
    }
  }

  setSoundState(enabled) {
    this.soundEnabled = enabled;
    console.log('Content script sound state:', enabled ? 'enabled' : 'disabled');
  }

  createNotificationContainer() {
    // Remove existing container if it exists
    const existing = document.getElementById('keychain-notification-container');
    if (existing) {
      existing.remove();
    }

    // Create container for notifications
    this.notificationContainer = document.createElement('div');
    this.notificationContainer.id = 'keychain-notification-container';
    this.notificationContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
      display: ${this.monitoringEnabled ? 'block' : 'none'};
    `;
    
    document.body.appendChild(this.notificationContainer);
  }

  showKeychainNotification(itemData) {
    if (!this.monitoringEnabled) {
      console.log('🚫 Notification ignored - monitoring disabled');
      return;
    }

    console.log('🔑 Showing keychain notification overlay:', itemData);

    // Check if we already have a notification for this item ID to prevent duplicates
    const existingNotification = document.getElementById(`notification-${itemData.id}`);
    if (existingNotification) {
      console.log('🚫 Duplicate notification prevented for item:', itemData.id);
      return;
    }

    // Check if sound is enabled (can come from itemData or instance setting)
    const soundEnabled = itemData.soundEnabled !== undefined ? itemData.soundEnabled : this.soundEnabled;

    // Format the data
    const marketValue = itemData.market_value ? (itemData.market_value / 100).toFixed(2) : 'Unknown';
    const purchasePrice = itemData.purchase_price ? (itemData.purchase_price / 100).toFixed(2) : marketValue;
    
    // 🔥 NEW: Get Float value from wear field - replace recommended price
    const floatValue = itemData.wear !== undefined && itemData.wear !== null ? 
      parseFloat(itemData.wear).toFixed(6) : 'Unknown';
    
    const aboveRecommended = itemData.above_recommended_price !== undefined && itemData.above_recommended_price !== null && !isNaN(itemData.above_recommended_price) 
      ? itemData.above_recommended_price.toFixed(2) 
      : 'Unknown';
    
    const keychainNames = itemData.keychains ? 
      (Array.isArray(itemData.keychains) ? itemData.keychains.map(k => k.name || k).join(', ') : itemData.keychains) : 
      'Unknown';

    // Add enhanced keyframes and styles for premium look
    if (!document.getElementById('keychain-notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'keychain-notification-styles';
      styles.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(350px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(350px);
            opacity: 0;
          }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(2deg); }
        }
        
        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 8px 32px rgba(102, 126, 234, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05);
          }
          50% {
            box-shadow: 0 12px 40px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
          }
        }
        
        .keychain-notification {
          animation: slideInRight 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        
        .keychain-notification:hover {
          transform: translateY(-4px) !important;
          box-shadow: 0 20px 40px rgba(102, 126, 234, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.15) !important;
        }
        
        .pulse-glow {
          animation: pulseGlow 3s infinite;
        }
        
        .crown-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .gradient-text {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .premium-button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .premium-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }
        
        .secondary-button {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .secondary-button:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.25);
        }
      `;
      document.head.appendChild(styles);
    }

    // Create notification element with unique ID based on item ID
    const notification = document.createElement('div');
    const notificationId = `notification-${itemData.id}`;
    notification.id = notificationId;
    notification.className = 'keychain-notification pulse-glow';
    notification.style.cssText = `
      background: rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      max-width: 300px;
      min-width: 280px;
      color: #e2e8f0;
      box-shadow: 0 8px 32px rgba(102, 126, 234, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05);
      pointer-events: auto;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
      position: relative;
      overflow: hidden;
    `;

    // Premium animated crown SVG matching your theme
    const crownSVG = `
      <svg class="crown-float" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 8px rgba(102, 126, 234, 0.4));">
        <defs>
          <linearGradient id="crownGradient${itemData.id}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#764ba2;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#36d1dc;stop-opacity:1" />
          </linearGradient>
        </defs>
        <path d="M3 18h18l-2-8-4 3-3-6-3 6-4-3z" fill="url(#crownGradient${itemData.id})" stroke="#667eea" stroke-width="0.5"/>
        <path d="M5 18h14v1.5c0 0.5-0.5 1-1 1H6c-0.5 0-1-0.5-1-1V18z" fill="#764ba2"/>
        <circle cx="12" cy="12" r="1.5" fill="#36d1dc"/>
        <circle cx="8" cy="14" r="1" fill="#667eea"/>
        <circle cx="16" cy="14" r="1" fill="#667eea"/>
      </svg>
    `;

    notification.innerHTML = `
      <!-- Compact premium header -->
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <div style="margin-right: 10px;">
          ${crownSVG}
        </div>
        <div style="flex: 1;">
          <div style="font-size: 14px; font-weight: 700; margin-bottom: 2px;" class="gradient-text">
            EMPIRE ENHANCED
          </div>
          <div style="font-size: 10px; opacity: 0.6; color: #94a3b8; font-weight: 500;">
            Target Found!
          </div>
        </div>
        <button onclick="this.closest('.keychain-notification').remove()" style="
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #f87171;
          border-radius: 6px;
          width: 24px;
          height: 24px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          font-weight: 600;
        " onmouseover="this.style.background='rgba(239, 68, 68, 0.2)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.12)'">×</button>
      </div>
      
      <!-- Premium item info section with enhanced typography -->
      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 6px; color: #f1f5f9; line-height: 1.3; letter-spacing: -0.2px;">
          ${itemData.market_name || 'Unknown Item'}
        </div>
        <div style="font-size: 12px; color: #36d1dc; display: flex; align-items: center; font-weight: 600;">
          <div style="width: 10px; height: 10px; background: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%); border-radius: 50%; margin-right: 6px; display: flex; align-items: center; justify-content: center;">
            <div style="width: 4px; height: 4px; background: white; border-radius: 50%;"></div>
          </div>
          ${keychainNames}
        </div>
      </div>
      
      <!-- Compact price grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
        <div style="background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.25); border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 9px; color: #94a3b8; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Market Value</div>
          <div style="font-size: 14px; font-weight: 800; color: #22c55e;">$${marketValue}</div>
        </div>
        <div style="background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.25); border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 9px; color: #94a3b8; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Float</div>
          <div style="font-size: 14px; font-weight: 800; color: #a855f7;">${floatValue}</div>
        </div>
      </div>
      
      <!-- Compact above recommended percentage -->
      <div style="display: flex; justify-content: center; margin-bottom: 12px;">
        <div style="background: rgba(${parseFloat(aboveRecommended) > 0 ? '239, 68, 68' : '34, 197, 94'}, 0.12); border: 1px solid rgba(${parseFloat(aboveRecommended) > 0 ? '239, 68, 68' : '34, 197, 94'}, 0.25); border-radius: 12px; padding: 6px 12px; display: flex; align-items: center; gap: 4px;">
          <span style="font-size: 10px;">${parseFloat(aboveRecommended) > 0 ? '📈' : '📉'}</span>
          <span style="font-size: 11px; font-weight: 700; color: ${parseFloat(aboveRecommended) > 0 ? '#f87171' : '#4ade80'};">
            ${parseFloat(aboveRecommended) > 0 ? '+' : ''}${aboveRecommended}% above rec.
          </span>
        </div>
      </div>
      
      <!-- Compact action buttons -->
      <div style="display: flex; gap: 8px;">
        <button onclick="window.open('https://csgoempire.com/item/${itemData.id}', '_blank')" 
                class="premium-button"
                style="
          flex: 1;
          color: white;
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        ">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15,3 21,3 21,9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          View Item
        </button>
        <button onclick="this.closest('.keychain-notification').remove()" 
                class="secondary-button"
                style="
          background: rgba(255, 255, 255, 0.08);
          color: #e2e8f0;
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        ">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Close
        </button>
      </div>
      
      <!-- Compact footer info -->
      <div style="font-size: 9px; color: #64748b; margin-top: 10px; text-align: center; opacity: 0.7; font-weight: 500;">
        ID: ${itemData.id || 'Unknown'} • ${new Date().toLocaleTimeString()}
      </div>
    `;

    // Add click handler to open specific item page
    notification.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
        window.open(`https://csgoempire.com/item/${itemData.id}`, '_blank');
      }
    });

    // Add notification to container
    this.notificationContainer.appendChild(notification);
    this.notifications.push(notificationId);

    // Play notification sound only if enabled
    if (soundEnabled) {
      this.playNotificationSound();
    }

    // Auto-remove after 30 seconds
    setTimeout(() => {
      this.removeNotification(notificationId);
    }, 30000);

    // Remove oldest notifications if we have too many
    if (this.notifications.length > this.maxNotifications) {
      const oldestId = this.notifications.shift();
      this.removeNotification(oldestId);
    }

    // Flash the page title
    this.flashPageTitle();
  }

  removeNotification(notificationId) {
    const notification = document.getElementById(notificationId);
    if (notification) {
      notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
        this.notifications = this.notifications.filter(id => id !== notificationId);
      }, 300);
    }
  }

  playNotificationSound() {
    if (!this.soundEnabled) return;

    try {
      // Create audio context for notification sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create a more premium notification sound sequence
      const playTone = (frequency, duration, delay = 0) => {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
          gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + duration);
        }, delay);
      };

      // Premium notification sound sequence
      playTone(880, 0.15, 0);      // A5
      playTone(1108, 0.15, 200);   // C#6
      playTone(1320, 0.2, 400);    // E6

    } catch (error) {
      console.error('Could not play notification sound:', error);
    }
  }

  flashPageTitle() {
    const originalTitle = document.title;
    let flashCount = 0;
    const maxFlashes = 6;

    const flashInterval = setInterval(() => {
      document.title = flashCount % 2 === 0 ? '♔ Empire Enhanced' : originalTitle;
      flashCount++;

      if (flashCount >= maxFlashes) {
        clearInterval(flashInterval);
        document.title = originalTitle;
      }
    }, 500);
  }
}

// Initialize the overlay when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CSGOEmpireNotificationOverlay();
  });
} else {
  new CSGOEmpireNotificationOverlay();
}
// content-script.js 
(function() {
  if (window.empireEnhancedLoaded) {
    console.log('Empire Enhanced already loaded, skipping...');
    return;
  }
  window.empireEnhancedLoaded = true;

  console.log('🔥 EMPIRE ENHANCED CONTENT SCRIPT v2.2 LOADED WITH ITEM TARGET SUPPORT');

// Content script for CSGOEmpire notifications overlay with enhanced charm pricing and item targets
class CSGOEmpireNotificationOverlay {
  constructor() {
    this.notifications = [];
    this.maxNotifications = 3;
    this.notificationContainer = null;
    this.soundEnabled = true;
    this.monitoringEnabled = true;
    this.currentTheme = 'shooting-star'; // Default theme
    this.siteThemingEnabled = true; // Site theming state
    
    // Charm category color mapping
    this.charmColors = {
      'Red': '#ef4444',      // Red
      'Pink': '#ec4899',     // Pink
      'Purple': '#a855f7',   // Purple
      'Blue': '#3b82f6'      // Blue
    };
    
    
    this.fallbackCharmPricing = {
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
    console.log('♔ Empire Enhanced notifications overlay initialized');
    
    // Load settings from storage including theme and site theming
    await this.loadSettings();
    
    // Create notification container
    this.createNotificationContainer();
    
    // Initialize site theming coordination with safety delay
    setTimeout(() => {
      this.initSiteThemingCoordination();
    }, 2000); // 2 second delay to ensure page is ready
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'KEYCHAIN_FOUND':
          console.log('🔍 DEBUG: Received KEYCHAIN_FOUND message:', message.data);
          if (this.monitoringEnabled) {
            this.showKeychainNotification(message.data);
          }
          sendResponse({success: true});
          break;
        case 'ITEM_TARGET_FOUND':
         
          console.log('🎯 DEBUG: Received ITEM_TARGET_FOUND message:', message.data);
          if (this.monitoringEnabled) {
            this.showItemTargetNotification(message.data);
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
        case 'THEME_CHANGED':
          this.setTheme(message.data.theme);
          // Safely notify site theming system
          this.notifySiteThemeChange(message.data.theme, message.data.siteThemingEnabled !== false);
          sendResponse({success: true});
          break;
        case 'SITE_THEMING_CHANGED':
          this.setSiteThemingState(message.data.enabled);
          sendResponse({success: true});
          break;
      }
      return true;
    });
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.sync.get({
        monitoringEnabled: true,
        soundEnabled: true,
        selectedTheme: 'shooting-star',
        siteThemingEnabled: true
      });
      
      this.monitoringEnabled = settings.monitoringEnabled;
      this.soundEnabled = settings.soundEnabled;
      this.currentTheme = settings.selectedTheme;
      this.siteThemingEnabled = settings.siteThemingEnabled;
      
      console.log('Content script settings loaded:', { 
        monitoring: this.monitoringEnabled, 
        sound: this.soundEnabled,
        theme: this.currentTheme,
        siteTheming: this.siteThemingEnabled
      });
    } catch (error) {
      console.error('Error loading settings in content script:', error);
    }
  }

  // SAFE: Initialize site theming coordination with error handling
  initSiteThemingCoordination() {
    try {
      // Only apply theming if enabled and we're on the right page
      if (this.siteThemingEnabled && this.isCSGOEmpirePage()) {
        this.notifySiteThemeChange(this.currentTheme, this.siteThemingEnabled);
      }

      // Listen for storage changes to keep in sync
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
          if (changes.selectedTheme) {
            this.currentTheme = changes.selectedTheme.newValue;
            this.setTheme(this.currentTheme);
            if (this.siteThemingEnabled && this.isCSGOEmpirePage()) {
              this.notifySiteThemeChange(this.currentTheme, this.siteThemingEnabled);
            }
          }
          if (changes.siteThemingEnabled) {
            this.siteThemingEnabled = changes.siteThemingEnabled.newValue;
            this.setSiteThemingState(this.siteThemingEnabled);
          }
        }
      });
    } catch (error) {
      console.error('Error initializing site theming coordination:', error);
    }
  }

  // Check if we're on a CSGOEmpire page
  isCSGOEmpirePage() {
    return window.location.hostname.includes('csgoempire.com') || 
           window.location.hostname.includes('csgoempire.gg');
  }

  // Notify site theming system with error handling
  notifySiteThemeChange(theme, siteThemingEnabled) {
    try {
      if (!this.isCSGOEmpirePage()) {
        console.log('🎨 Not on CSGOEmpire page, skipping site theming');
        return;
      }

      // Dispatch custom event for site theming system with safety delay
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('empireThemeChanged', {
          detail: { 
            theme: theme,
            siteThemingEnabled: siteThemingEnabled !== false
          }
        }));

        console.log(`🎨 Safely notified site theming system: ${theme}, enabled: ${siteThemingEnabled !== false}`);
      }, 100); // Small delay for safety
    } catch (error) {
      console.error('Error notifying site theming system:', error);
    }
  }

  setTheme(themeName) {
    console.log(`🎨 Notifications: Setting theme to ${themeName}`);
    this.currentTheme = themeName;
    
    // Update notification container theme
    if (this.notificationContainer) {
      this.notificationContainer.className = `keychain-notification-container theme-${themeName}`;
    }
    
    // Re-inject theme styles
    this.injectThemeStyles();
  }

  // Site theming state management
  setSiteThemingState(enabled) {
    console.log(`🌟 Site theming state changed: ${enabled ? 'enabled' : 'disabled'}`);
    this.siteThemingEnabled = enabled;
    
    // Safely notify site theming system
    if (this.isCSGOEmpirePage()) {
      this.notifySiteThemeChange(this.currentTheme, this.siteThemingEnabled);
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

    // Create container for notifications with SAFE positioning
    this.notificationContainer = document.createElement('div');
    this.notificationContainer.id = 'keychain-notification-container';
    this.notificationContainer.className = `keychain-notification-container theme-${this.currentTheme}`;
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
    
    // Inject theme-specific styles
    this.injectThemeStyles();
  }

  injectThemeStyles() {
    // Remove existing theme styles
    const existingStyles = document.getElementById('keychain-notification-theme-styles');
    if (existingStyles) {
      existingStyles.remove();
    }

    const styles = document.createElement('style');
    styles.id = 'keychain-notification-theme-styles';
    
    styles.textContent = `
      /* ===== SAFE NOTIFICATION STYLES - NO INTERFERENCE WITH CHAT ===== */
      @keyframes slideInRight {
        from { transform: translateX(350px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(350px); opacity: 0; }
      }
      
      @keyframes float {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-4px) rotate(2deg); }
      }
      
      @keyframes pulseGlow {
        0%, 100% { box-shadow: 0 8px 32px rgba(102, 126, 234, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05); }
        50% { box-shadow: 0 12px 40px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1); }
      }

      /* 🔥 NEW: Item target specific animations */
      @keyframes targetPulse {
        0%, 100% { box-shadow: 0 8px 32px rgba(16, 185, 129, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05); }
        50% { box-shadow: 0 12px 40px rgba(16, 185, 129, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1); }
      }
      
      /* SAFE: Only target our notification elements with specific IDs/classes */
      #keychain-notification-container .keychain-notification {
        animation: slideInRight 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }
      
      #keychain-notification-container .keychain-notification:hover { 
        transform: translateY(-4px) !important; 
      }
      
      #keychain-notification-container .crown-float { 
        animation: float 3s ease-in-out infinite; 
      }
      
      #keychain-notification-container .gradient-text {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        display: inline-block;
      }

      /* 🔥 NEW: Item target gradient text */
      #keychain-notification-container .gradient-text.item-target {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      
      #keychain-notification-container .premium-button {
        border: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      #keychain-notification-container .premium-button:hover { 
        transform: translateY(-2px); 
      }
      
      #keychain-notification-container .secondary-button { 
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
      }

      /* Enhanced charm display styles */
      #keychain-notification-container .charm-info {
        background: rgba(255, 255, 255, 0.04);
        border-radius: 8px;
        padding: 8px 12px;
        margin-bottom: 8px;
        border-left: 3px solid;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      /* 🔥 NEW: Item target info styles */
      #keychain-notification-container .target-info {
        background: rgba(16, 185, 129, 0.1);
        border-radius: 8px;
        padding: 8px 12px;
        margin-bottom: 8px;
        border-left: 3px solid #10b981;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      #keychain-notification-container .charm-icon,
      #keychain-notification-container .target-icon {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
        color: white;
        flex-shrink: 0;
      }

      #keychain-notification-container .target-icon {
        background: #10b981;
      }

      #keychain-notification-container .charm-details,
      #keychain-notification-container .target-details {
        flex: 1;
        min-width: 0;
      }

      #keychain-notification-container .charm-name,
      #keychain-notification-container .target-keyword {
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 2px;
        word-break: break-word;
      }

      #keychain-notification-container .target-keyword {
        color: #10b981;
      }

      #keychain-notification-container .charm-price,
      #keychain-notification-container .target-description {
        font-size: 11px;
        opacity: 0.8;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      #keychain-notification-container .price-badge {
        background: rgba(255, 255, 255, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        white-space: nowrap;
      }

      /* ===== THEME 1: NEBULA STYLES ===== */
      .keychain-notification-container.theme-nebula .keychain-notification {
        background: rgba(255, 255, 255, 0.06);
        backdrop-filter: blur(24px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 8px 32px rgba(102, 126, 234, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05);
      }

      .keychain-notification-container.theme-nebula .keychain-notification.item-target {
        box-shadow: 0 8px 32px rgba(16, 185, 129, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05);
      }

      .keychain-notification-container.theme-nebula .keychain-notification:hover {
        box-shadow: 0 20px 40px rgba(102, 126, 234, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.15) !important;
      }

      .keychain-notification-container.theme-nebula .keychain-notification.item-target:hover {
        box-shadow: 0 20px 40px rgba(16, 185, 129, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.15) !important;
      }

      .keychain-notification-container.theme-nebula .pulse-glow { 
        animation: pulseGlow 3s infinite; 
      }

      .keychain-notification-container.theme-nebula .pulse-glow.item-target { 
        animation: targetPulse 3s infinite; 
      }

      .keychain-notification-container.theme-nebula .gradient-text {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .keychain-notification-container.theme-nebula .gradient-text.item-target {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .keychain-notification-container.theme-nebula .premium-button {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
      }

      .keychain-notification-container.theme-nebula .premium-button.item-target {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
      }

      .keychain-notification-container.theme-nebula .premium-button:hover {
        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
      }

      .keychain-notification-container.theme-nebula .premium-button.item-target:hover {
        box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
      }

      .keychain-notification-container.theme-nebula .secondary-button {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
      }

      .keychain-notification-container.theme-nebula .secondary-button:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.25);
      }

      /* ===== THEME 2: SHOOTING STAR STYLES ===== */
      .keychain-notification-container.theme-shooting-star .keychain-notification {
        background: rgba(20, 20, 40, 0.85);
        backdrop-filter: blur(24px);
        border: 1px solid rgba(135, 206, 235, 0.3);
        box-shadow: 0 8px 32px rgba(135, 206, 235, 0.15), 0 0 0 1px rgba(135, 206, 235, 0.1);
        position: relative;
        overflow: hidden;
      }

      .keychain-notification-container.theme-shooting-star .keychain-notification.item-target {
        border: 1px solid rgba(16, 185, 129, 0.3);
        box-shadow: 0 8px 32px rgba(16, 185, 129, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.1);
      }

      .keychain-notification-container.theme-shooting-star .keychain-notification::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: 
          radial-gradient(1px 1px at 20% 30%, rgba(135, 206, 235, 0.4), transparent),
          radial-gradient(1px 1px at 80% 70%, rgba(74, 144, 226, 0.3), transparent),
          radial-gradient(1px 1px at 60% 20%, rgba(135, 206, 235, 0.2), transparent),
          radial-gradient(1px 1px at 40% 80%, rgba(74, 144, 226, 0.3), transparent);
        background-size: 60px 40px, 80px 50px, 70px 45px, 90px 55px;
        animation: starFieldMove 15s linear infinite;
        pointer-events: none;
        z-index: -1;
      }

      .keychain-notification-container.theme-shooting-star .keychain-notification.item-target::before {
        background: 
          radial-gradient(1px 1px at 20% 30%, rgba(16, 185, 129, 0.4), transparent),
          radial-gradient(1px 1px at 80% 70%, rgba(5, 150, 105, 0.3), transparent),
          radial-gradient(1px 1px at 60% 20%, rgba(16, 185, 129, 0.2), transparent),
          radial-gradient(1px 1px at 40% 80%, rgba(5, 150, 105, 0.3), transparent);
      }

      @keyframes starFieldMove {
        0% { transform: translateY(0px); }
        100% { transform: translateY(-20px); }
      }

      .keychain-notification-container.theme-shooting-star .keychain-notification:hover {
        box-shadow: 0 20px 40px rgba(135, 206, 235, 0.25), 0 0 0 1px rgba(135, 206, 235, 0.2) !important;
        border-color: rgba(135, 206, 235, 0.5);
      }

      .keychain-notification-container.theme-shooting-star .keychain-notification.item-target:hover {
        box-shadow: 0 20px 40px rgba(16, 185, 129, 0.25), 0 0 0 1px rgba(16, 185, 129, 0.2) !important;
        border-color: rgba(16, 185, 129, 0.5);
      }

      .keychain-notification-container.theme-shooting-star .gradient-text {
        background: linear-gradient(135deg, #4a90e2 0%, #87ceeb 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .keychain-notification-container.theme-shooting-star .gradient-text.item-target {
        background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .keychain-notification-container.theme-shooting-star .premium-button {
        background: linear-gradient(135deg, #4a90e2 0%, #87ceeb 100%);
        box-shadow: 0 4px 15px rgba(135, 206, 235, 0.3);
      }

      .keychain-notification-container.theme-shooting-star .premium-button.item-target {
        background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
      }

      .keychain-notification-container.theme-shooting-star .premium-button:hover {
        box-shadow: 0 8px 25px rgba(135, 206, 235, 0.5);
      }

      .keychain-notification-container.theme-shooting-star .premium-button.item-target:hover {
        box-shadow: 0 8px 25px rgba(16, 185, 129, 0.5);
      }

      .keychain-notification-container.theme-shooting-star .secondary-button {
        background: rgba(135, 206, 235, 0.08);
        border: 1px solid rgba(135, 206, 235, 0.2);
      }

      .keychain-notification-container.theme-shooting-star .secondary-button:hover {
        background: rgba(135, 206, 235, 0.15);
        border-color: rgba(135, 206, 235, 0.3);
      }

      .keychain-notification-container.theme-shooting-star .crown-svg {
        filter: drop-shadow(0 4px 8px rgba(135, 206, 235, 0.4));
      }

      .keychain-notification-container.theme-nebula .crown-svg {
        filter: drop-shadow(0 4px 8px rgba(102, 126, 234, 0.4));
      }
    `;
    
    document.head.appendChild(styles);
  }

  // Fallback method to get charm details from fallback data (matches server logic exactly)
  getFallbackCharmDetails(itemData) {
    console.log('🔍 DEBUG: Using fallback charm detection for:', itemData);
    
    if (!itemData.keychains || !Array.isArray(itemData.keychains)) {
      console.log('❌ No keychains array found');
      return null;
    }

    for (const keychain of itemData.keychains) {
      const keychainName = keychain.name || keychain;
      console.log('🔍 Checking keychain:', keychainName);
      
      for (const category in this.fallbackCharmPricing) {
        if (this.fallbackCharmPricing[category].hasOwnProperty(keychainName)) {
          console.log('✅ Found charm in fallback data:', category, keychainName);
          return {
            category: category,
            name: keychainName,
            price: this.fallbackCharmPricing[category][keychainName]
          };
        }
      }
    }
    
    console.log('❌ No charm found in fallback data');
    return null;
  }

  
  formatCharmInfo(itemData) {
    console.log('🔍 DEBUG: formatCharmInfo called with:', {
      charm_name: itemData.charm_name,
      charm_category: itemData.charm_category,
      charm_price: itemData.charm_price,
      keychains: itemData.keychains,
      market_value: itemData.market_value
    });

    // Priority 1: Check if we have charm data from the server
    if (itemData.charm_name && itemData.charm_category && itemData.charm_price !== undefined) {
      console.log('✅ Using server-provided charm data');
      const charmName = itemData.charm_name;
      const charmCategory = itemData.charm_category;
      const charmPrice = itemData.charm_price;
      const marketValue = itemData.market_value ? (itemData.market_value / 100) : 0;
      
      
      let percentageOfMarket = 0;
      if (marketValue > 0 && charmPrice > 0) {
        percentageOfMarket = (charmPrice / marketValue) * 100;
      }
      
      const charmColor = this.charmColors[charmCategory] || '#ffffff';
      const categoryIcon = this.getCategoryIcon(charmCategory);
      
      console.log('🔍 Server charm calculation:', {
        charmPrice,
        marketValue,
        percentage: percentageOfMarket.toFixed(2)
      });
      
      return {
        hasCharmData: true,
        charmName,
        charmCategory,
        charmPrice,
        charmColor,
        categoryIcon,
        percentageOfMarket,
        formattedDisplay: `${charmName} – $${charmPrice.toFixed(2)}`,
        percentageDisplay: percentageOfMarket > 0 ? `${percentageOfMarket.toFixed(2)}% of market` : 'N/A'
      };
    }
    
    // Priority 2: Try fallback charm detection from local data
    console.log('⚠️ No server charm data, trying fallback detection...');
    const fallbackCharm = this.getFallbackCharmDetails(itemData);
    
    if (fallbackCharm) {
      console.log('✅ Using fallback charm data');
      const marketValue = itemData.market_value ? (itemData.market_value / 100) : 0;
      
      
      let percentageOfMarket = 0;
      if (marketValue > 0 && fallbackCharm.price > 0) {
        percentageOfMarket = (fallbackCharm.price / marketValue) * 100;
      }
      
      const charmColor = this.charmColors[fallbackCharm.category] || '#ffffff';
      const categoryIcon = this.getCategoryIcon(fallbackCharm.category);
      
      console.log('🔍 Fallback charm calculation:', {
        charmPrice: fallbackCharm.price,
        marketValue: marketValue,
        percentage: percentageOfMarket.toFixed(2)
      });
      
      return {
        hasCharmData: true,
        charmName: fallbackCharm.name,
        charmCategory: fallbackCharm.category,
        charmPrice: fallbackCharm.price,
        charmColor,
        categoryIcon,
        percentageOfMarket,
        formattedDisplay: `${fallbackCharm.name} – $${fallbackCharm.price.toFixed(2)}`,
        percentageDisplay: percentageOfMarket > 0 ? `${percentageOfMarket.toFixed(2)}% of market` : 'N/A'
      };
    }
    
    // Priority 3: Fallback to basic keychain names if no charm data
    console.log('❌ No charm data found, using fallback display');
    const keychainNames = itemData.keychains ? 
      (Array.isArray(itemData.keychains) ? itemData.keychains.map(k => k.name || k).join(', ') : itemData.keychains) : 
      'Unknown';
      
    return {
      hasCharmData: false,
      fallbackDisplay: keychainNames
    };
  }

  getCategoryIcon(category) {
    const icons = {
      'Red': '🔴',
      'Pink': '🌸',
      'Purple': '🟣',
      'Blue': '🔵'
    };
    return icons[category] || '🔑';
  }

  // Show item target notification
  showItemTargetNotification(itemData) {
    if (!this.monitoringEnabled) {
      console.log('🚫 Item target notification ignored - monitoring disabled');
      return;
    }

    console.log('🎯 Showing item target notification overlay:', itemData);
    console.log('🔍 DEBUG: Full item target data received:', JSON.stringify(itemData, null, 2));

    // Check if we already have a notification for this item ID to prevent duplicates
    const existingNotification = document.getElementById(`notification-${itemData.id}`);
    if (existingNotification) {
      console.log('🚫 Duplicate notification prevented for item:', itemData.id);
      return;
    }

    // Check if sound is enabled
    const soundEnabled = itemData.soundEnabled !== undefined ? itemData.soundEnabled : this.soundEnabled;

    // Format the data
    const marketValue = itemData.market_value ? (itemData.market_value / 100).toFixed(2) : 'Unknown';
    const purchasePrice = itemData.purchase_price ? (itemData.purchase_price / 100).toFixed(2) : marketValue;
    
    // Get Float value from wear field
    const floatValue = itemData.wear !== undefined && itemData.wear !== null ? 
      parseFloat(itemData.wear).toFixed(6) : 'Unknown';
    
    const aboveRecommended = itemData.above_recommended_price !== undefined && itemData.above_recommended_price !== null && !isNaN(itemData.above_recommended_price) 
      ? itemData.above_recommended_price.toFixed(2) 
      : 'Unknown';

    // Create notification element with unique ID based on item ID
    const notification = document.createElement('div');
    const notificationId = `notification-${itemData.id}`;
    notification.id = notificationId;
    notification.className = 'keychain-notification pulse-glow item-target'; // Add item-target class
    notification.style.cssText = `
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      max-width: 320px;
      min-width: 300px;
      color: #e2e8f0;
      pointer-events: auto;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
      position: relative;
      overflow: hidden;
    `;

    // Create target icon SVG
    const targetGradientId = `targetGradient${itemData.id}`;
    const targetSVG = `
      <svg class="crown-float crown-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${targetGradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#059669;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#34d399;stop-opacity:1" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="none" stroke="url(#${targetGradientId})" stroke-width="2"/>
        <circle cx="12" cy="12" r="6" fill="none" stroke="url(#${targetGradientId})" stroke-width="1.5"/>
        <circle cx="12" cy="12" r="2" fill="url(#${targetGradientId})"/>
      </svg>
    `;

    // Generate target info HTML
    const targetKeyword = itemData.target_item_matched?.name || itemData.matched_keyword || 'Unknown';
    const floatRange = itemData.target_item_matched?.floatFilter?.enabled 
      ? `${itemData.target_item_matched.floatFilter.min.toFixed(3)} - ${itemData.target_item_matched.floatFilter.max.toFixed(3)}`
      : 'Any float';

    const targetDisplayHTML = `
      <div class="target-info">
        <div class="target-icon">🎯</div>
        <div class="target-details">
          <div class="target-keyword">
            "${targetKeyword}"
          </div>
          <div class="target-description">
            <span class="price-badge">Keyword Match</span>
            <span style="opacity: 0.6;">${floatRange}</span>
          </div>
        </div>
      </div>
    `;

    notification.innerHTML = `
      <!-- Compact premium header -->
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <div style="margin-right: 10px;">
          ${targetSVG}
        </div>
        <div style="flex: 1;">
          <div style="font-size: 14px; font-weight: 700; margin-bottom: 2px;" class="gradient-text item-target">
            ITEM TARGET FOUND
          </div>
          <div style="font-size: 10px; opacity: 0.6; color: #94a3b8; font-weight: 500;">
            Target Match!
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
      
      <!-- Premium item info section -->
      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #f1f5f9; line-height: 1.3; letter-spacing: -0.2px;">
          ${itemData.market_name || 'Unknown Item'}
        </div>
        ${targetDisplayHTML}
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
                class="premium-button item-target"
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
        ID: ${itemData.id || 'Unknown'} • ${new Date().toLocaleTimeString()} • Target Match
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
      this.playItemTargetNotificationSound();
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
    this.flashPageTitle('🎯 Item Target Found!');

    console.log('✅ Item target notification displayed successfully');
  }

  showKeychainNotification(itemData) {
    if (!this.monitoringEnabled) {
      console.log('🚫 Notification ignored - monitoring disabled');
      return;
    }

    console.log('🔑 Showing keychain notification overlay:', itemData);
    console.log('🔍 DEBUG: Full item data received:', JSON.stringify(itemData, null, 2));

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
    
    // Get Float value from wear field
    const floatValue = itemData.wear !== undefined && itemData.wear !== null ? 
      parseFloat(itemData.wear).toFixed(6) : 'Unknown';
    
    const aboveRecommended = itemData.above_recommended_price !== undefined && itemData.above_recommended_price !== null && !isNaN(itemData.above_recommended_price) 
      ? itemData.above_recommended_price.toFixed(2) 
      : 'Unknown';
    
    // Get enhanced charm information with fallback support
    const charmInfo = this.formatCharmInfo(itemData);
    console.log('🔍 DEBUG: Charm info result:', charmInfo);

    // Create notification element with unique ID based on item ID
    const notification = document.createElement('div');
    const notificationId = `notification-${itemData.id}`;
    notification.id = notificationId;
    notification.className = 'keychain-notification pulse-glow';
    notification.style.cssText = `
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      max-width: 320px;
      min-width: 300px;
      color: #e2e8f0;
      pointer-events: auto;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
      position: relative;
      overflow: hidden;
    `;

    // Create crown SVG with theme-aware gradient
    const crownGradientId = `crownGradient${itemData.id}`;
    const crownColors = this.currentTheme === 'shooting-star' 
      ? { start: '#4a90e2', mid: '#87ceeb', end: '#36d1dc' }
      : { start: '#667eea', mid: '#764ba2', end: '#36d1dc' };

    const crownSVG = `
      <svg class="crown-float crown-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${crownGradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${crownColors.start};stop-opacity:1" />
            <stop offset="50%" style="stop-color:${crownColors.mid};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${crownColors.end};stop-opacity:1" />
          </linearGradient>
        </defs>
        <path d="M3 18h18l-2-8-4 3-3-6-3 6-4-3z" fill="url(#${crownGradientId})" stroke="${crownColors.start}" stroke-width="0.5"/>
        <path d="M5 18h14v1.5c0 0.5-0.5 1-1 1H6c-0.5 0-1-0.5-1-1V18z" fill="${crownColors.mid}"/>
        <circle cx="12" cy="12" r="1.5" fill="${crownColors.end}"/>
        <circle cx="8" cy="14" r="1" fill="${crownColors.start}"/>
        <circle cx="16" cy="14" r="1" fill="${crownColors.start}"/>
      </svg>
    `;

    
    let charmDisplayHTML = '';
    if (charmInfo.hasCharmData) {
      console.log('✅ Rendering ENHANCED charm display with consistent pricing');
      console.log('🔍 Charm details:', {
        name: charmInfo.charmName,
        category: charmInfo.charmCategory,
        price: charmInfo.charmPrice,
        percentage: charmInfo.percentageOfMarket.toFixed(2)
      });
      
      charmDisplayHTML = `
        <div class="charm-info" style="border-left-color: ${charmInfo.charmColor};">
          <div class="charm-icon" style="background: ${charmInfo.charmColor};">
            ${charmInfo.categoryIcon}
          </div>
          <div class="charm-details">
            <div class="charm-name" style="color: ${charmInfo.charmColor};">
              ${charmInfo.formattedDisplay}
            </div>
            <div class="charm-price">
              <span class="price-badge">${charmInfo.percentageDisplay}</span>
              <span style="opacity: 0.6;">${charmInfo.charmCategory} Rarity</span>
            </div>
          </div>
        </div>
      `;
    } else {
      console.log('⚠️ Rendering fallback charm display');
      // Fallback display for items without charm data
      charmDisplayHTML = `
        <div style="font-size: 12px; color: #36d1dc; display: flex; align-items: center; font-weight: 600; margin-bottom: 12px;">
          <div style="width: 10px; height: 10px; background: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%); border-radius: 50%; margin-right: 6px; display: flex; align-items: center; justify-content: center;">
            <div style="width: 4px; height: 4px; background: white; border-radius: 50%;"></div>
          </div>
          ${charmInfo.fallbackDisplay}
        </div>
      `;
    }

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
      
      <!-- Premium item info section -->
      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #f1f5f9; line-height: 1.3; letter-spacing: -0.2px;">
          ${itemData.market_name || 'Unknown Item'}
        </div>
        ${charmDisplayHTML}
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
      
      <!-- Compact footer info with charm percentage (if available) -->
      <div style="font-size: 9px; color: #64748b; margin-top: 10px; text-align: center; opacity: 0.7; font-weight: 500;">
        ID: ${itemData.id || 'Unknown'} • ${new Date().toLocaleTimeString()}
        ${charmInfo.hasCharmData ? ` • Charm: ${charmInfo.percentageOfMarket.toFixed(1)}%` : ''}
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

    console.log('✅ Enhanced notification with consistent charm pricing displayed successfully');
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


  playItemTargetNotificationSound() {
    if (!this.soundEnabled) return;

    try {
      // Create audio context for notification sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Different sound pattern for item targets (more upbeat)
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

      // Item target sound sequence (different from keychain)
      playTone(523, 0.15, 0);      // C5
      playTone(659, 0.15, 150);    // E5
      playTone(784, 0.15, 300);    // G5
      playTone(1047, 0.2, 450);    // C6

    } catch (error) {
      console.error('Could not play item target notification sound:', error);
    }
  }

  playNotificationSound() {
    if (!this.soundEnabled) return;

    try {
      // Create audio context for notification sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      
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

      if (this.currentTheme === 'shooting-star') {
        // Ethereal shooting star sound sequence
        playTone(800, 0.15, 0);      // C5
        playTone(1200, 0.15, 200);   // E6
        playTone(1600, 0.2, 400);    // G#6
      } else {
        // Original nebula sound sequence
        playTone(880, 0.15, 0);      // A5
        playTone(1108, 0.15, 200);   // C#6
        playTone(1320, 0.2, 400);    // E6
      }

    } catch (error) {
      console.error('Could not play notification sound:', error);
    }
  }

  flashPageTitle(customTitle = null) {
    const originalTitle = document.title;
    let flashCount = 0;
    const maxFlashes = 6;
    const flashTitle = customTitle || '♔ Empire Enhanced';

    const flashInterval = setInterval(() => {
      document.title = flashCount % 2 === 0 ? flashTitle : originalTitle;
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
})();


(async function() {
  try {
    await import('./core/event-bus.js');
    await import('./core/module-loader.js'); 
    await import('./core/base-module.js');
    
    window.empireModuleLoader.setContext('content');
    await window.empireModuleLoader.autoLoadModules();
  } catch (error) {
    console.log('⚠️ Module system not ready yet');
  }
})();
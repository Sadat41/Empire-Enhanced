/**
 * ============================================================================
 * KEYCHAIN FILTER COMPONENT WITH TABBED INTERFACE
 * ============================================================================
 * 
 * Enhanced keychain filter component with separate tabs for each charm set:
 * - Small Arms
 * - Missing Link  
 * - Missing Link Community
 * - Dr Boom
 * - Austin Major (placeholder)
 * 
 * @version 2.0.0
 */

class KeychainFilterComponent {
  constructor(containerId) {
    this.containerId = containerId;
    this.activeTab = 'small-arms';
    this.keychainData = this.getKeychainData();
    this.selectedKeychains = new Set();
    this.percentageThreshold = 50;
    
    this.init();
  }

  /**
   * Get organized keychain data by charm collections
   */
  getKeychainData() {
    return {
      'small-arms': {
        name: 'Small Arms',
        charms: {
          'Red': [
            { name: 'Baby Karat T', value: 65.0 },
            { name: 'Baby Karat CT', value: 45.0 }
          ],
          'Pink': [
            { name: 'Semi-Precious', value: 50.0 },
            { name: 'Titanium AWP', value: 15.0 },
            { name: "Lil' Squirt", value: 10.00 }
          ],
          'Purple': [
            { name: 'Die-cast AK', value: 10.00 },
            { name: 'Glamour Shot', value: 3.00 },
            { name: 'Hot Hands', value: 2.50 },
            { name: 'POP Art', value: 2.50 },
            { name: 'Disco MAC', value: 2.00 }
          ],
          'Blue': [
            { name: "Baby's AK", value: 0.80 },
            { name: 'Pocket AWP', value: 0.5 },
            { name: 'Whittle Knife', value: 0.5 },
            { name: 'Stitch-Loaded', value: 0.25 },
            { name: "Lil' Cap Gun", value: 0.25 },
            { name: 'Backsplash', value: 0.24 }
          ]
        }
      },
      'missing-link': {
        name: 'Missing Link',
        charms: {
          'Red': [
            { name: 'Hot Howl', value: 85.0 },
            { name: 'Hot Wurst', value: 60.0 }
          ],
          'Pink': [
            { name: 'Diamond Dog', value: 30.0 },
            { name: "Lil' Monster", value: 20.0 },
            { name: 'Diner Dog', value: 15.00 }
          ],
          'Purple': [
            { name: "Lil' Teacup", value: 5.0 },
            { name: "Chicken Lil'", value: 4.50 },
            { name: "That's Bananas", value: 3.50 },
            { name: "Lil' Whiskers", value: 2.50 },
            { name: "Lil' Sandy", value: 2.50 },
            { name: "Lil' Squatch", value: 1.50 }
          ],
          'Blue': [
            { name: "Lil' SAS", value: 1.00 },
            { name: 'Hot Sauce', value: 0.50 },
            { name: "Pinch O' Salt", value: 0.50 },
            { name: 'Big Kev', value: 0.50 },
            { name: "Lil' Crass", value: 0.40 },
            { name: "Lil' Ava", value: 0.40 }
          ]
        }
      },
      'missing-link-community': {
        name: 'Missing Link Community',
        charms: {
          'Red': [
            { name: "Lil' Boo", value: 100.00 },
            { name: "Lil' Eldritch", value: 50.00 },
            { name: 'Quick Silver', value: 45.00 },
            { name: "Lil' Serpent", value: 35.00 }
          ],
          'Pink': [
            { name: "Lil' Hero", value: 20.00 },
            { name: 'Piñatita', value: 15.00 },
            { name: "Lil' Happy", value: 12.00 },
            { name: "Lil' Chirp", value: 12.00 },
            { name: "Lil' Prick", value: 8.00 }
          ],
          'Purple': [
            { name: 'Pocket Pop', value: 3.50 },
            { name: "Lil' Moments", value: 3.00 },
            { name: 'Magmatude', value: 2.50 },
            { name: "Lil' Goop", value: 2.25 },
            { name: "Lil' Buns", value: 1.50 },
            { name: 'Hang Loose', value: 1.25 }
          ],
          'Blue': [
            { name: "Lil' No. 2", value: 0.50 },
            { name: "Lil' Cackle", value: 0.35 },
            { name: 'Dead Weight', value: 0.30 },
            { name: "Lil' Baller", value: 0.30 },
            { name: "Lil' Smokey", value: 0.25 },
            { name: "Lil' Tusk", value: 0.20 },
            { name: "Lil' Vino", value: 0.20 },
            { name: "Lil' Curse", value: 0.20 }
          ]
        }
      },
      'dr-boom': {
        name: 'Dr Boom',
        charms: {
          'Red': [
            { name: 'Butane Buddy', value: 100.0 },
            { name: 'Glitter Bomb', value: 60.0 },
            { name: '8 Ball IGL', value: 50.0 },
            { name: "Lil' Ferno", value: 35.0 }
          ],
          'Pink': [
            { name: "Lil' Eco", value: 13.00 },
            { name: "Lil' Yeti", value: 13.00 },
            { name: 'Flash Bomb', value: 10.00 },
            { name: 'Eye of Ball', value: 8.00 },
            { name: 'Hungry Eyes', value: 7.00 }
          ],
          'Purple': [
            { name: "Lil' Bloody", value: 2.50 },
            { name: "Lil' Dumplin'", value: 2.00 },
            { name: 'Dr. Brian', value: 1.50 },
            { name: "Lil' Chomper", value: 1.00 },
            { name: "Lil' Facelift", value: 1.00 },
            { name: 'Big Brain', value: 1.00 },
            { name: 'Bomb Tag', value: 1.00 }
          ],
          'Blue': [
            { name: "Lil' Zen", value: 0.50 },
            { name: 'Splatter Cat', value: 0.25 },
            { name: 'Gritty', value: 0.20 },
            { name: 'Whittle Guy', value: 0.20 },
            { name: 'Fluffy', value: 0.20 },
            { name: 'Biomech', value: 0.20 }
          ]
        }
      },
      'austin-major': {
        name: 'Austin Major',
        charms: {
          'Red': [],
          'Pink': [],
          'Purple': [],
          'Blue': []
        },
        comingSoon: true
      }
    };
  }

  /**
   * Initialize the component
   */
  init() {
    this.render();
    this.setupEventListeners();
    this.setupThemeListener();
  }
  
  /**
   * Setup theme change listener
   */
  setupThemeListener() {
    // Listen for theme changes from the extension
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'THEME_CHANGED' || message.type === 'SITE_THEMING_CHANGED') {
          this.updateThemeStyles();
        }
      });
    }
    
    // Also listen for body class changes (fallback)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          this.updateThemeStyles();
        }
      });
    });
    
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
  
  /**
   * Update theme styles dynamically
   */
  updateThemeStyles() {
    // Remove existing styles
    const existingStyles = document.getElementById('keychain-filter-styles');
    if (existingStyles) {
      existingStyles.remove();
    }
    
    // Re-add styles with current theme
    this.addStyles();
  }

  /**
   * Render the component
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container ${this.containerId} not found`);
      return;
    }

    const currentCollection = this.keychainData[this.activeTab];
    const allCharms = currentCollection.comingSoon ? [] : this.getAllCharmsInCollection(currentCollection);
    const totalSelected = allCharms.filter(charm => this.selectedKeychains.has(charm.name)).length;

    container.innerHTML = `
      <div class="keychain-filter glass-card">
        <h3>🔑 Keychain Filter</h3>
        
        <!-- Percentage Threshold -->
        <div class="percentage-slider">
          <label for="keychainPercentage">Minimum Charm Value (% of Item Value)</label>
          <input type="range" id="keychainPercentage" min="0" max="100" value="${this.percentageThreshold}">
          <div class="percentage-value">${this.percentageThreshold}% of market value</div>
        </div>          <!-- Target Keychains Header -->
        <div class="keychain-list-toggle" id="keychainListToggle">
          <span>Target Keychains (${totalSelected}/${allCharms.length})</span>
          <span class="toggle-icon">▲</span>
        </div>

        <!-- Keychain List Container -->
        <div class="keychain-list expanded" id="keychainList">
          <!-- Tab Navigation -->
          <div class="keychain-tabs">
            ${Object.entries(this.keychainData).map(([key, set]) => `
              <button class="keychain-tab ${this.activeTab === key ? 'active' : ''}" data-tab="${key}">
                ${set.name}
              </button>
            `).join('')}
          </div>

          <!-- Select All/None Controls -->
          <div class="keychain-list-header">
            <div class="keychain-count">${totalSelected}/${allCharms.length} selected</div>
            <div class="select-buttons">
              <button class="select-btn" id="selectAll" ${currentCollection.comingSoon ? 'disabled' : ''}>All</button>
              <button class="select-btn" id="selectNone" ${currentCollection.comingSoon ? 'disabled' : ''}>None</button>
            </div>
          </div>

          <!-- Keychain Items -->
          <div class="keychain-items" id="keychainItems">
            ${this.renderKeychainItems()}
          </div>
        </div>

        <!-- Save Button -->
        <button class="save-keychain-button" id="saveKeychainFilter">
          Save Keychain Settings
        </button>
      </div>
    `;

    this.addStyles();
  }

  /**
   * Render keychain items for the active tab, organized by rarity
   */
  renderKeychainItems() {
    const currentCollection = this.keychainData[this.activeTab];
    
    // Handle "Coming Soon" collections
    if (currentCollection.comingSoon) {
      return `
        <div class="coming-soon-message">
          <div class="coming-soon-icon">🚀</div>
          <div class="coming-soon-text">Coming Soon</div>
          <div class="coming-soon-subtitle">Charms for this collection will be added when available</div>
        </div>
      `;
    }
    
    const rarityOrder = ['Red', 'Pink', 'Purple', 'Blue'];
    const rarityColors = {
      'Red': '#eb4b4b',
      'Pink': '#d946ef', 
      'Purple': '#8b5cf6',
      'Blue': '#3b82f6'
    };
    
    let html = '';
    
    for (const rarity of rarityOrder) {
      const charms = currentCollection.charms[rarity] || [];
      
      if (charms.length === 0) continue;
      
      // Sort charms by price high to low
      const sortedCharms = [...charms].sort((a, b) => b.value - a.value);
      
      html += `
        <div class="rarity-section">
          <div class="rarity-header" style="border-left: 4px solid ${rarityColors[rarity]};">
            <span class="rarity-name">${rarity}</span>
            <span class="rarity-count">(${sortedCharms.length})</span>
          </div>
          <div class="rarity-charms">
            ${sortedCharms.map(charm => {
              const isSelected = this.selectedKeychains.has(charm.name);
              const categoryClass = rarity.toLowerCase();
              
              return `
                <div class="keychain-item ${categoryClass}" data-charm="${charm.name}">
                  <div class="keychain-checkbox ${isSelected ? 'checked' : ''}"></div>
                  <div class="keychain-info">
                    <div class="keychain-name">${charm.name}</div>
                    <div class="keychain-price">$${charm.value.toFixed(2)}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    
    return html;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.keychain-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.activeTab = e.target.dataset.tab;
        this.render();
        this.setupEventListeners();
      });
    });

    // Percentage slider
    const percentageSlider = document.getElementById('keychainPercentage');
    if (percentageSlider) {
      percentageSlider.addEventListener('input', (e) => {
        this.percentageThreshold = parseInt(e.target.value);
        document.querySelector('.percentage-value').textContent = `${this.percentageThreshold}% of market value`;
      });
    }

    // Keychain item selection
    document.querySelectorAll('.keychain-item').forEach(item => {
      item.addEventListener('click', () => {
        const charmName = item.dataset.charm;
        this.toggleKeychainSelection(charmName);
      });
    });

    // Select All/None buttons
    document.getElementById('selectAll')?.addEventListener('click', () => {
      this.selectAllKeychains(true);
    });

    document.getElementById('selectNone')?.addEventListener('click', () => {
      this.selectAllKeychains(false);
    });

    // Save button
    document.getElementById('saveKeychainFilter')?.addEventListener('click', () => {
      this.saveSettings();
    });

    // List toggle
    document.getElementById('keychainListToggle')?.addEventListener('click', () => {
      const list = document.getElementById('keychainList');
      const toggle = document.getElementById('keychainListToggle');
      list.classList.toggle('expanded');
      toggle.classList.toggle('expanded');
    });
  }

  /**
   * Toggle keychain selection
   */
  toggleKeychainSelection(charmName) {
    if (this.selectedKeychains.has(charmName)) {
      this.selectedKeychains.delete(charmName);
    } else {
      this.selectedKeychains.add(charmName);
    }
    
    // Update the UI
    const item = document.querySelector(`[data-charm="${charmName}"]`);
    const checkbox = item.querySelector('.keychain-checkbox');
    checkbox.classList.toggle('checked');
    
    // Update counters
    this.updateCounters();
  }

  /**
   * Select all or none keychains for current tab
   */
  selectAllKeychains(selectAll) {
    const currentCollection = this.keychainData[this.activeTab];
    
    // Handle coming soon collections
    if (currentCollection.comingSoon) {
      return;
    }
    
    // Get all charms from all rarities in current collection
    const allCharms = this.getAllCharmsInCollection(currentCollection);
    
    allCharms.forEach(charm => {
      if (selectAll) {
        this.selectedKeychains.add(charm.name);
      } else {
        this.selectedKeychains.delete(charm.name);
      }
    });
    
    // Re-render to update UI
    this.render();
    this.setupEventListeners();
  }

  /**
   * Update selection counters
   */
  updateCounters() {
    const currentCollection = this.keychainData[this.activeTab];
    
    if (currentCollection.comingSoon) {
      return;
    }
    
    const allCharms = this.getAllCharmsInCollection(currentCollection);
    const totalSelected = allCharms.filter(charm => this.selectedKeychains.has(charm.name)).length;
    
    const countDisplay = document.querySelector('.keychain-count');
    if (countDisplay) {
      countDisplay.textContent = `${totalSelected}/${allCharms.length} selected`;
    }

    const headerCount = document.querySelector('#keychainListToggle span');
    if (headerCount) {
      headerCount.textContent = `Target Keychains (${totalSelected}/${allCharms.length})`;
    }
  }

  /**
   * Get all charms from all rarities in a collection
   */
  getAllCharmsInCollection(collection) {
    const allCharms = [];
    const rarityOrder = ['Red', 'Pink', 'Purple', 'Blue'];
    
    for (const rarity of rarityOrder) {
      const charms = collection.charms[rarity] || [];
      allCharms.push(...charms);
    }
    
    return allCharms;
  }

  /**
   * Save settings to extension
   */
  async saveSettings() {
    try {
      const saveBtn = document.getElementById('saveKeychainFilter');
      if (saveBtn) {
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;
      }

      // Update percentage threshold
      const response1 = await chrome.runtime.sendMessage({
        type: 'UPDATE_KEYCHAIN_PERCENTAGE',
        data: { percentageThreshold: this.percentageThreshold }
      });

      // Update enabled keychains
      const response2 = await chrome.runtime.sendMessage({
        type: 'UPDATE_ENABLED_KEYCHAINS',
        data: { enabledKeychains: Array.from(this.selectedKeychains) }
      });

      if (response1.success && response2.success) {
        this.showMessage(`✅ Keychain filter saved! ${this.selectedKeychains.size} keychains enabled, ${this.percentageThreshold}% threshold`, 'success');
      } else {
        throw new Error('Failed to save settings');
      }

    } catch (error) {
      console.error('Error saving keychain settings:', error);
      this.showMessage(`❌ Failed to save keychain filter: ${error.message}`, 'error');
    } finally {
      const saveBtn = document.getElementById('saveKeychainFilter');
      if (saveBtn) {
        saveBtn.textContent = 'Save Keychain Settings';
        saveBtn.disabled = false;
      }
    }
  }

  /**
   * Show message to user
   */
  showMessage(message, type) {
    console.log(`${type === 'success' ? '✅' : '❌'} ${message}`);
    // You can implement a toast notification system here
  }

  /**
   * Add component-specific styles with theme support
   */
  addStyles() {
    const styleId = 'keychain-filter-styles';
    if (document.getElementById(styleId)) return;

    const styles = document.createElement('style');
    styles.id = styleId;
    
    // Get current theme from body class or default to nebula
    const currentTheme = document.body.className.includes('shooting-star') ? 'shooting-star' : 'nebula';
    
    // Define theme-specific colors
    const themeColors = {
      nebula: {
        tabBackground: 'rgba(30, 32, 41, 0.7)',
        tabBorder: 'rgba(255, 255, 255, 0.08)',
        tabInactive: 'rgba(255, 255, 255, 0.06)',
        tabInactiveBorder: 'rgba(255, 255, 255, 0.1)',
        tabActiveGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        tabActiveShadow: 'rgba(102, 126, 234, 0.4)',
        rarityHeaderBg: 'rgba(255, 255, 255, 0.05)',
        itemHover: 'rgba(255, 255, 255, 0.08)',
        buttonBg: 'rgba(59, 130, 246, 0.2)',
        buttonColor: '#60a5fa',
        buttonBorder: 'rgba(59, 130, 246, 0.3)'
      },
      'shooting-star': {
        tabBackground: 'rgba(255, 182, 193, 0.1)',
        tabBorder: 'rgba(255, 182, 193, 0.3)',
        tabInactive: 'rgba(255, 182, 193, 0.05)',
        tabInactiveBorder: 'rgba(255, 182, 193, 0.2)',
        tabActiveGradient: 'linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)',
        tabActiveShadow: 'rgba(255, 107, 157, 0.4)',
        rarityHeaderBg: 'rgba(255, 182, 193, 0.08)',
        itemHover: 'rgba(255, 182, 193, 0.1)',
        buttonBg: 'rgba(255, 107, 157, 0.2)',
        buttonColor: '#ff6b9d',
        buttonBorder: 'rgba(255, 107, 157, 0.3)'
      }
    };
    
    const colors = themeColors[currentTheme];
    
    styles.textContent = `
      .keychain-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
        padding: 12px;
        background: ${colors.tabBackground};
        border-radius: 12px;
        border: 1px solid ${colors.tabBorder};
      }

      .keychain-tab {
        flex: 1;
        min-width: 120px;
        padding: 8px 12px;
        background: ${colors.tabInactive};
        border: 1px solid ${colors.tabInactiveBorder};
        border-radius: 8px;
        color: #94a3b8;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.3s ease;
        text-align: center;
      }

      .keychain-tab:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #e2e8f0;
      }

      .keychain-tab.active {
        background: ${colors.tabActiveGradient};
        color: white;
        border-color: ${colors.buttonColor};
        box-shadow: 0 4px 15px ${colors.tabActiveShadow};
      }

      .keychain-items {
        max-height: 300px;
        overflow-y: auto;
      }

      .keychain-item {
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .keychain-item:hover {
        background: ${colors.itemHover} !important;
        transform: translateY(-1px);
      }

      .rarity-section {
        margin-bottom: 20px;
      }

      .rarity-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: ${colors.rarityHeaderBg};
        border-radius: 8px;
        margin-bottom: 8px;
        font-weight: 600;
        font-size: 14px;
      }

      .rarity-name {
        color: #e2e8f0;
      }

      .rarity-count {
        color: #94a3b8;
        font-size: 12px;
      }

      .rarity-charms {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding-left: 8px;
      }

      .coming-soon-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
        color: #94a3b8;
      }

      .coming-soon-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.7;
      }

      .coming-soon-text {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
        color: #e2e8f0;
      }

      .coming-soon-subtitle {
        font-size: 14px;
        opacity: 0.8;
      }

      .select-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .save-keychain-button {
        width: 100%;
        padding: 10px 20px;
        margin-top: 16px;
        background: ${colors.buttonBg};
        color: ${colors.buttonColor};
        border: 1px solid ${colors.buttonBorder};
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        backdrop-filter: blur(10px);
      }

      .save-keychain-button:hover {
        background: ${colors.buttonBg.replace('0.2', '0.3')};
        border-color: ${colors.buttonBorder.replace('0.3', '0.5')};
        color: ${colors.buttonColor};
        transform: translateY(-1px);
      }

      .save-keychain-button:active {
        transform: translateY(0);
      }

      .save-keychain-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
    `;
    
    document.head.appendChild(styles);
  }

  /**
   * Load settings from extension
   */
  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_KEYCHAIN_FILTER_SETTINGS'
      });
      
      if (response && response.success) {
        this.percentageThreshold = response.data.percentageThreshold || 50;
        this.selectedKeychains = new Set(response.data.enabledKeychains || []);
        this.render();
        this.setupEventListeners();
      }
    } catch (error) {
      console.error('Error loading keychain settings:', error);
    }
  }
}

// Export for use in popup.js
window.KeychainFilterComponent = KeychainFilterComponent;
// popup.js 

class PopupManager {
    constructor() {
        this.currentStats = null;
        this.currentTheme = 'nebula'; // Default theme
        this.siteThemingEnabled = true; // Site theming state
        this.keychainFilterSettings = {
            percentageThreshold: 50,
            enabledKeychains: [],
            allKeychains: []
        };
        // Item Target List management
        this.itemTargetList = []; // Array of {keyword, minFloat, maxFloat, id}
        this.init();
    }
    

    async init() {
    console.log('🚀 Popup initialized for native extension');
    
    // Force nebula theme first, then load from storage
    this.applyTheme('nebula');
    
    // Load theme and site theming state
    await this.loadTheme();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load initial data
    await this.loadStats();
    await this.loadKeychainFilterSettings();
    await this.loadCurrentFilterSettings();
    await this.loadItemTargetList();
    
    // Setup auto-refresh
    setInterval(() => this.loadStats(), 3000);
    }

    async loadTheme() {
    try {
        const settings = await chrome.storage.sync.get({
            selectedTheme: 'nebula',
            siteThemingEnabled: true
        });
        
        this.currentTheme = settings.selectedTheme || 'nebula'; // Ensure fallback
        this.siteThemingEnabled = settings.siteThemingEnabled;
        
        // Force apply theme immediately
        this.applyTheme(this.currentTheme);
        
        // Also save the default theme to storage if it's empty (first run)
        if (!settings.selectedTheme) {
            await chrome.storage.sync.set({ selectedTheme: 'nebula' });
            console.log('🎨 Set default theme to nebula on first run');
        }
        
        console.log(`🎨 Popup loaded theme: ${this.currentTheme}, site theming: ${this.siteThemingEnabled}`);
        } catch (error) {
        console.error('Error loading theme:', error);

        // Force fall back to nebula theme
        this.currentTheme = 'nebula';
        this.siteThemingEnabled = true;
        this.applyTheme('nebula');
        }
    }
    

    // Load item target list 
    async loadItemTargetList() {
        try {
            const result = await chrome.storage.local.get(['itemTargetList']);
            this.itemTargetList = result.itemTargetList || [];
            
            console.log(`📋 Loaded ${this.itemTargetList.length} item targets`);
            
            this.updateItemListUI();
            
        } catch (error) {
            console.error('Error loading item target list:', error);
            this.itemTargetList = [];
            this.updateItemListUI();
        }
    }

async saveItemTargetList() {
  try {
    console.log(`💾 Saving ${this.itemTargetList.length} item targets...`);
    
    // 1. Save to local storage (primary) with retry logic
    let saveAttempts = 0;
    const maxAttempts = 3;
    
    while (saveAttempts < maxAttempts) {
      try {
        await chrome.storage.local.set({ itemTargetList: this.itemTargetList });
        console.log(`✅ Saved to local storage: ${this.itemTargetList.length} items (attempt ${saveAttempts + 1})`);
        break;
      } catch (localError) {
        saveAttempts++;
        console.warn(`⚠️ Local storage save attempt ${saveAttempts} failed:`, localError.message);
        if (saveAttempts >= maxAttempts) {
          throw localError;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // 2. Save to sync storage (backup) - with size limit handling
    try {
      const dataSize = JSON.stringify(this.itemTargetList).length;
      if (dataSize < 7000) { // Leave some buffer for 8KB limit
        await chrome.storage.sync.set({ itemTargetList: this.itemTargetList });
        console.log(`✅ Backed up to sync storage: ${this.itemTargetList.length} items`);
      } else {
        console.warn('⚠️ Item list too large for sync storage, using local only');
      }
    } catch (syncError) {
      console.warn('⚠️ Sync storage failed (quota exceeded):', syncError.message);
    }
    
    // 3. Update extension background immediately with retry logic
    let updateAttempts = 0;
    while (updateAttempts < maxAttempts) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'UPDATE_ITEM_TARGET_LIST',
          data: { itemTargetList: this.itemTargetList }
        });
        
        if (response && response.success) {
          console.log('✅ Item Target List synced to extension');
          break;
        } else {
          throw new Error(response?.error || 'Background script returned failure');
        }
      } catch (updateError) {
        updateAttempts++;
        console.warn(`⚠️ Background update attempt ${updateAttempts} failed:`, updateError.message);
        if (updateAttempts >= maxAttempts) {
          console.error('❌ Failed to sync to extension after multiple attempts:', updateError.message);
          this.showMessage('Saved locally, but extension sync failed - restart extension if needed', 'warning');
          return; // Don't throw error, data is still saved locally
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
  } catch (error) {
    console.error('❌ Error saving item target list:', error);
    this.showMessage('Failed to save item target list', 'error');
    throw error;
  }
}

    async addItemTarget() {
        const keywordInput = document.getElementById('itemKeyword');
        const minFloatInput = document.getElementById('minFloat');
        const maxFloatInput = document.getElementById('maxFloat');
        const minPercentDiffInput = document.getElementById('minPercentDiff');
        const maxPercentDiffInput = document.getElementById('maxPercentDiff');
        const minPriceInput = document.getElementById('minPrice');
        const maxPriceInput = document.getElementById('maxPrice');
        
        // UPDATED CODE:
        const keyword = keywordInput.value.trim();

        // Allow empty keywords for universal filters if other filters are enabled
        const hasPercentDiffFilter = minPercentDiffInput.value || maxPercentDiffInput.value;
        const hasPriceFilter = minPriceInput.value || maxPriceInput.value;

        if (!keyword && !hasPercentDiffFilter && !hasPriceFilter) {
            this.showMessage('Please enter an item keyword OR set price/% difference filters', 'error');
            return;
        }

// If no keyword but has filters, create a universal filter
const isUniversalFilter = !keyword && (hasPercentDiffFilter || hasPriceFilter);
const displayKeyword = keyword || `Universal Filter (${hasPercentDiffFilter ? '% Diff' : ''}${hasPercentDiffFilter && hasPriceFilter ? ' + ' : ''}${hasPriceFilter ? 'Price' : ''})`;

        // Check if item already exists (case-insensitive)
        const existingItem = this.itemTargetList.find(item => 
            (item.keyword || item.name).toLowerCase() === keyword.toLowerCase()
        );
        
        if (existingItem) {
            this.showMessage('This item is already in your target list', 'error');
            return;
        }

        // Parse float values (optional)
        let minFloat = minFloatInput.value ? parseFloat(minFloatInput.value) : 0.00;
        let maxFloat = maxFloatInput.value ? parseFloat(maxFloatInput.value) : 1.00;
        let minPercentDiff = minPercentDiffInput.value ? parseFloat(minPercentDiffInput.value) : null;
        let maxPercentDiff = maxPercentDiffInput.value ? parseFloat(maxPercentDiffInput.value) : null;
        let minPrice = minPriceInput.value ? parseFloat(minPriceInput.value) : null;
        let maxPrice = maxPriceInput.value ? parseFloat(maxPriceInput.value) : null;

        // Validate float range
        if (minFloat < 0 || minFloat > 1 || maxFloat < 0 || maxFloat > 1) {
            this.showMessage('Float values must be between 0.00 and 1.00', 'error');
            return;
        }

        if (minFloat > maxFloat) {
            this.showMessage('Minimum float cannot be greater than maximum float', 'error');
            return;
        }

        // Validate percentage difference range
        if (minPercentDiff !== null && maxPercentDiff !== null && minPercentDiff > maxPercentDiff) {
        this.showMessage('Minimum % difference cannot be greater than maximum % difference', 'error');
         return;
        }

        // Validate price range
        if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
        this.showMessage('Minimum price cannot be greater than maximum price', 'error');
        return;
        }

        if (minPrice !== null && minPrice < 0) {
        this.showMessage('Price values cannot be negative', 'error');
        return;
        }

        // Create new item with proper structure for extension
    const newItem = {
    id: Date.now().toString(),
    keyword: displayKeyword,
    name: displayKeyword,
    isUniversalFilter: isUniversalFilter,
    minFloat: minFloat,
    maxFloat: maxFloat,
    addedAt: Date.now(),
    floatFilter: {
        enabled: minFloat !== 0.00 || maxFloat !== 1.00,
        min: minFloat,
        max: maxFloat
    },
    percentDiffFilter: {
        enabled: minPercentDiff !== null || maxPercentDiff !== null,
        min: minPercentDiff,
        max: maxPercentDiff
    },
    priceFilter: {
        enabled: minPrice !== null || maxPrice !== null,
        min: minPrice,
        max: maxPrice
    }
};

        // Add to list
        this.itemTargetList.push(newItem);
        
        // Save and sync immediately
        await this.saveItemTargetList();
        this.updateItemListUI();

        // Clear inputs
        keywordInput.value = '';
        minFloatInput.value = '';
        maxFloatInput.value = '';
        minPercentDiffInput.value = '';
        maxPercentDiffInput.value = '';
        minPriceInput.value = '';
        maxPriceInput.value = '';

        this.showMessage(`Added "${keyword}" to target list`, 'success');
        console.log(`➕ Added item target: ${keyword} (${minFloat}-${maxFloat})`);
    }

    // Remove item 
    async removeItemTarget(itemId) {
        const itemIndex = this.itemTargetList.findIndex(item => item.id === itemId);
        if (itemIndex === -1) {
            console.error('Item not found for removal:', itemId);
            return;
        }

        const removedItem = this.itemTargetList[itemIndex];
        this.itemTargetList.splice(itemIndex, 1);
        
        // Save and sync immediately
        await this.saveItemTargetList();
        this.updateItemListUI();

        this.showMessage(`Removed "${removedItem.keyword || removedItem.name}" from target list`, 'success');
        console.log(`➖ Removed item target: ${removedItem.keyword || removedItem.name}`);
    }

    // Update item list UI
    updateItemListUI() {
        const itemsList = document.getElementById('itemsList');
        const itemsCount = document.getElementById('itemsCount');
        
        if (!itemsList || !itemsCount) {
            console.error('Item list UI elements not found');
            return;
        }

        // Update count
        itemsCount.textContent = `${this.itemTargetList.length} items being monitored`;

        // Clear existing content
        itemsList.innerHTML = '';

        if (this.itemTargetList.length === 0) {
            itemsList.innerHTML = `
                <div class="empty-state">
                    No items added yet. Add keywords above to start monitoring specific items.
                </div>
            `;
            return;
        }

        // Sort items by most recently added
        const sortedItems = [...this.itemTargetList].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

        // Create item entries
        sortedItems.forEach(item => {
            const itemEntry = document.createElement('div');
            itemEntry.className = 'item-entry';
            
            const hasCustomFloat = (item.minFloat !== undefined && item.maxFloat !== undefined) && 
                                   (item.minFloat !== 0.00 || item.maxFloat !== 1.00);
            const floatDisplay = hasCustomFloat 
                ? `Float: ${item.minFloat.toFixed(2)} - ${item.maxFloat.toFixed(2)}`
                : 'Any float (0.00 - 1.00)';
            // Add percentage difference display
            const hasPercentDiffFilter = item.percentDiffFilter?.enabled;
            const percentDiffDisplay = hasPercentDiffFilter
                ? `% Diff: ${item.percentDiffFilter.min ?? '-∞'}% to ${item.percentDiffFilter.max ?? '+∞'}%`
                : '';

// Add price filter display  
const hasPriceFilter = item.priceFilter?.enabled;
const priceDisplay = hasPriceFilter
    ? `Price: $${item.priceFilter.min ?? '0'} - $${item.priceFilter.max ?? '∞'}`
    : '';
            
            // Handle both keyword and name fields for backward compatibility
            const displayName = item.keyword || item.name || 'Unknown Item';
            
itemEntry.innerHTML = `
    <div class="item-info">
        <div class="item-keyword">${this.escapeHtml(displayName)}</div>
        <div class="item-wear-range">
            ${floatDisplay}
            ${hasCustomFloat ? '<span class="wear-badge small-badge">Custom Float</span>' : ''}
        </div>
        ${hasPercentDiffFilter ? `
        <div class="item-wear-range">
            ${percentDiffDisplay}
            <span class="wear-badge small-badge">Custom % Diff</span>
        </div>
        ` : ''}
        ${hasPriceFilter ? `
        <div class="item-wear-range">
            ${priceDisplay}
            <span class="wear-badge small-badge">Custom Price</span>
        </div>
        ` : ''}
    </div>
    <button class="remove-item-btn" data-item-id="${item.id}" title="Remove item">
        ×
    </button>
`;

            // Add click handler for remove button
            const removeBtn = itemEntry.querySelector('.remove-item-btn');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeItemTarget(item.id);
            });

            itemsList.appendChild(itemEntry);
        });

        console.log(`🎨 Updated item list UI with ${this.itemTargetList.length} items`);
    }

    // HTML escape helper
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    applyTheme(themeName) {
        console.log(`🎨 Applying theme: ${themeName}`);
        
        // Update body class
        document.body.className = `theme-${themeName}`;
        
        // Update crown SVG colors based on theme
        this.updateCrownColors(themeName);
        
        // Update active theme option
        this.updateThemeOptions(themeName);
        
        this.currentTheme = themeName;
    }

    updateCrownColors(themeName) {
        const crownPath = document.querySelector('.crown-path');
        const crownBase = document.querySelector('.crown-base');
        const crownLeft = document.querySelector('.crown-left');
        const crownRight = document.querySelector('.crown-right');
        
        if (themeName === 'shooting-star') {
            // Update to shooting star theme colors
            if (crownPath) {
                crownPath.setAttribute('fill', 'url(#crownGradientStar)');
                crownPath.setAttribute('stroke', '#4a90e2');
            }
            if (crownBase) crownBase.setAttribute('fill', '#87ceeb');
            if (crownLeft) crownLeft.setAttribute('fill', '#4a90e2');
            if (crownRight) crownRight.setAttribute('fill', '#4a90e2');
        } else {
            // Default nebula theme colors
            if (crownPath) {
                crownPath.setAttribute('fill', 'url(#crownGradient)');
                crownPath.setAttribute('stroke', '#667eea');
            }
            if (crownBase) crownBase.setAttribute('fill', '#764ba2');
            if (crownLeft) crownLeft.setAttribute('fill', '#667eea');
            if (crownRight) crownRight.setAttribute('fill', '#667eea');
        }
    }

    updateThemeOptions(selectedTheme) {
        // Update theme option active states
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
            if (option.getAttribute('data-theme') === selectedTheme) {
                option.classList.add('active');
            }
        });
    }

    setupEventListeners() {
        // API Key toggle functionality
        this.setupAPIKeyToggle();

        // Monitoring toggle
        const monitoringToggle = document.getElementById('monitoringToggle');
        if (monitoringToggle) {
            monitoringToggle.addEventListener('click', () => {
                const isActive = monitoringToggle.classList.contains('active');
                this.setMonitoringState(!isActive);
            });
        }

        // Sound toggle
        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', () => {
                const isActive = soundToggle.classList.contains('active');
                this.setSoundState(!isActive);
            });
        }

        // Site theming toggle
        const siteThemingToggle = document.getElementById('siteThemingToggle');
        if (siteThemingToggle) {
            siteThemingToggle.addEventListener('click', () => {
                const isActive = siteThemingToggle.classList.contains('active');
                this.setSiteThemingState(!isActive);
            });
        }

        // Item Target List event listeners
        this.setupItemTargetListEventListeners();

        // Theme selection
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', () => {
                const themeName = option.getAttribute('data-theme');
                this.setTheme(themeName);
            });
        });

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // Action buttons
        this.setupActionButtons();

        // Settings
        this.setupSettings();

        // Keychain filter controls
        this.setupKeychainFilterControls();

        // Listen for storage changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') {
                if (changes.selectedTheme) {
                    const newTheme = changes.selectedTheme.newValue;
                    if (newTheme !== this.currentTheme) {
                        console.log(`🎨 Theme changed to: ${newTheme}`);
                        this.applyTheme(newTheme);
                    }
                }
                if (changes.siteThemingEnabled) {
                    const newSiteThemingState = changes.siteThemingEnabled.newValue;
                    if (newSiteThemingState !== this.siteThemingEnabled) {
                        console.log(`🌟 Site theming changed to: ${newSiteThemingState}`);
                        this.siteThemingEnabled = newSiteThemingState;
                        this.updateToggleState('siteThemingToggle', newSiteThemingState);
                    }
                }
            }
            
            // Listen for item target list changes
            if (namespace === 'local' && changes.itemTargetList) {
                this.itemTargetList = changes.itemTargetList.newValue || [];
                this.updateItemListUI();
                console.log('📋 Item target list updated from storage');
            }
        });
    }

    setupAPIKeyToggle() {
        console.log('🔧 Setting up API key toggle...');

        const apiKeyToggle = document.getElementById('apiKeyToggle');
        const apiKeyContent = document.getElementById('apiKeyContent');
        const apiKeyInput = document.getElementById('apiKeyInput');
        const domainSelect = document.getElementById('domainSelect');
        const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');

        // Load current API key info on startup
        this.loadCurrentAPIKeyInfo();

        // Get the specific header element instead of the entire toggle
        const apiKeyHeader = document.querySelector('.api-key-header');

        if (apiKeyHeader) {
            apiKeyHeader.addEventListener('click', () => {
            const isExpanded = apiKeyToggle.classList.contains('expanded');
        
        if (isExpanded) {
            // Collapse
            apiKeyToggle.classList.remove('expanded');
            apiKeyContent.classList.remove('expanded');
        } else {
            // Expand and load current values
            apiKeyToggle.classList.add('expanded');
            apiKeyContent.classList.add('expanded');
            this.loadCurrentAPIKeyInfo();
        }
    });
}

        // Prevent clicks within the content area from bubbling up
        if (apiKeyContent) {
        apiKeyContent.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

        // API key form submission
        if (saveApiKeyBtn) {
            saveApiKeyBtn.addEventListener('click', async () => {
                const apiKey = apiKeyInput.value.trim();
                const domain = domainSelect.value;

                if (!apiKey) {
                    this.showMessage('Please enter your API key', 'error');
                    return;
                }

                if (apiKey.length < 10) {
                    this.showMessage('API key seems too short - please check it', 'error');
                    return;
                }

                try {
                    saveApiKeyBtn.textContent = 'Saving...';
                    saveApiKeyBtn.disabled = true;

                    const response = await chrome.runtime.sendMessage({
                        type: 'SET_API_KEY',
                        data: { apiKey, domain }
                    });

                    if (response && response.success) {
                        this.showMessage('API key saved and connection started!', 'success');
                        this.updateAPIKeyStatus(true, 'Configured');
                        // Refresh stats to show new connection
                        setTimeout(() => this.loadStats(), 1000);
                    } else {
                        this.showMessage(response?.error || 'Failed to save API key', 'error');
                    }
                } catch (error) {
                    console.error('Error saving API key:', error);
                    this.showMessage('Failed to save API key', 'error');
                } finally {
                    saveApiKeyBtn.innerHTML = `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                            <polyline points="17,21 17,13 7,13 7,21"/>
                            <polyline points="7,3 7,8 15,8"/>
                        </svg>
                        Save & Connect
                    `;
                    saveApiKeyBtn.disabled = false;
                }
            });
        }

        // Enter key in API key input
        if (apiKeyInput) {
            apiKeyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    saveApiKeyBtn.click();
                }
            });
        }

        console.log('✅ API key toggle setup complete');
    }

    async loadCurrentAPIKeyInfo() {
        try {
            const result = await chrome.storage.local.get(['csgoempire_api_key', 'csgoempire_domain']);
            const apiKeyInput = document.getElementById('apiKeyInput');
            const domainSelect = document.getElementById('domainSelect');
            
            if (apiKeyInput && result.csgoempire_api_key) {
                // Show masked API key
                const maskedKey = result.csgoempire_api_key.substring(0, 8) + '...' + result.csgoempire_api_key.slice(-4);
                apiKeyInput.placeholder = `Current: ${maskedKey}`;
                apiKeyInput.value = ''; // Keep input empty so user can enter new key if needed
            }
            
            if (domainSelect && result.csgoempire_domain) {
                domainSelect.value = result.csgoempire_domain;
            }
            
        } catch (error) {
            console.error('Error loading current API key info:', error);
        }
    }

    updateAPIKeyStatus(configured, statusText) {
        const apiStatusIndicator = document.getElementById('apiStatusIndicator');
        const apiStatusText = document.getElementById('apiStatusText');
        
        if (apiStatusIndicator) {
            if (configured) {
                apiStatusIndicator.classList.add('configured');
            } else {
                apiStatusIndicator.classList.remove('configured');
            }
        }
        
        if (apiStatusText) {
            apiStatusText.textContent = statusText;
        }
    }

    // Setup Item Target List event listeners
    setupItemTargetListEventListeners() {
        console.log('🔧 Setting up Item Target List controls...');

        // Add item button
        const addItemBtn = document.getElementById('addItemBtn');
        if (addItemBtn) {
            addItemBtn.addEventListener('click', () => {
                this.addItemTarget();
            });
        }

        // Enter key in keyword input
        const keywordInput = document.getElementById('itemKeyword');
        if (keywordInput) {
            keywordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addItemTarget();
                }
            });
        }

        // Float validation
        const minFloatInput = document.getElementById('minFloat');
        const maxFloatInput = document.getElementById('maxFloat');
        
        [minFloatInput, maxFloatInput].forEach(input => {
            if (input) {
                input.addEventListener('input', (e) => {
                    let value = parseFloat(e.target.value);
                    if (value < 0) e.target.value = '0.00';
                    if (value > 1) e.target.value = '1.00';
                });
            }
        });

        console.log('✅ Item Target List controls setup complete');
    }

    // Setup keychain filter controls
    setupKeychainFilterControls() {
        console.log('🔧 Setting up keychain filter controls...');

        // Percentage slider
        const percentageSlider = document.getElementById('keychainPercentage');
        const percentageValue = document.getElementById('percentageValue');
        
        if (percentageSlider && percentageValue) {
            percentageSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                percentageValue.textContent = `${value}% of market value`;
            });
        }

        // Keychain list toggle
        const listToggle = document.getElementById('keychainListToggle');
        const keychainList = document.getElementById('keychainList');
        
        if (listToggle && keychainList) {
            listToggle.addEventListener('click', () => {
                const isExpanded = keychainList.classList.contains('expanded');
                if (isExpanded) {
                    keychainList.classList.remove('expanded');
                    listToggle.classList.remove('expanded');
                } else {
                    keychainList.classList.add('expanded');
                    listToggle.classList.add('expanded');
                }
            });
        }

        // Select all/none buttons
        const selectAllBtn = document.getElementById('selectAll');
        const selectNoneBtn = document.getElementById('selectNone');
        
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.selectAllKeychains(true);
            });
        }
        
        if (selectNoneBtn) {
            selectNoneBtn.addEventListener('click', () => {
                this.selectAllKeychains(false);
            });
        }

        // Save keychain filter button
        const saveKeychainBtn = document.getElementById('saveKeychainFilter');
        if (saveKeychainBtn) {
            saveKeychainBtn.addEventListener('click', () => {
                this.saveKeychainFilterSettings();
            });
        }

        console.log('✅ Keychain filter controls setup complete');
    }

    async loadKeychainFilterSettings() {
        try {
            console.log('🔧 Loading keychain filter settings...');
            
            const response = await chrome.runtime.sendMessage({
                type: 'GET_KEYCHAIN_FILTER_SETTINGS'
            });
            
            if (response && response.success) {
                this.keychainFilterSettings = response.data;
                this.updateKeychainFilterUI();
                console.log('✅ Keychain filter settings loaded:', this.keychainFilterSettings);
            } else {
                throw new Error(response?.error || 'Failed to load keychain filter settings');
            }
        } catch (error) {
            console.error('❌ Error loading keychain filter settings:', error);
            this.useDefaultKeychainSettings();
        }
    }

    useDefaultKeychainSettings() {
        this.keychainFilterSettings = {
            percentageThreshold: 50,
            enabledKeychains: [
                "Hot Howl", "Baby Karat T", "Hot Wurst", "Baby Karat CT", "Semi-Precious", 
                "Diamond Dog", "Titeenium AWP", "Lil' Monster", "Diner Dog", "Lil' Squirt"
            ],
            allKeychains: [
                { name: "Hot Howl", category: "Red", price: 70.0 },
                { name: "Baby Karat T", category: "Red", price: 50.0 },
                { name: "Hot Wurst", category: "Red", price: 30.0 },
                { name: "Baby Karat CT", category: "Red", price: 30.0 },
                { name: "Semi-Precious", category: "Pink", price: 40.0 },
                { name: "Diamond Dog", category: "Pink", price: 25.0 },
                { name: "Titeenium AWP", category: "Pink", price: 10.0 },
                { name: "Lil' Monster", category: "Pink", price: 10.0 },
                { name: "Diner Dog", category: "Pink", price: 5.0 },
                { name: "Lil' Squirt", category: "Pink", price: 5.0 }
            ],
            enabledCount: 10,
            totalKeychains: 33
        };
        this.updateKeychainFilterUI();
        console.log('🔧 Using default keychain settings');
    }

    updateKeychainFilterUI() {
    console.log('🎨 Updating keychain filter UI...');
    
    try {
        // Update percentage slider
        const percentageSlider = document.getElementById('keychainPercentage');
        const percentageValue = document.getElementById('percentageValue');
        
        if (percentageSlider && percentageValue) {
            // Fix: Use nullish coalescing instead of logical OR to handle 0 properly
            const threshold = this.keychainFilterSettings.percentageThreshold ?? 50;
            percentageSlider.value = threshold;
            percentageValue.textContent = `${threshold}% of market value`;
        }

        // Update enabled count
        const enabledCount = document.getElementById('enabledCount');
        if (enabledCount) {
            const count = this.keychainFilterSettings.enabledKeychains?.length || 0;
            const total = this.keychainFilterSettings.totalKeychains || this.keychainFilterSettings.allKeychains?.length || 0;
            enabledCount.textContent = `${count}/${total}`;
        }

        // Populate keychain list
        this.populateKeychainList();
        
    } catch (error) {
        console.error('❌ Error updating keychain filter UI:', error);
        this.showMessage('Error updating keychain filter UI', 'error');
    }
}

    populateKeychainList() {
        console.log('🔧 Populating keychain list...');
        
        const keychainItems = document.getElementById('keychainItems');
        if (!keychainItems) {
            console.error('❌ Keychain items container not found');
            return;
        }

        if (!this.keychainFilterSettings.allKeychains || !Array.isArray(this.keychainFilterSettings.allKeychains)) {
            console.error('❌ No keychain data available');
            keychainItems.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8;">No keychain data available</div>';
            return;
        }

        keychainItems.innerHTML = '';

        this.keychainFilterSettings.allKeychains.forEach((keychain) => {
            const isEnabled = this.keychainFilterSettings.enabledKeychains?.includes(keychain.name) || false;
            
            const keychainItem = document.createElement('div');
            keychainItem.className = `keychain-item ${keychain.category?.toLowerCase() || 'unknown'}`;
            
            keychainItem.innerHTML = `
                <div class="keychain-checkbox ${isEnabled ? 'checked' : ''}" data-keychain="${keychain.name}"></div>
                <div class="keychain-info">
                    <div class="keychain-name">${keychain.name || 'Unknown'}</div>
                    <div class="keychain-price">${(keychain.price || 0).toFixed(2)}</div>
                </div>
            `;
            
            // Add click handler for the entire item
            keychainItem.addEventListener('click', () => {
                this.toggleKeychainSelection(keychain.name);
            });
            
            keychainItems.appendChild(keychainItem);
        });

        console.log(`✅ Populated ${this.keychainFilterSettings.allKeychains.length} keychain items`);
    }

    toggleKeychainSelection(keychainName) {
        const checkbox = document.querySelector(`[data-keychain="${keychainName}"]`);
        if (!checkbox) {
            console.error(`❌ Checkbox not found for keychain: ${keychainName}`);
            return;
        }

        const isCurrentlyChecked = checkbox.classList.contains('checked');
        
        // Ensure enabledKeychains is an array
        if (!Array.isArray(this.keychainFilterSettings.enabledKeychains)) {
            this.keychainFilterSettings.enabledKeychains = [];
        }
        
        if (isCurrentlyChecked) {
            checkbox.classList.remove('checked');
            // Remove from enabled list
            this.keychainFilterSettings.enabledKeychains = this.keychainFilterSettings.enabledKeychains.filter(name => name !== keychainName);
        } else {
            checkbox.classList.add('checked');
            // Add to enabled list
            if (!this.keychainFilterSettings.enabledKeychains.includes(keychainName)) {
                this.keychainFilterSettings.enabledKeychains.push(keychainName);
            }
        }

        // Update enabled count display
        const enabledCount = document.getElementById('enabledCount');
        if (enabledCount) {
            const total = this.keychainFilterSettings.allKeychains?.length || 0;
            enabledCount.textContent = `${this.keychainFilterSettings.enabledKeychains.length}/${total}`;
        }
    }

    selectAllKeychains(selectAll) {
        // Ensure enabledKeychains is an array
        if (!Array.isArray(this.keychainFilterSettings.enabledKeychains)) {
            this.keychainFilterSettings.enabledKeychains = [];
        }

        document.querySelectorAll('.keychain-checkbox').forEach(checkbox => {
            const keychainName = checkbox.getAttribute('data-keychain');
            
            if (selectAll) {
                checkbox.classList.add('checked');
                if (!this.keychainFilterSettings.enabledKeychains.includes(keychainName)) {
                    this.keychainFilterSettings.enabledKeychains.push(keychainName);
                }
            } else {
                checkbox.classList.remove('checked');
                this.keychainFilterSettings.enabledKeychains = this.keychainFilterSettings.enabledKeychains.filter(name => name !== keychainName);
            }
        });

        // Update enabled count display
        const enabledCount = document.getElementById('enabledCount');
        if (enabledCount) {
            const total = this.keychainFilterSettings.allKeychains?.length || 0;
            enabledCount.textContent = `${this.keychainFilterSettings.enabledKeychains.length}/${total}`;
        }
    }

    async saveKeychainFilterSettings() {
        try {
            const percentageSlider = document.getElementById('keychainPercentage');
            const percentageThreshold = percentageSlider ? parseInt(percentageSlider.value) : 50;

            console.log('💾 Saving keychain filter settings...');

            // Show loading state
            const saveBtn = document.getElementById('saveKeychainFilter');
            if (saveBtn) {
                saveBtn.textContent = 'Saving...';
                saveBtn.disabled = true;
            }

            // Save percentage threshold
            const percentageResponse = await chrome.runtime.sendMessage({
                type: 'UPDATE_KEYCHAIN_PERCENTAGE',
                data: { percentageThreshold }
            });

            if (!percentageResponse || !percentageResponse.success) {
                throw new Error(percentageResponse?.error || 'Failed to update percentage threshold');
            }

            // Save enabled keychains
            const keychainsResponse = await chrome.runtime.sendMessage({
                type: 'UPDATE_ENABLED_KEYCHAINS', 
                data: { enabledKeychains: this.keychainFilterSettings.enabledKeychains }
            });

            if (!keychainsResponse || !keychainsResponse.success) {
                throw new Error(keychainsResponse?.error || 'Failed to update enabled keychains');
            }

            this.showMessage(`✅ Keychain filter saved! ${this.keychainFilterSettings.enabledKeychains.length} keychains enabled, ${percentageThreshold}% threshold`, 'success');
            
        } catch (error) {
            console.error('❌ Error saving keychain filter settings:', error);
            this.showMessage(`❌ Failed to save keychain filter: ${error.message}`, 'error');
        } finally {
            // Restore button state
            const saveBtn = document.getElementById('saveKeychainFilter');
            if (saveBtn) {
                saveBtn.innerHTML = `
                    <svg class="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17,21 17,13 7,13 7,21"/>
                        <polyline points="7,3 7,8 15,8"/>
                    </svg>
                    Save Keychain Settings
                `;
                saveBtn.disabled = false;
            }
        }
    }

    setupActionButtons() {
        // Test notification
        const testBtn = document.getElementById('testNotification');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testNotification());
        }

        // View history
        const historyBtn = document.getElementById('viewHistory');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => {
                chrome.tabs.create({url: chrome.runtime.getURL('history.html')});
            });
        }

    // Open tracker
    const trackerBtn = document.getElementById('openTracker');
    if (trackerBtn) {
        trackerBtn.addEventListener('click', () => {
            chrome.tabs.create({url: chrome.runtime.getURL('Tracker/tracker.html')});
        });
    }

        // Connect button
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                this.connect();
            });
        }

        // Disconnect button
        const disconnectBtn = document.getElementById('disconnectBtn');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => {
                this.disconnect();
            });
        }
    }

    setupSettings() {
        // Price range inputs
        const minInput = document.getElementById('minPercentage');
        const maxInput = document.getElementById('maxPercentage');
        const rangeDisplay = document.getElementById('rangeDisplay');

        const updateRangeDisplay = () => {
            if (minInput && maxInput && rangeDisplay) {
                const min = minInput.value;
                const max = maxInput.value;
                rangeDisplay.textContent = `Range: ${min}% to +${max}% above recommended price`;
            }
        };

        if (minInput) {
            minInput.addEventListener('input', updateRangeDisplay);
        }
        if (maxInput) {
            maxInput.addEventListener('input', updateRangeDisplay);
        }

        // Save settings button
        const saveBtn = document.getElementById('saveSettings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        // Enable notifications button
        const enableNotificationsBtn = document.getElementById('enableNotifications');
        if (enableNotificationsBtn) {
            enableNotificationsBtn.addEventListener('click', () => this.enableNotifications());
        }
    }

    async loadCurrentFilterSettings() {
        try {
            console.log('🔄 Loading current filter settings...');
            
            const stats = await this.getStatsFromBackground();
            
            if (stats && stats.priceFilter) {
                const minInput = document.getElementById('minPercentage');
                const maxInput = document.getElementById('maxPercentage');
                const rangeDisplay = document.getElementById('rangeDisplay');
                
                if (minInput && maxInput && rangeDisplay) {
                    // Set the values from extension
                    minInput.value = stats.priceFilter.minAboveRecommended;
                    maxInput.value = stats.priceFilter.maxAboveRecommended;
                    
                    // Update the range display
                    rangeDisplay.textContent = `Range: ${stats.priceFilter.minAboveRecommended}% to +${stats.priceFilter.maxAboveRecommended}% above recommended price`;
                    
                    console.log(`✅ Loaded filter settings: ${stats.priceFilter.minAboveRecommended}% to ${stats.priceFilter.maxAboveRecommended}%`);
                }
            }
            
            // Load keychain item price settings
            if (stats && stats.keychainFilter) {
                const minPriceInput = document.getElementById('minKeychainItemPrice');
                const maxPriceInput = document.getElementById('maxKeychainItemPrice');
                
                if (minPriceInput && maxPriceInput) {
                    // Set the values from extension (null values become empty strings)
                    minPriceInput.value = stats.keychainFilter.minItemPrice !== null ? stats.keychainFilter.minItemPrice : '';
                    maxPriceInput.value = stats.keychainFilter.maxItemPrice !== null ? stats.keychainFilter.maxItemPrice : '';
                    
                    console.log(`✅ Loaded keychain item price settings: $${stats.keychainFilter.minItemPrice || 'no min'} to $${stats.keychainFilter.maxItemPrice || 'no max'}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Error loading current filter settings:', error);
        }
    }

    async getStatsFromBackground() {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({type: 'GET_STATS'}, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    async setTheme(themeName) {
        console.log(`🎨 Setting theme to: ${themeName}`);
        
        try {
            // Save to storage
            await chrome.storage.sync.set({ selectedTheme: themeName });
            console.log(`✅ Theme "${themeName}" saved to storage`);
            
            // Apply theme locally
            this.applyTheme(themeName);
            
            // Notify background script
            chrome.runtime.sendMessage({
                type: 'THEME_CHANGED',
                data: { theme: themeName }
            });
            
            this.showMessage(`Theme changed to ${themeName === 'shooting-star' ? 'Shooting Star' : 'Nebula'}`, 'success');
            
        } catch (error) {
            console.error('Error setting theme:', error);
            this.showMessage('Failed to change theme', 'error');
        }
    }

    async setSiteThemingState(enabled) {
        console.log(`🌟 Setting site theming to: ${enabled ? 'enabled' : 'disabled'}`);
        
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'SET_SITE_THEMING_STATE',
                data: { enabled }
            });

            if (response && response.success) {
                this.siteThemingEnabled = enabled;
                this.updateToggleState('siteThemingToggle', enabled);
                this.showMessage(enabled ? 'Site theming enabled' : 'Site theming disabled', 'success');
            }
        } catch (error) {
            console.error('Error setting site theming state:', error);
            this.showMessage('Failed to update site theming state', 'error');
        }
    }

    async setMonitoringState(enabled) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'SET_MONITORING_STATE',
                data: { enabled }
            });

            if (response && response.success) {
                this.updateToggleState('monitoringToggle', enabled);
                this.showMessage(enabled ? 'Monitoring enabled' : 'Monitoring disabled', 'success');
                
                // Update stats immediately
                setTimeout(() => this.loadStats(), 500);
            }
        } catch (error) {
            console.error('Error setting monitoring state:', error);
            this.showMessage('Failed to update monitoring state', 'error');
        }
    }

    async setSoundState(enabled) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'SET_SOUND_STATE',
                data: { enabled }
            });

            if (response && response.success) {
                this.updateToggleState('soundToggle', enabled);
                this.showMessage(enabled ? 'Sounds enabled' : 'Sounds disabled', 'success');
            }
        } catch (error) {
            console.error('Error setting sound state:', error);
            this.showMessage('Failed to update sound state', 'error');
        }
    }

    async connect() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'CONNECT'
            });

            if (response && response.success) {
                this.showMessage('Connection initiated', 'success');
                
                // Update stats immediately
                setTimeout(() => this.loadStats(), 500);
            } else {
                this.showMessage(response?.error || 'Failed to connect', 'error');
            }
        } catch (error) {
            console.error('Error connecting:', error);
            this.showMessage('Failed to connect', 'error');
        }
    }

    async disconnect() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'DISCONNECT'
            });

            if (response && response.success) {
                this.showMessage('Disconnected from CSGOEmpire', 'success');
                
                // Update stats immediately
                setTimeout(() => this.loadStats(), 500);
            }
        } catch (error) {
            console.error('Error disconnecting:', error);
            this.showMessage('Failed to disconnect', 'error');
        }
    }

    updateToggleState(toggleId, isActive) {
        const toggle = document.getElementById(toggleId);
        if (toggle) {
            if (isActive) {
                toggle.classList.add('active');
            } else {
                toggle.classList.remove('active');
            }
        } else {
            console.warn(`🚨 Toggle element ${toggleId} not found`);
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }

    async loadStats() {
        try {
            const response = await chrome.runtime.sendMessage({type: 'GET_STATS'});
            
            if (response) {
                this.currentStats = response;
                this.updateUI(response);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            this.updateConnectionStatus(false, false, 'Connection failed');
        }
    }

    updateUI(data) {
        // Update stats
        this.updateElement('keychainsFound', data.stats?.keychainsFound || 0);
        
        // Update uptime
        if (data.stats?.uptime) {
            const uptime = this.formatUptime(data.stats.uptime);
            this.updateElement('uptime', uptime);
        }

        // Update connection status
        this.updateConnectionStatus(data.connected, data.authenticated, data.monitoringEnabled);

        // Update toggles
        this.updateToggleState('monitoringToggle', data.monitoringEnabled);
        this.updateToggleState('soundToggle', data.soundEnabled);
        
        if (data.siteThemingEnabled !== undefined) {
            this.siteThemingEnabled = data.siteThemingEnabled;
            this.updateToggleState('siteThemingToggle', data.siteThemingEnabled);
        }

        // Update theme if it changed
        if (data.currentTheme && data.currentTheme !== this.currentTheme) {
            this.applyTheme(data.currentTheme);
        }

        // Update server info
        this.updateElement('serverStatus', this.getConnectionStatusText(data.connected, data.authenticated));
        if (data.connectionStartTime) {
            this.updateElement('lastConnection', new Date(data.connectionStartTime).toLocaleTimeString());
        }

        // Update API key status
        if (data.apiKeyConfigured !== undefined) {
            this.updateAPIKeyStatus(data.apiKeyConfigured, data.apiKeyConfigured ? 'Configured' : 'Not Configured');
        }

        // Update domain info
        if (data.domain) {
            this.updateElement('currentDomain', data.domain);
        }

        // Show/hide connect/disconnect buttons based on connection state
        this.updateConnectDisconnectButtons(data.connected, data.authenticated, data.apiKeyConfigured);
    }

    updateConnectDisconnectButtons(connected, authenticated, apiKeyConfigured) {
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        
        if (connectBtn && disconnectBtn) {
            if (connected && authenticated) {
                // Show disconnect button
                connectBtn.style.display = 'none';
                disconnectBtn.style.display = 'flex';
            } else if (apiKeyConfigured) {
                // Show connect button if API key is configured but not connected
                connectBtn.style.display = 'flex';
                disconnectBtn.style.display = 'none';
            } else {
                // Hide both if no API key
                connectBtn.style.display = 'none';
                disconnectBtn.style.display = 'none';
            }
        }
    }

    getConnectionStatusText(connected, authenticated) {
        if (connected && authenticated) {
            return 'Connected & Authenticated';
        } else if (connected && !authenticated) {
            return 'Connected - Authenticating...';
        } else {
            return 'Disconnected';
        }
    }

    updateConnectionStatus(connected, authenticated, monitoringEnabled) {
        const indicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const errorMessage = document.getElementById('errorMessage');

        if (!monitoringEnabled) {
            indicator.className = 'status-indicator disabled';
            statusText.textContent = 'Monitoring Disabled';
            if (errorMessage) errorMessage.style.display = 'none';
        } else if (connected && authenticated) {
            indicator.className = 'status-indicator connected';
            statusText.textContent = 'Connected & Monitoring';
            if (errorMessage) errorMessage.style.display = 'none';
        } else if (connected && !authenticated) {
            indicator.className = 'status-indicator partial';
            statusText.textContent = 'Connected - Authenticating...';
            if (errorMessage) errorMessage.style.display = 'none';
        } else {
            indicator.className = 'status-indicator disconnected';
            statusText.textContent = 'Server Disconnected';
            if (errorMessage) {
                errorMessage.textContent = 'WebSocket disconnected. Check your API key and internet connection.';
                errorMessage.style.display = 'block';
            }
        }
    }

    updateElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
        }
    }

    async testNotification() {
        try {
            const response = await chrome.runtime.sendMessage({type: 'TEST_NOTIFICATION'});
            
            if (response && response.success) {
                this.showMessage(response.message || 'Test notification sent!', 'success');
            } else {
                this.showMessage(response?.error || 'Failed to send test notification', 'error');
            }
        } catch (error) {
            console.error('Error testing notification:', error);
            this.showMessage('Failed to send test notification', 'error');
        }
    }

    async saveSettings() {
        const minInput = document.getElementById('minPercentage');
        const maxInput = document.getElementById('maxPercentage');
        const minPriceInput = document.getElementById('minKeychainItemPrice');
        const maxPriceInput = document.getElementById('maxKeychainItemPrice');

        if (!minInput || !maxInput || !minPriceInput || !maxPriceInput) return;

        const minPercentage = parseFloat(minInput.value);
        const maxPercentage = parseFloat(maxInput.value);

        if (minPercentage > maxPercentage) {
            this.showMessage('Minimum percentage cannot be greater than maximum', 'error');
            return;
        }

        // Parse keychain item price values (empty string becomes null)
        const minItemPrice = minPriceInput.value.trim() === '' ? null : parseFloat(minPriceInput.value);
        const maxItemPrice = maxPriceInput.value.trim() === '' ? null : parseFloat(maxPriceInput.value);

        // Validate keychain item price range
        if (minItemPrice !== null && maxItemPrice !== null && minItemPrice > maxItemPrice) {
            this.showMessage('Minimum keychain item price cannot be greater than maximum', 'error');
            return;
        }

        // Validate price values are not negative
        if ((minItemPrice !== null && minItemPrice < 0) || (maxItemPrice !== null && maxItemPrice < 0)) {
            this.showMessage('Keychain item prices cannot be negative', 'error');
            return;
        }

        try {
            // Update percentage filter
            const priceResponse = await chrome.runtime.sendMessage({
                type: 'UPDATE_PRICE_FILTER',
                data: { minPercentage, maxPercentage }
            });

            if (!priceResponse || !priceResponse.success) {
                this.showMessage(priceResponse?.error || 'Failed to save percentage settings', 'error');
                return;
            }

            // Update keychain item price filter
            const itemPriceResponse = await chrome.runtime.sendMessage({
                type: 'UPDATE_KEYCHAIN_ITEM_PRICE_FILTER',
                data: { minItemPrice, maxItemPrice }
            });

            if (itemPriceResponse && itemPriceResponse.success) {
                this.showMessage(itemPriceResponse.message || 'Settings saved successfully!', 'success');
            } else {
                this.showMessage(itemPriceResponse?.error || 'Failed to save keychain item price settings', 'error');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showMessage('Failed to save settings', 'error');
        }
    }

    showMessage(text, type) {
        console.log(`${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '❌'} ${text}`);
        
        const errorDiv = document.getElementById('errorMessage');

        // Only show temporary error/warning messages, don't interfere with status display
        if ((type === 'error' || type === 'warning') && errorDiv) {
            // Save current error state 
            const wasVisible = errorDiv.style.display !== 'none';
            const originalText = errorDiv.textContent;
            
            // Show temporary message
            errorDiv.textContent = text;
            errorDiv.style.display = 'block';
            if (type === 'warning') {
                errorDiv.style.backgroundColor = 'rgba(245, 158, 11, 0.12)';
                errorDiv.style.borderColor = 'rgba(245, 158, 11, 0.25)';
                errorDiv.style.color = '#fbbf24';
            } else {
                // Reset to error styling
                errorDiv.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                errorDiv.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                errorDiv.style.color = '#fca5a5';
            }
            
            // Restore original state after timeout
            setTimeout(() => {
                if (wasVisible) {
                    errorDiv.textContent = originalText;
                    errorDiv.style.display = 'block';
                } else {
                    errorDiv.style.display = 'none';
                }
                // Reset to default error styling
                errorDiv.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                errorDiv.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                errorDiv.style.color = '#fca5a5';
            }, 5000);
        }
        
        // For success messages, just log them
        if (type === 'success') {
            console.log('✅ Success:', text);
        }
    }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});

// Module system initialization
(async function() {
  try {
    await import('./core/event-bus.js');
    await import('./core/module-loader.js'); 
    await import('./core/base-module.js');
    
    window.empireModuleLoader.setContext('popup');
    await window.empireModuleLoader.autoLoadModules();
  } catch (error) {
    console.log('⚠️ Module system not ready yet');
  }
})();
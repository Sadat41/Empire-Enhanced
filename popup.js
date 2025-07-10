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
        this.isServerSynced = false; // Track if we've synced with server
        this.init();
    }

    async init() {
        console.log('🚀 Popup initialized');
        
        // Load theme and site theming state first
        await this.loadTheme();
        
        // Sync with server before loading local data
        await this.syncWithServer();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data (this will now have server-synced data)
        await this.loadStats();
        
        // Load keychain filter settings with retry
        await this.loadKeychainFilterSettingsWithRetry();

        
        await this.loadCurrentFilterSettings();
        
        // Setup auto-refresh
        setInterval(() => this.loadStats(), 5000);
    }

    // Sync with server on popup load
    async syncWithServer() {
        console.log('🔄 Syncing popup with server...');
        
        try {
            // Check if server is available
            const healthResponse = await this.fetchWithTimeout('http://localhost:3001/health', 3000);
            if (!healthResponse.ok) {
                throw new Error('Server health check failed');
            }
            
            console.log('✅ Server is available, syncing data...');
            
            // Force background script to sync with server
            const syncResponse = await chrome.runtime.sendMessage({
                type: 'FORCE_SYNC'
            });
            
            if (syncResponse && syncResponse.success) {
                console.log('✅ Background sync completed');
                
                // Now load the synced data
                await this.loadItemTargetList();
                
                this.isServerSynced = true;
                console.log('✅ Popup fully synced with server');
            } else {
                throw new Error(syncResponse?.error || 'Background sync failed');
            }
            
        } catch (error) {
            console.error('❌ Server sync failed:', error);
            console.log('⚠️ Loading from local storage as fallback');
            
            // Load from local storage as fallback
            await this.loadItemTargetList();
            
            // Show sync status to user
            this.showSyncStatus(false, error.message);
        }
    }

    // Helper method for fetch with timeout
    async fetchWithTimeout(url, timeout = 5000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                method: 'GET'
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    // Show sync status to user
    showSyncStatus(isSuccess, message) {
        console.log(`🔄 Sync status: ${isSuccess ? 'success' : 'failed'} - ${message}`);
        
        // Could add UI indicator here if needed
        if (!isSuccess) {
            // Show a temporary message that we're working with local data
            this.showMessage('Using local data - server sync will retry automatically', 'warning');
        }
    }

    async loadTheme() {
        try {
            const settings = await chrome.storage.sync.get({
                selectedTheme: 'nebula',
                siteThemingEnabled: true
            });
            
            this.currentTheme = settings.selectedTheme;
            this.siteThemingEnabled = settings.siteThemingEnabled;
            this.applyTheme(this.currentTheme);
            
            console.log(`🎨 Popup loaded theme: ${this.currentTheme}, site theming: ${this.siteThemingEnabled}`);
        } catch (error) {
            console.error('Error loading theme:', error);
            // Fall back to default theme
            this.applyTheme('nebula');
        }
    }

    // Load item target list with server priority
    async loadItemTargetList() {
        try {
            // If we're synced with server, local storage should have the correct data
            const result = await chrome.storage.local.get(['itemTargetList']);
            this.itemTargetList = result.itemTargetList || [];
            
            console.log(`📋 Loaded ${this.itemTargetList.length} item targets${this.isServerSynced ? ' (server-synced)' : ' (local only)'}`);
            
            this.updateItemListUI();
            
        } catch (error) {
            console.error('Error loading item target list:', error);
            this.itemTargetList = [];
            this.updateItemListUI();
        }
    }

    // UPDATED: Save item target list with immediate server sync
    async saveItemTargetList() {
        try {
            // Save to local storage first
            await chrome.storage.local.set({ itemTargetList: this.itemTargetList });
            console.log(`💾 Saved ${this.itemTargetList.length} item targets to local storage`);
            
            // Immediately sync with server
            const response = await chrome.runtime.sendMessage({
                type: 'UPDATE_ITEM_TARGET_LIST',
                data: { itemTargetList: this.itemTargetList }
            });
            
            if (response && response.success) {
                console.log('✅ Item Target List synced to server successfully');
            } else {
                console.error('❌ Failed to sync to server:', response?.error);
                this.showMessage('Saved locally, but server sync failed', 'warning');
            }
            
        } catch (error) {
            console.error('Error saving item target list:', error);
            this.showMessage('Failed to save item target list', 'error');
        }
    }

    
    async addItemTarget() {
        const keywordInput = document.getElementById('itemKeyword');
        const minFloatInput = document.getElementById('minFloat');
        const maxFloatInput = document.getElementById('maxFloat');
        
        const keyword = keywordInput.value.trim();
        if (!keyword) {
            this.showMessage('Please enter an item keyword', 'error');
            return;
        }

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

        // Validate float range
        if (minFloat < 0 || minFloat > 1 || maxFloat < 0 || maxFloat > 1) {
            this.showMessage('Float values must be between 0.00 and 1.00', 'error');
            return;
        }

        if (minFloat > maxFloat) {
            this.showMessage('Minimum float cannot be greater than maximum float', 'error');
            return;
        }

        // Create new item
        const newItem = {
            id: Date.now().toString(),
            keyword: keyword,
            name: keyword, // Include both for server compatibility
            minFloat: minFloat,
            maxFloat: maxFloat,
            addedAt: Date.now()
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

        this.showMessage(`Added "${keyword}" to target list`, 'success');
        console.log(`➕ Added item target: ${keyword} (${minFloat}-${maxFloat})`);
    }

    // Remove item with immediate sync
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

        // Update count with sync status
        const syncStatus = this.isServerSynced ? '(synced)' : '(local only)';
        itemsCount.textContent = `${this.itemTargetList.length} items being monitored ${syncStatus}`;

        // Clear existing content
        itemsList.innerHTML = '';

        if (this.itemTargetList.length === 0) {
            itemsList.innerHTML = `
                <div class="empty-state">
                    No items added yet. Add keywords above to start monitoring specific items.
                    ${!this.isServerSynced ? '<br><small style="color: #f59e0b;">⚠️ Server sync pending</small>' : ''}
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
            
            // Handle both keyword and name fields for backward compatibility
            const displayName = item.keyword || item.name || 'Unknown Item';
            
            itemEntry.innerHTML = `
                <div class="item-info">
                    <div class="item-keyword">${this.escapeHtml(displayName)}</div>
                    <div class="item-wear-range">
                        ${floatDisplay}
                        ${hasCustomFloat ? '<span class="wear-badge">Custom Range</span>' : ''}
                    </div>
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
        } else {
            console.warn('🚨 Site theming toggle not found in popup HTML');
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

        // Listen for storage changes (theme updates from other parts)
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

    // Setup keychain filter controls with better debugging
    setupKeychainFilterControls() {
        console.log('🔧 Setting up keychain filter controls...');

        // Percentage slider
        const percentageSlider = document.getElementById('keychainPercentage');
        const percentageValue = document.getElementById('percentageValue');
        
        if (percentageSlider && percentageValue) {
            percentageSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                percentageValue.textContent = `${value}% of market value`;
                console.log(`🎚️ Percentage slider changed to: ${value}%`);
            });
            console.log('✅ Percentage slider setup complete');
        } else {
            console.error('❌ Percentage slider elements not found');
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
                    console.log('📝 Keychain list collapsed');
                } else {
                    keychainList.classList.add('expanded');
                    listToggle.classList.add('expanded');
                    console.log('📝 Keychain list expanded');
                }
            });
            console.log('✅ Keychain list toggle setup complete');
        } else {
            console.error('❌ Keychain list toggle elements not found');
        }

        // Select all/none buttons
        const selectAllBtn = document.getElementById('selectAll');
        const selectNoneBtn = document.getElementById('selectNone');
        
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                console.log('🔧 Select all keychains clicked');
                this.selectAllKeychains(true);
            });
        }
        
        if (selectNoneBtn) {
            selectNoneBtn.addEventListener('click', () => {
                console.log('🔧 Select none keychains clicked');
                this.selectAllKeychains(false);
            });
        }

        // Save keychain filter button
        const saveKeychainBtn = document.getElementById('saveKeychainFilter');
        if (saveKeychainBtn) {
            saveKeychainBtn.addEventListener('click', () => {
                console.log('💾 Save keychain filter clicked');
                this.saveKeychainFilterSettings();
            });
        }

        console.log('✅ Keychain filter controls setup complete');
    }

    // Load keychain filter settings with retry mechanism
    async loadKeychainFilterSettingsWithRetry() {
        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                console.log(`🔧 Loading keychain filter settings (attempt ${attempt + 1}/${maxRetries})...`);
                await this.loadKeychainFilterSettings();
                console.log('✅ Keychain filter settings loaded successfully');
                return;
            } catch (error) {
                attempt++;
                console.error(`❌ Attempt ${attempt} failed:`, error);
                
                if (attempt < maxRetries) {
                    console.log(`⏳ Retrying in 1 second...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    console.error('❌ All attempts failed, using fallback settings');
                    this.showMessage('Failed to load keychain filter settings. Using defaults.', 'error');
                    this.useDefaultKeychainSettings();
                }
            }
        }
    }

    // Load keychain filter settings from server with timeout
    async loadKeychainFilterSettings() {
        return new Promise((resolve, reject) => {
            // Set a timeout for the request
            const timeout = setTimeout(() => {
                reject(new Error('Request timeout'));
            }, 10000); // 10 second timeout

            chrome.runtime.sendMessage({
                type: 'GET_KEYCHAIN_FILTER_SETTINGS'
            }, (response) => {
                clearTimeout(timeout);
                
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response && response.success) {
                    this.keychainFilterSettings = response.data;
                    this.updateKeychainFilterUI();
                    console.log('✅ Keychain filter settings loaded:', this.keychainFilterSettings);
                    resolve();
                } else {
                    reject(new Error(response?.error || 'Unknown error loading keychain filter settings'));
                }
            });
        });
    }

    // Use default settings if server is unavailable
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

    // Update UI with keychain filter settings and better error handling
    updateKeychainFilterUI() {
        console.log('🎨 Updating keychain filter UI...');
        
        try {
            // Update percentage slider
            const percentageSlider = document.getElementById('keychainPercentage');
            const percentageValue = document.getElementById('percentageValue');
            
            if (percentageSlider && percentageValue) {
                percentageSlider.value = this.keychainFilterSettings.percentageThreshold || 50;
                percentageValue.textContent = `${this.keychainFilterSettings.percentageThreshold || 50}% of market value`;
                console.log(`✅ Updated percentage slider to ${this.keychainFilterSettings.percentageThreshold}%`);
            } else {
                console.error('❌ Percentage slider elements not found');
            }

            // Update enabled count
            const enabledCount = document.getElementById('enabledCount');
            if (enabledCount) {
                const count = this.keychainFilterSettings.enabledKeychains?.length || 0;
                const total = this.keychainFilterSettings.totalKeychains || this.keychainFilterSettings.allKeychains?.length || 0;
                enabledCount.textContent = `${count}/${total}`;
                console.log(`✅ Updated enabled count to ${count}/${total}`);
            } else {
                console.error('❌ Enabled count element not found');
            }

            // Populate keychain list
            this.populateKeychainList();
            
        } catch (error) {
            console.error('❌ Error updating keychain filter UI:', error);
            this.showMessage('Error updating keychain filter UI', 'error');
        }
    }

    // Populate keychain list with better error handling
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
                    <div class="keychain-price">$${(keychain.price || 0).toFixed(2)}</div>
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

    // Toggle individual keychain selection with better state management
    toggleKeychainSelection(keychainName) {
        console.log(`🔧 Toggling keychain: ${keychainName}`);
        
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
            console.log(`❌ Disabled keychain: ${keychainName}`);
        } else {
            checkbox.classList.add('checked');
            // Add to enabled list
            if (!this.keychainFilterSettings.enabledKeychains.includes(keychainName)) {
                this.keychainFilterSettings.enabledKeychains.push(keychainName);
            }
            console.log(`✅ Enabled keychain: ${keychainName}`);
        }

        // Update enabled count display
        const enabledCount = document.getElementById('enabledCount');
        if (enabledCount) {
            const total = this.keychainFilterSettings.allKeychains?.length || 0;
            enabledCount.textContent = `${this.keychainFilterSettings.enabledKeychains.length}/${total}`;
        }

        console.log(`🔧 Current enabled keychains: ${this.keychainFilterSettings.enabledKeychains.length}`);
    }

    // Select all/none keychains with better error handling
    selectAllKeychains(selectAll) {
        console.log(`🔧 ${selectAll ? 'Selecting all' : 'Deselecting all'} keychains`);
        
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

        console.log(`✅ ${selectAll ? 'Selected all' : 'Deselected all'} keychains. Total: ${this.keychainFilterSettings.enabledKeychains.length}`);
    }

    // Save keychain filter settings with better error handling and debugging
    async saveKeychainFilterSettings() {
        try {
            const percentageSlider = document.getElementById('keychainPercentage');
            const percentageThreshold = percentageSlider ? parseInt(percentageSlider.value) : 50;

            console.log('💾 Saving keychain filter settings...');
            console.log('📊 Percentage threshold:', percentageThreshold);
            console.log('🔑 Enabled keychains:', this.keychainFilterSettings.enabledKeychains.length);
            console.log('🔑 Keychain list:', this.keychainFilterSettings.enabledKeychains);

            // Show loading state
            const saveBtn = document.getElementById('saveKeychainFilter');
            if (saveBtn) {
                saveBtn.textContent = 'Saving...';
                saveBtn.disabled = true;
            }

            // Save percentage threshold
            console.log('💾 Saving percentage threshold...');
            const percentageResponse = await this.sendMessageWithTimeout({
                type: 'UPDATE_KEYCHAIN_PERCENTAGE',
                data: { percentageThreshold }
            }, 10000);

            if (!percentageResponse || !percentageResponse.success) {
                throw new Error(percentageResponse?.error || 'Failed to update percentage threshold');
            }
            console.log('✅ Percentage threshold saved');

            // Save enabled keychains
            console.log('💾 Saving enabled keychains...');
            const keychainsResponse = await this.sendMessageWithTimeout({
                type: 'UPDATE_ENABLED_KEYCHAINS', 
                data: { enabledKeychains: this.keychainFilterSettings.enabledKeychains }
            }, 10000);

            if (!keychainsResponse || !keychainsResponse.success) {
                throw new Error(keychainsResponse?.error || 'Failed to update enabled keychains');
            }
            console.log('✅ Enabled keychains saved');

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

    // Helper method to send messages with timeout
    async sendMessageWithTimeout(message, timeoutMs = 5000) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Request timeout after ${timeoutMs}ms`));
            }, timeoutMs);

            chrome.runtime.sendMessage(message, (response) => {
                clearTimeout(timeout);
                
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                resolve(response);
            });
        });
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

        // Open server stats
        const serverBtn = document.getElementById('openServer');
        if (serverBtn) {
            serverBtn.addEventListener('click', () => {
                chrome.tabs.create({url: 'http://localhost:3001/health'});
            });
        }

        // Open CSGOEmpire
        const csgoBtn = document.getElementById('openCSGOEmpire');
        if (csgoBtn) {
            csgoBtn.addEventListener('click', () => {
                chrome.tabs.create({url: 'https://csgoempire.com/trade'});
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
            console.log('🔄 Loading current filter settings from server...');
        
            const response = await fetch('http://localhost:3001/health');
                if (!response.ok) {
                    throw new Error('Server not available');
        }
        
            const data = await response.json();
        
                if (data.config && data.config.priceRange) {
                    const minInput = document.getElementById('minPercentage');
                    const maxInput = document.getElementById('maxPercentage');
                const rangeDisplay = document.getElementById('rangeDisplay');
            
            if (minInput && maxInput && rangeDisplay) {
                // Set the values from server
                minInput.value = data.config.priceRange.min;
                maxInput.value = data.config.priceRange.max;
                
                // Update the range display
                rangeDisplay.textContent = `Range: ${data.config.priceRange.min}% to +${data.config.priceRange.max}% above recommended price`;
                
                console.log(`✅ Loaded filter settings: ${data.config.priceRange.min}% to ${data.config.priceRange.max}%`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error loading current filter settings:', error);
        // Keep default values if server is not available
    }
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
            this.updateConnectionStatus(false, 'Connection failed');
        }
    }

    updateUI(data) {
        // Update stats
        this.updateElement('keychainsFound', data.stats?.keychainsFound || 0);
        
        // Update uptime
        if (data.stats?.startTime) {
            const uptime = this.formatUptime(Date.now() - data.stats.startTime);
            this.updateElement('uptime', uptime);
        }

        // Update connection status
        this.updateConnectionStatus(data.connected, data.monitoringEnabled);

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
        this.updateElement('serverStatus', data.connected ? 'Connected' : 'Disconnected');
        if (data.stats?.lastConnection) {
            this.updateElement('lastConnection', new Date(data.stats.lastConnection).toLocaleTimeString());
        }

        
        if (data.syncStatus) {
            this.isServerSynced = data.syncStatus.isInitialSyncComplete;
            if (this.isServerSynced) {
                this.updateItemListUI(); // Refresh UI with sync status
            }
        }
    }

    updateConnectionStatus(connected, monitoringEnabled) {
        const indicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const errorMessage = document.getElementById('errorMessage');

        if (!monitoringEnabled) {
            indicator.className = 'status-indicator disabled';
            statusText.textContent = 'Monitoring Disabled';
            errorMessage.style.display = 'none';
        } else if (connected) {
            indicator.className = 'status-indicator connected';
            statusText.textContent = 'Connected & Monitoring';
            errorMessage.style.display = 'none';
        } else {
            indicator.className = 'status-indicator disconnected';
            statusText.textContent = 'Server Disconnected';
            errorMessage.style.display = 'block';
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

        if (!minInput || !maxInput) return;

        const minPercentage = parseFloat(minInput.value);
        const maxPercentage = parseFloat(maxInput.value);

        if (minPercentage > maxPercentage) {
            this.showMessage('Minimum percentage cannot be greater than maximum', 'error');
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'UPDATE_PRICE_FILTER',
                data: { minPercentage, maxPercentage }
            });

            if (response && response.success) {
                this.showMessage(response.message || 'Settings saved successfully!', 'success');
            } else {
                this.showMessage(response?.error || 'Failed to save settings', 'error');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showMessage('Failed to save settings', 'error');
        }
    }

    async enableNotifications() {
        try {
            const response = await chrome.runtime.sendMessage({type: 'REQUEST_NOTIFICATION_PERMISSION'});
            
            if (response && response.granted) {
                this.showMessage('Notifications enabled successfully!', 'success');
            } else {
                this.showMessage(response?.error || 'Failed to enable notifications', 'error');
            }
        } catch (error) {
            console.error('Error enabling notifications:', error);
            this.showMessage('Failed to enable notifications', 'error');
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
        
        // For success messages, just log them since we don't need a success div anymore
        if (type === 'success') {
            console.log('✅ Success:', text);
        }
    }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});

// 🚀 MODULE SYSTEM BOOTSTRAP  
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
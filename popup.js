// popup.js - Updated with proper theme handling

class PopupManager {
    constructor() {
        this.currentStats = null;
        this.currentTheme = 'nebula'; // Default theme
        this.init();
    }

    async init() {
        console.log('🚀 Popup initialized');
        
        // Load theme first
        await this.loadTheme();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadStats();
        
        // Setup auto-refresh
        setInterval(() => this.loadStats(), 5000);
    }

    async loadTheme() {
        try {
            const settings = await chrome.storage.sync.get({
                selectedTheme: 'nebula'
            });
            
            this.currentTheme = settings.selectedTheme;
            this.applyTheme(this.currentTheme);
            
            console.log(`🎨 Popup loaded theme: ${this.currentTheme}`);
        } catch (error) {
            console.error('Error loading theme:', error);
            // Fall back to default theme
            this.applyTheme('nebula');
        }
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

        // Listen for storage changes (theme updates from other parts)
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes.selectedTheme) {
                const newTheme = changes.selectedTheme.newValue;
                if (newTheme !== this.currentTheme) {
                    console.log(`🎨 Theme changed to: ${newTheme}`);
                    this.applyTheme(newTheme);
                }
            }
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

        // View keychains button
        const viewKeychainsBtn = document.getElementById('viewKeychains');
        if (viewKeychainsBtn) {
            viewKeychainsBtn.addEventListener('click', () => {
                this.showMessage('Currently monitoring 33 keychain types including Hot Howl, Baby Karat T, Hot Wurst, and more.', 'success');
            });
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

        // Update theme if it changed
        if (data.currentTheme && data.currentTheme !== this.currentTheme) {
            this.applyTheme(data.currentTheme);
        }

        // Update server info
        this.updateElement('serverStatus', data.connected ? 'Connected' : 'Disconnected');
        if (data.stats?.lastConnection) {
            this.updateElement('lastConnection', new Date(data.stats.lastConnection).toLocaleTimeString());
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
        const errorDiv = document.getElementById('errorMessage');

        // Only show temporary error messages, don't interfere with status display
        if (type === 'error' && errorDiv) {
            // Save current error state 
            const wasVisible = errorDiv.style.display !== 'none';
            const originalText = errorDiv.textContent;
            
            // Show temporary message
            errorDiv.textContent = text;
            errorDiv.style.display = 'block';
            
            // Restore original state after timeout
            setTimeout(() => {
                if (wasVisible) {
                    errorDiv.textContent = originalText;
                    errorDiv.style.display = 'block';
                } else {
                    errorDiv.style.display = 'none';
                }
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
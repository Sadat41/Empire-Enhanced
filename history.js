// history.js 

class NotificationHistory {
    constructor() {
        this.notifications = [];
        
        this.autoRefreshInterval = null;
        this.currentFilter = 'All Items'; // Track current filter state
        this.currentTheme = 'nebula'; // Default theme
        
        // Charm category color mapping
        this.charmColors = {
            'Red': '#ef4444',      // Red
            'Pink': '#ec4899',     // Pink
            'Purple': '#a855f7',   // Purple
            'Blue': '#3b82f6'      // Blue
        };
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing notification history...');
        
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // Load theme first, then setup everything else
        await this.loadTheme();
        this.setupEventListeners();
        this.setupStorageListener(); // Listen for local storage changes
        await this.loadHistory();
        this.startAutoRefresh();
    }

    async loadTheme() {
        try {
            const settings = await chrome.storage.sync.get({
                selectedTheme: 'nebula'
            });
            
            this.currentTheme = settings.selectedTheme;
            this.applyTheme(this.currentTheme);
            
            console.log(`🎨 History page loaded theme: ${this.currentTheme}`);
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

    setupEventListeners() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log(' Manual refresh triggered');
                
                // Add loading state using CSS classes
                refreshBtn.classList.add('loading');
                refreshBtn.innerHTML = '<span class="refresh-icon spinning"></span> Refreshing...';
                refreshBtn.disabled = true;
                
                this.loadHistory().finally(() => {
                    refreshBtn.classList.remove('loading');
                    refreshBtn.innerHTML = '<span class="refresh-icon">🔄</span> Refresh';
                    refreshBtn.disabled = false;
                });
            });
        }

        // Setup filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.currentFilter = btn.textContent.trim();
                console.log(`🔍 Filter changed to: ${this.currentFilter}`);
                this.applyCurrentFilter();
            });
        });

        // Listen for storage changes (theme updates from popup)
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') {
                if (changes.selectedTheme) {
                    const newTheme = changes.selectedTheme.newValue;
                    if (newTheme !== this.currentTheme) {
                        console.log(`🎨 Theme changed to: ${newTheme}`);
                        this.applyTheme(newTheme);
                    }
                }
                // Note: Site theming changes are handled by site-themeing.js, not history.js
            }
        });
    }

    applyCurrentFilter() {
        console.log(`🎯 Applying filter: ${this.currentFilter}`);
        
        // Sort notifications based on current filter
        let sortedNotifications = [...this.notifications];
        
        if (this.currentFilter === 'Good Deals') {
            // Sort by above_recommended_price (ascending: lowest/best deals first)
            sortedNotifications.sort((a, b) => {
                const aPercent = a.above_recommended_price || 0;
                const bPercent = b.above_recommended_price || 0;
                return aPercent - bPercent;
            });
            console.log(`📊 Sorted ${sortedNotifications.length} items by best deals first`);
        } else if (this.currentFilter === 'Recent') {
            // Sort by published_at (descending: most recent first)
            sortedNotifications.sort((a, b) => {
                const aTime = new Date(a.published_at || a.timestamp).getTime();
                const bTime = new Date(b.published_at || b.timestamp).getTime();
                return bTime - aTime;
            });
            console.log(`⏰ Sorted ${sortedNotifications.length} items by most recent first`);
        }
        // 'All Items' keeps original order (already sorted by timestamp from server)
        
        // Re-render with sorted data
        this.renderFilteredHistory(sortedNotifications);
    }

    // Enhanced method to format charm information with pricing and colors
    formatCharmInfo(item) {
        // Check if we have charm data from the server
        if (item.charm_name && item.charm_category && item.charm_price !== undefined) {
            const charmName = item.charm_name;
            const charmCategory = item.charm_category;
            const charmPrice = item.charm_price;
            const marketValue = item.market_value ? (item.market_value / 100) : 0;
            
            // Calculate percentage of charm price relative to market price
            let percentageOfMarket = 0;
            if (marketValue > 0 && charmPrice > 0) {
                percentageOfMarket = (charmPrice / marketValue) * 100;
            }
            
            const charmColor = this.charmColors[charmCategory] || '#ffffff';
            const categoryIcon = this.getCategoryIcon(charmCategory);
            
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
        
        // Fallback to keychain names if no charm data
        let keychainDisplay = 'N/A';
        if (item.keychains) {
            if (Array.isArray(item.keychains)) {
                keychainDisplay = item.keychains.length > 0 ? item.keychains.join(', ') : 'N/A';
            } else if (typeof item.keychains === 'string') {
                keychainDisplay = item.keychains;
            }
        }
        
        return {
            hasCharmData: false,
            fallbackDisplay: keychainDisplay
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

    renderFilteredHistory(sortedNotifications) {
        console.log(`🎨 Rendering ${sortedNotifications.length} filtered/sorted notifications...`);
        
        const itemsGrid = document.getElementById('itemsGrid');
        const emptyState = document.getElementById('emptyState');
        
        if (!sortedNotifications || sortedNotifications.length === 0) {
            console.log('📝 Showing empty state for filtered results');
            if (itemsGrid) itemsGrid.innerHTML = '';
            if (itemsGrid) itemsGrid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        console.log('📝 Showing grid with filtered data');
        if (emptyState) emptyState.style.display = 'none';
        if (itemsGrid) itemsGrid.style.display = 'grid';
        
        try {
            const cardsHTML = sortedNotifications.map((item, index) => {
                const marketValue = (item.market_value || 0) / 100;
                const recommendedValue = (item.suggested_price || 0) / 100;
                const aboveRec = item.above_recommended_price || 0;

                // Get enhanced charm information
                const charmInfo = this.formatCharmInfo(item);

                // Format timestamp using published_at primarily
                const publishedTime = new Date(item.published_at || item.timestamp);
                const now = new Date();
                const isToday = publishedTime.toDateString() === now.toDateString();
                const timeStr = isToday ? 
                    `Today at ${publishedTime.toLocaleTimeString()}` : 
                    publishedTime.toLocaleString();

                // Format float value
                const floatValue = item.wear !== undefined && item.wear !== null ? 
                    parseFloat(item.wear).toFixed(6) : 'Unknown';

                // Determine percentage styling
                const percentageClass = aboveRec >= 0 ? 'positive' : 'negative';
                const percentageIcon = aboveRec >= 0 ? '📈' : '📉';
                const percentageText = aboveRec >= 0 ? `+${aboveRec.toFixed(1)}%` : `${aboveRec.toFixed(1)}%`;

                // Generate charm display HTML for history cards
                let charmDisplayHTML = '';
                if (charmInfo.hasCharmData) {
                    charmDisplayHTML = `
                        <div class="item-charm enhanced-charm" style="color: ${charmInfo.charmColor};">
                            <div class="charm-icon" style="background: ${charmInfo.charmColor};">
                                ${charmInfo.categoryIcon}
                            </div>
                            <div class="charm-details">
                                <div class="charm-name">${charmInfo.formattedDisplay}</div>
                                <div class="charm-percentage">${charmInfo.percentageDisplay}</div>
                            </div>
                        </div>
                    `;
                } else {
                    charmDisplayHTML = `
                        <div class="item-keychain">
                            <div class="keychain-icon">🔑</div>
                            ${charmInfo.fallbackDisplay}
                        </div>
                    `;
                }

                return `
                    <div class="item-card" style="animation-delay: ${index * 0.05}s;">
                        <div class="item-header">
                            <div>
                                <div class="item-name" title="${item.market_name || 'Unknown Item'}">${item.market_name || 'Unknown Item'}</div>
                                ${charmDisplayHTML}
                            </div>
                            <div class="item-id">#${item.id || 'Unknown'}</div>
                        </div>
                        
                        <div class="price-grid">
                            <div class="price-item">
                                <div class="price-label">Market Value</div>
                                <div class="price-value market">$${marketValue.toFixed(2)}</div>
                            </div>
                            <div class="price-item">
                                <div class="price-label">Float</div>
                                <div class="price-value recommended">${floatValue}</div>
                            </div>
                        </div>

                        <div class="percentage-badge ${percentageClass}">
                            <span>${percentageIcon}</span>
                            ${percentageText}
                        </div>

                        <div class="item-actions">
                            <button class="action-btn primary view-item-btn" data-item-id="${item.id}">
                                <span>🔗</span>
                                View Item
                            </button>
                            <button class="action-btn secondary hide-item-btn">
                                <span>✕</span>
                                Hide
                            </button>
                        </div>

                        <div class="timestamp">
                            ${timeStr}
                        </div>
                    </div>
                `;
            }).join('');
            
            if (itemsGrid) {
                itemsGrid.innerHTML = cardsHTML;
                console.log(`✅ Filtered cards rendered successfully (${this.currentFilter})`);
                
                // Inject enhanced charm styles
                this.injectEnhancedCharmStyles();
                
                // Attach event listeners for CSP-safe action buttons
                // View Item buttons
                itemsGrid.querySelectorAll('.view-item-btn').forEach(btn => {
                    btn.addEventListener('click', (event) => {
                        // Prevent bubbling to card
                        event.stopPropagation();
                        const itemId = btn.getAttribute('data-item-id');
                        if (itemId) {
                            window.open(`https://csgoempire.com/item/${itemId}`, '_blank');
                        }
                    });
                });

                // Hide buttons
                itemsGrid.querySelectorAll('.hide-item-btn').forEach(btn => {
                    btn.addEventListener('click', (event) => {
                        event.stopPropagation();
                        const card = btn.closest('.item-card');
                        if (card) card.remove();
                    });
                });
            }
            
        } catch (error) {
            console.error('❌ Error rendering filtered cards:', error);
            this.showError(`Error rendering filtered cards: ${error.message}`);
        }
    }

    injectEnhancedCharmStyles() {
        // Remove existing enhanced charm styles
        const existingStyles = document.getElementById('enhanced-charm-styles');
        if (existingStyles) {
            existingStyles.remove();
        }

        const styles = document.createElement('style');
        styles.id = 'enhanced-charm-styles';
        
        styles.textContent = `
            /* Enhanced charm display styles for history cards */
            .enhanced-charm {
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                background: rgba(255, 255, 255, 0.04) !important;
                padding: 8px 10px !important;
                border-radius: 8px !important;
                border-left: 3px solid currentColor !important;
                margin-top: 6px !important;
            }

            .enhanced-charm .charm-icon {
                width: 16px !important;
                height: 16px !important;
                border-radius: 50% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 10px !important;
                color: white !important;
                flex-shrink: 0 !important;
            }

            .enhanced-charm .charm-details {
                flex: 1 !important;
                min-width: 0 !important;
            }

            .enhanced-charm .charm-name {
                font-size: 12px !important;
                font-weight: 700 !important;
                margin-bottom: 2px !important;
                line-height: 1.2 !important;
                word-break: break-word !important;
            }

            .enhanced-charm .charm-percentage {
                font-size: 10px !important;
                opacity: 0.8 !important;
                background: rgba(255, 255, 255, 0.1) !important;
                padding: 2px 6px !important;
                border-radius: 4px !important;
                display: inline-block !important;
                font-weight: 600 !important;
            }

            /* Fallback styles for regular keychain display */
            .item-keychain {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                font-size: 13px !important;
                color: #36d1dc !important;
                font-weight: 600 !important;
                margin-top: 6px !important;
            }

            body.theme-shooting-star .item-keychain {
                color: #87ceeb !important;
            }

            .keychain-icon {
                width: 14px !important;
                height: 14px !important;
                background: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%) !important;
                border-radius: 50% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: white !important;
                font-size: 9px !important;
            }

            body.theme-shooting-star .keychain-icon {
                background: linear-gradient(135deg, #87ceeb 0%, #4a90e2 100%) !important;
            }
        `;
        
        document.head.appendChild(styles);
    }

async loadHistory() {
    try {
        console.log('📊 Loading notification history from local storage...');
        this.showLoading(true);
        this.hideMessages();

        const result = await chrome.storage.local.get(['notificationHistory']);
        this.notifications = result.notificationHistory || [];
        
        console.log(`✅ Loaded ${this.notifications.length} notifications from storage`);
        
        if (this.notifications.length > 0) {
            console.log('🎯 Notifications found, rendering cards...');
            this.showSuccess(`Loaded ${this.notifications.length} notifications from last 24 hours`);
        } else {
            console.log('⚠️ No notifications found in storage');
        }
        
        this.renderHistory();
        this.updateStats();
        this.showLoading(false);
        
    } catch (error) {
        console.error('❌ Error loading history from storage:', error);
        this.showError(`Failed to load notification history: ${error.message}`);
        this.showLoading(false);
    }
}

    renderHistory() {
        console.log(`🎨 Rendering ${this.notifications.length} notifications as cards...`);
        
        const itemsGrid = document.getElementById('itemsGrid');
        const emptyState = document.getElementById('emptyState');
        
        if (!this.notifications || this.notifications.length === 0) {
            console.log('📝 Showing empty state');
            if (itemsGrid) itemsGrid.innerHTML = '';
            if (itemsGrid) itemsGrid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        console.log('📝 Showing grid with card data');
        if (emptyState) emptyState.style.display = 'none';
        if (itemsGrid) itemsGrid.style.display = 'grid';
        
        // Maintain current filter state after rendering
        this.maintainFilterState();
        
        // Apply current filter
        this.applyCurrentFilter();
    }

    maintainFilterState() {
        // Restore the active filter button state
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent.trim() === this.currentFilter) {
                btn.classList.add('active');
            }
        });
        console.log(`🔄 Maintained filter state: ${this.currentFilter}`);
    }

    updateStats() {
        try {
            const totalNotifications = this.notifications.length;
            const totalValue = this.notifications.reduce((sum, item) => sum + ((item.market_value || 0) / 100), 0);
            const lastNotification = this.notifications.length > 0 
                ? new Date(this.notifications[0].timestamp).toLocaleTimeString()
                : 'Never';
            
            const totalNotificationsEl = document.getElementById('totalNotifications');
            const totalValueEl = document.getElementById('totalValue');
            const lastNotificationEl = document.getElementById('lastNotification');
            
            if (totalNotificationsEl) totalNotificationsEl.textContent = totalNotifications;
            if (totalValueEl) totalValueEl.textContent = `$${totalValue.toFixed(2)}`;
            if (lastNotificationEl) lastNotificationEl.textContent = lastNotification;
            
            console.log(`📊 Stats updated: ${totalNotifications} notifications, $${totalValue.toFixed(2)} total value`);
        } catch (error) {
            console.error('❌ Error updating stats:', error);
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loadingMessage');
        const itemsGrid = document.getElementById('itemsGrid');
        const emptyState = document.getElementById('emptyState');
        
        if (show) {
            if (loading) loading.style.display = 'flex';
            if (itemsGrid) itemsGrid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'none';
        } else {
            if (loading) loading.style.display = 'none';
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.querySelector('span:last-child').textContent = message;
            errorDiv.style.display = 'flex';
            
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 30000);
        }
    }

    showSuccess(message) {
        const successDiv = document.getElementById('successMessage');
        if (successDiv) {
            successDiv.querySelector('span:last-child').textContent = message;
            successDiv.style.display = 'flex';
            
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 5000);
        }
    }

    hideMessages() {
        const errorDiv = document.getElementById('errorMessage');
        const successDiv = document.getElementById('successMessage');
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';
    }

    startAutoRefresh() {
        this.autoRefreshInterval = setInterval(() => {
            console.log(' Auto-refreshing...');
            this.loadHistory();
        }, 15000); // Refresh every 15 seconds
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }
    // Setup storage listener to refresh history when local storage changes
    setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.notificationHistory) {
            console.log('📝 Notification history updated, refreshing display...');
            this.loadHistory();
        }
    });
}

}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🌐 DOM loaded, starting notification history');
        try {
            new NotificationHistory();
        } catch (error) {
            console.error('❌ Error initializing NotificationHistory:', error);
        }
    });
} else {
    console.log('🌐 DOM already loaded, starting notification history');
    try {
        new NotificationHistory();
    } catch (error) {
        console.error('❌ Error initializing NotificationHistory:', error);
    }
}

// Test function to verify JavaScript is working
console.log('📝 History.js with enhanced charm pricing display loaded successfully');

// Add a global test function to debug CSP issues
window.testButtonClick = function() {
    console.log('🧪 Test function called - JavaScript is working');
    alert('JavaScript is working correctly!');
};
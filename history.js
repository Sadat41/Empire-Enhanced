// history.js - FIXED RENDERING ISSUE

class NotificationHistory {
    constructor() {
        this.notifications = [];
        this.autoRefreshInterval = null;
        this.currentFilter = 'All Items';
        this.currentTheme = 'nebula';
        
        this.charmColors = {
            'Red': '#ef4444',
            'Pink': '#ec4899',
            'Purple': '#a855f7',
            'Blue': '#3b82f6'
        };
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing notification history...');
        
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        await this.loadTheme();
        this.setupEventListeners();
        this.setupStorageListener();
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
            this.applyTheme('nebula');
        }
    }

    applyTheme(themeName) {
        console.log(`🎨 Applying theme: ${themeName}`);
        document.body.className = `theme-${themeName}`;
        this.updateCrownColors(themeName);
        this.currentTheme = themeName;
    }

    updateCrownColors(themeName) {
        const crownPath = document.querySelector('.crown-path');
        const crownBase = document.querySelector('.crown-base');
        const crownLeft = document.querySelector('.crown-left');
        const crownRight = document.querySelector('.crown-right');
        
        if (themeName === 'shooting-star') {
            if (crownPath) {
                crownPath.setAttribute('fill', 'url(#crownGradientStar)');
                crownPath.setAttribute('stroke', '#4a90e2');
            }
            if (crownBase) crownBase.setAttribute('fill', '#87ceeb');
            if (crownLeft) crownLeft.setAttribute('fill', '#4a90e2');
            if (crownRight) crownRight.setAttribute('fill', '#4a90e2');
        } else {
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
                console.log('📱 Manual refresh triggered');
                
                refreshBtn.classList.add('loading');
                refreshBtn.innerHTML = '<span class="refresh-icon spinning">🔄</span> Refreshing...';
                refreshBtn.disabled = true;
                
                this.loadHistory().finally(() => {
                    refreshBtn.classList.remove('loading');
                    refreshBtn.innerHTML = '<span class="refresh-icon">🔄</span> Refresh';
                    refreshBtn.disabled = false;
                });
            });
        }

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.currentFilter = btn.textContent.trim();
                console.log(`🔍 Filter changed to: ${this.currentFilter}`);
                this.applyCurrentFilter();
            });
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') {
                if (changes.selectedTheme) {
                    const newTheme = changes.selectedTheme.newValue;
                    if (newTheme !== this.currentTheme) {
                        console.log(`🎨 Theme changed to: ${newTheme}`);
                        this.applyTheme(newTheme);
                    }
                }
            }
        });
    }

    applyCurrentFilter() {
        console.log(`🎯 Applying filter: ${this.currentFilter}`);
        
        let sortedNotifications = [...this.notifications];
        
        if (this.currentFilter === 'Good Deals') {
            sortedNotifications.sort((a, b) => {
                const aPercent = a.above_recommended_price || 0;
                const bPercent = b.above_recommended_price || 0;
                return aPercent - bPercent;
            });
            console.log(`📊 Sorted ${sortedNotifications.length} items by best deals first`);
        } else if (this.currentFilter === 'Recent') {
            sortedNotifications.sort((a, b) => {
                const aTime = new Date(a.published_at || a.timestamp).getTime();
                const bTime = new Date(b.published_at || b.timestamp).getTime();
                return bTime - aTime;
            });
            console.log(`⏰ Sorted ${sortedNotifications.length} items by most recent first`);
        }
        
        this.renderFilteredHistory(sortedNotifications);
    }

    formatCharmInfo(item) {
        if (item.charm_name && item.charm_category && item.charm_price !== undefined) {
            const charmName = item.charm_name;
            const charmCategory = item.charm_category;
            const charmPrice = item.charm_price;
            const marketValue = item.market_value ? (item.market_value / 100) : 0;
            
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

    // FIXED: Simplified rendering logic
    renderFilteredHistory(sortedNotifications) {
        console.log(`🎨 Rendering ${sortedNotifications.length} filtered/sorted notifications...`);
        
        const itemsGrid = document.getElementById('itemsGrid');
        const emptyState = document.getElementById('emptyState');
        
        // Clear everything first
        if (itemsGrid) {
            itemsGrid.innerHTML = '';
            itemsGrid.classList.remove('loaded');
        }
        
        if (!sortedNotifications || sortedNotifications.length === 0) {
            console.log('📝 Showing empty state for filtered results');
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
                const aboveRec = item.above_recommended_price || 0;

                const charmInfo = this.formatCharmInfo(item);

                const publishedTime = new Date(item.published_at || item.timestamp);
                const now = new Date();
                const isToday = publishedTime.toDateString() === now.toDateString();
                const timeStr = isToday ? 
                    `Today at ${publishedTime.toLocaleTimeString()}` : 
                    publishedTime.toLocaleString();

                const floatValue = item.wear !== undefined && item.wear !== null ? 
                    parseFloat(item.wear).toFixed(6) : 'Unknown';

                const percentageClass = aboveRec >= 0 ? 'positive' : 'negative';
                const percentageIcon = aboveRec >= 0 ? '📈' : '📉';
                const percentageText = aboveRec >= 0 ? `+${aboveRec.toFixed(1)}%` : `${aboveRec.toFixed(1)}%`;

                // Price comparison data
                const buff163Price = item.buff163_price || null;
                const csfloatPrice = item.csfloat_price || null;
                const empirePrice = item.empire_price || marketValue;
                const buff163Percentage = item.buff163_percentage || null;

                const formatPrice = (price) => {
                    if (!price || price === 'Unknown' || isNaN(price)) return 'N/A';
                    return `$${parseFloat(price).toFixed(2)}`;
                };

                let differenceText = 'N/A';
                let differenceClass = '';
                if (buff163Percentage !== null) {
                    differenceText = `${buff163Percentage.toFixed(1)}%`;
                    differenceClass = buff163Percentage < 100 ? 'positive' : 'negative';
                }

                let priceComparisonHTML = '';
                if (buff163Price || csfloatPrice) {
                    priceComparisonHTML = `
                        <div class="price-comparison-container">
                            <div class="price-comparison-header">
                                PRICE COMPARISON
                            </div>
                            <div class="price-comparison-grid">
                                <div class="price-comparison-cell price-cell-csfloat">
                                    <div class="price-comparison-label">CSFLOAT</div>
                                    <div class="price-comparison-value price-value-csfloat">${formatPrice(csfloatPrice)}</div>
                                </div>
                                <div class="price-comparison-cell price-cell-buff163">
                                    <div class="price-comparison-label">BUFF163</div>
                                    <div class="price-comparison-value price-value-buff163">${formatPrice(buff163Price)}</div>
                                </div>
                                <div class="price-comparison-cell price-cell-empire">
                                    <div class="price-comparison-label">EMPIRE</div>
                                    <div class="price-comparison-value price-value-empire">${formatPrice(empirePrice)}</div>
                                </div>
                            </div>
                            <div class="price-comparison-grid">
                                <div class="price-comparison-cell price-cell-float">
                                    <div class="price-comparison-label">FLOAT</div>
                                    <div class="price-comparison-value price-value-float">${floatValue}</div>
                                </div>
                                <div class="price-comparison-cell price-cell-difference ${differenceClass}">
                                    <div class="price-comparison-label">% DIFFERENCE</div>
                                    <div class="price-comparison-value price-value-${differenceClass}">
                                        ${differenceText}
                                    </div>
                                </div>
                                <div class="price-comparison-cell price-cell-above-rec ${parseFloat(aboveRec) > 0 ? 'negative' : ''}">
                                    <div class="price-comparison-label">ABOVE REC</div>
                                    <div class="price-comparison-value price-value-${parseFloat(aboveRec) > 0 ? 'negative' : 'positive'}">
                                        ${parseFloat(aboveRec) > 0 ? '+' : ''}${aboveRec.toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }

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
                        
                        ${priceComparisonHTML}

                        ${priceComparisonHTML ? '' : `
                        <div class="price-grid">
                            <div class="price-item">
                                <div class="price-label">Market Value</div>
                                <div class="price-value market">${marketValue.toFixed(2)}</div>
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
                        `}

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
                            ${buff163Percentage !== null ? ` • Diff: ${differenceText}` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            
            // CRITICAL: Actually inject the HTML
            if (itemsGrid) {
                itemsGrid.innerHTML = cardsHTML;
                console.log(`✅ Injected HTML for ${sortedNotifications.length} cards`);
                
                // Add loaded class after DOM update
                setTimeout(() => {
                    itemsGrid.classList.add('loaded');
                    console.log('🎬 Added loaded class for animations');
                }, 50);
                
                // Inject enhanced charm styles
                this.injectEnhancedCharmStyles();
                
                // Attach event listeners
                this.attachEventListeners(itemsGrid);
            }
            
        } catch (error) {
            console.error('❌ Error rendering filtered cards:', error);
            this.showError(`Error rendering filtered cards: ${error.message}`);
        }
    }

    // FIXED: Separate event listener attachment
    attachEventListeners(itemsGrid) {
        // View Item buttons
        itemsGrid.querySelectorAll('.view-item-btn').forEach(btn => {
            btn.addEventListener('click', (event) => {
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

    injectEnhancedCharmStyles() {
        const existingStyles = document.getElementById('enhanced-charm-styles');
        if (existingStyles) {
            existingStyles.remove();
        }

        const styles = document.createElement('style');
        styles.id = 'enhanced-charm-styles';
        
        styles.textContent = `
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

    // FIXED: Simplified renderHistory method
    renderHistory() {
        console.log(`🎨 Rendering ${this.notifications.length} notifications as cards...`);
        
        const itemsGrid = document.getElementById('itemsGrid');
        const emptyState = document.getElementById('emptyState');
        
        if (!this.notifications || this.notifications.length === 0) {
            console.log('📝 Showing empty state');
            if (itemsGrid) {
                itemsGrid.innerHTML = '';
                itemsGrid.style.display = 'none';
            }
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        console.log('📝 Showing grid with card data');
        if (emptyState) emptyState.style.display = 'none';
        if (itemsGrid) itemsGrid.style.display = 'grid';
        
        // Maintain current filter state
        this.maintainFilterState();
        
        // Apply current filter to render cards
        this.applyCurrentFilter();
    }

    maintainFilterState() {
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
            console.log('🔄 Auto-refreshing...');
            this.loadHistory();
        }, 15000);
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

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

console.log('📝 History.js with FIXED rendering loaded successfully');
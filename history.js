// history.js - Updated for modern card-based layout

class NotificationHistory {
    constructor() {
        this.notifications = [];
        this.serverUrl = 'http://localhost:3001';
        this.autoRefreshInterval = null;
        this.currentFilter = 'All Items'; // Track current filter state
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
        
        this.setupEventListeners();
        await this.loadHistory();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('🔄 Manual refresh triggered');
                
                // Add loading state using CSS classes
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

            // Format keychains
            let keychainDisplay = 'N/A';
            if (item.keychains) {
                if (Array.isArray(item.keychains)) {
                    keychainDisplay = item.keychains.length > 0 ? item.keychains.join(', ') : 'N/A';
                } else if (typeof item.keychains === 'string') {
                    keychainDisplay = item.keychains;
                }
            }

            // Format timestamp using published_at primarily
            const publishedTime = new Date(item.published_at || item.timestamp);
            const now = new Date();
            const isToday = publishedTime.toDateString() === now.toDateString();
            const timeStr = isToday ? 
                `Today at ${publishedTime.toLocaleTimeString()}` : 
                publishedTime.toLocaleString();

            // Determine percentage styling
            const percentageClass = aboveRec >= 0 ? 'positive' : 'negative';
            const percentageIcon = aboveRec >= 0 ? '📈' : '📉';
            const percentageText = aboveRec >= 0 ? `+${aboveRec.toFixed(1)}%` : `${aboveRec.toFixed(1)}%`;

            return `
                <div class="item-card" style="animation-delay: ${index * 0.05}s;">
                    <div class="item-header">
                        <div>
                            <div class="item-name" title="${item.market_name || 'Unknown Item'}">${item.market_name || 'Unknown Item'}</div>
                            <div class="item-keychain">
                                <div class="keychain-icon">🔑</div>
                                ${keychainDisplay}
                            </div>
                        </div>
                        <div class="item-id">#${item.id || 'Unknown'}</div>
                    </div>
                    
                    <div class="price-grid">
                        <div class="price-item">
                            <div class="price-label">Market Value</div>
                            <div class="price-value market">${marketValue.toFixed(2)}</div>
                        </div>
                        <div class="price-item">
                            <div class="price-label">Recommended</div>
                            <div class="price-value recommended">${recommendedValue.toFixed(2)}</div>
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
            
            // 🟢 Attach event listeners here for CSP-safe action buttons

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




    async loadHistory() {
        try {
            console.log('📊 Loading notification history...');
            this.showLoading(true);
            this.hideMessages();

            const url = `${this.serverUrl}/history`;
            console.log(`🔗 Fetching from: ${url}`);
            
            const response = await fetch(url);
            console.log(`📡 Response status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📦 Server response:', data);
            
            // Make sure we get the items array
            this.notifications = Array.isArray(data.items) ? data.items : [];
            console.log(`✅ Processed ${this.notifications.length} notifications`);
            
            if (this.notifications.length > 0) {
                console.log('🎯 Notifications found, rendering cards...');
                this.showSuccess(`Loaded ${this.notifications.length} notifications from last 30 minutes`);
                
                // Log each notification for debugging
                this.notifications.forEach((notif, index) => {
                    console.log(`  ${index + 1}. ${notif.market_name} | Keychains: ${notif.keychains?.join(', ') || 'None'} | $${((notif.market_value || 0) / 100).toFixed(2)}`);
                });
            } else {
                console.log('⚠️ No notifications found');
            }
            
            this.renderHistory();
            this.updateStats();
            this.showLoading(false);
            
        } catch (error) {
            console.error('❌ Error loading history:', error);
            this.showError(`Failed to load notification history: ${error.message}\n\nMake sure the server is running on port 3001`);
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
            }, 15000);
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
        }, 15000); // Refresh every 15 seconds
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
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
console.log('📝 History.js loaded successfully');

// Add a global test function to debug CSP issues
window.testButtonClick = function() {
    console.log('🧪 Test function called - JavaScript is working');
    alert('JavaScript is working correctly!');
};
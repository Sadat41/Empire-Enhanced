/**
 * ============================================================================
 * EMPIRE ENHANCED - AUTOMATION MANAGER
 * ============================================================================
 *
 * Handles automated withdrawal functionality for CSGOEmpire items.
 *
 * Features:
 * - Automatic withdrawal of items meeting criteria
 * - Item re-verification before withdrawal
 * - Price range filtering
 * - Charm value percentage threshold
 * - Rate limiting and cooldown management
 * - Statistics tracking
 *
 * @version 1.0.0
 */

class AutomationManager {
  constructor() {
    this.initializeProperties();
  }

  /**
   * Initialize automation properties
   */
  initializeProperties() {
    // Automation configuration
    this.config = {
      enabled: false,
      thresholdPercentage: 50,  // Minimum charm value as % of item price
      minPrice: null,  // Minimum item price in USD (null = no limit)
      maxPrice: null,   // Maximum item price in USD (null = no limit)
      minDifferencePercentage: 50,  // Minimum price difference % (marketplace vs empire)
      maxDifferencePercentage: 100  // Maximum price difference % (marketplace vs empire)
    };

    // Statistics tracking
    this.stats = {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      totalValueWithdrawn: 0,
      lastAttempt: null,
      lastSuccess: null,
      lastFailure: null
    };

    // Rate limiting
    this.lastWithdrawalTime = 0;
    this.cooldownMs = 5000;  // 5 second cooldown between withdrawals

    // API configuration
    this.apiKey = null;
    this.domain = 'csgoempire.com';
  }

  /**
   * Load automation settings from Chrome storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['automationConfig', 'automationStats']);

      if (result.automationConfig) {
        this.config = { ...this.config, ...result.automationConfig };
        console.log('✅ Automation config loaded:', this.config);
      }

      if (result.automationStats) {
        this.stats = { ...this.stats, ...result.automationStats };
        console.log('✅ Automation stats loaded:', this.stats);
      }
    } catch (error) {
      console.error('❌ Error loading automation settings:', error);
    }
  }

  /**
   * Save automation configuration to Chrome storage
   */
  async saveConfig() {
    try {
      await chrome.storage.sync.set({ automationConfig: this.config });
      console.log('💾 Automation config saved');
    } catch (error) {
      console.error('❌ Error saving automation config:', error);
    }
  }

  /**
   * Save automation statistics to Chrome storage
   */
  async saveStats() {
    try {
      await chrome.storage.sync.set({ automationStats: this.stats });
      console.log('💾 Automation stats saved');
    } catch (error) {
      console.error('❌ Error saving automation stats:', error);
    }
  }

  /**
   * Set automation enabled state
   * @param {boolean} enabled - Whether automation is enabled
   */
  async setEnabled(enabled) {
    this.config.enabled = enabled;
    await this.saveConfig();
    console.log(`🤖 Automation ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Update automation settings
   * @param {Object} settings - Settings to update
   */
  async updateSettings(settings) {
    if (settings.thresholdPercentage !== undefined) {
      this.config.thresholdPercentage = settings.thresholdPercentage;
    }
    if (settings.minPrice !== undefined) {
      this.config.minPrice = settings.minPrice;
    }
    if (settings.maxPrice !== undefined) {
      this.config.maxPrice = settings.maxPrice;
    }
    if (settings.minDifferencePercentage !== undefined) {
      this.config.minDifferencePercentage = settings.minDifferencePercentage;
    }
    if (settings.maxDifferencePercentage !== undefined) {
      this.config.maxDifferencePercentage = settings.maxDifferencePercentage;
    }

    await this.saveConfig();
    console.log('⚙️ Automation settings updated:', this.config);
  }

  /**
   * Reset automation statistics
   */
  async resetStats() {
    this.stats = {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      totalValueWithdrawn: 0,
      lastAttempt: null,
      lastSuccess: null,
      lastFailure: null
    };

    await this.saveStats();
    console.log('🔄 Automation stats reset');
  }

  /**
   * Get current automation settings and stats
   * @returns {Object} Current settings and statistics
   */
  getSettings() {
    return {
      enabled: this.config.enabled,
      thresholdPercentage: this.config.thresholdPercentage,
      minPrice: this.config.minPrice,
      maxPrice: this.config.maxPrice,
      stats: { ...this.stats }
    };
  }

  /**
   * Set API key for authentication
   * @param {string} apiKey - Bearer token for API
   * @param {string} domain - Domain to use (default: csgoempire.com)
   */
  setAPIKey(apiKey, domain = 'csgoempire.com') {
    this.apiKey = apiKey;
    this.domain = domain;
  }

  /**
   * Check if enough time has passed since last withdrawal (rate limiting)
   * @returns {boolean} True if cooldown has elapsed
   */
  canWithdraw() {
    const now = Date.now();
    const timeSinceLastWithdrawal = now - this.lastWithdrawalTime;
    return timeSinceLastWithdrawal >= this.cooldownMs;
  }

  /**
   * Re-verify item data from the API before withdrawal
   * @param {number} itemId - Item deposit ID
   * @returns {Object|null} Fresh item data or null if failed
   */
  async reVerifyItem(itemId) {
    try {
      console.log(`🔍 Re-verifying item ${itemId}...`);

      const response = await fetch(`https://${this.domain}/api/v2/trading/deposit/${itemId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`❌ Re-verification failed: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      console.log(`✅ Item ${itemId} re-verified successfully`);
      return data;

    } catch (error) {
      console.error(`❌ Error re-verifying item ${itemId}:`, error);
      return null;
    }
  }

  /**
   * Execute withdrawal for an item
   * @param {Object} item - Item object with deposit ID and coin value
   * @returns {Object} Withdrawal result
   */
  async withdrawItem(item) {
    try {
      console.log(`💰 [Charm Automation] Attempting to withdraw item ${item.id} (${item.market_name})...`);
      console.log(`💰 [Charm Automation] Item data:`, {
        id: item.id,
        market_name: item.market_name,
        purchase_price: item.purchase_price,
        market_value: item.market_value,
        wear: item.wear
      });

      // Update stats
      this.stats.totalAttempts++;
      this.stats.lastAttempt = new Date().toISOString();
      this.lastWithdrawalTime = Date.now();

      // Prepare request body with coin_value (use purchase_price or market_value)
      // Both are already in cents (int32 format)
      const coinValue = item.purchase_price || item.market_value || 0;
      const body = JSON.stringify({ coin_value: coinValue });

      console.log(`💰 [Charm Automation] Request URL: https://${this.domain}/api/v2/trading/deposit/${item.id}/withdraw`);
      console.log(`💰 [Charm Automation] Request body:`, { coin_value: coinValue });

      const response = await fetch(`https://${this.domain}/api/v2/trading/deposit/${item.id}/withdraw`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: body
      });

      console.log(`💰 [Charm Automation] Response status:`, response.status);

      const data = await response.json();
      console.log(`💰 [Charm Automation] Response data:`, data);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${data.message || response.statusText}`);
      }

      // Success!
      this.stats.successCount++;
      this.stats.lastSuccess = new Date().toISOString();
      this.stats.totalValueWithdrawn += (item.market_value || 0) / 100; // Convert cents to dollars

      await this.saveStats();

      console.log(`✅ [Charm Automation] Successfully withdrew item ${item.id}!`);
      console.log(`📊 [Charm Automation] Total value withdrawn: $${this.stats.totalValueWithdrawn.toFixed(2)}`);

      return {
        success: true,
        data: data,
        item: item
      };

    } catch (error) {
      // Failure
      this.stats.failureCount++;
      this.stats.lastFailure = new Date().toISOString();

      await this.saveStats();

      console.error(`❌ [Charm Automation] Failed to withdraw item ${item.id}:`, error.message);

      return {
        success: false,
        error: error.message,
        item: item
      };
    }
  }

  /**
   * Check if an item meets automation criteria
   * @param {Object} item - Item to check
   * @param {number} charmValue - Total value of charms/keychains
   * @returns {Object} Result with pass/fail and reason
   */
  meetsAutomationCriteria(item, charmValue) {
    // Check if item is auction (must be non-auction)
    if (item.auction_ends_at !== null && item.auction_ends_at !== undefined) {
      console.log(`🔴 [Charm Automation] Item ${item.id} is an auction item (auction_ends_at: ${item.auction_ends_at}) - SKIPPING`);
      return {
        pass: false,
        reason: 'Item is an auction item (only instant-buy items are supported)'
      };
    }

    console.log(`✅ [Charm Automation] Item ${item.id} is non-auction (auction_ends_at: null)`);

    // Get item market value in dollars
    const itemValueUSD = (item.market_value || 0) / 100;

    // Check price range filter (min)
    if (this.config.minPrice !== null && itemValueUSD < this.config.minPrice) {
      return {
        pass: false,
        reason: `Item price $${itemValueUSD.toFixed(2)} below minimum $${this.config.minPrice.toFixed(2)}`
      };
    }

    // Check price range filter (max)
    if (this.config.maxPrice !== null && itemValueUSD > this.config.maxPrice) {
      return {
        pass: false,
        reason: `Item price $${itemValueUSD.toFixed(2)} above maximum $${this.config.maxPrice.toFixed(2)}`
      };
    }

    // Check charm value percentage threshold
    const charmPercentage = itemValueUSD > 0 ? (charmValue / itemValueUSD) * 100 : 0;

    if (charmPercentage < this.config.thresholdPercentage) {
      return {
        pass: false,
        reason: `Charm value ${charmPercentage.toFixed(1)}% below threshold ${this.config.thresholdPercentage}%`
      };
    }

    // Check price difference percentage (marketplace vs empire)
    // Use buff163_price as primary marketplace price (from enhanced data)
    const marketplacePrice = item.buff163_price || item.csfloat_price || null;

    if (marketplacePrice !== null && marketplacePrice > 0) {
      // Calculate percentage difference: how much cheaper Empire is compared to marketplace
      // Formula: ((marketplace - empire) / empire) * 100
      // If marketplace = $0.17 and empire = $0.31, diff = ((0.17 - 0.31) / 0.31) * 100 = -45% (empire more expensive)
      // We want the absolute value or the difference from marketplace perspective
      // Actually for this use case: (empire / marketplace) * 100 = how much empire costs as % of marketplace
      const priceDifferencePercent = (itemValueUSD / marketplacePrice) * 100;

      console.log(`💰 [Charm Automation] Price difference check:`, {
        empirePrice: itemValueUSD,
        marketplacePrice: marketplacePrice,
        differencePercent: priceDifferencePercent.toFixed(1),
        minRequired: this.config.minDifferencePercentage,
        maxAllowed: this.config.maxDifferencePercentage
      });

      if (priceDifferencePercent < this.config.minDifferencePercentage) {
        return {
          pass: false,
          reason: `Price difference ${priceDifferencePercent.toFixed(1)}% below minimum ${this.config.minDifferencePercentage}%`
        };
      }

      if (priceDifferencePercent > this.config.maxDifferencePercentage) {
        return {
          pass: false,
          reason: `Price difference ${priceDifferencePercent.toFixed(1)}% above maximum ${this.config.maxDifferencePercentage}%`
        };
      }

      console.log(`✅ [Charm Automation] Price difference ${priceDifferencePercent.toFixed(1)}% within range ${this.config.minDifferencePercentage}%-${this.config.maxDifferencePercentage}%`);
    } else {
      console.log(`⚠️ [Charm Automation] No marketplace price available, skipping price difference check`);
    }

    // All checks passed!
    return {
      pass: true,
      reason: `Meets criteria: ${charmPercentage.toFixed(1)}% charm value, $${itemValueUSD.toFixed(2)} item price`
    };
  }

  /**
   * Process item for potential automated withdrawal
   * @param {Object} item - Item to process
   * @param {number} charmValue - Total value of charms/keychains
   * @returns {Object|null} Withdrawal result or null if not processed
   */
  async processItem(item, charmValue) {
    // Check if automation is enabled
    if (!this.config.enabled) {
      console.log(`🤖⏸️ [Charm Automation] DISABLED - Enable in popup to auto-purchase charms`);
      return null;
    }

    // Check rate limiting
    if (!this.canWithdraw()) {
      const remainingCooldown = this.cooldownMs - (Date.now() - this.lastWithdrawalTime);
      console.log(`⏳ Rate limit: ${(remainingCooldown / 1000).toFixed(1)}s remaining`);
      return null;
    }

    // Check if item meets criteria
    const criteriaCheck = this.meetsAutomationCriteria(item, charmValue);

    if (!criteriaCheck.pass) {
      console.log(`⏭️ Item ${item.id} skipped: ${criteriaCheck.reason}`);
      return null;
    }

    console.log(`✨ Item ${item.id} meets automation criteria: ${criteriaCheck.reason}`);

    // SKIP re-verification for charm automation
    // The item data is already fresh from the WebSocket feed
    // Re-verification adds unnecessary delay and the endpoint returns 405 errors
    console.log(`⚡ [Charm Automation] Proceeding with withdrawal immediately (no re-verification)`);

    // Execute withdrawal
    const result = await this.withdrawItem(item);

    return result;
  }
}

/**
 * ============================================================================
 * ITEM TARGET AUTOMATION MANAGER
 * ============================================================================
 *
 * Handles automated withdrawal functionality for specific targeted items.
 *
 * Features:
 * - Automatic withdrawal based on item target list
 * - Float range filtering
 * - Percentage difference filtering (marketplace vs empire price)
 * - Price range filtering
 * - Rate limiting and cooldown management
 * - Statistics tracking
 *
 * @version 1.0.0
 */

class ItemTargetAutomationManager {
  constructor() {
    this.initializeProperties();
  }

  /**
   * Initialize automation properties
   */
  initializeProperties() {
    // Automation configuration
    this.config = {
      enabled: false
    };

    // Automation filter entries (separate from Control Panel filters)
    // Array of filter objects, each representing a different automation rule
    this.filterEntries = [];

    // Statistics tracking
    this.stats = {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      totalValueWithdrawn: 0,
      lastAttempt: null,
      lastSuccess: null,
      lastFailure: null
    };

    // API configuration
    this.apiKey = null;
    this.domain = 'csgoempire.com';
  }

  /**
   * Load automation settings from Chrome storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'itemTargetAutomationConfig',
        'itemTargetAutomationStats'
      ]);

      // Load from local storage for filter entries
      const localResult = await chrome.storage.local.get(['itemTargetAutomationFilterEntries']);

      if (result.itemTargetAutomationConfig) {
        this.config = { ...this.config, ...result.itemTargetAutomationConfig };
        console.log('✅ Item Target Automation config loaded:', this.config);
      }

      if (result.itemTargetAutomationStats) {
        this.stats = { ...this.stats, ...result.itemTargetAutomationStats };
        console.log('✅ Item Target Automation stats loaded:', this.stats);
      }

      if (localResult.itemTargetAutomationFilterEntries) {
        this.filterEntries = localResult.itemTargetAutomationFilterEntries;
        console.log(`✅ Item Target Automation filter entries loaded: ${this.filterEntries.length} entries`);
      }
    } catch (error) {
      console.error('❌ Error loading Item Target Automation settings:', error);
    }
  }

  /**
   * Add a new filter entry to the automation list
   * @param {Object} entry - Filter entry to add
   */
  async addFilterEntry(entry) {
    // Generate unique ID for the entry
    entry.id = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.filterEntries.push(entry);
    await this.saveFilterEntries();
    console.log(`➕ Added filter entry: ${entry.keyword || 'Universal Filter'}`);
  }

  /**
   * Remove a filter entry from the automation list
   * @param {string} entryId - ID of the entry to remove
   */
  async removeFilterEntry(entryId) {
    const index = this.filterEntries.findIndex(e => e.id === entryId);
    if (index !== -1) {
      const removed = this.filterEntries.splice(index, 1)[0];
      await this.saveFilterEntries();
      console.log(`➖ Removed filter entry: ${removed.keyword || 'Universal Filter'}`);
    }
  }

  /**
   * Update the filter entries list
   * @param {Array} entries - New filter entries array
   */
  async updateFilterEntries(entries) {
    this.filterEntries = entries || [];
    await this.saveFilterEntries();
    console.log(`📋 Filter entries updated: ${this.filterEntries.length} entries`);
  }

  /**
   * Save filter entries to Chrome storage
   */
  async saveFilterEntries() {
    try {
      await chrome.storage.local.set({ itemTargetAutomationFilterEntries: this.filterEntries });
      console.log('💾 Item Target Automation filter entries saved');
    } catch (error) {
      console.error('❌ Error saving Item Target Automation filter entries:', error);
    }
  }

  /**
   * Save automation configuration to Chrome storage
   */
  async saveConfig() {
    try {
      await chrome.storage.sync.set({ itemTargetAutomationConfig: this.config });
      console.log('💾 Item Target Automation config saved');
    } catch (error) {
      console.error('❌ Error saving Item Target Automation config:', error);
    }
  }

  /**
   * Save automation statistics to Chrome storage
   */
  async saveStats() {
    try {
      await chrome.storage.sync.set({ itemTargetAutomationStats: this.stats });
      console.log('💾 Item Target Automation stats saved');
    } catch (error) {
      console.error('❌ Error saving Item Target Automation stats:', error);
    }
  }

  /**
   * Set automation enabled state
   * @param {boolean} enabled - Whether automation is enabled
   */
  async setEnabled(enabled) {
    this.config.enabled = enabled;
    await this.saveConfig();
    console.log(`🤖 Item Target Automation ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Reset automation statistics
   */
  async resetStats() {
    this.stats = {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      totalValueWithdrawn: 0,
      lastAttempt: null,
      lastSuccess: null,
      lastFailure: null
    };

    await this.saveStats();
    console.log('🔄 Item Target Automation stats reset');
  }

  /**
   * Get current automation settings and stats
   * @returns {Object} Current settings and statistics
   */
  getSettings() {
    return {
      enabled: this.config.enabled,
      cooldownSeconds: this.config.cooldownSeconds,
      filterEntries: [...this.filterEntries],
      stats: { ...this.stats }
    };
  }

  /**
   * Set API key for authentication
   * @param {string} apiKey - Bearer token for API
   * @param {string} domain - Domain to use (default: csgoempire.com)
   */
  setAPIKey(apiKey, domain = 'csgoempire.com') {
    this.apiKey = apiKey;
    this.domain = domain;
  }

  /**
   * Check if an item matches any of the automation filter entries
   * @param {Object} item - Item to check
   * @param {Object} priceData - Price data from external marketplaces
   * @returns {Object} Result with match status and matched entry
   */
  matchesItemTarget(item, priceData = null) {
    if (!this.filterEntries || this.filterEntries.length === 0) {
      return {
        matches: false,
        reason: 'No automation filter entries configured'
      };
    }

    // Get item properties
    const itemName = item.market_name || '';
    const itemFloat = item.wear || null;
    const itemPriceUSD = (item.market_value || 0) / 100;

    // Check each filter entry in the list
    for (let i = 0; i < this.filterEntries.length; i++) {
      const entry = this.filterEntries[i];
      const keyword = entry.keyword || '';

      // Check item name/keyword filter (skip if empty)
      if (keyword.trim() !== '') {
        if (!itemName.toLowerCase().includes(keyword.toLowerCase())) {
          continue; // Doesn't match this entry, try next
        }
      }

      // Check float filter
      if (entry.floatFilter?.enabled) {
        if (itemFloat === null) {
          continue; // Item has no float data, try next entry
        }

        const minFloat = entry.floatFilter.min;
        const maxFloat = entry.floatFilter.max;

        if (minFloat !== null && itemFloat < minFloat) {
          continue; // Float out of range, try next entry
        }
        if (maxFloat !== null && itemFloat > maxFloat) {
          continue; // Float out of range, try next entry
        }
      }

      // Check price filter
      if (entry.priceFilter?.enabled) {
        const minPrice = entry.priceFilter.min;
        const maxPrice = entry.priceFilter.max;

        if (minPrice !== null && itemPriceUSD < minPrice) {
          continue; // Price too low, try next entry
        }
        if (maxPrice !== null && itemPriceUSD > maxPrice) {
          continue; // Price too high, try next entry
        }
      }

      // Check percentage difference filter
      if (entry.percentDiffFilter?.enabled && priceData) {
        const percentDiff = priceData.percentDifference || 0;
        const minDiff = entry.percentDiffFilter.min;
        const maxDiff = entry.percentDiffFilter.max;

        if (minDiff !== null && percentDiff < minDiff) {
          continue; // Percentage difference too low, try next entry
        }
        if (maxDiff !== null && percentDiff > maxDiff) {
          continue; // Percentage difference too high, try next entry
        }
      }

      // All filters passed for this entry!
      console.log(`🎉 MATCH FOUND: ${itemName} matches filter "${keyword || 'Universal Filter'}"`);
      return {
        matches: true,
        entry: entry,
        reason: `Matched automation entry: ${keyword || 'Universal Filter'}`
      };
    }

    return {
      matches: false,
      reason: 'No matching automation filter entry found'
    };
  }

  /**
   * Execute withdrawal for an item
   * @param {Object} item - Item object with deposit ID
   * @returns {Object} Withdrawal result
   */
  async withdrawItem(item) {
    try {
      console.log(`💰 [Withdrawal] Attempting to withdraw item ${item.id} (${item.market_name})...`);
      console.log(`💰 [Withdrawal] Item data:`, {
        id: item.id,
        market_name: item.market_name,
        purchase_price: item.purchase_price,
        market_value: item.market_value,
        wear: item.wear
      });

      // Update stats
      this.stats.totalAttempts++;
      this.stats.lastAttempt = new Date().toISOString();

      // Prepare request body with coin_value (use purchase_price or market_value)
      const coinValue = item.purchase_price || item.market_value || 0;
      const body = JSON.stringify({ coin_value: coinValue });

      console.log(`💰 [Withdrawal] Request URL: https://${this.domain}/api/v2/trading/deposit/${item.id}/withdraw`);
      console.log(`💰 [Withdrawal] Request body:`, { coin_value: coinValue });

      const response = await fetch(`https://${this.domain}/api/v2/trading/deposit/${item.id}/withdraw`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: body
      });

      console.log(`💰 [Withdrawal] Response status:`, response.status);

      const data = await response.json();
      console.log(`💰 [Withdrawal] Response data:`, data);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${data.message || response.statusText}`);
      }

      // Success!
      this.stats.successCount++;
      this.stats.lastSuccess = new Date().toISOString();
      this.stats.totalValueWithdrawn += (item.market_value || 0) / 100; // Convert cents to dollars

      await this.saveStats();

      console.log(`✅ [Withdrawal] Successfully withdrew item ${item.id}!`);
      console.log(`📊 [Withdrawal] Total value withdrawn: $${this.stats.totalValueWithdrawn.toFixed(2)}`);

      return {
        success: true,
        data: data,
        item: item
      };

    } catch (error) {
      // Failure
      this.stats.failureCount++;
      this.stats.lastFailure = new Date().toISOString();

      await this.saveStats();

      console.error(`❌ [Withdrawal] Failed to withdraw item ${item.id}:`, error.message);

      return {
        success: false,
        error: error.message,
        item: item
      };
    }
  }

  /**
   * Process item for potential automated withdrawal
   * @param {Object} item - Item to process
   * @param {Object} priceData - Price data from external marketplaces
   * @returns {Object|null} Withdrawal result or null if not processed
   */
  async processItem(item, priceData = null) {
    // Check if automation is enabled
    if (!this.config.enabled) {
      return null;
    }

    // Check if item is auction (must be non-auction)
    if (item.auction_ends_at !== null && item.auction_ends_at !== undefined) {
      console.log(`🔴 [Item Target Automation] Item ${item.id} is an auction item (auction_ends_at: ${item.auction_ends_at}) - SKIPPING`);
      return null;
    }

    // Check if item matches any target
    const matchResult = this.matchesItemTarget(item, priceData);

    if (!matchResult.matches) {
      return null;
    }

    console.log(`✨ Item ${item.market_name} matches automation filters - attempting withdrawal...`);

    // Execute withdrawal
    const result = await this.withdrawItem(item);

    // Include matched entry information in the result
    if (result && result.success) {
      result.matchedEntry = matchResult.entry;
    }

    return result;
  }
}

// Export for use in background.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AutomationManager,
    ItemTargetAutomationManager
  };
}

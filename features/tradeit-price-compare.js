// features/tradeit-price-compare.js

(function() {
    'use strict';

    // Set to true to get very detailed console logs.
    const DEBUG_MODE = false;

    // Ensure the script only runs on the specific market page
    if (!window.location.href.includes('/withdraw/steam/market')) {
        return;
    }

    console.log('🔥 TradeIt.gg Price Comparison Module Loaded on Market Page.');

    class SimpleTradeItComparison {
        constructor() {
            this.tradeitDataCache = new Map();
            this.currentTheme = 'nebula';
            this.init();
        }

        async init() {
            
            const settings = await chrome.storage.sync.get({ selectedTheme: 'nebula' });
            this.currentTheme = settings.selectedTheme;
            this.applyDynamicStylesToAllInjectedElements(); // Apply initial theme styles

            window.addEventListener('empireThemeChanged', (event) => {
                this.currentTheme = event.detail.theme;
                this.applyDynamicStylesToAllInjectedElements();
            });

        
            await this.loadAndCachePriceData(); 

            if (this.tradeitDataCache.size > 0) { 
                this.startItemProcessing();
            } else {
                console.warn('⚠️ Price comparison data not loaded or empty. Comparison will not run fully.');
            }
        }

        
        async loadAndCachePriceData() {
            const CACHE_KEY = 'tradeitAndBuffPrices';
            const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

            // Try to load from chrome.storage.local first
            const cachedData = await chrome.storage.local.get(CACHE_KEY);
            if (cachedData[CACHE_KEY] && (Date.now() - cachedData[CACHE_KEY].timestamp < CACHE_EXPIRY_MS)) {
                this.tradeitDataCache = new Map(cachedData[CACHE_KEY].data);
                if (DEBUG_MODE) console.log(`✅ Loaded ${this.tradeitDataCache.size} prices from chrome.storage.local cache.`);
                return;
            }

            if (DEBUG_MODE) console.log('🔄 Cache is stale or empty, fetching from background script.');
            
            try {
                // Fetch ALL available data from background script (Tradeit.gg + GitHub JSON)
                const response = await chrome.runtime.sendMessage({ type: 'FETCH_TRADEIT_DATA' });

                if (response?.success && response.data) {
                    this.tradeitDataCache.clear();
                    response.data.forEach(item => {
                        if (item.item && item.price) {
                            this.tradeitDataCache.set(item.item.toLowerCase(), {
                                price: item.price,
                                source: item.source, // Store the source information
                                timestamp: item.timestamp
                            });
                        }
                    });
                    
                    // Save to chrome.storage.local
                    await chrome.storage.local.set({
                        [CACHE_KEY]: {
                            data: Array.from(this.tradeitDataCache.entries()),
                            timestamp: Date.now()
                        }
                    });

                    if (DEBUG_MODE) console.log(`✅ Fetched ${this.tradeitDataCache.size} combined prices from background script and cached.`);
                } else {
                    console.error('❌ Combined price data fetch failed or response was empty from background script.');
                }
            } catch (error) {
                console.error('❌ Error communicating with background script for combined price data:', error);
            }
        }


        cleanMarketHashName(itemType, itemName, itemQuality) {
            const cleanedType = (itemType || '').replace(/\s+/g, ' ').trim();
            let cleanedName = (itemName || '').replace(/\s+/g, ' ').trim();
            const cleanedQuality = (itemQuality || '').replace(/\s+/g, ' ').trim();

            // Handle stickers: "Sticker" + "Team Dignitas - Cologne 2014" -> "Sticker | Team Dignitas | Cologne 2014"
    if (cleanedType.toLowerCase() === 'sticker') {
        // Replace the first " - " with " | " for stickers
        cleanedName = cleanedName.replace(' - ', ' | ');
        return `${cleanedType} | ${cleanedName}`;
    }

            let formattedName = cleanedQuality ? `${cleanedType} | ${cleanedName} (${cleanedQuality})` : `${cleanedType} | ${cleanedName}`;

            const patternsToReplace = [
                { regex: / - (Sapphire|Emerald|Ruby|Black Pearl)/gi, replace: ' $1' },
                { regex: / - (Phase [1-4])/gi, replace: ' $1' },
                { regex: / - (Gamma Doppler)/gi, replace: ' $1' },
                { regex: / \(Phase ([1-4])\)/gi, replace: ' Phase $1' },
                { regex: / \(Gamma Doppler\)/gi, replace: ' Gamma Doppler' },
            ];

            patternsToReplace.forEach(pattern => {
                formattedName = formattedName.replace(pattern.regex, pattern.replace);
            });
            
            return formattedName.replace(/\s+/g, ' ').trim();
        }

        startItemProcessing() {
            const observerTarget = document.querySelector('.market-items-grid') || document.body;
            if (DEBUG_MODE) console.log('🔎 Starting item processing with MutationObserver.');

            this.processAllVisibleItems(); 

            const observer = new MutationObserver(mutations => {
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length) {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1) {
                                if (node.matches('div.item-card')) this.processItemCard(node);
                                else node.querySelectorAll('div.item-card').forEach(this.processItemCard.bind(this));
                            }
                        });
                    }
                }
            });

            observer.observe(observerTarget, { childList: true, subtree: true });
        }

        processAllVisibleItems() {
            document.querySelectorAll('div.item-card').forEach(this.processItemCard.bind(this));
        }

        async processItemCard(itemCard) {
            if (itemCard.dataset.cardProcessed) return;
            itemCard.dataset.cardProcessed = 'true';

            const itemData = this.extractItemData(itemCard);
            if (!itemData) return;

            const possibleNames = this.generatePossibleMarketHashNames(itemData.itemType, itemData.itemName, itemData.itemQuality);
            let foundPrice = false;

            // First, try to find price in the already loaded cache
            for (const nameAttempt of possibleNames) {
                if (this.tradeitDataCache.has(nameAttempt)) { // Check the combined cache
                    const priceInfo = this.tradeitDataCache.get(nameAttempt);
                    this.injectFullPriceBox(itemCard, itemData.csEmpirePrice, priceInfo); // Pass the full priceInfo object
                    foundPrice = true;
                    break;
                }
            }

            // If price is still missing after checking all local sources, request from backend
            if (!foundPrice) {
                if (DEBUG_MODE) console.log(`Item "${itemData.fullMarketName}" not found in cache. Requesting scrape from backend via background script.`);
                this.injectLoadingState(itemCard); // Show loading indicator
                try {
                    const response = await chrome.runtime.sendMessage({ 
                        type: 'FETCH_TRADEIT_DATA', // This message now triggers the full logic in background.js
                        data: { itemName: itemData.fullMarketName } // Pass specific item name
                    });

                    if (response?.success && response.data) {
                        // Re-process the item with potentially new data
                        // Find the newly scraped item in the response data
                        const newlyScrapedItem = response.data.find(d => 
                            this.generatePossibleMarketHashNames(itemData.itemType, itemData.itemName, itemData.itemQuality)
                                .includes(d.item?.toLowerCase())
                        );
                        
                        if (newlyScrapedItem) {
                            // Store the full item object (including source) in cache
                            this.tradeitDataCache.set(newlyScrapedItem.item.toLowerCase(), {
                                price: newlyScrapedItem.price,
                                source: newlyScrapedItem.source,
                                timestamp: newlyScrapedItem.timestamp
                            });
                            // Pass the full newlyScrapedItem object here
                            this.injectFullPriceBox(itemCard, itemData.csEmpirePrice, newlyScrapedItem); // <--- CRITICAL CHANGE HERE
                        } else {
                            this.injectNotFoundState(itemCard); // No price found even after scrape
                        }
                    } else {
                        this.injectNotFoundState(itemCard); // Backend scrape failed
                    }
                } catch (error) {
                    console.error(`❌ Error requesting scrape for "${itemData.fullMarketName}":`, error);
                    this.injectNotFoundState(itemCard); // Error during request
                }
            }
        }

        generatePossibleMarketHashNames(itemType, itemName, itemQuality) {
            const names = new Set();
            names.add(this.cleanMarketHashName(itemType, itemName, itemQuality).toLowerCase());
            names.add(this.cleanMarketHashName(itemType, itemName, '').toLowerCase()); // Without quality
            return Array.from(names);
        }

        extractItemData(itemElement) {
            const typeEl = itemElement.querySelector('[data-testid="item-card-item-type"]');
            const nameEl = itemElement.querySelector('[data-testid="item-card-item-name"]');
            const qualityEl = itemElement.querySelector('[data-testid="item-card-quality"]');
            const priceEl = itemElement.querySelector('[data-testid="currency-value"] span:last-child');

            if (!typeEl || !nameEl || !qualityEl || !priceEl) return null;

            const csEmpirePrice = parseFloat(priceEl.textContent.replace(/[^0-9.]/g, ''));
            if (isNaN(csEmpirePrice)) return null;

            return {
                itemType: typeEl.textContent.trim(),
                itemName: nameEl.textContent.trim(),
                itemQuality: qualityEl.textContent.split('|')[0].trim(),
                csEmpirePrice,
                fullMarketName: this.cleanMarketHashName(typeEl.textContent.trim(), nameEl.textContent.trim(), qualityEl.textContent.split('|')[0].trim()) // Added for backend request
            };
        }
        
        applyDynamicStylesToAllInjectedElements() {
            document.querySelectorAll('.tradeit-comparison-box').forEach(this.applySpecificBoxStyles.bind(this));
        }

        injectFullPriceBox(itemCard, csEmpirePriceRaw, priceInfo) { // 'priceInfo' is now consistently an object
            let comparisonDiv = itemCard.querySelector('.tradeit-comparison-box');
            if (!comparisonDiv) {
                comparisonDiv = document.createElement('div');
                comparisonDiv.className = 'tradeit-comparison-box';
                const insertTarget = itemCard.querySelector('[data-testid="item-card-bottom-area"]');
                insertTarget?.parentNode?.insertBefore(comparisonDiv, insertTarget.nextSibling);
            }

            let csFloatFinalPriceUSD;
            // Removed priceSourceDisplay as it's no longer used in the output HTML
            const TRADEIT_ADJUSTMENT_MULTIPLIER = 0.925; 

            // Apply multiplier conditionally based on the source
            if (priceInfo.source === 'tradeit.gg') {
                csFloatFinalPriceUSD = priceInfo.price * TRADEIT_ADJUSTMENT_MULTIPLIER;
                if (DEBUG_MODE) console.log(`DEBUG: Tradeit.gg price: ${priceInfo.price}, adjusted to: ${csFloatFinalPriceUSD}`);
            } else if (priceInfo.source && priceInfo.source.includes('buff.163.com')) {
                csFloatFinalPriceUSD = priceInfo.price;
                if (DEBUG_MODE) console.log(`DEBUG: Buff.163.com price (already USD): ${priceInfo.price}`);
            } else {
                csFloatFinalPriceUSD = priceInfo.price;
                console.warn(`WARNING: Unknown price source '${priceInfo.source}'. Using price as-is.`);
            }

            const formatPrice = (p) => p ? `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A';
            // *** MODIFIED ICON: Smaller size and adjusted alignment ***
            const coinIconSVG = `<svg width="12" height="12" viewBox="0 0 24 24" style="display: inline-block; vertical-align: -1px; margin-right: 4px;" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="empireCoinGradient"><stop offset="5%" stop-color="#fdd835"></stop><stop offset="95%" stop-color="#f57f17"></stop></linearGradient></defs><circle cx="12" cy="12" r="11" fill="url(#empireCoinGradient)" stroke="#c5871b" stroke-width="1.5"/></svg>`;
            
            let differenceHtml = '';
            const csEmpirePriceUSD = csEmpirePriceRaw; 

            if (csEmpirePriceUSD > 0 && !isNaN(csFloatFinalPriceUSD)) {
                const ratioPercent = (csFloatFinalPriceUSD / csEmpirePriceUSD) * 100;
                const diffClass = ratioPercent < 100 ? 'positive' : 'negative'; 
                
                differenceHtml = `
                    <div class="tradeit-line tradeit-difference ${diffClass}">
                        <span class="tradeit-label">Difference:</span>
                        <span class="tradeit-value">${ratioPercent.toFixed(2)}%</span>
                    </div>`;
            }

            comparisonDiv.innerHTML = `
                <div class="tradeit-header">COMPARISON</div>
                <div class="tradeit-details-grid">
                    <div class="tradeit-line">
                        <span class="tradeit-label">CSFloat Price:</span>
                        <span class="tradeit-value">${formatPrice(csFloatFinalPriceUSD)}</span>
                    </div>
                    <div class="tradeit-line">
                        <span class="tradeit-label">Empire Price:</span>
                        <span class="tradeit-value">${coinIconSVG}${csEmpirePriceRaw.toLocaleString('en-US')}</span>
                    </div>
                    ${differenceHtml}
                </div>
            `;
            
            this.applySpecificBoxStyles(comparisonDiv);
        }

        applySpecificBoxStyles(comparisonDiv) {
            const isShootingStar = this.currentTheme === 'shooting-star';
            
            Object.assign(comparisonDiv.style, {
                marginTop: '10px',
                padding: '8px 10px',
                borderRadius: '8px',
                backgroundColor: isShootingStar ? 'rgba(20, 20, 40, 0.85)' : 'rgba(255, 255, 255, 0.07)',
                border: `1px solid ${isShootingStar ? 'rgba(135, 206, 235, 0.2)' : 'rgba(255, 255, 255, 0.12)'}`,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
            });

            const header = comparisonDiv.querySelector('.tradeit-header');
            if (header) {
                Object.assign(header.style, {
                    fontSize: '11px',
                    fontWeight: '600',
                    color: isShootingStar ? '#87ceeb' : '#a3bffa',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    paddingBottom: '4px',
                    borderBottom: `1px solid ${isShootingStar ? 'rgba(135, 206, 235, 0.15)' : 'rgba(255, 255, 255, 0.1)'}`,
                    marginBottom: '4px',
                });
            }

            const detailsGrid = comparisonDiv.querySelector('.tradeit-details-grid');
            if (detailsGrid) {
                detailsGrid.style.cssText = 'display: flex; flex-direction: column; gap: 3px;';
            }

            comparisonDiv.querySelectorAll('.tradeit-line').forEach(line => {
                line.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 1px 0;';
            });

            comparisonDiv.querySelectorAll('.tradeit-label').forEach(label => {
                label.style.cssText = 'font-size: 11px; color: #94a3b8; font-weight: 400;';
            });

            comparisonDiv.querySelectorAll('.tradeit-value').forEach(value => {
                value.style.cssText = 'font-size: 12px; font-weight: 600; color: #e2e8f0; display: flex; align-items: center;';
            });

            comparisonDiv.querySelectorAll('.tradeit-difference.positive .tradeit-value').forEach(value => {
                value.style.color = '#4ade80'; 
            });
            
            comparisonDiv.querySelectorAll('.tradeit-difference.negative .tradeit-value').forEach(value => {
                value.style.color = '#f87171';
            });
        }

        // injectLoadingState
        injectLoadingState(itemCard) {
            let comparisonDiv = itemCard.querySelector('.tradeit-comparison-box');
            if (!comparisonDiv) {
                comparisonDiv = document.createElement('div');
                comparisonDiv.className = 'tradeit-comparison-box';
                const insertTarget = itemCard.querySelector('[data-testid="item-card-bottom-area"]');
                insertTarget?.parentNode?.insertBefore(comparisonDiv, insertTarget.nextSibling);
            }
            comparisonDiv.innerHTML = `
                <div class="tradeit-header">COMPARISON</div>
                <div style="text-align: center; padding: 10px; color: #94a3b8; font-size: 12px;">
                    Loading price...
                </div>
            `;
            this.applySpecificBoxStyles(comparisonDiv);
        }

        // injectNotFoundState
        injectNotFoundState(itemCard) {
            let comparisonDiv = itemCard.querySelector('.tradeit-comparison-box');
            if (!comparisonDiv) {
                comparisonDiv = document.createElement('div');
                comparisonDiv.className = 'tradeit-comparison-box';
                const insertTarget = itemCard.querySelector('[data-testid="item-card-bottom-area"]');
                insertTarget?.parentNode?.insertBefore(comparisonDiv, insertTarget.nextSibling);
            }
            comparisonDiv.innerHTML = `
                <div class="tradeit-header">COMPARISON</div>
                <div style="text-align: center; padding: 10px; color: #f87171; font-size: 12px;">
                    Price not found.
                </div>
            `;
            this.applySpecificBoxStyles(comparisonDiv);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new SimpleTradeItComparison());
    } else {
        new SimpleTradeItComparison();
    }
})();
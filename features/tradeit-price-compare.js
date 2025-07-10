// features/tradeit-price-compare.js - TradeIt.gg Price Comparison Module

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
            this.tradeitData = new Map();
            this.currentTheme = 'nebula';
            this.init();
        }

        async init() {
            this.loadCache();

            window.addEventListener('empireThemeChanged', (event) => {
                this.currentTheme = event.detail.theme;
                this.applyDynamicStylesToAllInjectedElements();
            });

            await this.loadTradeItData();

            if (this.tradeitData.size > 0) {
                this.startItemProcessing();
            } else {
                console.warn('⚠️ TradeIt.gg data not loaded or empty. Price comparison will not run.');
            }
        }

        loadCache() {
            try {
                const storedTradeItData = localStorage.getItem("tradeitDataCache");
                if (storedTradeItData) {
                    this.tradeitData = new Map(Object.entries(JSON.parse(storedTradeItData)));
                    if (DEBUG_MODE) console.log(`✅ Loaded ${this.tradeitData.size} TradeIt.gg prices from local cache.`);
                }
            } catch (e) {
                console.error("❌ Error loading cache.", e);
                this.tradeitData.clear();
            }
        }

        saveCache() {
            try {
                localStorage.setItem("tradeitDataCache", JSON.stringify(Object.fromEntries(this.tradeitData)));
            } catch (e) {
                console.error("❌ Error saving cache:", e);
            }
        }

        cleanMarketHashName(itemType, itemName, itemQuality) {
            const cleanedType = (itemType || '').replace(/\s+/g, ' ').trim();
            let cleanedName = (itemName || '').replace(/\s+/g, ' ').trim();
            const cleanedQuality = (itemQuality || '').replace(/\s+/g, ' ').trim();

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

        async loadTradeItData() {
            try {
                const response = await chrome.runtime.sendMessage({ type: 'FETCH_TRADEIT_DATA' });

                if (response?.success && response.data) {
                    this.tradeitData.clear();
                    response.data.forEach(tradeitItem => {
                        if (tradeitItem.item) {
                            this.tradeitData.set(tradeitItem.item.toLowerCase(), { price: tradeitItem.price });
                        }
                    });
                    this.saveCache();
                    if (DEBUG_MODE) console.log(`✅ TradeIt.gg data loaded from API. Total unique items: ${this.tradeitData.size}`);
                } else {
                    console.error('❌ TradeIt.gg data fetch failed or response was empty.');
                }
            }
            catch (error) {
                console.error('❌ Error communicating with background script for TradeIt.gg data:', error);
            }
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

        processItemCard(itemCard) {
            if (itemCard.dataset.cardProcessed) return;
            itemCard.dataset.cardProcessed = 'true';

            const itemData = this.extractItemData(itemCard);
            if (!itemData) return;

            const possibleNames = this.generatePossibleMarketHashNames(itemData.itemType, itemData.itemName, itemData.itemQuality);
            
            for (const nameAttempt of possibleNames) {
                if (this.tradeitData.has(nameAttempt)) {
                    const tradeitInfo = this.tradeitData.get(nameAttempt);
                    if (DEBUG_MODE) console.log(`✅ Match for: "${nameAttempt}"`);
                    this.injectFullPriceBox(itemCard, itemData.csEmpirePrice, tradeitInfo.price);
                    return; 
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
            };
        }
        
        applyDynamicStylesToAllInjectedElements() {
            document.querySelectorAll('.tradeit-comparison-box').forEach(this.applySpecificBoxStyles.bind(this));
        }

        injectFullPriceBox(itemCard, csEmpirePriceRaw, tradeitRawPrice) {
            let comparisonDiv = itemCard.querySelector('.tradeit-comparison-box');
            if (!comparisonDiv) {
                comparisonDiv = document.createElement('div');
                comparisonDiv.className = 'tradeit-comparison-box';
                const insertTarget = itemCard.querySelector('[data-testid="item-card-bottom-area"]');
                insertTarget?.parentNode?.insertBefore(comparisonDiv, insertTarget.nextSibling);
            }

            const csFloatCalculatedPriceUSD = tradeitRawPrice * 0.925;
            const formatPrice = (p) => p ? `$${p.toFixed(2)}` : 'N/A';
            // *** MODIFIED ICON: Smaller size and adjusted alignment ***
            const coinIconSVG = `<svg width="12" height="12" viewBox="0 0 24 24" style="display: inline-block; vertical-align: -1px; margin-right: 4px;" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="empireCoinGradient"><stop offset="5%" stop-color="#fdd835"></stop><stop offset="95%" stop-color="#f57f17"></stop></linearGradient></defs><circle cx="12" cy="12" r="11" fill="url(#empireCoinGradient)" stroke="#c5871b" stroke-width="1.5"/></svg>`;
            
            let differenceHtml = '';
            const csEmpirePriceUSD = csEmpirePriceRaw; 

            if (csEmpirePriceUSD > 0 && !isNaN(csFloatCalculatedPriceUSD)) {
                const ratioPercent = (csFloatCalculatedPriceUSD / csEmpirePriceUSD) * 100;
                const diffClass = ratioPercent < 100 ? 'positive' : 'negative';
                differenceHtml = `
                    <div class="tradeit-line tradeit-difference ${diffClass}">
                        <span class="tradeit-label">Difference:</span>
                        <span class="tradeit-value">${ratioPercent.toFixed(2)}%</span>
                    </div>`;
            }

            // *** FIXED: Removed broken comment from this section ***
            comparisonDiv.innerHTML = `
                <div class="tradeit-header">COMPARISON</div>
                <div class="tradeit-details-grid">
                    <div class="tradeit-line">
                        <span class="tradeit-label">CSFloat Price:</span>
                        <span class="tradeit-value">${formatPrice(csFloatCalculatedPriceUSD)}</span>
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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new SimpleTradeItComparison());
    } else {
        new SimpleTradeItComparison();
    }
})();
// features/tradeit-price-compare.js

(function() {
    'use strict';

    if (!window.location.href.includes('/withdraw/steam/market')) {
        return;
    }

    console.log('🔥 CSFloat/Buff163 Price Comparison Module v4.1 (Final) Loaded.');

    class MarketPriceComparison {
        constructor() {
            this.priceDataCache = new Map();
            this.currentTheme = 'nebula';
            this.observer = null;
            this.init();
        }

        async init() {
            const settings = await chrome.storage.sync.get({ selectedTheme: 'nebula' });
            this.currentTheme = settings.selectedTheme;
            this.applyDynamicStyles();

            window.addEventListener('empireThemeChanged', (event) => {
                if (event.detail && event.detail.theme) {
                    this.currentTheme = event.detail.theme;
                    this.applyDynamicStyles();
                }
            });

            await this.loadPriceData();
            this.startItemProcessing();
        }

        async loadPriceData() {
            try {
                const response = await chrome.runtime.sendMessage({ type: 'FETCH_TRADEIT_DATA' });
                if (response?.success && response.data) {
                    this.priceDataCache = new Map(Object.entries(response.data));
                    console.log(`✅ Loaded ${this.priceDataCache.size} prices from the background script.`);
                } else {
                    console.error('❌ Price data fetch failed.');
                }
            } catch (error) {
                console.error('❌ Error communicating with background script for price data:', error);
            }
        }

        toTitleCase(str) {
            if (!str) return '';
            return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
        }
        
        cleanMarketHashName(itemType, itemName, itemQuality) {
            let cleanedType = (itemType || '').replace(/\s+/g, ' ').trim();
            let cleanedName = (itemName || '').replace(/\s+/g, ' ').trim();
            let cleanedQuality = (itemQuality || '').replace(/\s+/g, ' ').trim();

            if (cleanedType.startsWith('★') && !cleanedType.startsWith('★ ')) {
                cleanedType = cleanedType.replace('★', '★ ');
            }

            if (cleanedQuality) {
                cleanedQuality = this.toTitleCase(cleanedQuality);
            }

            return cleanedQuality ? `${cleanedType} | ${cleanedName} (${cleanedQuality})` : `${cleanedType} | ${cleanedName}`;
        }

        startItemProcessing() {
            const observerTarget = document.querySelector('.market-items-grid') || document.body;
            this.processAllVisibleItems();
            this.observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.addedNodes.length) {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1) {
                                if (node.matches('div.item-card')) this.processItemCard(node);
                                else node.querySelectorAll('div.item-card').forEach(this.processItemCard.bind(this));
                            }
                        });
                    }
                });
            });
            this.observer.observe(observerTarget, { childList: true, subtree: true });
        }

        processAllVisibleItems() {
            document.querySelectorAll('div.item-card').forEach(this.processItemCard.bind(this));
        }

        processItemCard(itemCard) {
            if (itemCard.dataset.cardProcessed) return;
            itemCard.dataset.cardProcessed = 'true';

            const itemData = this.extractItemData(itemCard);
            if (!itemData) return;

            const itemNameLower = itemData.itemName.toLowerCase();
            if (itemNameLower.includes('doppler') || itemNameLower.includes('ruby') || itemNameLower.includes('sapphire') || itemNameLower.includes('emerald') || itemNameLower.includes('black pearl')) {
                const dopplerPattern = /(Ruby|Sapphire|Emerald|Black Pearl|Phase [1-4])$/i;
                const match = itemData.itemName.match(dopplerPattern);

                if (match) {
                    const phaseOrGem = this.toTitleCase(match[0].trim());
                    const baseItemName = itemData.itemName.replace(dopplerPattern, '').trim().replace(/-$/, '').trim();
                    const baseKey = this.cleanMarketHashName(itemData.itemType, baseItemName, itemData.itemQuality).toLowerCase();
                    
                    if (this.priceDataCache.has(baseKey)) {
                        const priceObject = this.priceDataCache.get(baseKey);
                        let finalPriceInfo = {};

                        if (priceObject.csfloatPrice?.doppler?.[phaseOrGem]) {
                            finalPriceInfo.csfloatPrice = priceObject.csfloatPrice.doppler[phaseOrGem];
                        }
                        if (priceObject.buffPrice?.doppler?.[phaseOrGem]) {
                            finalPriceInfo.buffPrice = priceObject.buffPrice.doppler[phaseOrGem];
                        }

                        if (Object.keys(finalPriceInfo).length > 0) {
                            this.injectComparisonBox(itemCard, itemData.csEmpirePrice, finalPriceInfo, true);
                            return;
                        }
                    }
                }
            }
            
            const standardKey = this.cleanMarketHashName(itemData.itemType, itemData.itemName, itemData.itemQuality).toLowerCase();
            if (this.priceDataCache.has(standardKey)) {
                const priceInfo = this.priceDataCache.get(standardKey);
                this.injectComparisonBox(itemCard, itemData.csEmpirePrice, priceInfo, false);
                return;
            }

            this.injectNotFoundState(itemCard, itemData.csEmpirePrice);
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

        injectComparisonBox(itemCard, csEmpirePrice, priceInfo, isDoppler) {
            let csfloatPrice, buffPrice;

            if (isDoppler) {
                csfloatPrice = priceInfo.csfloatPrice;
                buffPrice = priceInfo.buffPrice;
            } else {
                csfloatPrice = priceInfo.csfloatPrice?.price;
                buffPrice = priceInfo.buffPrice?.price;
            }

            let comparisonDiv = itemCard.querySelector('.price-comparison-box');
            if (!comparisonDiv) {
                comparisonDiv = document.createElement('div');
                comparisonDiv.className = 'price-comparison-box';
                const insertTarget = itemCard.querySelector('[data-testid="item-card-bottom-area"]');
                insertTarget?.parentNode?.insertBefore(comparisonDiv, insertTarget.nextSibling);
            }
            
            const formatPrice = (p) => (p ? `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A');
            const coinIconSVG = `<svg width="12" height="12" viewBox="0 0 24 24" style="display:inline-block;vertical-align:-1px;margin-right:4px;" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="empireCoinGradient"><stop offset="5%" stop-color="#fdd835"/><stop offset="95%" stop-color="#f57f17"/></linearGradient></defs><circle cx="12" cy="12" r="11" fill="url(#empireCoinGradient)" stroke="#c5871b" stroke-width="1.5"/></svg>`;

            let differenceHtml = '';
            // **MODIFICATION: Use buffPrice for calculation**
            if (buffPrice && csEmpirePrice > 0.01) {
                const ratioPercent = (buffPrice / csEmpirePrice) * 100;
                const diffClass = ratioPercent < 100 ? 'positive' : 'negative';
                differenceHtml = `
                    <div class="comparison-line comparison-difference ${diffClass}">
                        <span class="comparison-label">Difference:</span>
                        <span class="comparison-value">${ratioPercent.toFixed(1)}%</span>
                    </div>`;
            }

            comparisonDiv.innerHTML = `
                <div class="comparison-header">Price Comparison</div>
                <div class="comparison-grid">
                    <div class="comparison-line">
                        <span class="comparison-label">CSFloat:</span>
                        <span class="comparison-value">${formatPrice(csfloatPrice)}</span>
                    </div>
                    <div class="comparison-line">
                        <span class="comparison-label">Buff163:</span>
                        <span class="comparison-value">${formatPrice(buffPrice)}</span>
                    </div>
                    <div class="comparison-line">
                        <span class="comparison-label">Empire:</span>
                        <span class="comparison-value">${coinIconSVG}${csEmpirePrice.toLocaleString('en-US')}</span>
                    </div>
                    ${differenceHtml}
                </div>
            `;
            this.applySpecificBoxStyles(comparisonDiv);
        }
        
        injectNotFoundState(itemCard, csEmpirePrice) {
            let comparisonDiv = itemCard.querySelector('.price-comparison-box');
            if (!comparisonDiv) {
                comparisonDiv = document.createElement('div');
                comparisonDiv.className = 'price-comparison-box';
                const insertTarget = itemCard.querySelector('[data-testid="item-card-bottom-area"]');
                insertTarget?.parentNode?.insertBefore(comparisonDiv, insertTarget.nextSibling);
            }
            const coinIconSVG = `<svg width="12" height="12" viewBox="0 0 24 24" style="display:inline-block;vertical-align:-1px;margin-right:4px;" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="empireCoinGradient"><stop offset="5%" stop-color="#fdd835"/><stop offset="95%" stop-color="#f57f17"/></linearGradient></defs><circle cx="12" cy="12" r="11" fill="url(#empireCoinGradient)" stroke="#c5871b" stroke-width="1.5"/></svg>`;
            comparisonDiv.innerHTML = `
                <div class="comparison-header">Price Comparison</div>
                <div class="comparison-grid">
                    <div class="comparison-line">
                        <span class="comparison-label">CSFloat:</span>
                        <span class="comparison-value" style="color:#a3a3a3;">Not Found</span>
                    </div>
                    <div class="comparison-line">
                        <span class="comparison-label">Buff163:</span>
                        <span class="comparison-value" style="color:#a3a3a3;">Not Found</span>
                    </div>
                    <div class="comparison-line">
                        <span class="comparison-label">Empire:</span>
                        <span class="comparison-value">${coinIconSVG}${csEmpirePrice.toLocaleString('en-US')}</span>
                    </div>
                </div>
            `;
            this.applySpecificBoxStyles(comparisonDiv);
        }

        applyDynamicStyles() {
            document.querySelectorAll('.price-comparison-box').forEach(this.applySpecificBoxStyles.bind(this));
        }

        applySpecificBoxStyles(comparisonDiv) {
            const isShootingStar = this.currentTheme === 'shooting-star';
            Object.assign(comparisonDiv.style, {
                marginTop: '10px', padding: '8px 10px', borderRadius: '8px',
                backgroundColor: isShootingStar ? 'rgba(20, 20, 40, 0.85)' : 'rgba(40, 40, 55, 0.7)',
                border: `1px solid ${isShootingStar ? 'rgba(135, 206, 235, 0.2)' : 'rgba(255, 255, 255, 0.12)'}`,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
                display: 'flex', flexDirection: 'column', gap: '5px',
            });
            const header = comparisonDiv.querySelector('.comparison-header');
            if (header) Object.assign(header.style, {
                fontSize: '10px', fontWeight: '600', color: isShootingStar ? '#87ceeb' : '#a3bffa',
                textTransform: 'uppercase', textAlign: 'center', paddingBottom: '4px',
                borderBottom: `1px solid ${isShootingStar ? 'rgba(135, 206, 235, 0.15)' : 'rgba(255, 255, 255, 0.1)'}`,
                marginBottom: '4px', letterSpacing: '0.5px',
            });
            comparisonDiv.querySelectorAll('.comparison-grid').forEach(g => g.style.cssText = 'display:flex;flex-direction:column;gap:3px;');
            comparisonDiv.querySelectorAll('.comparison-line').forEach(l => l.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:1px 0;');
            comparisonDiv.querySelectorAll('.comparison-label').forEach(l => l.style.cssText = 'font-size:11px;color:#94a3b8;font-weight:500;');
            comparisonDiv.querySelectorAll('.comparison-value').forEach(v => v.style.cssText = 'font-size:12px;font-weight:600;color:#e2e8f0;display:flex;align-items:center;');
            comparisonDiv.querySelectorAll('.comparison-difference.positive .comparison-value').forEach(v => v.style.color = '#4ade80');
            comparisonDiv.querySelectorAll('.comparison-difference.negative .comparison-value').forEach(v => v.style.color = '#f87171');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new MarketPriceComparison());
    } else {
        new MarketPriceComparison();
    }
})();
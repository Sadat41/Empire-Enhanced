// ================================================================================================
// ADVANCED INVESTMENT TRACKER - OPTIMIZED VERSION
// ================================================================================================
// Main application for tracking investments, long-term holdings, and case drops
// Features: Portfolio management, hierarchical time organization, charts, import/export
// Author: Investment Tracker Team
// Last Updated: 2025
// ================================================================================================

class InvestmentTracker {
    // ============================================================================================
    // CONSTRUCTOR & INITIALIZATION
    // ============================================================================================
    
    constructor() {
        // Core Data Arrays
        this.investments = [];              // Regular investment portfolio
        this.longTermInvestments = [];      // Long-term bulk investments
        this.caseDrops = [];               // Case drop tracking
        this.years = [];                   // Hierarchical year/month/week structure
        this.categories = [];              // User-defined categories for long-term investments
        this.selectedCategoryId = null;  // Currently selected category for filtering
        
        // Current State Tracking
        this.currentYear = null;           // Currently selected year
        this.currentMonth = null;          // Currently selected month (0-11)
        this.currentWeek = null;           // Currently selected week ID
        this.currentPeriod = '7d';         // Chart time period filter
        
        // Modal State Management
        this.editingInvestment = null;          // Currently editing investment
        this.editingLongTermInvestment = null;  // Currently editing long-term investment
        this.editingCaseDrop = null;           // Currently editing case drop
        
        // Chart Management
        this.charts = {};                  // Stores Chart.js instances
        this.priceDataCache = null;        // Price data
        this.priceCacheTimestamp = 0;      // Price data    timestamp
        this.chartColors = {               // Consistent color scheme
            primary: '#667eea',
            secondary: '#764ba2',
            success: '#22c55e',
            danger: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        
        // Enhanced Trading Dashboard Data
        this.tradeHistory = [];           // Complete trading records
        this.accountBalance = 0;          // Current cash
        this.deposits = [];               // Money added to account
        this.withdrawals = [];            // Money taken out
        this.tradingStats = {             // Cached analytics
            totalTrades: 0,
            winRate: 0,
            avgProfit: 0,
            bestTrade: null,
            worstTrade: null,
            monthlyPerformance: []
        };
        
        // Current Trading Tab State
        this.currentTradingTab = 'holdings'; // holdings, performance, account
        
        // Notification System
        this.notyf = null;
        
        console.log('🚀 Investment Tracker initializing...');
        this.init();
    }

    // ============================================================================================
    // INITIALIZATION METHODS
    // ============================================================================================
    
    /**
     * Main initialization sequence
     * Loads data, sets up events, renders UI, initializes charts
     */
    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            
            // Initial UI Rendering
            this.renderInvestments();
            this.renderLongTermInvestments();
            this.renderCategoryTabs();
            this.ensureInvestmentsHaveCategories(); 
            this.updateMetrics();
            this.initializeCharts();
            
            // Initialize Enhanced Trading Dashboard
            this.initializeNotifications();
            this.initializeTradingTabs();
            this.initializeLucideIcons();
            this.updateTradingDashboard();
            
            // Initialize Case Drop UI if data exists
            this.renderYearTabs();
            if (this.currentYear) {
                this.renderMonthTabs();
                this.renderWeekTabs();
                this.renderCurrentWeek();
                this.showCaseDropSelectors();
            }
            
            // Set default form dates
            this.setDefaultDates();
            
            console.log('✅ Investment Tracker initialized successfully');
        } catch (error) {
            console.error('❌ Error during initialization:', error);
        }
    }

    /**
     * Sets default dates in form inputs to today
     */
    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        const dateInputs = ['buyDate', 'dropDate'];
        
        dateInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) input.value = today;
        });
    }

    /**
     * Shows case drop selector containers
     */
    showCaseDropSelectors() {
        const selectors = ['monthSelectorContainer', 'weekSelectorContainer', 'caseDropFormContainer'];
        selectors.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'block';
        });
    }

    // ============================================================================================
    // UTILITY METHODS
    // ============================================================================================
    
    /**
     * Formats numbers with commas and decimal places
     * @param {number} num - Number to format
     * @returns {string} Formatted number string
     */
    formatNumber(num) {
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /**
     * Escapes HTML to prevent XSS attacks
     * @param {string} text - Text to escape
     * @returns {string} HTML-safe text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Shows notification to user
     * @param {string} message - Message to display
     * @param {string} type - Notification type: 'success', 'error', 'info'
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-600' : 
                        type === 'error' ? 'bg-red-600' : 'bg-blue-600';
        
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full max-w-sm ${bgColor} text-white`;
        
        notification.innerHTML = `
            <div class="flex items-center space-x-2">
                <span class="text-sm">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200 ml-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.style.transform = 'translateX(0)', 10);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    // ============================================================================================
    // DATA MANAGEMENT - SAVE/LOAD/CALCULATIONS
    // ============================================================================================
    
    /**
     * Loads all data from localStorage
     * Initializes with default data if none exists
     */
    async loadData() {
    try {
        // Load regular investments
        this.loadInvestments();
        
        // Load long-term investments
        this.loadLongTermInvestments();
        
        // Load hierarchical case drops data
        this.loadCaseDropsData();
        
        // Load categories
        this.loadCategories();

        // Load enhanced trading data
        this.loadTradingData();

        this.ensureInvestmentsHaveCategories();
        
            console.log(`📊 Loaded ${this.investments.length} investments, ${this.longTermInvestments.length} long term investments, ${this.caseDrops.length} case drops, and ${this.categories.length} categories from storage`);
        } catch (error) {
            console.error('❌ Error loading data:', error);
            this.initializeEmptyData();
        }
    }

    

    /**
     * Loads regular investments from localStorage
     */
    loadInvestments() {
        const stored = localStorage.getItem('investmentTracker');
        const rawData = stored ? JSON.parse(stored) : [];
        
        this.investments = rawData.map(inv => ({
            id: inv.id || Date.now().toString() + Math.random(),
            itemName: inv.itemName || inv.name || '',
            buyPrice: parseFloat(inv.buyPrice) || 0,
            sellPrice: inv.sellPrice ? parseFloat(inv.sellPrice) : null,
            buyDate: inv.buyDate || inv.dateAdded || new Date().toISOString(),
            sellDate: inv.sellDate || null,
            status: inv.status || (inv.sellPrice ? 'sold' : 'holding'),
            profit: this.calculateProfit(inv.buyPrice, inv.sellPrice),
            returnPercentage: this.calculateReturnPercentage(inv.buyPrice, inv.sellPrice),
            dateAdded: inv.dateAdded || inv.buyDate || new Date().toISOString()
        }));
    }

    /**
    * Loads long-term investments from localStorage
    */
    loadLongTermInvestments() {
        const longTermStored = localStorage.getItem('longTermInvestmentTracker');
        const longTermRawData = longTermStored ? JSON.parse(longTermStored) : [];

        this.longTermInvestments = longTermRawData.map(inv => ({
            id: inv.id || Date.now().toString() + Math.random(),
            itemName: inv.itemName || '',
            quantity: parseInt(inv.quantity) || 1,
            unitBuyPrice: parseFloat(inv.unitBuyPrice) || 0,
            totalBuyPrice: parseFloat(inv.totalBuyPrice) || 0,
            unitSellPrice: inv.unitSellPrice ? parseFloat(inv.unitSellPrice) : null,
            totalSellPrice: inv.totalSellPrice ? parseFloat(inv.totalSellPrice) : null,
            buyDate: inv.buyDate || new Date().toISOString(),
            sellDate: inv.sellDate || null,
            status: inv.status || (inv.unitSellPrice ? 'sold' : 'holding'),
            profit: parseFloat(inv.profit) || 0,
            returnPercentage: parseFloat(inv.returnPercentage) || 0,
            categoryId: inv.categoryId || null, // ADD THIS LINE - preserve categoryId
            dateAdded: inv.dateAdded || inv.buyDate || new Date().toISOString()
        }));
    }

    /**
     * Loads case drops and hierarchical data from localStorage
     */
    loadCaseDropsData() {
        const caseDropsStored = localStorage.getItem('caseDropsHierarchical');
        const caseDropsData = caseDropsStored ? JSON.parse(caseDropsStored) : { years: [], caseDrops: [] };
        
        this.years = caseDropsData.years || [];
        this.caseDrops = caseDropsData.caseDrops || [];
        
        // Initialize current year if no data exists
        if (this.years.length === 0) {
            this.createDefaultYearStructure();
        } else {
            this.setCurrentPeriod();
        }
    }


    /**
        * Loads categories from localStorage
        */
    loadCategories() {
        const categoriesStored = localStorage.getItem('longTermCategories');
        this.categories = categoriesStored ? JSON.parse(categoriesStored) : [];
    
        // Add default "Uncategorized" category if no categories exist
        if (this.categories.length === 0) {
            this.categories.push({
                id: 'uncategorized',
                name: 'Uncategorized',
                isDefault: true,
                dateCreated: new Date().toISOString()
        });
        }
    }

    /**
     * Loads enhanced trading data from localStorage
     */
    loadTradingData() {
        // Load trading history
        const tradingHistoryStored = localStorage.getItem('tradingHistory');
        this.tradeHistory = tradingHistoryStored ? JSON.parse(tradingHistoryStored) : [];

        // Load account balance
        const accountBalanceStored = localStorage.getItem('accountBalance');
        this.accountBalance = accountBalanceStored ? parseFloat(accountBalanceStored) : 0;

        // Load deposits
        const depositsStored = localStorage.getItem('deposits');
        this.deposits = depositsStored ? JSON.parse(depositsStored) : [];

        // Load withdrawals
        const withdrawalsStored = localStorage.getItem('withdrawals');
        this.withdrawals = withdrawalsStored ? JSON.parse(withdrawalsStored) : [];

        // Load trading stats cache
        const tradingStatsStored = localStorage.getItem('tradingStats');
        if (tradingStatsStored) {
            this.tradingStats = { ...this.tradingStats, ...JSON.parse(tradingStatsStored) };
        }

        console.log(`💼 Loaded trading data: ${this.deposits.length} deposits, ${this.withdrawals.length} withdrawals, balance: $${this.accountBalance}`);
    }

    /**
     * Creates default year structure for current year
     */
    createDefaultYearStructure() {
        const currentYear = new Date().getFullYear();
        const yearData = this.generateYearStructure(currentYear);
        this.years.push(yearData);
        this.currentYear = currentYear;
        this.currentMonth = new Date().getMonth();
        
        // Set to current week if possible
        if (yearData.months[this.currentMonth].weeks.length > 0) {
            this.currentWeek = yearData.months[this.currentMonth].weeks[0].id;
        }
    }

    /**
     * Sets current period to first available year/month/week
     */
    setCurrentPeriod() {
        this.currentYear = this.years[0].year;
        this.currentMonth = 0;
        if (this.years[0].months[0].weeks.length > 0) {
            this.currentWeek = this.years[0].months[0].weeks[0].id;
        }
    }

    /**
     * Initializes empty data arrays
     */
    initializeEmptyData() {
        this.investments = [];
        this.longTermInvestments = [];
        this.caseDrops = [];
        this.years = [];
    }

    /**
     * Saves all data to localStorage
     */
    async saveData() {
    try {
        // Save all data types to their respective localStorage keys
        localStorage.setItem('investmentTracker', JSON.stringify(this.investments));
        localStorage.setItem('longTermInvestmentTracker', JSON.stringify(this.longTermInvestments));
        localStorage.setItem('caseDropsHierarchical', JSON.stringify({
            years: this.years,
            caseDrops: this.caseDrops
        }));
        localStorage.setItem('longTermCategories', JSON.stringify(this.categories));
        
        // Save enhanced trading data
        localStorage.setItem('tradingHistory', JSON.stringify(this.tradeHistory));
        localStorage.setItem('accountBalance', this.accountBalance.toString());
        localStorage.setItem('deposits', JSON.stringify(this.deposits));
        localStorage.setItem('withdrawals', JSON.stringify(this.withdrawals));
        localStorage.setItem('tradingStats', JSON.stringify(this.tradingStats));
        
        console.log(`💾 Saved ${this.investments.length} investments, ${this.longTermInvestments.length} long-term investments, ${this.caseDrops.length} case drops, ${this.categories.length} categories, and trading data to storage`);
        }   catch (error) {
        console.error('❌ Error saving data:', error);
        }
    }

    // ============================================================================================
    // CALCULATION METHODS
    // ============================================================================================
    
    /**
     * Calculates profit from buy/sell prices
     * @param {number} buyPrice - Purchase price
     * @param {number} sellPrice - Sale price
     * @returns {number} Profit amount
     */
    calculateProfit(buyPrice, sellPrice) {
        if (!sellPrice || !buyPrice) return 0;
        return parseFloat(sellPrice) - parseFloat(buyPrice);
    }

    /**
     * Calculates return percentage from buy/sell prices
     * @param {number} buyPrice - Purchase price
     * @param {number} sellPrice - Sale price
     * @returns {number} Return percentage
     */
    calculateReturnPercentage(buyPrice, sellPrice) {
        if (!sellPrice || !buyPrice || buyPrice === 0) return 0;
        return ((parseFloat(sellPrice) - parseFloat(buyPrice)) / parseFloat(buyPrice)) * 100;
    }

    /**
 * Calculates overall portfolio metrics
 * @returns {Object} Portfolio metrics object
 */
calculateMetrics() {
    const totalItems = this.investments.length;
    const totalInvested = this.investments.reduce((sum, inv) => sum + inv.buyPrice, 0);
    
    const soldInvestments = this.investments.filter(inv => inv.sellPrice);
    const totalRealized = soldInvestments.reduce((sum, inv) => sum + inv.sellPrice, 0);
    const totalPnL = soldInvestments.reduce((sum, inv) => sum + (inv.profit || 0), 0);
    
    // DEBUG: Calculate portfolio value with logging
    console.log('\n💰 === PORTFOLIO VALUE CALCULATION DEBUG ===');
    
    // Regular investments holding value
    const holdingInvestments = this.investments.filter(inv => !inv.sellPrice);
    const holdingInvestmentValue = holdingInvestments.reduce((sum, inv) => sum + inv.buyPrice, 0);
    console.log(`📊 Regular investments holding: ${holdingInvestments.length} items = $${holdingInvestmentValue.toFixed(2)}`);
    
    // Long-term investments holding value
    const holdingLongTermInvestments = this.longTermInvestments.filter(inv => !inv.unitSellPrice);
    const longTermHoldingValue = holdingLongTermInvestments.reduce((sum, inv) => sum + inv.totalBuyPrice, 0);
    console.log(`📊 Long-term investments holding: ${holdingLongTermInvestments.length} items = $${longTermHoldingValue.toFixed(2)}`);
    
    // Total portfolio value
    const portfolioValue = holdingInvestmentValue + longTermHoldingValue;
    console.log(`📊 TOTAL PORTFOLIO VALUE: $${holdingInvestmentValue.toFixed(2)} + $${longTermHoldingValue.toFixed(2)} = $${portfolioValue.toFixed(2)}`);
    console.log('💰 === END DEBUG ===\n');

    const winningTrades = soldInvestments.filter(inv => inv.profit > 0).length;
    const winRate = soldInvestments.length > 0 ? (winningTrades / soldInvestments.length) * 100 : 0;
    
    const avgReturn = soldInvestments.length > 0 
        ? soldInvestments.reduce((sum, inv) => sum + (inv.returnPercentage || 0), 0) / soldInvestments.length
        : 0;

    return {
        totalItems,
        totalInvested,
        totalRealized,
        totalPnL,
        portfolioValue,
        winRate,
        avgReturn
    };
}

    /**
     * Calculates metrics for long-term investments
     * @returns {Object} Long-term metrics object
     */
    calculateLongTermMetrics() {
        const totalItems = this.longTermInvestments.length;
        const holdingInvestments = this.longTermInvestments.filter(inv => !inv.unitSellPrice);
        const holdingValue = holdingInvestments.reduce((sum, inv) => sum + inv.totalBuyPrice, 0);
        const totalQuantity = this.longTermInvestments.reduce((sum, inv) => sum + inv.quantity, 0);

        return {
            totalItems,
            holdingValue,
            totalQuantity
        };
    }

    // ============================================================================================
    // EVENT LISTENERS SETUP
    // ============================================================================================
    
    /**
     * Sets up all event listeners for the application
     */
    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        
        // Core form submissions
        this.setupFormListeners();
        
        // Investment type toggles
        this.setupInvestmentTypeListeners();
        
        // Collapse/expand functionality
        this.setupCollapseListeners();
        
        // Export/Import buttons
        this.setupExportImportListeners();
        
        // Modal handlers
        this.setupModalListeners();
        
        // Case drop functionality
        this.setupCaseDropListeners();
        
        // Chart time period filters
        this.setupChartFilterListeners();

        // Category management
        this.setupCategoryListeners();

        // Category tab listeners
        this.setupCategoryTabListeners();
        
        // Enhanced Trading Dashboard listeners
        this.setupTradingTabListeners();
        this.setupCashManagementListeners();
        
        // Global event delegation
        this.setupGlobalEventDelegation();
        
        console.log('✅ Event listeners setup complete');
    }

    /**
     * Sets up form submission listeners
     */
    setupFormListeners() {
        const form = document.getElementById('investmentForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addInvestment();
            });
        }
    }

    /**
     * Sets up investment type radio button handlers
     */
    setupInvestmentTypeListeners() {
        const portfolioType = document.getElementById('portfolioType');
        const longtermType = document.getElementById('longtermType');
        const quantityField = document.getElementById('quantityField');
        const categoryField = document.getElementById('categoryField');

        if (portfolioType && longtermType && quantityField && categoryField) {
            const toggleFields = () => {
            // Update button states
            document.querySelectorAll('.investment-type-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            if (longtermType.checked) {
                longtermType.parentElement.querySelector('.investment-type-btn').classList.add('active');
                quantityField.classList.remove('hidden');
                categoryField.classList.remove('hidden');
                document.getElementById('quantity').required = true;
                this.populateCategoryDropdown(); // Populate categories when shown
                document.getElementById('investmentFormGrid').className = 'grid grid-cols-1 md:grid-cols-8 gap-4 mb-6';
                document.getElementById('itemNameContainer').className = 'md:col-span-2';
            } else {
                portfolioType.parentElement.querySelector('.investment-type-btn').classList.add('active');
                quantityField.classList.add('hidden');
                categoryField.classList.add('hidden');
                document.getElementById('quantity').required = false;
                document.getElementById('quantity').value = '';
                document.getElementById('categorySelect').value = '';
                document.getElementById('investmentFormGrid').className = 'grid grid-cols-1 md:grid-cols-6 gap-4 mb-6';
                document.getElementById('itemNameContainer').className = 'md:col-span-2 md:col-start-1';
            }
        };

        // Add click handlers to the visual buttons
        document.querySelectorAll('.investment-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const input = e.target.parentElement.querySelector('input[type="radio"]');
                input.checked = true;
                toggleFields();
            });
        });

        portfolioType.addEventListener('change', toggleFields);
        longtermType.addEventListener('change', toggleFields);
        toggleFields(); // Call on page load to set initial state
        }
    }

    

    /**
     * Sets up collapse/expand functionality for sections
     */
    setupCollapseListeners() {
        const collapseButtons = [
            'toggleInvestmentPortfolio',
            'toggleLongTermInvestments',
            'toggleCaseDropStats'
        ];

        collapseButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => {
                    this.handleSectionToggle(buttonId);
                });
            }
        });
    }

    /**
     * Handles section toggle functionality
     * @param {string} buttonId - ID of toggle button
     */
    handleSectionToggle(buttonId) {
        const contentMap = {
            'toggleInvestmentPortfolio': 'investmentPortfolioContent',
            'toggleLongTermInvestments': 'longTermInvestmentsContent',
            'toggleCaseDropStats': 'caseDropStatsContent'
        };

        const contentId = contentMap[buttonId];
        const content = document.getElementById(contentId);
        const icon = document.getElementById(buttonId);
        
        if (content && icon) {
            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.style.transform = 'rotate(0deg)';
                icon.textContent = '▼';
            } else {
                content.style.display = 'none';
                icon.style.transform = 'rotate(-90deg)';
                icon.textContent = '▶';
            }
        }
    }

    /**
     * Sets up export/import button listeners
     */
    setupExportImportListeners() {
        // Regular investments export/import
        this.setupButtonListener('exportCsvBtn', () => this.exportToCSV());
        this.setupButtonListener('exportExcelBtn', () => this.exportToExcel());
        this.setupFileImportListener('importCsvBtn', 'importCsvFile', 'investments');
        this.setupButtonListener('clearAllBtn', () => this.clearAllData('investments'));

        // Long-term investments export/import
        this.setupButtonListener('exportLongTermCsvBtn', () => this.exportLongTermToCSV());
        this.setupButtonListener('exportLongTermExcelBtn', () => this.exportLongTermToExcel());
        this.setupFileImportListener('importLongTermCsvBtn', 'importLongTermCsvFile', 'longterm');
        this.setupButtonListener('clearAllLongTermBtn', () => this.clearAllData('longterm'));

        // Case drops export/import
        this.setupButtonListener('exportCaseDropsCsvBtn', () => this.exportCaseDropsToCSV());
        this.setupButtonListener('exportCaseDropsExcelBtn', () => this.exportCaseDropsToExcel());
        this.setupFileImportListener('importCaseDropsCsvBtn', 'importCaseDropsCsvFile', 'casedrops');
    }

    /**
     * Helper to set up single button listener
     * @param {string} buttonId - Button element ID
     * @param {Function} handler - Click handler function
     */
    setupButtonListener(buttonId, handler) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', handler);
        }
    }

    /**
     * Helper to set up file import listener
     * @param {string} buttonId - Button element ID
     * @param {string} fileId - File input element ID
     * @param {string} type - Import type
     */
    setupFileImportListener(buttonId, fileId, type) {
        const button = document.getElementById(buttonId);
        const fileInput = document.getElementById(fileId);
        
        if (button && fileInput) {
            button.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.importFromCSV(e.target.files[0], type);
                    e.target.value = ''; // Reset file input
                }
            });
        }
    }

    /**
     * Sets up modal event listeners
     */
    setupModalListeners() {
        // Edit modals for each type
        this.setupEditModalListeners('editForm', 'cancelEdit', 'editModal', 
                                    () => this.saveEdit(), () => this.closeEditModal());
        
        this.setupEditModalListeners('editLongTermForm', 'cancelLongTermEdit', 'editLongTermModal',
                                    () => this.saveLongTermEdit(), () => this.closeLongTermEditModal());
        
        this.setupEditModalListeners('editCaseDropForm', 'cancelCaseDropEdit', 'editCaseDropModal',
                                    () => this.saveCaseDropEdit(), () => this.closeCaseDropEditModal());
    }



    /**
 * Ensures modal styles are properly applied
 */
ensureModalStyles() {
    const modalIds = ['editModal', 'editLongTermModal', 'editCaseDropModal', 'addYearModal'];
    
    modalIds.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            // Ensure proper modal positioning
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.zIndex = '9999';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
        }
    });
}


    /**
     * Helper to set up edit modal listeners
     * @param {string} formId - Form element ID
     * @param {string} cancelId - Cancel button ID
     * @param {string} modalId - Modal element ID
     * @param {Function} saveHandler - Save handler function
     * @param {Function} cancelHandler - Cancel handler function
     */
    setupEditModalListeners(formId, cancelId, modalId, saveHandler, cancelHandler) {
        const form = document.getElementById(formId);
        const cancelBtn = document.getElementById(cancelId);
        const modal = document.getElementById(modalId);

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                saveHandler();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', cancelHandler);
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    cancelHandler();
                }
            });
        }
    }

    /**
     * Sets up case drop related listeners
     */
    setupCaseDropListeners() {
        const caseDropForm = document.getElementById('caseDropForm');
        if (caseDropForm) {
            caseDropForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addCaseDrop();
            });
        }

        // Year management
        this.setupButtonListener('addNewYearBtn', () => this.showAddYearModal());
        this.setupEditModalListeners('addYearForm', 'cancelAddYear', 'addYearModal',
                                    () => this.createNewYear(), () => this.closeAddYearModal());

        // Month dropdown functionality
        this.setupMonthDropdownListeners();
    }

    /**
     * Sets up month dropdown functionality
     */
    setupMonthDropdownListeners() {
        const monthDropdownTrigger = document.getElementById('monthDropdownTrigger');
        const monthDropdownMenu = document.getElementById('monthDropdownMenu');
        
        if (monthDropdownTrigger && monthDropdownMenu) {
            monthDropdownTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isActive = monthDropdownTrigger.classList.contains('active');
                
                // Close all dropdowns
                document.querySelectorAll('.dropdown-trigger').forEach(trigger => {
                    trigger.classList.remove('active');
                });
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    menu.classList.add('hidden');
                });
                
                // Open this dropdown if it wasn't active
                if (!isActive) {
                    monthDropdownTrigger.classList.add('active');
                    monthDropdownMenu.classList.remove('hidden');
                }
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                monthDropdownTrigger.classList.remove('active');
                monthDropdownMenu.classList.add('hidden');
            });
        }
    }

    /**
     * Sets up chart time period filter listeners
     */
    setupChartFilterListeners() {
        document.querySelectorAll('.time-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('🔘 Period button clicked:', e.target.dataset.period);
                
                // Remove active class from all buttons
                document.querySelectorAll('.time-filter-btn').forEach(b => b.classList.remove('active'));
                
                e.target.classList.add('active');
                
                // Update current period
                const newPeriod = e.target.dataset.period;
                console.log('📅 Changing period from', this.currentPeriod, 'to', newPeriod);
                this.currentPeriod = newPeriod;
                
                // Update charts
                this.updateCharts();
            });
        });
    }


    /**
    * Sets up category management listeners
    */
    setupCategoryListeners() {
        this.setupButtonListener('addCategoryBtn', () => this.showAddCategoryForm());
        this.setupButtonListener('saveCategoryBtn', () => this.addCategory());
        this.setupButtonListener('cancelCategoryBtn', () => this.hideAddCategoryForm());
    
        // Add Enter key support for category input
        const categoryInput = document.getElementById('newCategoryName');
        if (categoryInput) {
            categoryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addCategory();
            } else if (e.key === 'Escape') {
                this.hideAddCategoryForm();
            }
            });
        }
    }



    /**
     * Sets up global event delegation for dynamic elements
     */
    setupGlobalEventDelegation() {
        document.addEventListener('click', (e) => {
        // Handle action buttons for investments
        if (e.target.classList.contains('action-btn')) {
            const action = e.target.dataset.action;
            const id = e.target.dataset.id;
            console.log(`🔥 Button clicked: ${action} for ID: ${id}`);
            this.handleAction(action, id);
        }
        
        // Handle case drop action buttons
        if (e.target.classList.contains('case-action-btn')) {
            const action = e.target.dataset.action;
            const id = e.target.dataset.id;
            console.log(`🎲 Case drop button clicked: ${action} for ID: ${id}`);
            this.handleCaseDropAction(action, id);
        }

        // Handle long term investment action buttons
        if (e.target.classList.contains('longterm-action-btn')) {
            const action = e.target.dataset.action;
            const id = e.target.dataset.id;
            console.log(`💎 Long term investment button clicked: ${action} for ID: ${id}`);
            this.handleLongTermAction(action, id);
        }
        
        // Handle category tab clicks
        if (e.target.classList.contains('category-tab') || e.target.closest('.category-tab')) {
            const categoryTab = e.target.classList.contains('category-tab') ? e.target : e.target.closest('.category-tab');
            const categoryId = categoryTab.dataset.categoryId;
            
            // Don't trigger if clicking delete button
            if (e.target.classList.contains('category-tab-delete')) {
                return;
            }
            
            console.log(`📂 Category tab clicked: ${categoryId}`);
            
            if (categoryId === 'all') {
                this.selectCategory(null);
            } else {
                this.selectCategory(categoryId);
            }
        }
        
        // Handle category delete buttons
        if (e.target.classList.contains('category-tab-delete') || e.target.dataset.deleteCategory) {
            e.stopPropagation(); // Prevent category selection
            const categoryId = e.target.dataset.deleteCategory;
            console.log(`🗑️ Category delete clicked: ${categoryId}`);
            this.removeCategory(categoryId);
        }
        
        // Handle week tab clicks
        if (e.target.classList.contains('week-tab')) {
            const weekId = e.target.dataset.weekId;
            console.log(`📅 Week tab clicked: ${weekId}`);
            this.switchToWeek(weekId);
        }

        // Handle year tab clicks
        if (e.target.classList.contains('year-tab')) {
            const year = parseInt(e.target.dataset.year);
            console.log(`📅 Year tab clicked: ${year}`);
            this.selectYear(year);
        }

        // Handle custom dropdown option clicks
        if (e.target.classList.contains('dropdown-option')) {
            const monthIndex = parseInt(e.target.dataset.month);
            if (!isNaN(monthIndex)) {
                this.selectMonth(monthIndex);
            }
        }
        });
    }


    /**
    * Sets up category tab event listeners
    */
    setupCategoryTabListeners() {
        // Use event delegation on the container
        const categoryTabsContainer = document.getElementById('categoryTabsContainer');
        if (categoryTabsContainer) {
            categoryTabsContainer.addEventListener('click', (e) => {
            // Handle delete button clicks
            if (e.target.classList.contains('category-tab-delete')) {
                e.stopPropagation();
                const categoryId = e.target.dataset.deleteCategory;
                console.log(`🗑️ Category delete clicked: ${categoryId}`);
                this.removeCategory(categoryId);
                return;
            }
            
            // Handle tab clicks
            const categoryTab = e.target.closest('.category-tab');
            if (categoryTab) {
                const categoryId = categoryTab.dataset.categoryId;
                console.log(`📂 Category tab clicked: ${categoryId}`);
                
                if (categoryId === 'all') {
                    this.selectCategory(null);
                } else {
                    this.selectCategory(categoryId);
                }
            }
        });
        }
    }






    // ============================================================================================
    // INVESTMENT MANAGEMENT - ADD/EDIT/REMOVE
    // ============================================================================================
    
    /**
     * Adds new investment (regular or long-term based on form selection)
     */
    addInvestment() {
        const formData = this.getInvestmentFormData();
        
        if (!this.validateInvestmentForm(formData)) {
            return;
        }

        if (formData.isLongTerm) {
            this.addLongTermInvestment(formData);
        } else {
            this.addRegularInvestment(formData);
        }

        this.saveData();
        this.updateMetrics();
        this.updateCharts();
        this.clearForm();
    }

    /**
    * Gets form data for investment creation
    * @returns {Object} Form data object
    */
    getInvestmentFormData() {
        return {
            itemName: document.getElementById('itemName').value.trim(),
            buyPrice: parseFloat(document.getElementById('buyPrice').value),
            buyDate: document.getElementById('buyDate').value,
            sellPrice: document.getElementById('sellPrice').value ? parseFloat(document.getElementById('sellPrice').value) : null,
            sellDate: document.getElementById('sellDate').value || null,
            isLongTerm: document.getElementById('longtermType').checked,
            quantity: document.getElementById('longtermType').checked ? parseInt(document.getElementById('quantity').value) : 1,
            categoryId: document.getElementById('longtermType').checked ? document.getElementById('categorySelect').value : null
        };
    }   

    /**
     * Validates investment form data
     * @param {Object} formData - Form data to validate
     * @returns {boolean} Validation result
     */
    validateInvestmentForm(formData) {
        if (!formData.itemName || !formData.buyPrice || formData.buyPrice <= 0 || !formData.buyDate) {
            this.showNotification('Please fill in all required fields with valid values', 'error');
            return false;
        }

        if (formData.isLongTerm && (!formData.quantity || formData.quantity <= 0)) {
            this.showNotification('Please enter a valid quantity for long term investment', 'error');
            return false;
        }

        return true;
    }

    /**
     * Adds regular investment to portfolio
     * @param {Object} formData - Investment data
     */
    addRegularInvestment(formData) {
        const investment = {
            id: this.generateUniqueId(),
            itemName: formData.itemName,
            buyPrice: formData.buyPrice,
            sellPrice: formData.sellPrice,
            buyDate: formData.buyDate,
            sellDate: formData.sellPrice ? (formData.sellDate || new Date().toISOString().split('T')[0]) : null,
            status: formData.sellPrice ? 'sold' : 'holding',
            profit: this.calculateProfit(formData.buyPrice, formData.sellPrice),
            returnPercentage: this.calculateReturnPercentage(formData.buyPrice, formData.sellPrice),
            dateAdded: new Date().toISOString()
        };

        this.investments.unshift(investment);
        this.renderInvestments();
        this.showNotification(`Added "${formData.itemName}" to your portfolio`, 'success');
    }


    /**
    * Adds long-term investment to portfolio
    * @param {Object} formData - Investment data
    */
    addLongTermInvestment(formData) {
        // Use selected category or default to uncategorized
        let categoryId = formData.categoryId;
        if (!categoryId) {
            const uncategorizedCategory = this.categories.find(cat => cat.isDefault);
            categoryId = uncategorizedCategory ? uncategorizedCategory.id : this.categories[0]?.id;
    }
    
    const longTermInvestment = {
        id: this.generateUniqueId(),
        itemName: formData.itemName,
        quantity: formData.quantity,
        unitBuyPrice: formData.buyPrice,
        totalBuyPrice: formData.buyPrice * formData.quantity,
        unitSellPrice: formData.sellPrice,
        totalSellPrice: formData.sellPrice ? formData.sellPrice * formData.quantity : null,
        buyDate: formData.buyDate,
        sellDate: formData.sellPrice ? new Date().toISOString().split('T')[0] : null,
        status: formData.sellPrice ? 'sold' : 'holding',
        profit: formData.sellPrice ? (formData.sellPrice - formData.buyPrice) * formData.quantity : 0,
        returnPercentage: formData.sellPrice ? ((formData.sellPrice - formData.buyPrice) / formData.buyPrice) * 100 : 0,
        categoryId: categoryId, // Add category assignment
        dateAdded: new Date().toISOString()
    };

    this.longTermInvestments.unshift(longTermInvestment);
    this.renderLongTermInvestments();
    this.renderCategoryTabs(); // Update category tabs to show new counts
    this.showNotification(`Added "${formData.itemName}" (${formData.quantity}x) to long term investments`, 'success');
    }


    /**
     * Generates unique ID for new items
     * @returns {string} Unique ID
     */
    generateUniqueId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    // ============================================================================================
    // INVESTMENT ACTIONS - EDIT/REMOVE/SELL
    // ============================================================================================
    
    /**
     * Handles action button clicks for investments
     * @param {string} action - Action type: 'edit', 'remove', 'sell'
     * @param {string} id - Investment ID
     */
    handleAction(action, id) {
        console.log(`🎯 Handling action: ${action} for ID: ${id}`);
        
        switch (action) {
            case 'edit':
                this.editInvestment(id);
                break;
            case 'remove':
                this.removeInvestment(id);
                break;
            case 'sell':
                this.quickSell(id);
                break;
            default:
                console.error('❌ Unknown action:', action);
                this.showNotification('Unknown action', 'error');
        }
    }

    /**
     * Opens edit modal for investment
     * @param {string} id - Investment ID
     */
    editInvestment(id) {
        console.log('🔧 Edit button clicked for ID:', id);
        const investment = this.investments.find(inv => inv.id === id);
        
        if (!investment) {
            console.error('Investment not found with ID:', id);
            this.showNotification('Investment not found', 'error');
            return;
        }

        this.editingInvestment = investment;
        
        // Populate edit form
        document.getElementById('editItemName').value = investment.itemName;
        document.getElementById('editBuyPrice').value = investment.buyPrice;
        document.getElementById('editBuyDate').value = investment.buyDate.split('T')[0];
        document.getElementById('editSellPrice').value = investment.sellPrice || '';
        document.getElementById('editSellDate').value = investment.sellDate || '';

        // Show modal
        const modal = document.getElementById('editModal');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        console.log('✅ Edit modal opened for:', investment.itemName);
    }

    /**
     * Saves investment edit changes
     */
    saveEdit() {
        if (!this.editingInvestment) {
            this.showNotification('No investment selected for editing', 'error');
            return;
        }

        const editData = this.getEditFormData();
        
        if (!this.validateEditForm(editData)) {
            return;
        }

        const index = this.investments.findIndex(inv => inv.id === this.editingInvestment.id);
        if (index !== -1) {
            this.investments[index] = {
                ...this.investments[index],
                ...editData,
                sellDate: editData.sellPrice ? (editData.sellDate || new Date().toISOString().split('T')[0]) : null,
                status: editData.sellPrice ? 'sold' : 'holding',
                profit: this.calculateProfit(editData.buyPrice, editData.sellPrice),
                returnPercentage: this.calculateReturnPercentage(editData.buyPrice, editData.sellPrice)
            };

            this.saveData();
            this.renderInvestments();
            this.updateMetrics();
            this.updateCharts();
            this.closeEditModal();
            this.showNotification(`Updated "${editData.itemName}" successfully`, 'success');
        }
    }

    /**
     * Gets edit form data
     * @returns {Object} Edit form data
     */
    getEditFormData() {
        return {
            itemName: document.getElementById('editItemName').value.trim(),
            buyPrice: parseFloat(document.getElementById('editBuyPrice').value),
            buyDate: document.getElementById('editBuyDate').value,
            sellPrice: document.getElementById('editSellPrice').value ? parseFloat(document.getElementById('editSellPrice').value) : null,
            sellDate: document.getElementById('editSellDate').value || null
        };
    }

    /**
    * Validates edit form data
    * @param {Object} editData - Edit form data
    * @returns {boolean} Validation result
    */
    validateEditForm(editData) {
        if (!editData.itemName || !editData.buyPrice || editData.buyPrice <= 0 || !editData.buyDate) {
            this.showNotification('Please fill in all required fields with valid values', 'error');
            return false;
        }
    
        // Sell date is optional - no validation needed for it
        return true;
    }

    /**
     * Closes edit modal
     */
    closeEditModal() {
        document.getElementById('editModal').classList.add('hidden');
        document.getElementById('editModal').style.display = 'none';
        this.editingInvestment = null;
    }

    /**
     * Removes investment from portfolio
     * @param {string} id - Investment ID
     */
    removeInvestment(id) {
        console.log('🗑️ Remove button clicked for ID:', id);
        const investment = this.investments.find(inv => inv.id === id);
        
        if (!investment) {
            console.error('Investment not found with ID:', id);
            this.showNotification('Investment not found', 'error');
            return;
        }

        if (confirm(`Are you sure you want to remove "${investment.itemName}" from your portfolio?`)) {
            this.investments = this.investments.filter(inv => inv.id !== id);
            this.saveData();
            this.renderInvestments();
            this.updateMetrics();
            this.updateCharts();
            this.showNotification(`Removed "${investment.itemName}" from portfolio`, 'success');
            console.log('✅ Investment removed:', investment.itemName);
        }
    }

    /**
     * Quick sell functionality for unsold investments
     * @param {string} id - Investment ID
     */
    quickSell(id) {
        console.log('💰 Quick sell clicked for ID:', id);
        const investment = this.investments.find(inv => inv.id === id);
        
        if (!investment) {
            this.showNotification('Investment not found', 'error');
            return;
        }

        if (investment.sellPrice) {
            this.showNotification('Investment already sold', 'error');
            return;
        }

        const sellPrice = prompt(`Enter sell price for "${investment.itemName}":`, investment.buyPrice.toFixed(2));
        if (sellPrice !== null) {
            const price = parseFloat(sellPrice);
            if (!isNaN(price) && price > 0) {
                // Update the investment
                investment.sellPrice = price;
                investment.sellDate = new Date().toISOString().split('T')[0];
                investment.status = 'sold';
                investment.profit = this.calculateProfit(investment.buyPrice, price);
                investment.returnPercentage = this.calculateReturnPercentage(investment.buyPrice, price);

                this.saveData();
                this.renderInvestments();
                this.updateMetrics();
                this.updateCharts();
                this.showNotification(`Sold "${investment.itemName}" for $${price.toFixed(2)}`, 'success');
            } else {
                this.showNotification('Please enter a valid sell price', 'error');
            }
        }
    }

    // ============================================================================================
    // LONG TERM INVESTMENT ACTIONS
    // ============================================================================================
    
    /**
     * Handles long-term investment action buttons
     * @param {string} action - Action type
     * @param {string} id - Investment ID
     */
    handleLongTermAction(action, id) {
        console.log(`🎯 Handling long term action: ${action} for ID: ${id}`);
        
        switch (action) {
            case 'edit':
                this.editLongTermInvestment(id);
                break;
            case 'remove':
                this.removeLongTermInvestment(id);
                break;
            case 'sell':
                this.quickSellLongTerm(id);
                break;
            default:
                console.error('❌ Unknown long term action:', action);
                this.showNotification('Unknown action', 'error');
        }
    }

    /**
    * Opens edit modal for long-term investment
    * @param {string} id - Investment ID
    */
    editLongTermInvestment(id) {
        console.log('🔧 Edit long term button clicked for ID:', id);
        const investment = this.longTermInvestments.find(inv => inv.id === id);
    
        if (!investment) {
            console.error('Long term investment not found with ID:', id);
            this.showNotification('Long term investment not found', 'error');
            return;
        }

        this.editingLongTermInvestment = investment;
    
        // Populate edit form
        document.getElementById('editLongTermItemName').value = investment.itemName;
        document.getElementById('editLongTermQuantity').value = investment.quantity;
        document.getElementById('editLongTermBuyPrice').value = investment.unitBuyPrice;
        document.getElementById('editLongTermBuyDate').value = investment.buyDate.split('T')[0];
        document.getElementById('editLongTermSellPrice').value = investment.unitSellPrice || '';
        document.getElementById('editLongTermSellDate').value = investment.sellDate || '';
    
        // Populate and set category dropdown
        this.populateEditCategoryDropdown();
        document.getElementById('editLongTermCategory').value = investment.categoryId || '';

        // Show modal
        const modal = document.getElementById('editLongTermModal');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        console.log('✅ Edit long term modal opened for:', investment.itemName);
    }

    /**
    * Saves long-term investment edit changes
    */
    saveLongTermEdit() {
    if (!this.editingLongTermInvestment) {
        this.showNotification('No long term investment selected for editing', 'error');
        return;
    }

    const editData = this.getLongTermEditFormData();
    
    if (!this.validateLongTermEditForm(editData)) {
        return;
    }

    // Use selected category or default to uncategorized if none selected
    let categoryId = editData.categoryId;
    if (!categoryId) {
        const uncategorizedCategory = this.categories.find(cat => cat.isDefault);
        categoryId = uncategorizedCategory ? uncategorizedCategory.id : this.categories[0]?.id;
    }

    const index = this.longTermInvestments.findIndex(inv => inv.id === this.editingLongTermInvestment.id);
    if (index !== -1) {
        const oldCategoryId = this.longTermInvestments[index].categoryId;
        
        this.longTermInvestments[index] = {
            ...this.longTermInvestments[index],
            ...editData,
            categoryId: categoryId, // Update category
            totalBuyPrice: editData.unitBuyPrice * editData.quantity,
            totalSellPrice: editData.unitSellPrice ? editData.unitSellPrice * editData.quantity : null,
            sellDate: editData.unitSellPrice ? (editData.sellDate || new Date().toISOString().split('T')[0]) : null,
            status: editData.unitSellPrice ? 'sold' : 'holding',
            profit: editData.unitSellPrice ? (editData.unitSellPrice - editData.unitBuyPrice) * editData.quantity : 0,
            returnPercentage: editData.unitSellPrice ? ((editData.unitSellPrice - editData.unitBuyPrice) / editData.unitBuyPrice) * 100 : 0
        };

        this.saveData();
        this.renderLongTermInvestments();
        
        // Update category tabs if category changed
        if (oldCategoryId !== categoryId) {
            this.renderCategoryTabs();
            
            // Show notification about category change
            const newCategory = this.categories.find(cat => cat.id === categoryId);
            const categoryName = newCategory ? newCategory.name : 'Uncategorized';
            this.showNotification(`Updated "${editData.itemName}" and moved to ${categoryName}`, 'success');
        } else {
            this.showNotification(`Updated "${editData.itemName}" successfully`, 'success');
        }
        
        this.updateMetrics();
        this.updateCharts();
        this.closeLongTermEditModal();
        }
    }


    /**
     * Gets long-term edit form data
    * @returns {Object} Edit form data
     */
    getLongTermEditFormData() {
        return {
            itemName: document.getElementById('editLongTermItemName').value.trim(),
            quantity: parseInt(document.getElementById('editLongTermQuantity').value),
            unitBuyPrice: parseFloat(document.getElementById('editLongTermBuyPrice').value),
            buyDate: document.getElementById('editLongTermBuyDate').value,
            unitSellPrice: document.getElementById('editLongTermSellPrice').value ? parseFloat(document.getElementById('editLongTermSellPrice').value) : null,
            sellDate: document.getElementById('editLongTermSellDate').value || null,
            categoryId: document.getElementById('editLongTermCategory').value || null
        };
    }

    /**
    * Validates long-term edit form data
    * @param {Object} editData - Edit form data
    * @returns {boolean} Validation result
     */
    validateLongTermEditForm(editData) {
        if (!editData.itemName || !editData.quantity || editData.quantity <= 0 || 
            !editData.unitBuyPrice || editData.unitBuyPrice <= 0 || !editData.buyDate) {
            this.showNotification('Please fill in all required fields with valid values', 'error');
            return false;
        }
    
        // Optional: Validate category exists if provided
        if (editData.categoryId && !this.categories.find(cat => cat.id === editData.categoryId)) {
            this.showNotification('Selected category no longer exists', 'error');
            return false;
        }
    
        return true;
    }

    /**
    * Ensures all long-term investments have a category assigned
    */
    ensureInvestmentsHaveCategories() {
        const uncategorizedCategory = this.categories.find(cat => cat.isDefault);
        if (!uncategorizedCategory) return;
    
        let updated = false;
        this.longTermInvestments.forEach(investment => {
            if (!investment.categoryId) {
                investment.categoryId = uncategorizedCategory.id;
                updated = true;
            }
        });
    
        if (updated) {
            this.saveData();
            console.log('📝 Updated existing investments to have category assignments');
        }
    }

    /**
     * Closes long-term edit modal
     */
    closeLongTermEditModal() {
        document.getElementById('editLongTermModal').classList.add('hidden');
        document.getElementById('editLongTermModal').style.display = 'none';
        this.editingLongTermInvestment = null;
    }

    /**
     * Removes long-term investment
     * @param {string} id - Investment ID
     */
    removeLongTermInvestment(id) {
        console.log('🗑️ Remove long term button clicked for ID:', id);
        const investment = this.longTermInvestments.find(inv => inv.id === id);
        
        if (!investment) {
            console.error('Long term investment not found with ID:', id);
            this.showNotification('Long term investment not found', 'error');
            return;
        }

        if (confirm(`Are you sure you want to remove "${investment.itemName}" (${investment.quantity}x) from your long term investments?`)) {
            this.longTermInvestments = this.longTermInvestments.filter(inv => inv.id !== id);
            this.saveData();
            this.renderLongTermInvestments();
            this.updateMetrics();
            this.updateCharts();
            this.showNotification(`Removed "${investment.itemName}" from long term investments`, 'success');
            console.log('✅ Long term investment removed:', investment.itemName);
        }
    }

    /**
     * Quick sell functionality for long-term investments
     * @param {string} id - Investment ID
     */
    quickSellLongTerm(id) {
        console.log('💰 Quick sell long term clicked for ID:', id);
        const investment = this.longTermInvestments.find(inv => inv.id === id);
        
        if (!investment) {
            this.showNotification('Long term investment not found', 'error');
            return;
        }

        if (investment.unitSellPrice) {
            this.showNotification('Long term investment already sold', 'error');
            return;
        }

        const sellPrice = prompt(`Enter unit sell price for "${investment.itemName}" (${investment.quantity}x):`, investment.unitBuyPrice.toFixed(2));
        if (sellPrice !== null) {
            const price = parseFloat(sellPrice);
            if (!isNaN(price) && price > 0) {
                // Update the investment
                investment.unitSellPrice = price;
                investment.totalSellPrice = price * investment.quantity;
                investment.sellDate = new Date().toISOString().split('T')[0];
                investment.status = 'sold';
                investment.profit = (price - investment.unitBuyPrice) * investment.quantity;
                investment.returnPercentage = ((price - investment.unitBuyPrice) / investment.unitBuyPrice) * 100;

                this.saveData();
                this.renderLongTermInvestments();
                this.updateMetrics();
                this.updateCharts();
                this.showNotification(`Sold "${investment.itemName}" (${investment.quantity}x) for $${price.toFixed(2)} each`, 'success');
            } else {
                this.showNotification('Please enter a valid sell price', 'error');
            }
        }
    }

    // ============================================================================================
    // YEAR/MONTH/WEEK MANAGEMENT
    // ============================================================================================
    
    /**
     * Shows add year modal
     */
    showAddYearModal() {
        const currentYear = new Date().getFullYear();
        document.getElementById('newYear').value = currentYear;
        document.getElementById('addYearModal').classList.remove('hidden');
    }

    /**
     * Closes add year modal
     */
    closeAddYearModal() {
        document.getElementById('addYearModal').classList.add('hidden');
        document.getElementById('addYearModal').style.display = 'none';
        document.getElementById('newYear').value = '';
    }

    /**
     * Creates new year structure
     */
    createNewYear() {
        const year = parseInt(document.getElementById('newYear').value);
        
        if (!year || year < 2020 || year > 2030) {
            this.showNotification('Please enter a valid year (2020-2030)', 'error');
            return;
        }

        if (this.years.find(y => y.year === year)) {
            this.showNotification('Year already exists', 'error');
            return;
        }

        const yearData = this.generateYearStructure(year);
        this.years.push(yearData);
        this.currentYear = year;
        this.currentMonth = 0; // January
        
        // Set current week to first week of January
        if (yearData.months[0].weeks.length > 0) {
            this.currentWeek = yearData.months[0].weeks[0].id;
        }

        this.saveData();
        this.renderYearTabs();
        this.renderMonthTabs();
        this.renderWeekTabs();
        this.renderCurrentWeek();
        this.closeAddYearModal();
        
        this.showNotification(`Created ${year} with ${this.getTotalWeeksInYear(yearData)} weeks`, 'success');
    }

    /**
     * Generates complete year structure with months and weeks
     * @param {number} year - Year to generate
     * @returns {Object} Year structure object
     */
    generateYearStructure(year) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const yearData = {
            year: year,
            months: []
        };

        for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
            const monthData = {
                index: monthIndex,
                name: months[monthIndex],
                weeks: this.generateWeeksForMonth(year, monthIndex)
            };
            yearData.months.push(monthData);
        }

        return yearData;
    }

    /**
     * Generates weeks for a specific month (Wednesday to Tuesday)
     * @param {number} year - Year
     * @param {number} monthIndex - Month index (0-11)
     * @returns {Array} Array of week objects
     */
    generateWeeksForMonth(year, monthIndex) {
        const weeks = [];
        const firstDayOfMonth = new Date(year, monthIndex, 1);
        const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
        
        // Find first Wednesday of the month or before
        let currentWednesday = new Date(firstDayOfMonth);
        const dayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday, 3 = Wednesday
        const daysToWednesday = dayOfWeek <= 3 ? 3 - dayOfWeek : 10 - dayOfWeek;
        currentWednesday.setDate(firstDayOfMonth.getDate() - dayOfWeek + 3);
        
        // If this Wednesday is before the month, move to first Wednesday in month
        if (currentWednesday < firstDayOfMonth) {
            currentWednesday.setDate(currentWednesday.getDate() + 7);
        }

        let weekNumber = 1;
        
        while (currentWednesday <= lastDayOfMonth) {
            const weekEnd = new Date(currentWednesday);
            weekEnd.setDate(currentWednesday.getDate() + 6); // Tuesday
            
            const week = {
                id: `${year}-${monthIndex}-${weekNumber}-${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
                number: weekNumber,
                name: `Week ${weekNumber}`,
                startDate: new Date(currentWednesday).toISOString(),
                endDate: weekEnd.toISOString(),
                year: year,
                month: monthIndex
            };
            
            weeks.push(week);
            weekNumber++;
            currentWednesday.setDate(currentWednesday.getDate() + 7); // Next Wednesday
        }

        return weeks;
    }

    /**
     * Gets total weeks in a year
     * @param {Object} yearData - Year data object
     * @returns {number} Total weeks count
     */
    getTotalWeeksInYear(yearData) {
        return yearData.months.reduce((total, month) => total + month.weeks.length, 0);
    }

    /**
     * Selects a specific year
     * @param {number} year - Year to select
     */
    selectYear(year) {
        this.currentYear = year;
        this.currentMonth = 0; // Reset to January
        
        // Set current week to first week of January
        const yearData = this.years.find(y => y.year === year);
        if (yearData && yearData.months[0].weeks.length > 0) {
            this.currentWeek = yearData.months[0].weeks[0].id;
        }

        this.renderYearTabs();
        this.renderMonthTabs();
        this.renderWeekTabs();
        this.renderCurrentWeek();
        this.showCaseDropSelectors();
    }

    /**
     * Selects a specific month
     * @param {number} monthIndex - Month index (0-11)
     */
    selectMonth(monthIndex) {
        this.currentMonth = monthIndex;
        
        // Set current week to first week of selected month
        const yearData = this.years.find(y => y.year === this.currentYear);
        if (yearData && yearData.months[monthIndex].weeks.length > 0) {
            this.currentWeek = yearData.months[monthIndex].weeks[0].id;
        }

        this.renderMonthTabs();
        this.renderWeekTabs();
        this.renderCurrentWeek();
    }

    /**
     * Switches to a specific week
     * @param {string} weekId - Week ID to switch to
     */
    switchToWeek(weekId) {
        this.currentWeek = weekId;
        this.renderWeekTabs();
        this.renderCurrentWeek();
    }

    // ============================================================================================
    // UI RENDERING METHODS
    // ============================================================================================
    
    /**
     * Updates all metric displays
     */
    updateMetrics() {
        const metrics = this.calculateMetrics();
        const longTermMetrics = this.calculateLongTermMetrics();
        
        this.updatePortfolioMetrics(metrics);
        this.updateLongTermMetrics(longTermMetrics);
    }

    /**
     * Updates portfolio metrics display
     * @param {Object} metrics - Portfolio metrics
     */
    updatePortfolioMetrics(metrics) {
        const elements = {
            portfolioTotalItems: document.getElementById('portfolioTotalItems'),
            portfolioTotalInvested: document.getElementById('portfolioTotalInvested'),
            portfolioTotalRealized: document.getElementById('portfolioTotalRealized'),
            portfolioValue: document.getElementById('portfolioValue'),
            portfolioWinRate: document.getElementById('portfolioWinRate'),
            portfolioAvgReturn: document.getElementById('portfolioAvgReturn'),
            portfolioTotalPnL: document.getElementById('portfolioTotalPnL')
        };

        if (elements.portfolioTotalItems) elements.portfolioTotalItems.textContent = metrics.totalItems;
        if (elements.portfolioTotalInvested) elements.portfolioTotalInvested.textContent = `$${this.formatNumber(metrics.totalInvested)}`;
        if (elements.portfolioTotalRealized) elements.portfolioTotalRealized.textContent = `$${this.formatNumber(metrics.totalRealized)}`;
        if (elements.portfolioValue) elements.portfolioValue.textContent = `$${this.formatNumber(metrics.portfolioValue)}`;
        if (elements.portfolioWinRate) elements.portfolioWinRate.textContent = `${metrics.winRate.toFixed(1)}%`;
        if (elements.portfolioAvgReturn) elements.portfolioAvgReturn.textContent = `${metrics.avgReturn >= 0 ? '+' : ''}${metrics.avgReturn.toFixed(2)}%`;

        if (elements.portfolioTotalPnL) {
            elements.portfolioTotalPnL.textContent = `${metrics.totalPnL >= 0 ? '+' : ''}$${this.formatNumber(Math.abs(metrics.totalPnL))}`;
            elements.portfolioTotalPnL.className = `metric-value ${metrics.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`;
        }
    }

    /**
     * Updates long-term metrics display
     * @param {Object} longTermMetrics - Long-term metrics
     */
    updateLongTermMetrics(longTermMetrics) {
        const longTermElements = {
            longTermTotalItems: document.getElementById('longTermTotalItems'),
            longTermHoldingValue: document.getElementById('longTermHoldingValue'),
            longTermTotalQuantity: document.getElementById('longTermTotalQuantity')
        };

        if (longTermElements.longTermTotalItems) longTermElements.longTermTotalItems.textContent = longTermMetrics.totalItems;
        if (longTermElements.longTermHoldingValue) longTermElements.longTermHoldingValue.textContent = `$${this.formatNumber(longTermMetrics.holdingValue)}`;
        if (longTermElements.longTermTotalQuantity) longTermElements.longTermTotalQuantity.textContent = longTermMetrics.totalQuantity;
    }

    /**
     * Renders regular investments table
     */
    renderInvestments() {
    const tbody = document.getElementById('investmentsTable');
    const emptyState = document.getElementById('emptyState');

    if (!tbody) {
        console.error('❌ investmentsTable not found');
        return;
    }

    if (this.investments.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = this.investments.map(investment => this.generateInvestmentRow(investment)).join('');

    // ADD THIS LINE:
    this.loadPricesForVisibleItems();

    console.log(`📋 Rendered ${this.investments.length} investments`);
}

    // ADD THIS METHOD HERE:
    /**
    * Load prices for all visible investment items
    */
    async loadPricesForVisibleItems() {
        for (const investment of this.investments) {
            const priceElement = document.getElementById(`price-info-${investment.id}`);
            if (priceElement) {
                try {
                    const prices = await this.getItemPrices(investment.itemName);
                    const priceHtml = this.formatPriceDisplay(prices);
                    priceElement.innerHTML = priceHtml;
                } catch (error) {
                    priceElement.innerHTML = '<span style="color: #ef4444;">Price fetch failed</span>';
                }
            }
        }
    }



    // Price comparison 
    /**
    * Load prices for all visible investment items
    */
    async loadPricesForVisibleItems() {
        for (const investment of this.investments) {
            const priceElement = document.getElementById(`price-info-${investment.id}`);
            if (priceElement) {
                try {
                    const prices = await this.getItemPrices(investment.itemName);
                    const priceHtml = this.formatPriceDisplay(prices);
                    priceElement.innerHTML = priceHtml;
                } catch (error) {
                    priceElement.innerHTML = '<span style="color: #ef4444;">Price fetch failed</span>';
                }
            }
        }
    }

/**
 * Format price display
 */
formatPriceDisplay(prices) {
    const formatPrice = (price) => price ? `$${price.toFixed(2)}` : 'N/A';
    const csfloatPrice = formatPrice(prices.csfloatPrice);
    const buffPrice = formatPrice(prices.buffPrice);

    // This now uses the new 'price-comparison-card' class for proper styling.
    return `
        <div class="price-comparison-card">
            <div class="price-comparison-row">
                <span class="price-source">CSFloat:</span>
                <span class="price-value csfloat-price">${csfloatPrice}</span>
            </div>
            <div class="price-comparison-row">
                <span class="price-source">Buff:</span>
                <span class="price-value buff-price">${buffPrice}</span>
            </div>
        </div>
    `;
}
    // End of Price comparison


    /**
     * Generates HTML for single investment row
     * @param {Object} investment - Investment object
     * @returns {string} HTML string for table row
     */
    generateInvestmentRow(investment) {
        const profit = investment.profit || 0;
        const returnPct = investment.returnPercentage || 0;
        const profitClass = profit > 0 ? 'profit' : profit < 0 ? 'loss' : 'neutral';
        const profitSign = profit > 0 ? '+' : '';
        const returnSign = returnPct > 0 ? '+' : '';

        const buyDate = new Date(investment.buyDate).toLocaleDateString();
        const sellDate = investment.sellDate ? new Date(investment.sellDate).toLocaleDateString() : '-';

        return `
            <tr class="border-b border-gray-800 hover:bg-gray-800/30 transition animate-fadeIn">
                <td class="py-4 px-4">
                    <div class="font-medium text-white">${this.escapeHtml(investment.itemName)}</div>
                    <div class="price-info-container" id="price-info-${investment.id}">Loading prices...</div>
                </td>
                <td class="py-4 px-4 text-blue-400 font-semibold">${this.formatNumber(investment.buyPrice)}</td>
                <td class="py-4 px-4 text-gray-300 text-sm">${buyDate}</td>
                <td class="py-4 px-4">
                    ${investment.sellPrice ? 
                        `<span class="text-green-400 font-semibold">${this.formatNumber(investment.sellPrice)}</span>` :
                        '<span class="text-gray-500">-</span>'
                    }
                </td>
                <td class="py-4 px-4 text-gray-300 text-sm">${sellDate}</td>
                <td class="py-4 px-4">
                    <span class="font-semibold ${profitClass}">
                        ${profit !== 0 ? `${profitSign}${Math.abs(profit).toFixed(2)}` : '-'}
                    </span>
                </td>
                <td class="py-4 px-4 text-center">
                    ${returnPct !== 0 ? 
                        `<span class="longterm-return ${returnPct > 0 ? 'longterm-return-positive' : 'longterm-return-negative'}">
                            ${returnSign}${Math.abs(returnPct).toFixed(2)}%
                        </span>` : 
                        '<span class="text-gray-500">-</span>'
                    }
                </td>
                <td class="py-4 px-4 text-center">
                    <span class="longterm-status-badge ${investment.status === 'sold' ? 'longterm-status-sold' : 'longterm-status-holding'}">
                        ${investment.status === 'sold' ? '✅ Sold' : 'Holding'}
                    </span>
                </td>
                <td class="py-4 px-4">
                    <div class="grid grid-cols-3 gap-1 min-w-[140px] text-sm">
                        <div class="text-center">
                            ${!investment.sellPrice ? 
                                `<button data-action="sell" data-id="${investment.id}"
                                        class="text-green-400 hover:text-green-300 transition action-btn text-xs">
                                    Sell
                                </button>` : 
                                '<span class="text-transparent text-xs">-</span>'
                            }
                        </div>
                        <div class="text-center">
                            <button data-action="edit" data-id="${investment.id}"
                                    class="text-blue-400 hover:text-blue-300 transition action-btn text-xs">
                                Edit
                            </button>
                        </div>
                        <div class="text-center">
                            <button data-action="remove" data-id="${investment.id}"
                                    class="text-red-400 hover:text-red-300 transition action-btn text-xs">
                                Remove
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
    * Renders long-term investments table
    */
    renderLongTermInvestments() {
        const tbody = document.getElementById('longTermInvestmentsTable');
        const emptyState = document.getElementById('longTermEmptyState');

        if (!tbody) {
            console.error('❌ longTermInvestmentsTable not found');
            return;
        }

        // Get filtered investments based on selected category
        const filteredInvestments = this.getFilteredLongTermInvestments();

        if (filteredInvestments.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) {
                emptyState.classList.remove('hidden');
                // Update empty state message based on filter
                const emptyStateText = emptyState.querySelector('p');
                if (emptyStateText) {
                    if (this.selectedCategoryId === null) {
                        emptyStateText.textContent = 'Start tracking your bulk investments by adding items with quantities above.';
                    } else {
                        const selectedCategory = this.categories.find(cat => cat.id === this.selectedCategoryId);
                        const categoryName = selectedCategory ? selectedCategory.name : 'this category';
                        emptyStateText.textContent = `No investments found in ${categoryName}. Add items to this category or select a different category.`;
                    }
                }
            }
            return;
        }

            if (emptyState) emptyState.classList.add('hidden');

            tbody.innerHTML = filteredInvestments.map(investment => this.generateLongTermRow(investment)).join('');
            console.log(`📋 Rendered ${filteredInvestments.length} long term investments (filtered from ${this.longTermInvestments.length} total)`);
            
            // Load prices for each long-term item
            this.loadPricesForLongTermItems();
    }

    // ADD THIS METHOD HERE:
    /**
    * Load prices for long term investment items
    */
    async loadPricesForLongTermItems() {
        const filteredInvestments = this.getFilteredLongTermInvestments();
    
        for (const investment of filteredInvestments) {
            const priceElement = document.getElementById(`longterm-price-info-${investment.id}`);
            if (priceElement) {
                try {
                    const prices = await this.getItemPrices(investment.itemName);
                    const priceHtml = this.formatPriceDisplay(prices);
                    priceElement.innerHTML = priceHtml;
                } catch (error) {
                    priceElement.innerHTML = '<span style="color: #ef4444;">Price fetch failed</span>';
                }
            }
        }
    }

 
    /**
     * Generates HTML for single long-term investment row
     * @param {Object} investment - Long-term investment object
     * @returns {string} HTML string for table row
     */
    generateLongTermRow(investment) {
        const profit = investment.profit || 0;
        const returnPct = investment.returnPercentage || 0;
        const profitClass = profit > 0 ? 'profit' : profit < 0 ? 'loss' : 'neutral';
        const profitSign = profit > 0 ? '+' : '';
        const returnSign = returnPct > 0 ? '+' : '';

        const buyDate = new Date(investment.buyDate).toLocaleDateString();
        const sellDate = investment.sellDate ? new Date(investment.sellDate).toLocaleDateString() : '-';

        return `
            <tr class="border-b border-gray-800 hover:bg-gray-800/30 transition animate-fadeIn">
                <td class="py-4 px-4">
                    <div class="longterm-item-name font-medium text-white">${this.escapeHtml(investment.itemName)}</div>
                    <div class="price-info-container" id="longterm-price-info-${investment.id}">Loading prices...</div>
                </td>
                <td class="py-4 px-4 text-center">
                    <span class="longterm-quantity">${investment.quantity}</span>
                </td>
                <td class="py-4 px-4">
                    <span class="longterm-price-unit">${this.formatNumber(investment.unitBuyPrice)}</span>
                </td>
                <td class="py-4 px-4">
                    <span class="longterm-price-total">${this.formatNumber(investment.totalBuyPrice)}</span>
                </td>
                <td class="py-4 px-4">
                    <span class="longterm-date">${buyDate}</span>
                </td>
                <td class="py-4 px-4">
                    ${investment.unitSellPrice ? 
                        `<span class="longterm-price-unit">${this.formatNumber(investment.unitSellPrice)}</span>` :
                        '<span class="text-gray-500">-</span>'
                    }
                </td>
                <td class="py-4 px-4">
                    ${investment.totalSellPrice ? 
                        `<span class="longterm-price-total">${this.formatNumber(investment.totalSellPrice)}</span>` :
                        '<span class="text-gray-500">-</span>'
                    }
                </td>
                <td class="py-4 px-4">
                    <span class="longterm-date">${sellDate}</span>
                </td>
                <td class="py-4 px-4">
                    <span class="longterm-profit ${profitClass}">
                        ${profit !== 0 ? `${profitSign}${Math.abs(profit).toFixed(2)}` : '-'}
                    </span>
                </td>
                <td class="py-4 px-4 text-center">
                    ${returnPct !== 0 ? 
                        `<span class="longterm-return ${returnPct > 0 ? 'longterm-return-positive' : 'longterm-return-negative'}">
                            ${returnSign}${Math.abs(returnPct).toFixed(2)}%
                        </span>` : 
                        '<span class="text-gray-500">-</span>'
                    }
                </td>
                <td class="py-4 px-4 text-center">
                    <span class="performance-badge ${investment.status === 'sold' ? 'performance-positive' : 'performance-negative'}">
                        ${investment.status === 'sold' ? '✅ Sold' : 'Holding'}
                    </span>
                </td>
                <td class="py-4 px-4">
                    <div class="flex justify-between items-center min-w-[140px] gap-1">
                        <div class="flex-1 text-center">
                            ${!investment.unitSellPrice ? 
                                `<button data-action="sell" data-id="${investment.id}"
                                        class="text-green-400 hover:text-green-300 transition longterm-action-btn text-xs">
                                    Sell
                                </button>` : 
                                '<span class="text-transparent text-xs">-</span>'
                            }
                        </div>
                        <div class="flex-1 text-center">
                            <button data-action="edit" data-id="${investment.id}"
                                    class="text-blue-400 hover:text-blue-300 transition longterm-action-btn text-xs">
                                Edit
                            </button>
                        </div>
                        <div class="flex-1 text-center">
                            <button data-action="remove" data-id="${investment.id}"
                                    class="text-red-400 hover:text-red-300 transition longterm-action-btn text-xs">
                                Remove
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Renders year tabs
     */
    renderYearTabs() {
        const yearTabsContainer = document.getElementById('yearTabs');
        if (!yearTabsContainer) return;
        
        yearTabsContainer.innerHTML = this.years.map(yearData => `
            <button class="year-tab ${yearData.year === this.currentYear ? 'active' : ''}" 
                    data-year="${yearData.year}">
                ${yearData.year}
            </button>
        `).join('');
    }

    /**
     * Renders month dropdown
     */
    renderMonthTabs() {
        const monthDropdownMenu = document.getElementById('monthDropdownMenu');
        const selectedMonthText = document.getElementById('selectedMonthText');
        if (!monthDropdownMenu || !selectedMonthText || !this.currentYear) return;
        
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        // Update dropdown options
        monthDropdownMenu.innerHTML = months.map((month, index) => `
            <div class="dropdown-option ${index === this.currentMonth ? 'selected' : ''}" 
                 data-month="${index}">
                ${month}
            </div>
        `).join('');
        
        // Update selected text
        selectedMonthText.textContent = months[this.currentMonth] || 'January';
    }

    /**
     * Renders week tabs
     */
    renderWeekTabs() {
        const weekTabsContainer = document.getElementById('weekTabs');
        if (!weekTabsContainer || !this.currentYear || this.currentMonth === null) return;
        
        const yearData = this.years.find(y => y.year === this.currentYear);
        if (!yearData) return;
        
        const monthData = yearData.months[this.currentMonth];
        if (!monthData) return;
        
        weekTabsContainer.innerHTML = monthData.weeks.map(week => `
            <div class="relative week-tab-container">
                <button class="week-tab ${week.id === this.currentWeek ? 'active' : ''}" 
                        data-week-id="${week.id}">
                    ${week.name}
                </button>
            </div>
        `).join('');
    }

    // ============================================================================================
    // CASE DROP MANAGEMENT
    // ============================================================================================
    
    /**
     * Gets current week object
     * @returns {Object|null} Current week object or null
     */
    getCurrentWeek() {
        if (!this.currentYear || this.currentMonth === null || !this.currentWeek) return null;
        
        const yearData = this.years.find(y => y.year === this.currentYear);
        if (!yearData) return null;
        
        // Search all months for the current week ID
        for (const month of yearData.months) {
            const week = month.weeks.find(w => w.id === this.currentWeek);
            if (week) return week;
        }
        
        return null;
    }

    /**
     * Gets case drops for current week
     * @returns {Array} Array of case drops
     */
    getCurrentWeekCaseDrops() {
        if (!this.currentWeek) return [];
        
        const currentWeek = this.getCurrentWeek();
        if (!currentWeek) return [];
        
        return this.caseDrops.filter(caseDrop => caseDrop.weekId === this.currentWeek);
    }

    /**
     * Adds new case drop
     */
    addCaseDrop() {
        const caseDropData = this.getCaseDropFormData();
        
        if (!this.validateCaseDropForm(caseDropData)) {
            return;
        }

        // Check if the drop date falls within the current week
        const currentWeek = this.getCurrentWeek();
        if (currentWeek && !this.isDateInWeek(caseDropData.dropDate, currentWeek)) {
            const weekStart = new Date(currentWeek.startDate).toLocaleDateString();
            const weekEnd = new Date(currentWeek.endDate).toLocaleDateString();
            this.showNotification(
                `Drop date must be within ${currentWeek.name} (${weekStart} - ${weekEnd})`, 
                'error'
            );
            return;
        }

        const caseDrop = {
            id: this.generateUniqueId(),
            caseName: caseDropData.caseName,
            dropDate: caseDropData.dropDate,
            price: caseDropData.casePrice,
            account: caseDropData.caseAccount,
            weekId: this.currentWeek,
            dateAdded: new Date().toISOString()
        };

        this.caseDrops.push(caseDrop);
        this.saveData();
        this.renderCurrentWeek();
        this.clearCaseDropForm();
        
        const selectedWeek = this.getCurrentWeek();
        this.showNotification(`Added "${caseDropData.caseName}" to ${selectedWeek?.name || 'current week'}`, 'success');
    }

    /**
     * Gets case drop form data
     * @returns {Object} Case drop form data
     */
    getCaseDropFormData() {
        return {
            caseName: document.getElementById('caseName').value.trim(),
            dropDate: document.getElementById('dropDate').value,
            casePrice: parseFloat(document.getElementById('casePrice').value),
            caseAccount: document.getElementById('caseAccount').value.trim()
        };
    }

    /**
     * Validates case drop form data
     * @param {Object} caseDropData - Case drop data to validate
     * @returns {boolean} Validation result
     */
    validateCaseDropForm(caseDropData) {
        if (!caseDropData.caseName || !caseDropData.dropDate || 
            !caseDropData.casePrice || caseDropData.casePrice <= 0 || 
            !caseDropData.caseAccount) {
            this.showNotification('Please fill in all required fields with valid values', 'error');
            return false;
        }
        return true;
    }

    /**
     * Checks if date falls within a week
     * @param {string} dateString - Date string to check
     * @param {Object} week - Week object
     * @returns {boolean} True if date is in week
     */
    isDateInWeek(dateString, week) {
        const dropDateObj = new Date(dateString);
        const weekStart = new Date(week.startDate);
        const weekEnd = new Date(week.endDate);
        return dropDateObj >= weekStart && dropDateObj <= weekEnd;
    }

    /**
     * Handles case drop action buttons
     * @param {string} action - Action type
     * @param {string} id - Case drop ID
     */
    handleCaseDropAction(action, id) {
        console.log(`🎯 Handling case drop action: ${action} for ID: ${id}`);
        
        switch (action) {
            case 'edit':
                this.editCaseDrop(id);
                break;
            case 'remove':
                this.removeCaseDrop(id);
                break;
            default:
                console.error('❌ Unknown case drop action:', action);
                this.showNotification('Unknown action', 'error');
        }
    }

    /**
     * Opens edit modal for case drop
     * @param {string} id - Case drop ID
     */
    editCaseDrop(id) {
        console.log('🔧 Edit case drop clicked for ID:', id);
        const caseDrop = this.caseDrops.find(drop => drop.id === id);
        
        if (!caseDrop) {
            console.error('Case drop not found with ID:', id);
            this.showNotification('Case drop not found', 'error');
            return;
        }

        this.editingCaseDrop = caseDrop;
        
        // Populate edit form
        document.getElementById('editCaseName').value = caseDrop.caseName;
        document.getElementById('editDropDate').value = caseDrop.dropDate;
        document.getElementById('editCasePrice').value = caseDrop.price;
        document.getElementById('editCaseAccount').value = caseDrop.account || '';

        // Show modal
        document.getElementById('editCaseDropModal').classList.remove('hidden');
        console.log('✅ Edit case drop modal opened for:', caseDrop.caseName);
    }

    /**
     * Saves case drop edit changes
     */
    saveCaseDropEdit() {
        if (!this.editingCaseDrop) {
            this.showNotification('No case drop selected for editing', 'error');
            return;
        }

        const editData = this.getCaseDropEditFormData();
        
        if (!this.validateCaseDropEditForm(editData)) {
            return;
        }

        const index = this.caseDrops.findIndex(drop => drop.id === this.editingCaseDrop.id);
        if (index !== -1) {
            this.caseDrops[index] = {
                ...this.caseDrops[index],
                ...editData
            };

            this.saveData();
            this.renderCurrentWeek();
            this.closeCaseDropEditModal();
            this.showNotification(`Updated "${editData.caseName}" successfully`, 'success');
        }
    }

    /**
     * Gets case drop edit form data
     * @returns {Object} Edit form data
     */
    getCaseDropEditFormData() {
        return {
            caseName: document.getElementById('editCaseName').value.trim(),
            dropDate: document.getElementById('editDropDate').value,
            price: parseFloat(document.getElementById('editCasePrice').value),
            account: document.getElementById('editCaseAccount').value.trim()
        };
    }

    /**
     * Validates case drop edit form data
     * @param {Object} editData - Edit form data
     * @returns {boolean} Validation result
     */
    validateCaseDropEditForm(editData) {
        if (!editData.caseName || !editData.dropDate || 
            !editData.price || editData.price <= 0 || 
            !editData.account) {
            this.showNotification('Please fill in all required fields with valid values', 'error');
            return false;
        }
        return true;
    }

    /**
     * Closes case drop edit modal
     */
    closeCaseDropEditModal() {
        document.getElementById('editCaseDropModal').classList.add('hidden');
        document.getElementById('editCaseDropModal').style.display = 'none';
        this.editingCaseDrop = null;
    }

    /**
     * Removes case drop
     * @param {string} id - Case drop ID
     */
    removeCaseDrop(id) {
        console.log('🗑️ Remove case drop clicked for ID:', id);
        const caseDrop = this.caseDrops.find(drop => drop.id === id);
        
        if (!caseDrop) {
            console.error('Case drop not found with ID:', id);
            this.showNotification('Case drop not found', 'error');
            return;
        }

        if (confirm(`Are you sure you want to remove "${caseDrop.caseName}" from your case drops?`)) {
            this.caseDrops = this.caseDrops.filter(drop => drop.id !== id);
            this.saveData();
            this.renderCurrentWeek();
            this.showNotification(`Removed "${caseDrop.caseName}" from case drops`, 'success');
            console.log('✅ Case drop removed:', caseDrop.caseName);
        }
    }

    /**
     * Renders current week content
     */
    renderCurrentWeek() {
        const weekContent = document.getElementById('weekContent');
        const emptyState = document.getElementById('caseDropsEmptyState');
        
        if (!weekContent) return;
        
        const currentWeek = this.getCurrentWeek();
        const currentWeekCaseDrops = this.getCurrentWeekCaseDrops();
        
        if (!currentWeek) {
            weekContent.innerHTML = '<p class="text-gray-400">No week selected</p>';
            return;
        }
        
        if (currentWeekCaseDrops.length === 0) {
            weekContent.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }
        
        if (emptyState) emptyState.classList.add('hidden');
        
        weekContent.innerHTML = this.generateWeekContent(currentWeek, currentWeekCaseDrops);
    }

    /**
     * Generates week content HTML
     * @param {Object} currentWeek - Current week object
     * @param {Array} currentWeekCaseDrops - Case drops for current week
     * @returns {string} HTML content for week
     */
    generateWeekContent(currentWeek, currentWeekCaseDrops) {
        const totalCases = currentWeekCaseDrops.length;
        const totalValue = currentWeekCaseDrops.reduce((sum, drop) => sum + drop.price, 0);
        const avgValue = totalCases > 0 ? totalValue / totalCases : 0;
        
        const weekStart = new Date(currentWeek.startDate).toLocaleDateString();
        const weekEnd = new Date(currentWeek.endDate).toLocaleDateString();
        
        return `
            <!-- Week Summary -->
            <div class="week-summary">
                <div class="week-summary-item">
                    <div class="week-summary-value gradient-text">${totalCases}</div>
                    <div class="week-summary-label">Total Cases</div>
                </div>
                <div class="week-summary-item">
                    <div class="week-summary-value text-green-400">$${this.formatNumber(totalValue)}</div>
                    <div class="week-summary-label">Total Value</div>
                </div>
                <div class="week-summary-item">
                    <div class="week-summary-value text-blue-400">$${this.formatNumber(avgValue)}</div>
                    <div class="week-summary-label">Average Value</div>
                </div>
                <div class="week-summary-item">
                    <div class="week-summary-value text-gray-300">${weekStart} - ${weekEnd}</div>
                    <div class="week-summary-label">Week Period</div>
                </div>
            </div>
            
            <!-- Case Drops Table -->
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead>
                        <tr class="border-b border-gray-700">
                            <th class="py-3 px-4 font-semibold text-gray-300">Case Name</th>
                            <th class="py-3 px-4 font-semibold text-gray-300">Drop Date</th>
                            <th class="py-3 px-4 font-semibold text-gray-300">Price</th>
                            <th class="py-3 px-4 font-semibold text-gray-300">Account</th>
                            <th class="py-3 px-4 font-semibold text-gray-300">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${currentWeekCaseDrops.map(caseDrop => this.generateCaseDropRow(caseDrop)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Generates case drop row HTML
     * @param {Object} caseDrop - Case drop object
     * @returns {string} HTML for case drop row
     */
    generateCaseDropRow(caseDrop) {
        return `
            <tr class="border-b border-gray-800 hover:bg-gray-800/30 transition animate-fadeIn">
                <td class="py-4 px-4">
                    <div class="font-medium text-white">${this.escapeHtml(caseDrop.caseName)}</div>
                    <div class="text-xs text-gray-400">ID: ${caseDrop.id.slice(-8)}</div>
                </td>
                <td class="py-4 px-4 text-gray-300 text-sm">
                    ${new Date(caseDrop.dropDate).toLocaleDateString()}
                </td>
                <td class="py-4 px-4 text-green-400 font-semibold">
                    $${this.formatNumber(caseDrop.price)}
                </td>
                <td class="py-4 px-4 text-gray-300 text-sm">
                    ${this.escapeHtml(caseDrop.account || 'N/A')}
                </td>
                <td class="py-4 px-4">
                    <div class="flex space-x-2 text-sm">
                        <button data-action="edit" data-id="${caseDrop.id}"
                                class="text-blue-400 hover:text-blue-300 transition case-action-btn">
                            Edit
                        </button>
                        <button data-action="remove" data-id="${caseDrop.id}"
                                class="text-red-400 hover:text-red-300 transition case-action-btn">
                            Remove
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Clears case drop form
     */
    clearCaseDropForm() {
        const elements = ['caseName', 'casePrice', 'caseAccount'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });
        
        const dropDateElement = document.getElementById('dropDate');
        if (dropDateElement) {
            dropDateElement.value = new Date().toISOString().split('T')[0];
        }
    }

    // ============================================================================================
    // CHART MANAGEMENT
    // ============================================================================================
    
    /**
     * Initializes all charts with error handling
     */
    initializeCharts() {
        console.log('📊 Initializing charts...');
        console.log('Chart.js available:', typeof Chart !== 'undefined');

        if (typeof Chart !== 'undefined') {
            try {
                this.createPerformanceChart();
                this.createPnLChart();
                this.createLongTermQuantityChart();
                console.log('✅ Charts initialized successfully');
            } catch (error) {
                console.error('❌ Chart initialization failed:', error);
                this.createFallbackCharts();
            }
        } else {
            console.error('❌ Chart.js not loaded');
            this.createFallbackCharts();
        }
    }

    /**
     * Creates fallback charts when Chart.js is not available
     */
    createFallbackCharts() {
        console.log('🔄 Creating fallback charts...');
        
        const chartContainers = [
            { id: 'performanceChart', title: 'Portfolio Performance Chart' },
            { id: 'pnlChart', title: 'P&L Distribution Chart' },
            { id: 'longTermQuantityChart', title: 'Holdings Distribution Chart' }
        ];

        chartContainers.forEach(({ id, title }) => {
            const canvas = document.getElementById(id);
            if (canvas) {
                const parent = canvas.parentElement;
                parent.innerHTML = `
                    <div class="flex items-center justify-center h-full text-gray-400">
                        <div class="text-center">
                            <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </svg>
                            <p class="text-sm">${title}</p>
                            <p class="text-xs mt-1">Chart.js not loaded</p>
                        </div>
                    </div>
                `;
            }
        });
    }

    /**
     * Creates performance chart
     */
    createPerformanceChart() {
        const canvas = document.getElementById('performanceChart');
        if (!canvas) {
            console.error('❌ Performance chart canvas not found');
            return;
        }

        const ctx = canvas.getContext('2d');
        const data = this.getPerformanceData();

        // Destroy existing chart if it exists
        if (this.charts.performance) {
            this.charts.performance.destroy();
        }

        try {
            this.charts.performance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'Portfolio Value',
                        data: data.values,
                        borderColor: this.chartColors.primary,
                        backgroundColor: `${this.chartColors.primary}20`,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: this.chartColors.primary,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#94a3b8'
                            }
                        },
                        y: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#94a3b8',
                                callback: function(value) {
                                    return '$' + value.toFixed(0);
                                }
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
            console.log('✅ Performance chart created');
        } catch (error) {
            console.error('❌ Performance chart creation failed:', error);
        }
    }

    /**
     * Creates P&L distribution chart
     */
    createPnLChart() {
        const canvas = document.getElementById('pnlChart');
        if (!canvas) {
            console.error('❌ P&L chart canvas not found');
            return;
        }

        const ctx = canvas.getContext('2d');
        const data = this.getPnLData();

        // Destroy existing chart if it exists
        if (this.charts.pnl) {
            this.charts.pnl.destroy();
        }

        try {
            this.charts.pnl = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'P&L',
                        data: data.values,
                        backgroundColor: data.values.map(value => 
                            value >= 0 ? this.chartColors.success + '80' : this.chartColors.danger + '80'
                        ),
                        borderColor: data.values.map(value => 
                            value >= 0 ? this.chartColors.success : this.chartColors.danger
                        ),
                        borderWidth: 2,
                        borderRadius: 4,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#94a3b8'
                            }
                        },
                        y: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#94a3b8',
                                callback: function(value) {
                                    return '$' + value.toFixed(0);
                                }
                            }
                        }
                    }
                }
            });
            console.log('✅ P&L chart created');
        } catch (error) {
            console.error('❌ P&L chart creation failed:', error);
        }
    }

    /**
     * Creates long-term quantity distribution chart
     */
    createLongTermQuantityChart() {
        const canvas = document.getElementById('longTermQuantityChart');
        if (!canvas) {
            console.error('❌ Long term quantity chart canvas not found');
            return;
        }

        const ctx = canvas.getContext('2d');
        const data = this.getLongTermQuantityData();

        // Destroy existing chart if it exists
        if (this.charts.longTermQuantity) {
            this.charts.longTermQuantity.destroy();
        }

        try {
            this.charts.longTermQuantity = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'Quantity',
                        data: data.quantities,
                        backgroundColor: data.quantities.map((_, index) => {
                            const colors = [
                                this.chartColors.primary + '80',
                                this.chartColors.success + '80', 
                                this.chartColors.warning + '80',
                                this.chartColors.info + '80',
                                this.chartColors.secondary + '80',
                                this.chartColors.danger + '80'
                            ];
                            return colors[index % colors.length];
                        }),
                        borderColor: data.quantities.map((_, index) => {
                            const colors = [
                                this.chartColors.primary,
                                this.chartColors.success, 
                                this.chartColors.warning,
                                this.chartColors.info,
                                this.chartColors.secondary,
                                this.chartColors.danger
                            ];
                            return colors[index % colors.length];
                        }),
                        borderWidth: 2,
                        borderRadius: 4,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#94a3b8',
                                maxRotation: 45
                            }
                        },
                        y: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#94a3b8',
                                stepSize: 1
                            }
                        }
                    }
                }
            });
            console.log('✅ Long term quantity chart created');
        } catch (error) {
            console.error('❌ Long term quantity chart creation failed:', error);
        }
    }

// ============================================================================================
// PRICE COMPARISON INTEGRATION (Adapted from tradeit-price-compare.js)
// ============================================================================================

// ============================================================================================
// SIMPLE PRICE COMPARISON INTEGRATION
// ============================================================================================

// ============================================================================================
// DOPPLER-AWARE PRICE COMPARISON INTEGRATION
// ============================================================================================

/**
 * Fetch price data from APIs
 */
async fetchPriceData() {
    // Use cache if it's less than 1 hour old
    if (this.priceDataCache && (Date.now() - this.priceCacheTimestamp < 3600000)) {
        return this.priceDataCache;
    }

    console.log('📡 Fetching fresh prices from csgotrader.app APIs...');
    
    try {
        const [csfloatResponse, buffResponse] = await Promise.all([
            fetch('https://prices.csgotrader.app/latest/csfloat.json'),
            fetch('https://prices.csgotrader.app/latest/buff163.json')
        ]);

        if (!csfloatResponse.ok || !buffResponse.ok) {
            throw new Error('Failed to fetch price data');
        }

        const csfloatData = await csfloatResponse.json();
        const buffData = await buffResponse.json();
        
        this.priceDataCache = this.combinePriceData(csfloatData, buffData);
        this.priceCacheTimestamp = Date.now();
        
        console.log(`✅ Price cache updated with ${Object.keys(this.priceDataCache).length} items.`);
        return this.priceDataCache;

    } catch (error) {
        console.error('❌ Error fetching prices:', error.message);
        return this.priceDataCache || {};
    }
}

/**
 * Combine price data from both APIs (preserving doppler structure)
 */
combinePriceData(csfloatData, buffData) {
    const combinedPrices = {};

    // Add CSFloat prices (preserve doppler structure)
    for (const [name, data] of Object.entries(csfloatData)) {
        combinedPrices[name.toLowerCase()] = { 
            csfloatPrice: data.price,
            csfloatDoppler: data.doppler || null
        };
    }
    
    // Add Buff163 prices (preserve doppler structure)
    for (const [name, data] of Object.entries(buffData)) {
        const lowerName = name.toLowerCase();
        if (!combinedPrices[lowerName]) {
            combinedPrices[lowerName] = {};
        }
        
        if (data?.starting_at?.price) {
            combinedPrices[lowerName].buffPrice = data.starting_at.price;
            if (data.starting_at.doppler) {
                combinedPrices[lowerName].buffDoppler = data.starting_at.doppler;
            }
        }
    }
    
    return combinedPrices;
}

/**
 * Check if item is a Doppler item and extract phase/gem (FIXED VERSION)
 */
parseDopplerItem(itemName) {
    console.log(`🔍 Parsing Doppler for: "${itemName}"`);
    
    const lowerName = itemName.toLowerCase();
    
    // Check if it contains "doppler"
    if (!lowerName.includes('doppler')) {
        console.log(`   ❌ No "doppler" found`);
        return { isDoppler: false };
    }
    
    console.log(`   ✅ Contains "doppler"`);
    
    // Define phase/gem patterns more carefully
    const patterns = [
        // Gem patterns: "Doppler - Sapphire", "Doppler Sapphire"
        { 
            regex: /\|\s*doppler\s*[-\s]*sapphire/i, 
            phase: 'Sapphire',
            replacement: '| Doppler'
        },
        { 
            regex: /\|\s*doppler\s*[-\s]*ruby/i, 
            phase: 'Ruby',
            replacement: '| Doppler'
        },
        { 
            regex: /\|\s*doppler\s*[-\s]*emerald/i, 
            phase: 'Emerald',
            replacement: '| Doppler'
        },
        { 
            regex: /\|\s*doppler\s*[-\s]*black\s+pearl/i, 
            phase: 'Black Pearl',
            replacement: '| Doppler'
        },
        // Phase patterns: "Doppler (Phase 3)", "Doppler - Phase 3"
        { 
            regex: /\|\s*doppler\s*[-\s]*phase\s+([1-4])/i, 
            phase: 'Phase',
            replacement: '| Doppler'
        },
        { 
            regex: /\|\s*doppler\s*\(\s*phase\s+([1-4])\s*\)/i, 
            phase: 'Phase',
            replacement: '| Doppler'
        }
    ];
    
    for (const pattern of patterns) {
        console.log(`   Testing pattern: ${pattern.regex}`);
        const match = itemName.match(pattern.regex);
        
        if (match) {
            console.log(`   ✅ Pattern matched!`, match);
            
            let phase = pattern.phase;
            if (pattern.phase === 'Phase' && match[1]) {
                phase = `Phase ${match[1]}`;
            }
            
            // Create base name by replacing the matched part with just "| Doppler"
            const baseName = itemName.replace(pattern.regex, pattern.replacement);
            
            console.log(`   Phase: "${phase}"`);
            console.log(`   Base name: "${baseName}"`);
            
            return {
                isDoppler: true,
                baseName: baseName.trim(),
                phase: phase
            };
        }
    }
    
    console.log(`   ❌ No Doppler patterns matched`);
    return { isDoppler: false };
}

/**
 * Generate name variations for matching
 */
generateNameVariations(itemName) {
    const variations = [];
    let workingName = itemName.trim();
    
    // Original name
    variations.push(workingName);
    
    // Fix quality: "Factory-New" → "Factory New"
    const qualityFixed = workingName.replace(/\(([^)]+)\)/, (match, quality) => {
        return `(${quality.replace(/-/g, ' ')})`;
    });
    variations.push(qualityFixed);
    
    // Add star for knives
    const knifeNames = ['knife', 'bayonet', 'karambit'];
    const isKnife = knifeNames.some(k => workingName.toLowerCase().includes(k));
    
    if (isKnife && !workingName.includes('★')) {
        variations.push(`★ ${qualityFixed}`);
    }
    
    // Remove star if present
    if (workingName.includes('★')) {
        variations.push(qualityFixed.replace('★ ', ''));
    }
    
    // StatTrak variations
    if (workingName.includes('StatTrak')) {
        const statTrakFixed = qualityFixed.replace(/StatTrak[™]?\s*/gi, 'StatTrak™ ');
        variations.push(statTrakFixed);
        
        if (isKnife && !statTrakFixed.includes('★')) {
            variations.push(`★ ${statTrakFixed}`);
        }
    }
    
    // Remove duplicates and return
    return [...new Set(variations)];
}

/**
 * Get prices for an item name (with Doppler support)
 */
async getItemPrices(itemName) {
    console.log(`\n🔍 === SUPER DEBUG FOR: "${itemName}" ===`);
    
    try {
        const priceData = await this.fetchPriceData();
        
        if (!priceData || Object.keys(priceData).length === 0) {
            console.log('❌ No price data available');
            return { csfloatPrice: null, buffPrice: null };
        }

        // Step 1: Check if this is a Doppler item
        const dopplerInfo = this.parseDopplerItem(itemName);
        console.log(`🎯 Doppler check result:`, dopplerInfo);
        
        if (dopplerInfo.isDoppler) {
            console.log(`🔍 Processing as Doppler item...`);
            console.log(`   Base name: "${dopplerInfo.baseName}"`);
            console.log(`   Phase: "${dopplerInfo.phase}"`);
            
            // Generate variations for base name
            const baseVariations = this.generateNameVariations(dopplerInfo.baseName);
            console.log(`   Base variations:`, baseVariations);
            
            // Try to find the base item
            for (const variation of baseVariations) {
                const lowerVariation = variation.toLowerCase();
                console.log(`   Checking: "${lowerVariation}"`);
                
                if (priceData[lowerVariation]) {
                    const itemData = priceData[lowerVariation];
                    console.log(`   ✅ Found base item!`);
                    console.log(`   Item data:`, {
                        csfloatPrice: itemData.csfloatPrice,
                        buffPrice: itemData.buffPrice,
                        hasCsfloatDoppler: !!itemData.csfloatDoppler,
                        hasBuffDoppler: !!itemData.buffDoppler
                    });
                    
                    if (itemData.csfloatDoppler) {
                        console.log(`   CSFloat Doppler phases:`, Object.keys(itemData.csfloatDoppler));
                    }
                    if (itemData.buffDoppler) {
                        console.log(`   Buff163 Doppler phases:`, Object.keys(itemData.buffDoppler));
                    }
                    
                    // Try to get phase-specific price
                    let csfloatPrice = null;
                    let buffPrice = null;
                    
                    if (itemData.csfloatDoppler && itemData.csfloatDoppler[dopplerInfo.phase]) {
                        csfloatPrice = itemData.csfloatDoppler[dopplerInfo.phase];
                        console.log(`   ✅ Found CSFloat ${dopplerInfo.phase}: $${csfloatPrice}`);
                    } else {
                        console.log(`   ❌ CSFloat ${dopplerInfo.phase} not found`);
                    }
                    
                    if (itemData.buffDoppler && itemData.buffDoppler[dopplerInfo.phase]) {
                        buffPrice = itemData.buffDoppler[dopplerInfo.phase];
                        console.log(`   ✅ Found Buff163 ${dopplerInfo.phase}: $${buffPrice}`);
                    } else {
                        console.log(`   ❌ Buff163 ${dopplerInfo.phase} not found`);
                    }
                    
                    return { csfloatPrice, buffPrice };
                } else {
                    console.log(`   ❌ Not found: "${lowerVariation}"`);
                }
            }
            
            console.log(`❌ No Doppler base item found`);
            return { csfloatPrice: null, buffPrice: null };
        }
        
        // Regular item processing
        console.log(`🔍 Processing as regular item...`);
        const variations = this.generateNameVariations(itemName);
        console.log(`   Variations:`, variations);
        
        for (const variation of variations) {
            const lowerVariation = variation.toLowerCase();
            console.log(`   Trying: "${lowerVariation}"`);
            
            if (priceData[lowerVariation]) {
                console.log(`   ✅ Found regular item!`);
                return {
                    csfloatPrice: priceData[lowerVariation].csfloatPrice || null,
                    buffPrice: priceData[lowerVariation].buffPrice || null
                };
            }
        }
        
        console.log(`❌ No match found`);
        return { csfloatPrice: null, buffPrice: null };
        
    } catch (error) {
        console.error('❌ Error getting item prices:', error);
        return { csfloatPrice: null, buffPrice: null };
    }
}

/**
 * Get Doppler-specific prices
 */
async getDopplerPrices(baseName, phase, priceData) {
    // Generate variations for the base name
    const variations = this.generateNameVariations(baseName);
    
    for (const variation of variations) {
        const lowerVariation = variation.toLowerCase();
        
        if (priceData[lowerVariation]) {
            const itemData = priceData[lowerVariation];
            
            console.log(`✅ Found Doppler base: "${variation}"`);
            
            // Get phase-specific prices
            let csfloatPrice = null;
            let buffPrice = null;
            
            if (itemData.csfloatDoppler && itemData.csfloatDoppler[phase]) {
                csfloatPrice = itemData.csfloatDoppler[phase];
                console.log(`   CSFloat ${phase}: $${csfloatPrice}`);
            }
            
            if (itemData.buffDoppler && itemData.buffDoppler[phase]) {
                buffPrice = itemData.buffDoppler[phase];
                console.log(`   Buff163 ${phase}: $${buffPrice}`);
            }
            
            // Fallback to base price if phase not found
            if (!csfloatPrice && itemData.csfloatPrice) {
                csfloatPrice = itemData.csfloatPrice;
                console.log(`   CSFloat fallback: $${csfloatPrice}`);
            }
            
            if (!buffPrice && itemData.buffPrice) {
                buffPrice = itemData.buffPrice;
                console.log(`   Buff163 fallback: $${buffPrice}`);
            }
            
            return { csfloatPrice, buffPrice };
        }
    }
    
    console.log(`❌ No Doppler base found for: "${baseName}"`);
    return { csfloatPrice: null, buffPrice: null };
}


    // ============================================================================================
    // CHART DATA GENERATION
    // ============================================================================================

// ============================================================================================
// CATEGORY MANAGEMENT
// ============================================================================================

/**
 * Shows the add category form
 */
showAddCategoryForm() {
    document.getElementById('addCategoryForm').classList.remove('hidden');
    document.getElementById('newCategoryName').focus();
}

/**
 * Hides the add category form
 */
hideAddCategoryForm() {
    document.getElementById('addCategoryForm').classList.add('hidden');
    document.getElementById('newCategoryName').value = '';
}

/**
 * Adds a new category
 */
addCategory() {
    const categoryName = document.getElementById('newCategoryName').value.trim();
    
    if (!categoryName) {
        this.showNotification('Please enter a category name', 'error');
        return;
    }
    
    // Check if category already exists
    if (this.categories.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase())) {
        this.showNotification('Category already exists', 'error');
        return;
    }
    
    const category = {
        id: this.generateUniqueId(),
        name: categoryName,
        isDefault: false,
        dateCreated: new Date().toISOString()
    };
    
    this.categories.push(category);
    this.saveData();
    this.renderCategoryTabs();
    this.hideAddCategoryForm();
    
    this.showNotification(`Category "${categoryName}" created successfully`, 'success');
}

/**
 * Removes a category
 * @param {string} categoryId - Category ID to remove
 */
removeCategory(categoryId) {
    const category = this.categories.find(cat => cat.id === categoryId);
    
    if (!category) {
        this.showNotification('Category not found', 'error');
        return;
    }
    
    if (category.isDefault) {
        this.showNotification('Cannot delete default category', 'error');
        return;
    }
    
    // Count items in this category
    const itemsInCategory = this.longTermInvestments.filter(inv => inv.categoryId === categoryId).length;
    
    if (itemsInCategory > 0) {
        if (!confirm(`This category contains ${itemsInCategory} items. Items will be moved to "Uncategorized". Continue?`)) {
            return;
        }
        
        // Move items to uncategorized
        const uncategorizedCategory = this.categories.find(cat => cat.isDefault);
        this.longTermInvestments.forEach(inv => {
            if (inv.categoryId === categoryId) {
                inv.categoryId = uncategorizedCategory.id;
            }
        });
    }
    
    this.categories = this.categories.filter(cat => cat.id !== categoryId);
    
    // If we're currently viewing this category, switch to "All"
    if (this.selectedCategoryId === categoryId) {
        this.selectedCategoryId = null;
    }
    
    this.saveData();
    this.renderCategoryTabs();
    this.renderLongTermInvestments();
    
    this.showNotification(`Category "${category.name}" deleted successfully`, 'success');
}

/**
 * Populates the category dropdown in the form
 */
populateCategoryDropdown() {
    const categorySelect = document.getElementById('categorySelect');
    if (!categorySelect) return;
    
    // Clear existing options except the first one
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    
    // Add all categories as options
    this.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });
    
    // If no categories exist except default, show a message
    if (this.categories.length <= 1) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No categories created yet';
        option.disabled = true;
        categorySelect.appendChild(option);
    }
}

/**
 * Populates the category dropdown in the edit modal
 */
populateEditCategoryDropdown() {
    const categorySelect = document.getElementById('editLongTermCategory');
    if (!categorySelect) return;
    
    // Clear existing options except the first one
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    
    // Add all categories as options
    this.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });
}


/**
 * Selects a category for filtering
 * @param {string} categoryId - Category ID to select (null for "All")
 */
selectCategory(categoryId) {
    this.selectedCategoryId = categoryId;
    this.renderCategoryTabs();
    this.renderLongTermInvestments();
}

/**
 * Renders category tabs horizontally
 */
renderCategoryTabs() {
    const categoryTabsContainer = document.getElementById('categoryTabsContainer');
    
    if (!categoryTabsContainer) return;
    
    const allItemsCount = this.longTermInvestments.length;
    
    // Create "All" tab
    let tabsHTML = `
        <div class="category-tab ${this.selectedCategoryId === null ? 'active' : ''}" data-category-id="all">
            <span class="category-tab-name">All</span>
            <span class="category-tab-count">${allItemsCount}</span>
        </div>
    `;
    
    // Create tabs for each category
    this.categories.forEach(category => {
        const itemCount = this.longTermInvestments.filter(inv => inv.categoryId === category.id).length;
        const isActive = this.selectedCategoryId === category.id;
        
        tabsHTML += `
            <div class="category-tab ${isActive ? 'active' : ''}" data-category-id="${category.id}">
                <span class="category-tab-name">${this.escapeHtml(category.name)}</span>
                <span class="category-tab-count">${itemCount}</span>
                ${!category.isDefault ? `
                    <button class="category-tab-delete" data-delete-category="${category.id}" title="Delete category">
                        ×
                    </button>
                ` : ''}
            </div>
        `;
    });
    
    categoryTabsContainer.innerHTML = tabsHTML;

    // Also update the form dropdown when categories change
    this.populateCategoryDropdown();
}


/**
 * Gets filtered long term investments based on selected category
 * @returns {Array} Filtered investments
 */
getFilteredLongTermInvestments() {
    if (this.selectedCategoryId === null) {
        return this.longTermInvestments; // Show all
    }
    
    return this.longTermInvestments.filter(inv => inv.categoryId === this.selectedCategoryId);
}
  
    
    /**
     * Generates performance chart data based on current period
     * @returns {Object} Chart data with labels and values
     */
    getPerformanceData() {
        console.log('🔍 Generating performance data for period:', this.currentPeriod);
        
        // If no investments, return simple mock data
        if (this.investments.length === 0) {
            const periodDays = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
            const days = periodDays[this.currentPeriod] || 7;
            const labels = [];
            for (let i = 0; i < Math.min(days, 10); i++) {
                const date = new Date();
                date.setDate(date.getDate() - (days - i));
                labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            }
            return {
                labels,
                values: new Array(labels.length).fill(0)
            };
        }

        // Define period settings
        const periodSettings = {
            '7d': { days: 7, dataPoints: 7 },
            '30d': { days: 30, dataPoints: 15 },
            '90d': { days: 90, dataPoints: 18 },
            '1y': { days: 365, dataPoints: 24 }
        };

        const settings = periodSettings[this.currentPeriod] || periodSettings['7d'];
        const { days, dataPoints } = settings;

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const labels = [];
        const values = [];

        // Generate data points
        for (let i = 0; i < dataPoints; i++) {
            const currentDate = new Date(startDate);
            const dayOffset = Math.floor((days / dataPoints) * i);
            currentDate.setDate(startDate.getDate() + dayOffset);
            
            // Format label based on period
            let label;
            if (this.currentPeriod === '1y') {
                label = currentDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            } else {
                label = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            labels.push(label);
            
            // Calculate portfolio value at this date
            let portfolioValue = 0;
            
            this.investments.forEach(inv => {
                const buyDate = new Date(inv.buyDate);
                const sellDate = inv.sellDate ? new Date(inv.sellDate) : null;
                
                if (buyDate <= currentDate) {
                    if (sellDate && sellDate <= currentDate) {
                        // Item was bought and sold before this date
                        portfolioValue += inv.sellPrice;
                    } else if (!sellDate || sellDate > currentDate) {
                        // Item was bought but not yet sold (or sold after this date)
                        portfolioValue += inv.buyPrice;
                    }
                }
            });
            
            values.push(portfolioValue);
        }

        console.log('📈 Performance data generated:', { 
            period: this.currentPeriod, 
            dataPoints: values.length, 
            values: values.slice(0, 3) + '...' // Show first 3 values
        });
        
        return { labels, values };
    }

    /**
     * Generates P&L chart data
     * @returns {Object} Chart data with labels and values
     */
    getPnLData() {
        const soldInvestments = this.investments.filter(inv => inv.sellPrice && inv.profit);
        const profits = soldInvestments.map(inv => inv.profit);
        const labels = soldInvestments.map(inv => inv.itemName.slice(0, 15) + (inv.itemName.length > 15 ? '...' : ''));
        
        return { labels: labels.slice(0, 10), values: profits.slice(0, 10) };
    }

    /**
     * Generates long-term quantity chart data
     * @returns {Object} Chart data with labels and quantities
     */
    getLongTermQuantityData() {
        // Group by item name and sum quantities
        const itemGroups = {};
        
        this.longTermInvestments.forEach(inv => {
            const itemName = inv.itemName.length > 15 ? inv.itemName.slice(0, 15) + '...' : inv.itemName;
            if (itemGroups[itemName]) {
                itemGroups[itemName] += inv.quantity;
            } else {
                itemGroups[itemName] = inv.quantity;
            }
        });

        const labels = Object.keys(itemGroups);
        const quantities = Object.values(itemGroups);
        
        return { labels, quantities };
    }

    /**
     * Updates all charts with current data
     */
    updateCharts() {
        console.log('🔄 Updating charts for period:', this.currentPeriod);
        
        // Update performance chart
        if (this.charts.performance) {
            console.log('📊 Updating performance chart...');
            const performanceData = this.getPerformanceData();
            this.charts.performance.data.labels = performanceData.labels;
            this.charts.performance.data.datasets[0].data = performanceData.values;
            this.charts.performance.update('active');
            console.log('✅ Performance chart updated');
        } else {
            console.log('❌ Performance chart not found, recreating...');
            this.createPerformanceChart();
        }

        // Update P&L chart
        if (this.charts.pnl) {
            console.log('📊 Updating P&L chart...');
            const pnlData = this.getPnLData();
            this.charts.pnl.data.labels = pnlData.labels;
            this.charts.pnl.data.datasets[0].data = pnlData.values;
            this.charts.pnl.data.datasets[0].backgroundColor = pnlData.values.map(value => 
                value >= 0 ? this.chartColors.success + '80' : this.chartColors.danger + '80'
            );
            this.charts.pnl.data.datasets[0].borderColor = pnlData.values.map(value => 
                value >= 0 ? this.chartColors.success : this.chartColors.danger
            );
            this.charts.pnl.update('active');
            console.log('✅ P&L chart updated');
        } else {
            console.log('❌ P&L chart not found, recreating...');
            this.createPnLChart();
        }

        // Update long term quantity chart
        if (this.charts.longTermQuantity) {
            console.log('📊 Updating long term quantity chart...');
            const longTermData = this.getLongTermQuantityData();
            this.charts.longTermQuantity.data.labels = longTermData.labels;
            this.charts.longTermQuantity.data.datasets[0].data = longTermData.quantities;
            
            // Update colors for new data points
            this.charts.longTermQuantity.data.datasets[0].backgroundColor = longTermData.quantities.map((_, index) => {
                const colors = [
                    this.chartColors.primary + '80',
                    this.chartColors.success + '80', 
                    this.chartColors.warning + '80',
                    this.chartColors.info + '80',
                    this.chartColors.secondary + '80',
                    this.chartColors.danger + '80'
                ];
                return colors[index % colors.length];
            });
            
            this.charts.longTermQuantity.data.datasets[0].borderColor = longTermData.quantities.map((_, index) => {
                const colors = [
                    this.chartColors.primary,
                    this.chartColors.success, 
                    this.chartColors.warning,
                    this.chartColors.info,
                    this.chartColors.secondary,
                    this.chartColors.danger
                ];
                return colors[index % colors.length];
            });
            
            this.charts.longTermQuantity.update('active');
            console.log('✅ Long term quantity chart updated');
        } else {
            console.log('❌ Long term quantity chart not found, recreating...');
            this.createLongTermQuantityChart();
        }
    }

    // ============================================================================================
    // EXPORT FUNCTIONALITY
    // ============================================================================================
    
    /**
     * Exports regular investments to CSV
     */
    exportToCSV() {
        if (this.investments.length === 0) {
            this.showNotification('No investments to export', 'error');
            return;
        }

        const headers = ['Item Name', 'Buy Price', 'Buy Date', 'Sell Price', 'Sell Date', 'Profit/Loss', 'Return %', 'Status'];
        const csvContent = [
            headers.join(','),
            ...this.investments.map(inv => [
                `"${inv.itemName.replace(/"/g, '""')}"`,
                inv.buyPrice.toFixed(2),
                inv.buyDate.split('T')[0],
                inv.sellPrice ? inv.sellPrice.toFixed(2) : '',
                inv.sellDate || '',
                (inv.profit || 0).toFixed(2),
                (inv.returnPercentage || 0).toFixed(2),
                inv.status
            ].join(','))
        ].join('\n');

        this.downloadFile(csvContent, `investment-portfolio-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        this.showNotification('Portfolio data exported successfully', 'success');
    }

    /**
     * Exports regular investments to Excel
     */
    exportToExcel() {
        if (this.investments.length === 0) {
            this.showNotification('No investments to export', 'error');
            return;
        }

        if (typeof XLSX === 'undefined') {
            this.showNotification('Excel library not loaded. Please refresh the page.', 'error');
            return;
        }

        try {
            const data = [
                ['Item Name', 'Buy Price', 'Buy Date', 'Sell Price', 'Sell Date', 'Profit/Loss', 'Return %', 'Status']
            ];
            
            this.investments.forEach(inv => {
                data.push([
                    inv.itemName,
                    inv.buyPrice,
                    inv.buyDate.split('T')[0],
                    inv.sellPrice || '',
                    inv.sellDate || '',
                    inv.profit || 0,
                    inv.returnPercentage || 0,
                    inv.status
                ]);
            });

            this.createExcelFile(data, 'Investments', `investment-portfolio-${new Date().toISOString().split('T')[0]}.xlsx`);
            this.showNotification('Portfolio data exported to Excel successfully', 'success');
        } catch (error) {
            console.error('Excel export error:', error);
            this.showNotification('Error exporting to Excel', 'error');
        }
    }

    /**
     * Exports long-term investments to CSV
     */
    exportLongTermToCSV() {
        if (this.longTermInvestments.length === 0) {
            this.showNotification('No long term investments to export', 'error');
            return;
        }

        const headers = ['Item Name', 'Quantity', 'Unit Buy Price', 'Total Buy Price', 'Buy Date', 'Unit Sell Price', 'Total Sell Price', 'Sell Date', 'Profit/Loss', 'Return %', 'Status'];
        const csvContent = [
            headers.join(','),
            ...this.longTermInvestments.map(inv => [
                `"${inv.itemName.replace(/"/g, '""')}"`,
                inv.quantity,
                inv.unitBuyPrice.toFixed(2),
                inv.totalBuyPrice.toFixed(2),
                inv.buyDate.split('T')[0],
                inv.unitSellPrice ? inv.unitSellPrice.toFixed(2) : '',
                inv.totalSellPrice ? inv.totalSellPrice.toFixed(2) : '',
                inv.sellDate || '',
                (inv.profit || 0).toFixed(2),
                (inv.returnPercentage || 0).toFixed(2),
                inv.status
            ].join(','))
        ].join('\n');

        this.downloadFile(csvContent, `long-term-investments-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        this.showNotification('Long term investments exported successfully', 'success');
    }

    /**
     * Exports long-term investments to Excel
     */
    exportLongTermToExcel() {
        if (this.longTermInvestments.length === 0) {
            this.showNotification('No long term investments to export', 'error');
            return;
        }

        if (typeof XLSX === 'undefined') {
            this.showNotification('Excel library not loaded. Please refresh the page.', 'error');
            return;
        }

        try {
            const data = [
                ['Item Name', 'Quantity', 'Unit Buy Price', 'Total Buy Price', 'Buy Date', 'Unit Sell Price', 'Total Sell Price', 'Sell Date', 'Profit/Loss', 'Return %', 'Status']
            ];
            
            this.longTermInvestments.forEach(inv => {
                data.push([
                    inv.itemName,
                    inv.quantity,
                    inv.unitBuyPrice,
                    inv.totalBuyPrice,
                    inv.buyDate.split('T')[0],
                    inv.unitSellPrice || '',
                    inv.totalSellPrice || '',
                    inv.sellDate || '',
                    inv.profit || 0,
                    inv.returnPercentage || 0,
                    inv.status
                ]);
            });

            this.createExcelFile(data, 'Long Term Investments', `long-term-investments-${new Date().toISOString().split('T')[0]}.xlsx`);
            this.showNotification('Long term investments exported to Excel successfully', 'success');
        } catch (error) {
            console.error('Excel export error:', error);
            this.showNotification('Error exporting to Excel', 'error');
        }
    }

    /**
     * Exports case drops to CSV
     */
    exportCaseDropsToCSV() {
        if (this.caseDrops.length === 0) {
            this.showNotification('No case drops to export', 'error');
            return;
        }

        const headers = ['Year', 'Month', 'Week', 'Case Name', 'Drop Date', 'Price', 'Account', 'Week ID'];
        const csvContent = [
            headers.join(','),
            ...this.caseDrops.map(drop => {
                const weekInfo = this.findWeekInfo(drop.weekId);
                return [
                    weekInfo.year || 'Unknown',
                    `"${weekInfo.monthName || 'Unknown'}"`,
                    `"${weekInfo.weekName || 'Unknown Week'}"`,
                    `"${drop.caseName.replace(/"/g, '""')}"`,
                    drop.dropDate,
                    drop.price.toFixed(2),
                    `"${(drop.account || 'N/A').replace(/"/g, '""')}"`,
                    `"${drop.weekId || 'unknown'}"`
                ].join(',');
            })
        ].join('\n');

        this.downloadFile(csvContent, `case-drops-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        this.showNotification('Case drops data exported successfully', 'success');
    }

    /**
     * Exports case drops to Excel
     */
    exportCaseDropsToExcel() {
        if (this.caseDrops.length === 0) {
            this.showNotification('No case drops to export', 'error');
            return;
        }

        const data = [
            ['Year', 'Month', 'Week', 'Case Name', 'Drop Date', 'Price', 'Account', 'Week ID']
        ];
        
        this.caseDrops.forEach(drop => {
            const weekInfo = this.findWeekInfo(drop.weekId);
            data.push([
                weekInfo.year || 'Unknown',
                weekInfo.monthName || 'Unknown',
                weekInfo.weekName || 'Unknown Week',
                drop.caseName,
                drop.dropDate,
                drop.price,
                drop.account || 'N/A',
                drop.weekId || 'unknown'
            ]);
        });

        this.createExcelFile(data, 'Case Drops', `case-drops-${new Date().toISOString().split('T')[0]}.xlsx`);
        this.showNotification('Case drops data exported to Excel successfully', 'success');
    }

    /**
     * Finds week information by week ID
     * @param {string} weekId - Week ID to find
     * @returns {Object} Week information object
     */
    findWeekInfo(weekId) {
        for (const yearData of this.years) {
            for (const monthData of yearData.months) {
                const week = monthData.weeks.find(w => w.id === weekId);
                if (week) {
                    return {
                        year: yearData.year,
                        monthName: monthData.name,
                        weekName: week.name,
                        week: week
                    };
                }
            }
        }
        return { year: null, monthName: null, weekName: null, week: null };
    }

    // ============================================================================================
    // IMPORT FUNCTIONALITY
    // ============================================================================================
    
    /**
     * Imports data from CSV file
     * @param {File} file - File to import
     * @param {string} type - Import type: 'investments', 'longterm', 'casedrops'
     */
    async importFromCSV(file, type) {
        try {
            console.log('🔍 Starting import for type:', type);
            
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                this.showNotification('CSV file appears to be empty or invalid', 'error');
                return;
            }

            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            const dataLines = lines.slice(1);
            
            console.log('📋 Headers:', headers);
            console.log('📊 Data lines count:', dataLines.length);
            
            switch (type) {
                case 'investments':
                    await this.importInvestments(headers, dataLines);
                    break;
                case 'longterm':
                    await this.importLongTermInvestments(headers, dataLines);
                    break;
                case 'casedrops':
                    await this.importCaseDrops(headers, dataLines);
                    break;
                default:
                    this.showNotification('Unknown import type', 'error');
            }
            
        } catch (error) {
            console.error('❌ Import error:', error);
            this.showNotification(`Error importing CSV file: ${error.message}`, 'error');
        }
    }

    /**
     * Imports regular investments from CSV data
     * @param {Array} headers - CSV headers
     * @param {Array} dataLines - CSV data lines
     */
    async importInvestments(headers, dataLines) {
        console.log('💰 Starting investments import...');
        let importedCount = 0;
        let skippedCount = 0;
        
        for (let i = 0; i < dataLines.length; i++) {
            const line = dataLines[i];
            const values = this.parseCSVLine(line);
            
            if (values.length < 3) {
                skippedCount++;
                continue;
            }
            
            try {
                const investmentData = this.parseInvestmentCSVLine(values);
                
                if (!investmentData.itemName || investmentData.buyPrice <= 0) {
                    skippedCount++;
                    continue;
                }
                
                const investment = {
                    id: this.generateUniqueId(),
                    ...investmentData,
                    profit: this.calculateProfit(investmentData.buyPrice, investmentData.sellPrice),
                    returnPercentage: this.calculateReturnPercentage(investmentData.buyPrice, investmentData.sellPrice),
                    dateAdded: new Date().toISOString()
                };
                
                this.investments.push(investment);
                importedCount++;
                
                // Small delay to avoid ID collisions
                await new Promise(resolve => setTimeout(resolve, 1));
            } catch (lineError) {
                console.error(`❌ Error processing investment line ${i + 1}:`, lineError);
                skippedCount++;
            }
        }
        
        await this.saveData();
        this.renderInvestments();
        this.updateMetrics();
        this.updateCharts();
        
        this.showNotification(
            `Imported ${importedCount} investments successfully${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`,
            'success'
        );
    }

    /**
     * Imports long-term investments from CSV data
     * @param {Array} headers - CSV headers
     * @param {Array} dataLines - CSV data lines
     */
    async importLongTermInvestments(headers, dataLines) {
        console.log('💎 Starting long-term investments import...');
        let importedCount = 0;
        let skippedCount = 0;
        
        for (let i = 0; i < dataLines.length; i++) {
            const line = dataLines[i];
            const values = this.parseCSVLine(line);
            
            if (values.length < 5) {
                skippedCount++;
                continue;
            }
            
            try {
                const longTermData = this.parseLongTermCSVLine(values);
                
                if (!longTermData.itemName || longTermData.quantity <= 0 || longTermData.unitBuyPrice <= 0) {
                    skippedCount++;
                    continue;
                }
                
                const longTermInvestment = {
                    id: this.generateUniqueId(),
                    ...longTermData,
                    dateAdded: new Date().toISOString()
                };
                
                this.longTermInvestments.push(longTermInvestment);
                importedCount++;
                
                await new Promise(resolve => setTimeout(resolve, 1));
            } catch (lineError) {
                console.error(`❌ Error processing long-term line ${i + 1}:`, lineError);
                skippedCount++;
            }
        }
        
        await this.saveData();
        this.renderLongTermInvestments();
        this.updateMetrics();
        this.updateCharts();
        
        this.showNotification(
            `Imported ${importedCount} long-term investments successfully${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`,
            'success'
        );
    }

    /**
     * Imports case drops from CSV data
     * @param {Array} headers - CSV headers
     * @param {Array} dataLines - CSV data lines
     */
    async importCaseDrops(headers, dataLines) {
        console.log('🎲 Starting case drops import...');
        let importedCount = 0;
        let skippedCount = 0;
        
        for (let i = 0; i < dataLines.length; i++) {
            const line = dataLines[i];
            const values = this.parseCSVLine(line);
            
            if (values.length < 4) {
                skippedCount++;
                continue;
            }
            
            try {
                const caseDropData = this.parseCaseDropCSVLine(values, headers);
                
                if (!caseDropData.caseName || caseDropData.price <= 0) {
                    skippedCount++;
                    continue;
                }
                
                const targetWeekId = await this.findOrCreateWeekStructure(
                    caseDropData.year, 
                    caseDropData.monthName, 
                    caseDropData.weekName, 
                    caseDropData.dropDate
                );
                
                if (targetWeekId) {
                    const caseDrop = {
                        id: this.generateUniqueId(),
                        caseName: caseDropData.caseName,
                        dropDate: caseDropData.dropDate,
                        price: caseDropData.price,
                        account: caseDropData.account,
                        weekId: targetWeekId,
                        dateAdded: new Date().toISOString()
                    };
                    
                    this.caseDrops.push(caseDrop);
                    importedCount++;
                    
                    await new Promise(resolve => setTimeout(resolve, 1));
                } else {
                    skippedCount++;
                }
                
            } catch (lineError) {
                console.error(`❌ Error processing case drop line ${i + 1}:`, lineError);
                skippedCount++;
            }
        }
        
        await this.saveData();
        this.renderYearTabs();
        this.renderMonthTabs();
        this.renderWeekTabs();
        this.renderCurrentWeek();
        this.showCaseDropSelectors();
        
        this.showNotification(
            `Imported ${importedCount} case drops successfully${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`,
            'success'
        );
    }

    // ============================================================================================
    // CSV PARSING HELPERS
    // ============================================================================================
    
    /**
     * Parses CSV line handling quotes and commas
     * @param {string} line - CSV line to parse
     * @returns {Array} Parsed values array
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim().replace(/^"|"$/g, ''));
        return result;
    }

    /**
     * Parses investment CSV line data
     * @param {Array} values - CSV values array
     * @returns {Object} Investment data object
     */
    parseInvestmentCSVLine(values) {
        return {
            itemName: values[0] || '',
            buyPrice: parseFloat(values[1]) || 0,
            buyDate: values[2] || new Date().toISOString(),
            sellPrice: values[3] ? parseFloat(values[3]) : null,
            sellDate: values[4] || null,
            status: values[7] || (values[3] ? 'sold' : 'holding')
        };
    }

    /**
     * Parses long-term investment CSV line data
     * @param {Array} values - CSV values array
     * @returns {Object} Long-term investment data object
     */
    parseLongTermCSVLine(values) {
        const quantity = parseInt(values[1]) || 1;
        const unitBuyPrice = parseFloat(values[2]) || 0;
        const unitSellPrice = values[5] ? parseFloat(values[5]) : null;
        
        return {
            itemName: values[0] || '',
            quantity: quantity,
            unitBuyPrice: unitBuyPrice,
            totalBuyPrice: parseFloat(values[3]) || (unitBuyPrice * quantity),
            buyDate: values[4] || new Date().toISOString(),
            unitSellPrice: unitSellPrice,
            totalSellPrice: values[6] ? parseFloat(values[6]) : (unitSellPrice ? unitSellPrice * quantity : null),
            sellDate: values[7] || null,
            status: values[10] || (unitSellPrice ? 'sold' : 'holding'),
            profit: parseFloat(values[8]) || (unitSellPrice ? (unitSellPrice - unitBuyPrice) * quantity : 0),
            returnPercentage: parseFloat(values[9]) || (unitSellPrice ? ((unitSellPrice - unitBuyPrice) / unitBuyPrice) * 100 : 0)
        };
    }

    /**
     * Parses case drop CSV line data
     * @param {Array} values - CSV values array
     * @param {Array} headers - CSV headers array
     * @returns {Object} Case drop data object
     */
    parseCaseDropCSVLine(values, headers) {
        const hasYearColumn = headers[0] && headers[0].toLowerCase().trim() === 'year';
        
        if (hasYearColumn && values.length >= 6) {
            // New format: Year, Month, Week, Case Name, Drop Date, Price, Account, Week ID
            return {
                year: parseInt(values[0]) || new Date().getFullYear(),
                monthName: values[1] || 'January',
                weekName: values[2] || 'Week 1',
                caseName: values[3] || '',
                dropDate: values[4] || new Date().toISOString().split('T')[0],
                price: parseFloat(values[5]) || 0,
                account: values[6] || 'Imported'
            };
        } else {
            // Old format: Week, Case Name, Drop Date, Price, Account
            const dropDateObj = new Date(values[2] || new Date().toISOString().split('T')[0]);
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            
            return {
                year: dropDateObj.getFullYear() || new Date().getFullYear(),
                monthName: monthNames[dropDateObj.getMonth()] || 'January',
                weekName: values[0] || 'Week 1',
                caseName: values[1] || '',
                dropDate: values[2] || new Date().toISOString().split('T')[0],
                price: parseFloat(values[3]) || 0,
                account: values[4] || 'Imported'
            };
        }
    }

    /**
     * Finds or creates week structure for case drop import
     * @param {number} year - Year
     * @param {string} monthName - Month name
     * @param {string} weekName - Week name
     * @param {string} dropDate - Drop date
     * @returns {string|null} Week ID or null if failed
     */
    async findOrCreateWeekStructure(year, monthName, weekName, dropDate) {
        try {
            // Find or create year
            let yearData = this.years.find(y => y.year === year);
            if (!yearData) {
                console.log(`📅 Creating new year structure for ${year}`);
                yearData = this.generateYearStructure(year);
                this.years.push(yearData);
                this.years.sort((a, b) => a.year - b.year);
                
                if (!this.currentYear) {
                    this.currentYear = year;
                    this.currentMonth = 0;
                }
            }
            
            // Find month by name
            const monthIndex = yearData.months.findIndex(m => 
                m.name.toLowerCase() === monthName.toLowerCase()
            );
            
            if (monthIndex === -1) {
                console.warn(`❌ Month ${monthName} not found in year ${year}`);
                return null;
            }
            
            const monthData = yearData.months[monthIndex];
            
            // Try to find existing week by name first
            let week = monthData.weeks.find(w => 
                w.name.toLowerCase().includes(weekName.toLowerCase()) || 
                weekName.toLowerCase().includes(w.name.toLowerCase())
            );
            
            if (!week) {
                // Try to find week by drop date
                const dropDateObj = new Date(dropDate);
                week = monthData.weeks.find(w => {
                    const weekStart = new Date(w.startDate);
                    const weekEnd = new Date(w.endDate);
                    return dropDateObj >= weekStart && dropDateObj <= weekEnd;
                });
                
                if (!week && monthData.weeks.length > 0) {
                    // If no exact match, use the first week of the month
                    week = monthData.weeks[0];
                }
            }
            
            if (!week) {
                console.warn(`❌ No weeks found in ${monthName} ${year}`);
                return null;
            }
            
            return week.id;
            
        } catch (error) {
            console.error('❌ Error in findOrCreateWeekStructure:', error);
            return null;
        }
    }

    // ============================================================================================
    // UTILITY HELPERS
    // ============================================================================================
    
    /**
     * Downloads file to user's computer
     * @param {string} content - File content
     * @param {string} filename - File name
     * @param {string} mimeType - MIME type
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    /**
     * Creates Excel file using XLSX library
     * @param {Array} data - 2D array of data
     * @param {string} sheetName - Sheet name
     * @param {string} filename - File name
     */
    createExcelFile(data, sheetName, filename) {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Auto-width columns
        const colWidths = data[0].map((_, colIndex) => {
            return Math.max(...data.map(row => (row[colIndex] || '').toString().length));
        });
        ws['!cols'] = colWidths.map(w => ({ width: w + 2 }));
        
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, filename);
    }

    /**
     * Clears all data of specified type
     * @param {string} type - Data type to clear: 'investments', 'longterm'
     */
    clearAllData(type) {
        const dataTypes = {
            'investments': {
                data: () => this.investments,
                clear: () => { this.investments = []; },
                render: () => this.renderInvestments(),
                message: 'investment data'
            },
            'longterm': {
                data: () => this.longTermInvestments,
                clear: () => { this.longTermInvestments = []; },
                render: () => this.renderLongTermInvestments(),
                message: 'long term investment data'
            }
        };

        const dataType = dataTypes[type];
        if (!dataType) {
            this.showNotification('Unknown data type', 'error');
            return;
        }

        if (dataType.data().length === 0) {
            this.showNotification(`No ${dataType.message} to clear`, 'error');
            return;
        }

        if (confirm(`Are you sure you want to clear all ${dataType.message}? This action cannot be undone.`)) {
            dataType.clear();
            this.saveData();
            dataType.render();
            this.updateMetrics();
            this.updateCharts();
            this.showNotification(`All ${dataType.message} cleared`, 'success');
        }
    }

    /**
     * Clears investment form
     */
    clearForm() {
        const elements = ['itemName', 'buyPrice', 'sellPrice', 'quantity'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });
    
        // Reset category selection
        const categorySelect = document.getElementById('categorySelect');
        if (categorySelect) categorySelect.value = '';
    
        // Reset radio button to default
        document.getElementById('portfolioType').checked = true;
        document.getElementById('longtermType').checked = false;
    
        // Hide quantity and category fields
        document.getElementById('quantityField').classList.add('hidden');
        document.getElementById('categoryField').classList.add('hidden');
        document.getElementById('quantity').required = false;
    
        const buyDateElement = document.getElementById('buyDate');
        if (buyDateElement) {
            buyDateElement.value = new Date().toISOString().split('T')[0];
        }
    }

    // ============================================================================================
    // ENHANCED TRADING DASHBOARD METHODS
    // ============================================================================================

    /**
     * Sets up trading tab event listeners
     */
    setupTradingTabListeners() {
        const tradingTabs = document.querySelectorAll('.trading-tab');
        tradingTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = tab.id.replace('tab-', '');
                this.switchTradingTab(tabId);
            });
        });
    }

    /**
     * Sets up cash management event listeners
     */
    setupCashManagementListeners() {
        this.setupButtonListener('addDepositBtn', () => this.addDeposit());
        this.setupButtonListener('addWithdrawalBtn', () => this.addWithdrawal());
    }

    /**
     * Initializes notification system
     */
    initializeNotifications() {
        if (typeof Notyf !== 'undefined') {
            this.notyf = new Notyf({
                duration: 3000,
                position: { x: 'right', y: 'top' },
                types: [
                    {
                        type: 'success',
                        background: '#22c55e',
                        icon: {
                            className: 'notyf__icon--success',
                            tagName: 'i',
                            text: '✓'
                        }
                    },
                    {
                        type: 'error',
                        background: '#ef4444',
                        icon: {
                            className: 'notyf__icon--error',
                            tagName: 'i',
                            text: '✗'
                        }
                    }
                ]
            });
            console.log('✅ Notification system initialized');
        } else {
            console.warn('⚠️ Notyf not loaded, using fallback notifications');
        }
    }

    /**
     * Initializes trading tabs
     */
    initializeTradingTabs() {
        // Ensure DOM elements exist before initializing
        setTimeout(() => {
            this.switchTradingTab('holdings');
        }, 100);
    }

    /**
     * Initializes Lucide icons
     */
    initializeLucideIcons() {
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
            console.log('✅ Lucide icons initialized');
        } else {
            console.warn('⚠️ Lucide not loaded, icons may not display correctly');
        }
    }

    /**
     * Switches to specified trading tab
     */
    switchTradingTab(tabName) {
        console.log(`🔄 Attempting to switch to trading tab: ${tabName}`);
        
        // Update current tab state
        this.currentTradingTab = tabName;

        // Update tab button styles
        const tradingTabs = document.querySelectorAll('.trading-tab');
        console.log(`Found ${tradingTabs.length} trading tabs`);
        tradingTabs.forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.getElementById(`tab-${tabName}`);
        if (activeTab) {
            activeTab.classList.add('active');
            console.log(`✅ Activated tab button: tab-${tabName}`);
        } else {
            console.warn(`❌ Tab button not found: tab-${tabName}`);
        }

        // Update tab content visibility
        const tabContents = document.querySelectorAll('.tab-content');
        console.log(`Found ${tabContents.length} tab contents`);
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        
        const activeContent = document.getElementById(`content-${tabName}`);
        if (activeContent) {
            activeContent.classList.add('active');
            console.log(`✅ Activated tab content: content-${tabName}`);
        } else {
            console.warn(`❌ Tab content not found: content-${tabName}`);
        }

        // Update tab-specific data
        this.updateTradingTabContent(tabName);

        console.log(`📋 Successfully switched to trading tab: ${tabName}`);
    }

    /**
     * Updates content for specific trading tab
     */
    updateTradingTabContent(tabName) {
        switch (tabName) {
            case 'holdings':
                this.updateHoldingsTab();
                break;
            case 'performance':
                this.updatePerformanceTab();
                break;
            case 'account':
                this.updateAccountTab();
                break;
        }
    }

    /**
     * Updates Holdings tab content
     */
    updateHoldingsTab() {
        const holdings = this.investments.filter(inv => !inv.sellPrice);
        
        // Update metrics
        const totalItems = holdings.length;
        const invested = holdings.reduce((sum, inv) => sum + inv.buyPrice, 0);
        const currentValue = invested; // TODO: Add real-time pricing
        const unrealizedPnL = currentValue - invested;

        this.updateElement('holdingsTotalItems', totalItems);
        this.updateElement('holdingsInvested', `$${this.formatNumber(invested)}`);
        this.updateElement('holdingsCurrentValue', `$${this.formatNumber(currentValue)}`);
        this.updateElement('holdingsUnrealizedPnL', `$${this.formatNumber(unrealizedPnL)}`, 
                          unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400');

        // Update holdings table
        this.renderHoldingsTable(holdings);

        // Update holdings chart
        this.updateHoldingsChart(holdings);
    }

    /**
     * Updates Performance tab content
     */
    updatePerformanceTab() {
        const completedTrades = this.investments.filter(inv => inv.sellPrice);
        
        // Calculate performance metrics
        const totalTrades = completedTrades.length;
        const winningTrades = completedTrades.filter(inv => inv.sellPrice > inv.buyPrice).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        const totalProfit = completedTrades.reduce((sum, inv) => sum + (inv.sellPrice - inv.buyPrice), 0);
        const avgProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;
        const avgReturn = totalTrades > 0 ? completedTrades.reduce((sum, inv) => 
            sum + this.calculateReturnPercentage(inv.buyPrice, inv.sellPrice), 0) / totalTrades : 0;

        // Update performance metrics
        this.updateElement('performanceTotalTrades', totalTrades);
        this.updateElement('performanceWinRate', `${this.formatNumber(winRate)}%`, 
                          winRate >= 50 ? 'text-green-400' : 'text-red-400');
        this.updateElement('performanceAvgProfit', `$${this.formatNumber(avgProfit)}`,
                          avgProfit >= 0 ? 'text-green-400' : 'text-red-400');
        this.updateElement('performanceTotalProfit', `$${this.formatNumber(totalProfit)}`,
                          totalProfit >= 0 ? 'text-green-400' : 'text-red-400');
        this.updateElement('performanceAvgReturn', `${this.formatNumber(avgReturn)}%`,
                          avgReturn >= 0 ? 'text-green-400' : 'text-red-400');

        // Update performance charts
        this.updatePerformanceCharts();

        // Update trade history table
        this.renderTradeHistoryTable(completedTrades);
    }

    /**
     * Updates Account tab content with enhanced trading analytics
     */
    updateAccountTab() {
        // Calculate advanced trading metrics
        const tradingMetrics = this.calculateTradingMetrics();
        
        // Update Trading Capital KPIs
        this.updateElement('availableCapital', `$${this.formatNumber(tradingMetrics.availableCapital)}`);
        this.updateElement('capitalInUse', `$${this.formatNumber(tradingMetrics.capitalInUse)}`);
        this.updateElement('capitalEfficiency', `${tradingMetrics.capitalEfficiency}x`);
        this.updateElement('riskExposure', `${tradingMetrics.riskExposure}%`);
        
        // Update Professional P&L Analysis
        this.updateElement('realizedPnL', `$${this.formatNumber(tradingMetrics.realizedPnL)}`,
                          tradingMetrics.realizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400');
        this.updateElement('unrealizedPnL', `$${this.formatNumber(tradingMetrics.unrealizedPnL)}`,
                          tradingMetrics.unrealizedPnL >= 0 ? 'text-cyan-400' : 'text-red-400');
        this.updateElement('tradingVelocity', tradingMetrics.tradingVelocity.toFixed(1));
        this.updateElement('profitFactor', tradingMetrics.profitFactor.toFixed(1));
        
        // Update enhanced charts
        this.updateEnhancedAccountCharts();
        
        // Update intelligent insights
        this.updateTradingInsights(tradingMetrics);
    }
    
    /**
     * Calculate advanced trading metrics for professional traders
     */
    calculateTradingMetrics() {
        // Get unsold holdings (capital in use)
        const activeHoldings = this.investments.filter(inv => !inv.sellPrice);
        const capitalInUse = activeHoldings.reduce((sum, inv) => sum + (inv.buyPrice || 0), 0);
        
        // Available capital = account balance (assuming account balance is free cash)
        const availableCapital = this.accountBalance;
        
        // Total capital = available + in use
        const totalCapital = availableCapital + capitalInUse;
        
        // Risk exposure = (capital in use / total capital) * 100
        const riskExposure = totalCapital > 0 ? ((capitalInUse / totalCapital) * 100) : 0;
        
        // Calculate realized P&L from completed trades
        const completedTrades = this.investments.filter(inv => inv.sellPrice);
        const realizedPnL = completedTrades.reduce((sum, inv) => {
            return sum + ((inv.sellPrice || 0) - (inv.buyPrice || 0));
        }, 0);
        
        // Calculate unrealized P&L from current holdings (assuming current value = buy price + 5% for demo)
        const unrealizedPnL = activeHoldings.reduce((sum, inv) => {
            const currentValue = (inv.buyPrice || 0) * 1.05; // Demo assumption
            return sum + (currentValue - (inv.buyPrice || 0));
        }, 0);
        
        // Calculate trading velocity (trades per week)
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const recentTrades = completedTrades.filter(inv => {
            const sellDate = new Date(inv.sellDate || inv.date);
            return sellDate >= thirtyDaysAgo;
        });
        const tradingVelocity = (recentTrades.length / 30) * 7; // trades per week
        
        // Calculate profit factor (gross profits / gross losses)
        let grossProfits = 0;
        let grossLosses = 0;
        completedTrades.forEach(inv => {
            const profit = (inv.sellPrice || 0) - (inv.buyPrice || 0);
            if (profit > 0) {
                grossProfits += profit;
            } else {
                grossLosses += Math.abs(profit);
            }
        });
        const profitFactor = grossLosses > 0 ? (grossProfits / grossLosses) : (grossProfits > 0 ? 999 : 0);
        
        // Calculate capital efficiency (total traded value / average capital balance)
        const totalTradedValue = completedTrades.reduce((sum, inv) => sum + (inv.sellPrice || 0), 0);
        const avgCapitalBalance = (totalCapital || 1000); // Default assumption
        const capitalEfficiency = avgCapitalBalance > 0 ? (totalTradedValue / avgCapitalBalance) : 0;
        
        return {
            availableCapital,
            capitalInUse,
            capitalEfficiency: Math.max(0, capitalEfficiency.toFixed(1)),
            riskExposure: Math.min(100, Math.max(0, riskExposure.toFixed(0))),
            realizedPnL,
            unrealizedPnL,
            tradingVelocity: Math.max(0, tradingVelocity),
            profitFactor: Math.max(0, profitFactor),
            totalCapital,
            completedTrades,
            activeHoldings,
            grossProfits,
            grossLosses
        };
    }

    /**
     * Helper method to update element content and styling
     */
    updateElement(id, content, className = '') {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = content;
            if (className) {
                element.className = element.className.replace(/text-(green|red|blue)-\d+/g, '') + ' ' + className;
            }
        }
    }

    /**
     * Updates the main trading dashboard
     */
    updateTradingDashboard() {
        this.updateTradingTabContent(this.currentTradingTab);
    }

    /**
     * Adds a deposit to the account
     */
    addDeposit() {
        const amount = parseFloat(document.getElementById('depositAmount').value);
        const note = document.getElementById('depositNote').value;

        if (!amount || amount <= 0) {
            this.showNotification('Please enter a valid deposit amount', 'error');
            return;
        }

        const deposit = {
            id: Date.now().toString(),
            amount: amount,
            note: note || '',
            date: new Date().toISOString(),
            type: 'deposit'
        };

        this.deposits.push(deposit);
        this.accountBalance += amount;
        this.saveData();

        // Clear form
        document.getElementById('depositAmount').value = '';
        document.getElementById('depositNote').value = '';

        // Update display
        this.updateAccountTab();
        
        this.showNotification(`Successfully added deposit of $${this.formatNumber(amount)}`, 'success');
    }

    /**
     * Adds a withdrawal from the account
     */
    addWithdrawal() {
        const amount = parseFloat(document.getElementById('withdrawalAmount').value);
        const note = document.getElementById('withdrawalNote').value;

        if (!amount || amount <= 0) {
            this.showNotification('Please enter a valid withdrawal amount', 'error');
            return;
        }

        if (amount > this.accountBalance) {
            this.showNotification('Insufficient account balance', 'error');
            return;
        }

        const withdrawal = {
            id: Date.now().toString(),
            amount: amount,
            note: note || '',
            date: new Date().toISOString(),
            type: 'withdrawal'
        };

        this.withdrawals.push(withdrawal);
        this.accountBalance -= amount;
        this.saveData();

        // Clear form
        document.getElementById('withdrawalAmount').value = '';
        document.getElementById('withdrawalNote').value = '';

        // Update display
        this.updateAccountTab();

        this.showNotification(`Successfully added withdrawal of $${this.formatNumber(amount)}`, 'success');
    }

    /**
     * Enhanced notification with Notyf fallback
     */
    showNotification(message, type = 'info') {
        if (this.notyf) {
            this.notyf.open({ type, message });
        } else {
            // Fallback to existing notification system
            const notification = document.createElement('div');
            const bgColor = type === 'success' ? 'bg-green-600' : 
                            type === 'error' ? 'bg-red-600' : 'bg-blue-600';
            
            notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-sm`;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }
    }

    /**
     * Renders holdings table
     */
    renderHoldingsTable(holdings) {
        const table = document.getElementById('holdingsTable');
        if (!table) return;

        if (holdings.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-8 text-gray-400">
                        No active holdings
                    </td>
                </tr>
            `;
            return;
        }

        table.innerHTML = holdings.map(holding => `
            <tr class="border-b border-gray-700 hover:bg-gray-800/50 transition-colors">
                <td class="py-3 px-4 text-left">${this.escapeHtml(holding.itemName)}</td>
                <td class="py-3 px-4 text-center">$${this.formatNumber(holding.buyPrice)}</td>
                <td class="py-3 px-4 text-center">$${this.formatNumber(holding.buyPrice)}</td>
                <td class="py-3 px-4 text-center text-gray-400">$0.00</td>
                <td class="py-3 px-4 text-center">
                    <button class="btn-primary text-xs py-1 px-3 rounded" onclick="investmentTracker.quickSell('${holding.id}')">
                        Quick Sell
                    </button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Renders trade history table
     */
    renderTradeHistoryTable(trades) {
        const table = document.getElementById('tradeHistoryTable');
        if (!table) return;

        if (trades.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-8 text-gray-400">
                        No completed trades yet
                    </td>
                </tr>
            `;
            return;
        }

        table.innerHTML = trades.map(trade => {
            const profit = trade.sellPrice - trade.buyPrice;
            const returnPct = this.calculateReturnPercentage(trade.buyPrice, trade.sellPrice);
            const profitClass = profit >= 0 ? 'text-green-400' : 'text-red-400';
            
            return `
                <tr class="border-b border-gray-700 hover:bg-gray-800/50 transition-colors">
                    <td class="py-3 px-4 text-left">${this.escapeHtml(trade.itemName)}</td>
                    <td class="py-3 px-4 text-center">$${this.formatNumber(trade.buyPrice)}</td>
                    <td class="py-3 px-4 text-center">$${this.formatNumber(trade.sellPrice)}</td>
                    <td class="py-3 px-4 text-center ${profitClass}">$${this.formatNumber(profit)}</td>
                    <td class="py-3 px-4 text-center ${profitClass}">${this.formatNumber(returnPct)}%</td>
                    <td class="py-3 px-4 text-center text-sm text-gray-400">${trade.sellDate || 'N/A'}</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Updates holdings chart with ApexCharts pie chart
     */
    updateHoldingsChart(holdings) {
        if (typeof ApexCharts === 'undefined') {
            console.warn('❌ ApexCharts not loaded');
            return;
        }

        const chartElement = document.getElementById('holdingsDistributionChart');
        if (!chartElement) {
            console.warn('❌ Holdings chart container not found');
            return;
        }

        // Destroy existing chart
        if (this.charts.holdingsDistribution) {
            this.charts.holdingsDistribution.destroy();
        }

        if (holdings.length === 0) {
            chartElement.innerHTML = '<div class="text-center text-gray-400 py-12">No holdings to display</div>';
            return;
        }

        // Prepare data for pie chart
        const chartData = holdings.map(holding => ({
            name: holding.itemName.length > 20 ? holding.itemName.substring(0, 20) + '...' : holding.itemName,
            value: holding.buyPrice
        }));

        const options = {
            series: chartData.map(item => item.value),
            labels: chartData.map(item => item.name),
            chart: {
                type: 'pie',
                height: 300,
                background: 'transparent',
                toolbar: {
                    show: false
                }
            },
            colors: ['#667eea', '#764ba2', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'],
            legend: {
                show: true,
                position: 'bottom',
                labels: {
                    colors: '#d1d5db'
                }
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: '40%'
                    }
                }
            },
            dataLabels: {
                enabled: true,
                formatter: function(val) {
                    return val.toFixed(1) + '%';
                },
                style: {
                    colors: ['#ffffff']
                }
            },
            tooltip: {
                theme: 'dark',
                y: {
                    formatter: function(val) {
                        return '$' + val.toFixed(2);
                    }
                }
            },
            responsive: [{
                breakpoint: 480,
                options: {
                    chart: {
                        height: 250
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }]
        };

        this.charts.holdingsDistribution = new ApexCharts(chartElement, options);
        this.charts.holdingsDistribution.render();
        
        console.log('📊 Holdings distribution chart updated');
    }

    /**
     * Updates performance charts with ApexCharts
     */
    updatePerformanceCharts() {
        this.updateDailyPnLChart();
        this.updateWinLossChart();
    }

    /**
     * Updates Daily P&L chart
     */
    updateDailyPnLChart() {
        if (typeof ApexCharts === 'undefined') {
            console.warn('❌ ApexCharts not loaded');
            return;
        }

        const chartElement = document.getElementById('dailyPnLChart');
        if (!chartElement) {
            console.warn('❌ Daily P&L chart container not found');
            return;
        }

        // Destroy existing chart
        if (this.charts.dailyPnL) {
            this.charts.dailyPnL.destroy();
        }

        const completedTrades = this.investments.filter(inv => inv.sellPrice);
        
        if (completedTrades.length === 0) {
            chartElement.innerHTML = '<div class="text-center text-gray-400 py-12">No trades to display</div>';
            return;
        }

        // Group trades by date and calculate daily P&L
        const dailyPnL = {};
        completedTrades.forEach(trade => {
            const date = trade.sellDate || new Date().toISOString().split('T')[0];
            const profit = trade.sellPrice - trade.buyPrice;
            
            if (!dailyPnL[date]) {
                dailyPnL[date] = 0;
            }
            dailyPnL[date] += profit;
        });

        // Convert to chart data
        const sortedDates = Object.keys(dailyPnL).sort();
        const chartData = sortedDates.map(date => ({
            x: date,
            y: dailyPnL[date]
        }));

        const options = {
            series: [{
                name: 'Daily P&L',
                data: chartData
            }],
            chart: {
                type: 'line',
                height: 300,
                background: 'transparent',
                toolbar: {
                    show: true,
                    tools: {
                        zoom: true,
                        pan: true,
                        reset: true
                    }
                }
            },
            colors: ['#667eea'],
            stroke: {
                curve: 'smooth',
                width: 3
            },
            grid: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                strokeDashArray: 0,
                xaxis: {
                    lines: {
                        show: true
                    }
                },
                yaxis: {
                    lines: {
                        show: true
                    }
                }
            },
            xaxis: {
                type: 'datetime',
                labels: {
                    style: {
                        colors: '#d1d5db'
                    }
                }
            },
            yaxis: {
                labels: {
                    style: {
                        colors: '#d1d5db'
                    },
                    formatter: function(val) {
                        return '$' + val.toFixed(2);
                    }
                }
            },
            tooltip: {
                theme: 'dark',
                y: {
                    formatter: function(val) {
                        return '$' + val.toFixed(2);
                    }
                }
            },
            markers: {
                size: 4,
                colors: ['#667eea'],
                strokeColors: '#fff',
                strokeWidth: 2,
                hover: {
                    size: 6
                }
            }
        };

        this.charts.dailyPnL = new ApexCharts(chartElement, options);
        this.charts.dailyPnL.render();
        
        console.log('📊 Daily P&L chart updated');
    }

    /**
     * Updates Win/Loss distribution chart
     */
    updateWinLossChart() {
        if (typeof ApexCharts === 'undefined') {
            console.warn('❌ ApexCharts not loaded');
            return;
        }

        const chartElement = document.getElementById('winLossChart');
        if (!chartElement) {
            console.warn('❌ Win/Loss chart container not found');
            return;
        }

        // Destroy existing chart
        if (this.charts.winLoss) {
            this.charts.winLoss.destroy();
        }

        const completedTrades = this.investments.filter(inv => inv.sellPrice);
        
        if (completedTrades.length === 0) {
            chartElement.innerHTML = '<div class="text-center text-gray-400 py-12">No trades to display</div>';
            return;
        }

        const winningTrades = completedTrades.filter(trade => trade.sellPrice > trade.buyPrice).length;
        const losingTrades = completedTrades.length - winningTrades;

        const options = {
            series: [winningTrades, losingTrades],
            labels: ['Winning Trades', 'Losing Trades'],
            chart: {
                type: 'pie',
                height: 300,
                background: 'transparent',
                toolbar: {
                    show: false
                }
            },
            colors: ['#22c55e', '#ef4444'],
            legend: {
                show: true,
                position: 'bottom',
                labels: {
                    colors: '#d1d5db'
                }
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: '50%',
                        labels: {
                            show: true,
                            total: {
                                show: true,
                                label: 'Win Rate',
                                formatter: function(w) {
                                    const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                    const winRate = ((winningTrades / total) * 100).toFixed(1);
                                    return winRate + '%';
                                },
                                style: {
                                    color: '#d1d5db'
                                }
                            }
                        }
                    }
                }
            },
            dataLabels: {
                enabled: true,
                formatter: function(val) {
                    return val.toFixed(1) + '%';
                },
                style: {
                    colors: ['#ffffff']
                }
            },
            tooltip: {
                theme: 'dark',
                y: {
                    formatter: function(val) {
                        return val + ' trades';
                    }
                }
            }
        };

        this.charts.winLoss = new ApexCharts(chartElement, options);
        this.charts.winLoss.render();
        
        console.log('📊 Win/Loss chart updated');
    }

    /**
     * Updates account charts with ApexCharts
     */
    updateEnhancedAccountCharts() {
        this.updateCapitalFlowChart();
        this.updateRiskRewardChart();
        this.updateProfitHeatmapChart();
        this.updateActivityTimelineChart();
    }

    /**
     * Updates Account Balance Over Time chart
     */
    updateAccountBalanceChart() {
        if (typeof ApexCharts === 'undefined') {
            console.warn('❌ ApexCharts not loaded');
            return;
        }

        const chartElement = document.getElementById('accountBalanceChart');
        if (!chartElement) {
            console.warn('❌ Account balance chart container not found');
            return;
        }

        // Destroy existing chart
        if (this.charts.accountBalance) {
            this.charts.accountBalance.destroy();
        }

        // Create timeline data from deposits, withdrawals, and trades
        const events = [];
        
        // Add deposits
        this.deposits.forEach(deposit => {
            events.push({
                date: deposit.date,
                amount: deposit.amount,
                type: 'deposit',
                description: `Deposit: ${deposit.note || 'Manual deposit'}`
            });
        });

        // Add withdrawals
        this.withdrawals.forEach(withdrawal => {
            events.push({
                date: withdrawal.date,
                amount: -withdrawal.amount,
                type: 'withdrawal',
                description: `Withdrawal: ${withdrawal.note || 'Manual withdrawal'}`
            });
        });

        // Add completed trades
        const completedTrades = this.investments.filter(inv => inv.sellPrice);
        completedTrades.forEach(trade => {
            const profit = trade.sellPrice - trade.buyPrice;
            events.push({
                date: trade.sellDate || new Date().toISOString(),
                amount: profit,
                type: 'trade',
                description: `Trade: ${trade.itemName}`
            });
        });

        if (events.length === 0) {
            chartElement.innerHTML = '<div class="text-center text-gray-400 py-12">No account activity to display</div>';
            return;
        }

        // Sort events by date and calculate running balance
        events.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let runningBalance = 0;
        const chartData = events.map(event => {
            runningBalance += event.amount;
            return {
                x: event.date,
                y: runningBalance
            };
        });

        const options = {
            series: [{
                name: 'Account Balance',
                data: chartData
            }],
            chart: {
                type: 'area',
                height: 300,
                background: 'transparent',
                toolbar: {
                    show: true,
                    tools: {
                        zoom: true,
                        pan: true,
                        reset: true
                    }
                }
            },
            colors: ['#667eea'],
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.7,
                    opacityTo: 0.1,
                    stops: [0, 100]
                }
            },
            stroke: {
                curve: 'smooth',
                width: 2
            },
            grid: {
                borderColor: 'rgba(255, 255, 255, 0.1)'
            },
            xaxis: {
                type: 'datetime',
                labels: {
                    style: {
                        colors: '#d1d5db'
                    }
                }
            },
            yaxis: {
                labels: {
                    style: {
                        colors: '#d1d5db'
                    },
                    formatter: function(val) {
                        return '$' + val.toFixed(2);
                    }
                }
            },
            tooltip: {
                theme: 'dark',
                y: {
                    formatter: function(val) {
                        return '$' + val.toFixed(2);
                    }
                }
            }
        };

        this.charts.accountBalance = new ApexCharts(chartElement, options);
        this.charts.accountBalance.render();
        
        console.log('📊 Account balance chart updated');
    }

    /**
     * Updates Cash Flow chart
     */
    updateCashFlowChart() {
        if (typeof ApexCharts === 'undefined') {
            console.warn('❌ ApexCharts not loaded');
            return;
        }

        const chartElement = document.getElementById('cashFlowChart');
        if (!chartElement) {
            console.warn('❌ Cash flow chart container not found');
            return;
        }

        // Destroy existing chart
        if (this.charts.cashFlow) {
            this.charts.cashFlow.destroy();
        }

        const totalDeposits = this.deposits.reduce((sum, dep) => sum + dep.amount, 0);
        const totalWithdrawals = this.withdrawals.reduce((sum, wit) => sum + wit.amount, 0);
        const completedTrades = this.investments.filter(inv => inv.sellPrice);
        const totalTradingProfit = completedTrades.reduce((sum, trade) => sum + (trade.sellPrice - trade.buyPrice), 0);

        if (totalDeposits === 0 && totalWithdrawals === 0 && totalTradingProfit === 0) {
            chartElement.innerHTML = '<div class="text-center text-gray-400 py-12">No cash flow data to display</div>';
            return;
        }

        const options = {
            series: [{
                name: 'Cash Flow',
                data: [
                    { x: 'Deposits', y: totalDeposits },
                    { x: 'Trading Profit', y: totalTradingProfit },
                    { x: 'Withdrawals', y: -totalWithdrawals }
                ]
            }],
            chart: {
                type: 'bar',
                height: 300,
                background: 'transparent',
                toolbar: {
                    show: false
                }
            },
            colors: function({value, seriesIndex, dataPointIndex, w}) {
                if (value > 0) {
                    return '#22c55e'; // Green for positive
                } else {
                    return '#ef4444'; // Red for negative
                }
            },
            plotOptions: {
                bar: {
                    columnWidth: '60%',
                    distributed: true
                }
            },
            grid: {
                borderColor: 'rgba(255, 255, 255, 0.1)'
            },
            xaxis: {
                labels: {
                    style: {
                        colors: '#d1d5db'
                    }
                }
            },
            yaxis: {
                labels: {
                    style: {
                        colors: '#d1d5db'
                    },
                    formatter: function(val) {
                        return '$' + val.toFixed(2);
                    }
                }
            },
            tooltip: {
                theme: 'dark',
                y: {
                    formatter: function(val) {
                        return '$' + Math.abs(val).toFixed(2);
                    }
                }
            },
            legend: {
                show: false
            }
        };

        this.charts.cashFlow = new ApexCharts(chartElement, options);
        this.charts.cashFlow.render();
        
        console.log('📊 Cash flow chart updated');
    }

    /**
     * Updates Trading Capital Flow chart
     */
    updateCapitalFlowChart() {
        if (typeof ApexCharts === 'undefined') {
            console.warn('❌ ApexCharts not loaded');
            return;
        }

        const chartElement = document.getElementById('capitalFlowChart');
        if (!chartElement) {
            console.warn('❌ Capital flow chart container not found');
            return;
        }

        // Destroy existing chart
        if (this.charts.capitalFlow) {
            this.charts.capitalFlow.destroy();
        }

        const tradingMetrics = this.calculateTradingMetrics();
        
        if (tradingMetrics.totalCapital === 0) {
            chartElement.innerHTML = '<div class="text-center text-gray-400 py-12">No capital data to display</div>';
            return;
        }

        const options = {
            series: [{
                name: 'Available Capital',
                data: [tradingMetrics.availableCapital]
            }, {
                name: 'Capital in Use',
                data: [tradingMetrics.capitalInUse]
            }],
            chart: {
                type: 'area',
                height: 280,
                background: 'transparent',
                stacked: true,
                toolbar: { show: false }
            },
            colors: ['#22c55e', '#3b82f6'],
            stroke: {
                width: 2,
                curve: 'smooth'
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.7,
                    opacityTo: 0.3
                }
            },
            xaxis: {
                categories: ['Current'],
                labels: { style: { colors: '#9ca3af' } }
            },
            yaxis: {
                labels: {
                    style: { colors: '#9ca3af' },
                    formatter: (val) => `$${this.formatNumber(val)}`
                }
            },
            tooltip: {
                theme: 'dark',
                y: {
                    formatter: (val) => `$${this.formatNumber(val)}`
                }
            },
            legend: {
                labels: { colors: '#9ca3af' }
            },
            grid: {
                borderColor: '#374151',
                strokeDashArray: 3
            }
        };

        this.charts.capitalFlow = new ApexCharts(chartElement, options);
        this.charts.capitalFlow.render();
        
        console.log('📊 Capital flow chart updated');
    }

    /**
     * Updates Risk vs Reward scatter chart
     */
    updateRiskRewardChart() {
        if (typeof ApexCharts === 'undefined') {
            console.warn('❌ ApexCharts not loaded');
            return;
        }

        const chartElement = document.getElementById('riskRewardChart');
        if (!chartElement) {
            console.warn('❌ Risk reward chart container not found');
            return;
        }

        // Destroy existing chart
        if (this.charts.riskReward) {
            this.charts.riskReward.destroy();
        }

        const completedTrades = this.investments.filter(inv => inv.sellPrice);
        
        if (completedTrades.length === 0) {
            chartElement.innerHTML = '<div class="text-center text-gray-400 py-12">No completed trades to analyze</div>';
            return;
        }

        const scatterData = completedTrades.map(trade => {
            const risk = trade.buyPrice || 0;
            const reward = (trade.sellPrice || 0) - (trade.buyPrice || 0);
            return { x: risk, y: reward };
        });

        const options = {
            series: [{
                name: 'Trades',
                data: scatterData
            }],
            chart: {
                type: 'scatter',
                height: 280,
                background: 'transparent',
                toolbar: { show: false },
                zoom: { enabled: true }
            },
            colors: ['#8b5cf6'],
            xaxis: {
                title: {
                    text: 'Risk (Buy Price)',
                    style: { color: '#9ca3af' }
                },
                labels: {
                    style: { colors: '#9ca3af' },
                    formatter: (val) => `$${this.formatNumber(val)}`
                }
            },
            yaxis: {
                title: {
                    text: 'Reward (P&L)',
                    style: { color: '#9ca3af' }
                },
                labels: {
                    style: { colors: '#9ca3af' },
                    formatter: (val) => `$${this.formatNumber(val)}`
                }
            },
            tooltip: {
                theme: 'dark',
                x: {
                    formatter: (val) => `Risk: $${this.formatNumber(val)}`
                },
                y: {
                    formatter: (val) => `Reward: $${this.formatNumber(val)}`
                }
            },
            grid: {
                borderColor: '#374151',
                strokeDashArray: 3
            }
        };

        this.charts.riskReward = new ApexCharts(chartElement, options);
        this.charts.riskReward.render();
        
        console.log('📊 Risk vs Reward chart updated');
    }

    /**
     * Updates Profit Distribution Heatmap
     */
    updateProfitHeatmapChart() {
        const chartElement = document.getElementById('profitHeatmapChart');
        if (!chartElement) {
            console.warn('❌ Profit heatmap chart container not found');
            return;
        }

        const completedTrades = this.investments.filter(inv => inv.sellPrice);
        
        if (completedTrades.length === 0) {
            chartElement.innerHTML = '<div class="text-center text-gray-400 py-12">No trading data for heatmap</div>';
            return;
        }

        // For demo, show a simple distribution
        chartElement.innerHTML = `
            <div class="grid grid-cols-7 gap-1 p-4">
                <div class="text-xs text-gray-400 text-center">Daily Profit Distribution</div>
                <div class="col-span-6"></div>
                ${Array.from({length: 35}, (_, i) => {
                    const profit = Math.random() * 200 - 100;
                    const intensity = Math.abs(profit) / 100;
                    const color = profit > 0 ? `bg-green-500` : `bg-red-500`;
                    return `<div class="${color}" style="opacity: ${intensity}" title="$${profit.toFixed(2)}" class="w-4 h-4 rounded-sm"></div>`;
                }).join('')}
            </div>
        `;
        
        console.log('📊 Profit heatmap chart updated');
    }

    /**
     * Updates Trading Activity Timeline
     */
    updateActivityTimelineChart() {
        if (typeof ApexCharts === 'undefined') {
            console.warn('❌ ApexCharts not loaded');
            return;
        }

        const chartElement = document.getElementById('activityTimelineChart');
        if (!chartElement) {
            console.warn('❌ Activity timeline chart container not found');
            return;
        }

        // Destroy existing chart
        if (this.charts.activityTimeline) {
            this.charts.activityTimeline.destroy();
        }

        const completedTrades = this.investments.filter(inv => inv.sellPrice);
        
        if (completedTrades.length === 0) {
            chartElement.innerHTML = '<div class="text-center text-gray-400 py-12">No trading activity to display</div>';
            return;
        }

        // Group trades by date
        const tradesByDate = {};
        completedTrades.forEach(trade => {
            const date = new Date(trade.sellDate || trade.date).toDateString();
            if (!tradesByDate[date]) {
                tradesByDate[date] = { count: 0, profit: 0 };
            }
            tradesByDate[date].count++;
            tradesByDate[date].profit += (trade.sellPrice - trade.buyPrice);
        });

        const dates = Object.keys(tradesByDate).sort();
        const volumes = dates.map(date => tradesByDate[date].count);
        const profits = dates.map(date => tradesByDate[date].profit);

        const options = {
            series: [{
                name: 'Trade Volume',
                type: 'column',
                data: volumes
            }, {
                name: 'Daily P&L',
                type: 'line',
                data: profits
            }],
            chart: {
                type: 'line',
                height: 280,
                background: 'transparent',
                toolbar: { show: false }
            },
            colors: ['#f59e0b', '#22c55e'],
            stroke: {
                width: [0, 3],
                curve: 'smooth'
            },
            xaxis: {
                categories: dates.map(date => new Date(date).toLocaleDateString()),
                labels: { style: { colors: '#9ca3af' } }
            },
            yaxis: [{
                title: {
                    text: 'Trade Volume',
                    style: { color: '#9ca3af' }
                },
                labels: { style: { colors: '#9ca3af' } }
            }, {
                opposite: true,
                title: {
                    text: 'Daily P&L',
                    style: { color: '#9ca3af' }
                },
                labels: {
                    style: { colors: '#9ca3af' },
                    formatter: (val) => `$${this.formatNumber(val)}`
                }
            }],
            tooltip: {
                theme: 'dark',
                y: [{
                    formatter: (val) => `${val} trades`
                }, {
                    formatter: (val) => `$${this.formatNumber(val)}`
                }]
            },
            legend: {
                labels: { colors: '#9ca3af' }
            },
            grid: {
                borderColor: '#374151',
                strokeDashArray: 3
            }
        };

        this.charts.activityTimeline = new ApexCharts(chartElement, options);
        this.charts.activityTimeline.render();
        
        console.log('📊 Activity timeline chart updated');
    }

    /**
     * Updates intelligent trading insights
     */
    updateTradingInsights(tradingMetrics) {
        const insightsContainer = document.getElementById('tradingInsights');
        if (!insightsContainer) {
            return;
        }

        const insights = this.generateTradingInsights(tradingMetrics);
        
        insightsContainer.innerHTML = insights.map(insight => `
            <div class="flex items-start gap-3 p-4 bg-gray-800/50 rounded-lg">
                <i data-lucide="${insight.icon}" class="w-5 h-5 ${insight.color} mt-0.5"></i>
                <div>
                    <div class="text-sm font-medium text-gray-200">${insight.title}</div>
                    <div class="text-xs text-gray-400 mt-1">${insight.description}</div>
                </div>
            </div>
        `).join('');

        // Re-initialize lucide icons for the new content
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Generate intelligent trading insights based on metrics
     */
    generateTradingInsights(metrics) {
        const insights = [];

        // Capital efficiency insight
        if (metrics.capitalEfficiency > 2) {
            insights.push({
                icon: 'zap',
                color: 'text-green-400',
                title: 'Excellent Capital Efficiency',
                description: `Your ${metrics.capitalEfficiency}x turnover rate shows efficient capital usage`
            });
        } else if (metrics.capitalEfficiency > 0) {
            insights.push({
                icon: 'trending-up',
                color: 'text-yellow-400',
                title: 'Moderate Capital Efficiency',
                description: `Consider increasing trading frequency to improve your ${metrics.capitalEfficiency}x turnover`
            });
        }

        // Risk exposure insight
        if (metrics.riskExposure > 80) {
            insights.push({
                icon: 'alert-triangle',
                color: 'text-red-400',
                title: 'High Risk Exposure',
                description: `${metrics.riskExposure}% of capital at risk - consider diversifying or reducing position sizes`
            });
        } else if (metrics.riskExposure < 30) {
            insights.push({
                icon: 'shield-check',
                color: 'text-green-400',
                title: 'Conservative Risk Profile',
                description: `Your ${metrics.riskExposure}% risk exposure is very conservative - could potentially increase for higher returns`
            });
        }

        // Profit factor insight
        if (metrics.profitFactor > 2) {
            insights.push({
                icon: 'trophy',
                color: 'text-gold-400',
                title: 'Excellent Profit Factor',
                description: `Your ${metrics.profitFactor.toFixed(1)} profit factor indicates strong trading performance`
            });
        } else if (metrics.profitFactor < 1 && metrics.completedTrades.length > 5) {
            insights.push({
                icon: 'trending-down',
                color: 'text-red-400',
                title: 'Review Trading Strategy',
                description: `Profit factor of ${metrics.profitFactor.toFixed(1)} suggests losses exceed profits`
            });
        }

        // Trading velocity insight
        if (metrics.tradingVelocity > 10) {
            insights.push({
                icon: 'clock',
                color: 'text-blue-400',
                title: 'High Trading Activity',
                description: `${metrics.tradingVelocity.toFixed(1)} trades per week - ensure you're not overtrading`
            });
        } else if (metrics.tradingVelocity < 1 && metrics.activeHoldings.length > 0) {
            insights.push({
                icon: 'clock',
                color: 'text-yellow-400',
                title: 'Low Trading Velocity',
                description: `Consider increasing trading frequency to improve capital turnover`
            });
        }

        // Default insight if no data
        if (insights.length === 0) {
            insights.push({
                icon: 'lightbulb',
                color: 'text-yellow-400',
                title: 'Start Trading for Insights',
                description: 'Complete more trades to unlock personalized performance insights'
            });
        }

        return insights;
    }

    /**
     * Quick sell functionality
     */
    quickSell(investmentId) {
        const investment = this.investments.find(inv => inv.id === investmentId);
        if (!investment) return;

        const sellPrice = prompt(`Quick sell ${investment.itemName}?\nEnter sell price:`, investment.buyPrice);
        if (!sellPrice || sellPrice <= 0) return;

        investment.sellPrice = parseFloat(sellPrice);
        investment.sellDate = new Date().toISOString().split('T')[0];
        
        this.saveData();
        this.updateTradingDashboard();
        
        const profit = investment.sellPrice - investment.buyPrice;
        const profitText = profit >= 0 ? `profit of $${this.formatNumber(profit)}` : `loss of $${this.formatNumber(Math.abs(profit))}`;
        
        this.showNotification(`Sold ${investment.itemName} with ${profitText}`, profit >= 0 ? 'success' : 'error');
    }
    
}


// Fix for Modal (forces modals to be appended to body)
document.addEventListener('DOMContentLoaded', function() {
    const modals = ['editModal', 'editLongTermModal', 'editCaseDropModal', 'addYearModal', 'addWeekModal'];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal && modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
    });
});

// ============================================================================================
// INITIALIZATION
// ============================================================================================

/**
 * Global investment tracker instance
 */
let investmentTracker = null;

/**
 * Initializes the investment tracker application
 */
function initializeInvestmentTracker() {
    if (!investmentTracker) {
        investmentTracker = new InvestmentTracker();
        // Make it available globally for onclick handlers
        window.investmentTracker = investmentTracker;
        window.tracker = investmentTracker; // Backup reference
        console.log('✅ Investment Tracker initialized and available globally');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeInvestmentTracker);
} else {
    initializeInvestmentTracker();
}

// Backup initialization
setTimeout(initializeInvestmentTracker, 100);
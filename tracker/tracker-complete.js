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
        this.chartColors = {               // Consistent color scheme
            primary: '#667eea',
            secondary: '#764ba2',
            success: '#22c55e',
            danger: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        
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
            this.updateMetrics();
            this.initializeCharts();
            
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
            
            console.log(`📊 Loaded ${this.investments.length} investments, ${this.longTermInvestments.length} long term investments, and ${this.caseDrops.length} case drops from storage`);
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
            
            console.log(`💾 Saved ${this.investments.length} investments, ${this.longTermInvestments.length} long-term investments, and ${this.caseDrops.length} case drops to storage`);
        } catch (error) {
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
        
        // Calculate portfolio value: only include items currently being held (not sold)
        let portfolioValue = 0;
        
        // Add regular investments that are still being held
        const holdingInvestments = this.investments.filter(inv => !inv.sellPrice);
        portfolioValue += holdingInvestments.reduce((sum, inv) => sum + inv.buyPrice, 0);
        
        // Add long-term investments that are still being held
        const holdingLongTermInvestments = this.longTermInvestments.filter(inv => !inv.unitSellPrice);
        portfolioValue += holdingLongTermInvestments.reduce((sum, inv) => sum + inv.totalBuyPrice, 0);

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

        if (portfolioType && longtermType && quantityField) {
            const toggleQuantityField = () => {
                if (longtermType.checked) {
                    quantityField.classList.remove('hidden');
                    document.getElementById('quantity').required = true;
                } else {
                    quantityField.classList.add('hidden');
                    document.getElementById('quantity').required = false;
                    document.getElementById('quantity').value = '';
                }
            };

            portfolioType.addEventListener('change', toggleQuantityField);
            longtermType.addEventListener('change', toggleQuantityField);
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
            isLongTerm: document.getElementById('longtermType').checked,
            quantity: document.getElementById('longtermType').checked ? parseInt(document.getElementById('quantity').value) : 1
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
            sellDate: formData.sellPrice ? new Date().toISOString().split('T')[0] : null,
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
            dateAdded: new Date().toISOString()
        };

        this.longTermInvestments.unshift(longTermInvestment);
        this.renderLongTermInvestments();
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

        const index = this.longTermInvestments.findIndex(inv => inv.id === this.editingLongTermInvestment.id);
        if (index !== -1) {
            this.longTermInvestments[index] = {
                ...this.longTermInvestments[index],
                ...editData,
                totalBuyPrice: editData.unitBuyPrice * editData.quantity,
                totalSellPrice: editData.unitSellPrice ? editData.unitSellPrice * editData.quantity : null,
                sellDate: editData.unitSellPrice ? (editData.sellDate || new Date().toISOString().split('T')[0]) : null,
                status: editData.unitSellPrice ? 'sold' : 'holding',
                profit: editData.unitSellPrice ? (editData.unitSellPrice - editData.unitBuyPrice) * editData.quantity : 0,
                returnPercentage: editData.unitSellPrice ? ((editData.unitSellPrice - editData.unitBuyPrice) / editData.unitBuyPrice) * 100 : 0
            };

            this.saveData();
            this.renderLongTermInvestments();
            this.updateMetrics();
            this.updateCharts();
            this.closeLongTermEditModal();
            this.showNotification(`Updated "${editData.itemName}" successfully`, 'success');
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
            sellDate: document.getElementById('editLongTermSellDate').value || null
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
        return true;
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
        console.log(`📋 Rendered ${this.investments.length} investments`);
    }

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
                    <div class="text-xs text-gray-400">ID: ${investment.id.slice(-8)}</div>
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
                <td class="py-4 px-4">
                    ${returnPct !== 0 ? 
                        `<span class="performance-badge ${returnPct > 0 ? 'performance-positive' : 'performance-negative'}">
                            ${returnSign}${Math.abs(returnPct).toFixed(2)}%
                        </span>` : 
                        '<span class="text-gray-500">-</span>'
                    }
                </td>
                <td class="py-4 px-4">
                    <span class="performance-badge ${investment.status === 'sold' ? 'performance-positive' : 'performance-negative'}">
                        ${investment.status === 'sold' ? '✅ Sold' : '📦 Holding'}
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

        if (this.longTermInvestments.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        tbody.innerHTML = this.longTermInvestments.map(investment => this.generateLongTermRow(investment)).join('');
        console.log(`📋 Rendered ${this.longTermInvestments.length} long term investments`);
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
                    <div class="longterm-item-id">ID: ${investment.id.slice(-8)}</div>
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
    // CHART DATA GENERATION
    // ============================================================================================
    
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
        
        // Reset radio button to default
        document.getElementById('portfolioType').checked = true;
        document.getElementById('longtermType').checked = false;
        
        // Hide quantity field
        document.getElementById('quantityField').classList.add('hidden');
        document.getElementById('quantity').required = false;
        
        const buyDateElement = document.getElementById('buyDate');
        if (buyDateElement) {
            buyDateElement.value = new Date().toISOString().split('T')[0];
        }
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
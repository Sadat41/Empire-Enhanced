
// --- Start of Starfield Class (formerly part of starfield.js) ---
class Starfield {
    constructor(containerId = 'starfield-container') {
        this.starCount = 80; // Number of twinkling stars
        this.shootingStarCount = 2; // Number of shooting stars
        
        this.starContainer = null;
        this.shootingStarIntervals = [];
        this.resizeTimer = null;
        
        this.containerId = containerId;
    }

    /**
     * Creates the container for the starfield if it doesn't exist.
     */
    _setupContainer() {
        this.starContainer = document.getElementById(this.containerId);
        if (!this.starContainer) {
            this.starContainer = document.createElement('div');
            this.starContainer.id = this.containerId;
            // Basic styles are applied here, more specific styles are in the theme CSS
            this.starContainer.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                pointer-events: none; z-index: -2; overflow: hidden; display: none;
            `;
            document.body.appendChild(this.starContainer);
        }
    }

    /**
     * Generates the twinkling background stars.
     */
    _generateTwinklingStars() {
        // Clear only twinkling stars
        this.starContainer.querySelectorAll('.star').forEach(star => star.remove());

        for (let i = 0; i < this.starCount; i++) {
            const star = document.createElement('div');
            star.classList.add('star');

            const size = Math.random() * 2.5 + 1;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.top = `${Math.random() * 100}vh`;
            star.style.left = `${Math.random() * 100}vw`;
            star.style.animationDelay = `${Math.random() * 4}s`;
            star.style.animationDuration = `${3 + Math.random() * 2}s`;
            const brightness = 200 + Math.random() * 55;
            star.style.backgroundColor = `rgb(${brightness}, ${brightness}, ${brightness})`;
            
            this.starContainer.appendChild(star);
        }
    }

    /**
     * Creates and animates a single shooting star.
     * @param {HTMLElement} starElement The div element for the shooting star.
     */
    _animateShootingStar(starElement) {
        starElement.style.animation = 'none';
        void starElement.offsetWidth; // Trigger reflow to restart animation

        const startX = -200 - (Math.random() * 300);
        const startY = -100 - (Math.random() * 200);
        const pathLength = Math.max(window.innerWidth, window.innerHeight) * 1.2 + (Math.random() * 500);
        const endX = startX + pathLength;
        const endY = startY + pathLength;
        const duration = 4 + Math.random() * 4;

        starElement.style.setProperty('--start-x', `${startX}px`);
        starElement.style.setProperty('--start-y', `${startY}px`);
        starElement.style.setProperty('--end-x', `${endX}px`);
        starElement.style.setProperty('--end-y', `${endY}px`);
        starElement.style.animation = `shootingStarPath ${duration}s linear forwards`;
        
        // Hide the star after animation to prevent it from sitting at the end point
        setTimeout(() => { starElement.style.opacity = '0'; }, duration * 1000);
    }
    
    /**
     * Initializes the creation and timed animations of shooting stars.
     */
    _startShootingStars() {
        this._stopShootingStars(); // Clear existing ones first

        for (let i = 0; i < this.shootingStarCount; i++) {
            const shootingStar = document.createElement('div');
            shootingStar.classList.add('shooting-star-js');
            this.starContainer.appendChild(shootingStar);

            // Stagger the start times and intervals for a more random appearance
            const initialDelay = i * (Math.random() * 5 + 2); // Initial delay before the first animation
            const intervalId = setTimeout(() => {
                this._animateShootingStar(shootingStar);
                // Set up the repeating interval after the first run
                const repeatInterval = setInterval(() => this._animateShootingStar(shootingStar), 15000 + Math.random() * 10000);
                this.shootingStarIntervals.push(repeatInterval);
            }, initialDelay * 1000);

            this.shootingStarIntervals.push(intervalId); // Keep track to clear it later
        }
    }

    /**
     * Clears all shooting star intervals and removes their elements.
     */
    _stopShootingStars() {
        this.shootingStarIntervals.forEach(id => clearInterval(id));
        this.shootingStarIntervals = [];
        this.starContainer?.querySelectorAll('.shooting-star-js').forEach(star => star.remove());
    }
    
    /**
     * Handles window resize events to regenerate stars for the new viewport size.
     */
    _handleResize() {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
            if (this.starContainer && this.starContainer.style.display !== 'none') {
                this.stop();
                this.start();
            }
        }, 250);
    }
    
    /**
     * Public method to start the entire starfield effect.
     */
    start() {
        this._setupContainer();
        this.starContainer.style.display = 'block';
        
        this._generateTwinklingStars();
        this._startShootingStars();
        
        // Add resize listener only when started
        window.addEventListener('resize', this._boundResizeHandler);
        
        console.log('✨ Starfield started.');
    }

    /**
     * Public method to stop the starfield effect and clean up.
     */
    stop() {
        this._stopShootingStars();
        if (this.starContainer) {
            this.starContainer.innerHTML = ''; // Clear all stars
            this.starContainer.style.display = 'none';
        }
        
        // Remove resize listener when stopped
        window.removeEventListener('resize', this._boundResizeHandler);

        console.log('✨ Starfield stopped.');
    }
}
// --- End of Starfield Class ---


// --- Start of Theme Injector (formerly site-themeing.js) ---
(function() {
  'use strict';

  if (document.getElementById('empire-enhanced-theme')) {
    console.log('Empire Enhanced theme already loaded');
    return;
  }

  // NOTE: The Starfield class is now defined above in this same file.

  class EmpireThemeInjector {
    constructor() {
      this.themeId = 'empire-enhanced-theme';
      this.currentTheme = 'nebula';
      this.siteThemingEnabled = false;
      this.starfieldInstance = null; // Will hold the instance of the Starfield class
      this.domObserver = null;
      this.observerDebounceTimer = null;
      this.init();
    }

    init() {
      this.loadThemePreference().then(() => {
        if (this.siteThemingEnabled === true) {
          this.injectTheme();
        } else {
          document.body.className = document.body.className.replace(/empire-theme-\w+/g, '');
        }
        this.observeDOMChanges();
        this.setupScrollListener();
      });

      window.addEventListener('empireThemeChanged', (event) => {
        if (event.detail) {
          const { theme, siteThemingEnabled } = event.detail;
          this.siteThemingEnabled = siteThemingEnabled !== false;
          if (this.siteThemingEnabled) {
            this.currentTheme = theme || 'nebula';
            if (!document.getElementById(this.themeId)) {
              this.injectTheme();
            } else {
              this.updateTheme();
            }
          } else {
            this.removeTheme();
          }
        }
      });
    }

    setupScrollListener() {
        let scrollTimeout = null;
        window.addEventListener('scroll', () => {
            document.body.classList.add('is-scrolling');
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                document.body.classList.remove('is-scrolling');
            }, 150);
        }, { passive: true });
    }

    async loadThemePreference() {
      try {
        const settings = await chrome.storage.sync.get({ selectedTheme: 'nebula', siteThemingEnabled: true });
        this.currentTheme = settings.selectedTheme;
        this.siteThemingEnabled = settings.siteThemingEnabled;
      } catch (e) {
        this.currentTheme = 'nebula'; this.siteThemingEnabled = false;
      }
    }

    injectTheme() {
      if (!this.siteThemingEnabled) return;
      const style = document.createElement('style');
      style.id = this.themeId;
      style.textContent = this.getThemeCSS();
      document.head.appendChild(style);
      document.body.classList.add(`empire-theme-${this.currentTheme}`);
      this.updateStarfieldDisplay();
    }

    updateTheme() {
      if (!this.siteThemingEnabled) return;
      document.body.className = document.body.className.replace(/empire-theme-\w+/g, '');
      document.body.classList.add(`empire-theme-${this.currentTheme}`);
      const themeElement = document.getElementById(this.themeId);
      if (themeElement) themeElement.textContent = this.getThemeCSS();
      this.updateStarfieldDisplay();
    }

    removeTheme() {
      const themeElement = document.getElementById(this.themeId);
      if (themeElement) themeElement.remove();
      document.body.className = document.body.className.replace(/empire-theme-\w+/g, '');
      if (this.starfieldInstance) {
        this.starfieldInstance.stop();
        this.starfieldInstance = null;
      }
      if (this.domObserver) {
        this.domObserver.disconnect();
        this.domObserver = null;
      }
    }

    getThemeCSS() {
      return `
        ${this.getBaseStyles()}
        ${this.currentTheme === 'shooting-star' ? this.getShootingStarStyles() : this.getNebulaStyles()}
        /* Starfield and animation styles now live here */
        .star {
            position: absolute; background-color: white; border-radius: 50%;
            opacity: 0; animation: twinkle 4s infinite ease-in-out alternate;
        }
        @keyframes twinkle {
            0% { opacity: 0.2; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1); }
            100% { opacity: 0.2; transform: scale(0.8); }
        }
        .shooting-star-js {
            position: absolute; width: 80px; height: 2px;
            background: linear-gradient(to right, transparent, rgba(74, 144, 226, 0.6), rgba(135, 206, 235, 0.9));
            border-radius: 1px; pointer-events: none; z-index: -1; opacity: 0;
        }
        @keyframes shootingStarPath {
            0% { transform: translate(var(--start-x), var(--start-y)) rotate(45deg); opacity: 0; }
            1% { opacity: 1; }
            99% { opacity: 1; }
            100% { transform: translate(var(--end-x), var(--end-y)) rotate(45deg); opacity: 0; }
        }

        /* * FIX: Removed '.shooting-star-js' from this rule.
         * Now, only twinkling stars and pulse animations pause during scroll for performance.
         * Shooting stars will continue their animation, looking much more natural.
        */
        body.is-scrolling .star,
        body.is-scrolling [style*="animation-name: pulse-magenta"] {
            animation-play-state: paused !important;
        }
      `;
    }

    getBaseStyles() { return `
        /* ===== Base Structure & Nav ===== */
        .navbar-nav > li, .nav-pills > li, ul.nav > li, .trade-list-wrapper, .trade-item-wrapper, .filters-wrapper, .filter-wrapper, .notifications-wrapper, .notification-item {
          background: transparent !important; border: none !important; box-shadow: none !important;
        }
        [href*="/games"], [data-toggle="dropdown"] {
          background: transparent !important; border: none !important; box-shadow: none !important;
          padding: 8px 16px !important; border-radius: 12px !important; transition: all 0.3s ease !important;
        }
        [href*="/games"]:hover, [data-toggle="dropdown"]:hover {
          background: rgba(255, 255, 255, 0.04) !important;
        }
        /* ===== Main Content Panels (Trade & Filters) ===== */
        .trade-list-wrapper > div, .filters-wrapper > div {
          background: rgba(15, 15, 25, 0.75) !important;
          /* OPTIMIZED: Further reduced blur for maximum scroll performance */
          backdrop-filter: blur(5px) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important; border-radius: 24px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important; overflow: hidden !important;
        }
        .filters-wrapper > div { padding: 20px !important; }
        /* ===== Notifications ===== */
        .notification-item > div {
          background: rgba(255, 255, 255, 0.08) !important; backdrop-filter: blur(8px) !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important; border-radius: 16px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        /* ===== Inputs & Price Range ===== */
        .price-range-wrapper, input[placeholder*="Min"], input[placeholder*="Max"] {
          background: rgba(255, 255, 255, 0.08) !important; border: 1px solid rgba(255, 255, 255, 0.12) !important;
          border-radius: 10px !important; padding: 8px 12px !important; box-shadow: none !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .price-range-wrapper:hover, input[placeholder*="Min"]:hover, input[placeholder*="Max"]:hover {
          border-color: rgba(102, 126, 234, 0.4) !important;
        }
        /* ===== Dropdowns & Popovers ===== */
        .dropdown-menu, .popover-panel, div[class*="room-box_desktop"] {
          background: rgba(10, 10, 20, 0.9) !important; backdrop-filter: blur(10px) !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important; border-radius: 12px !important;
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.6) !important; color: #e2e8f0 !important;
        }
        .dropdown-item:hover, .popover-panel button:hover, div[class*="room-box_desktop"] button:hover {
          background: rgba(255, 255, 255, 0.04) !important;
        }
        .popover-panel *, div[class*="room-box_desktop"] * { color: #e2e8f0 !important; }
        /* ===== General Dark Backgrounds & Sidebars ===== */
        .bg-dark-7, .bg-dark-2, [class*="bg-dark"], .sidebar_inner, .sidebar-structure, .content_inner, [data-v-ebe404fd].sidebar_inner,
        [data-v-ecf11097].sidebar-structure, [data-v-ecf11097].content, [data-v-ecf11097].content_inner, [data-v-7fedfc59].bg-dark-3,
        #scrollable-sidebar-element, .bg-dark-3.p-1g, .sidebar [data-testid="trades"], .sidebar [data-testid="filters"],
        .sidebar-content, [class*="sidebar"] [class*="trade"], [class*="sidebar"] [class*="filter"] {
          background: rgba(15, 15, 25, 0.75) !important; backdrop-filter: blur(5px) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
        }
        #app > div.sidebar.sidebar__desktop.z-30 > div, #app > div.sidebar.sidebar__desktop.z-30 > div > div, #app > div.sidebar.sidebar__desktop.z-30 > div > div > div,
        #app > div.sidebar.sidebar__desktop.z-30 > div > div > div > div.content, #app > div.sidebar.sidebar__desktop.z-30 > div > div > div > div.content > div,
        #scrollable-sidebar-element {
            display: flex !important; flex-direction: column !important;
            flex-grow: 1 !important; min-height: 0;
        }
        [style*="border: 1px solid"], [style*="border:1px solid"], .border-dark-2, .border-dark, [class*="border-dark"] {
          border-color: rgba(255, 255, 255, 0.12) !important;
        }
        [style*="box-shadow"] { box-shadow: none !important; }
      `; }
    getNebulaStyles() { return `
        body.empire-theme-nebula { background: linear-gradient(135deg, #0a0f1c 0%, #1a1f2e 25%, #2a2f3e 50%, #1a1f2e 75%, #0a0f1c 100%) !important; }
        body.empire-theme-nebula::before {
          content: ''; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255, 107, 107, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(54, 215, 183, 0.1) 0%, transparent 50%);
          pointer-events: none; z-index: -1;
        }
        .empire-theme-nebula .btn-primary, .empire-theme-nebula .active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important; }
        .empire-theme-nebula a { color: #667eea !important; }
        .empire-theme-nebula a:hover { color: #764ba2 !important; }
      `; }
    getShootingStarStyles() { return `
        body.empire-theme-shooting-star { background: radial-gradient(ellipse at center, #1a1a2e 0%, #16213e 35%, #0f0f1e 100%) !important; }
        body.empire-theme-shooting-star .trade-list-wrapper > div, body.empire-theme-shooting-star .filters-wrapper > div,
        body.empire-theme-shooting-star #app > div.chat--open.chat.h-full.z-30 > div,
        body.empire-theme-shooting-star #app > div.sidebar.sidebar__desktop.z-30 > div > div > div.sidebar-structure,
        body.empire-theme-shooting-star div.item-card, body.empire-theme-shooting-star div.main-item-info\\.grid,
        body.empire-theme-shooting-star .chat__messages button.block {
            background: linear-gradient(145deg, rgba(20, 30, 55, 0.85), rgba(30, 20, 50, 0.85)) !important;
            backdrop-filter: blur(5px) !important; border: 1px solid rgba(135, 206, 235, 0.2) !important;
            box-shadow: 0 8px 32px rgba(135, 206, 235, 0.1) !important; border-radius: 24px !important;
            overflow: hidden !important;
        }
        body.empire-theme-shooting-star .item-card:hover, body.empire-theme-shooting-star .chat__messages button.block:hover {
          transform: translateY(-8px) !important; border-color: rgba(135, 206, 235, 0.6) !important;
          box-shadow: 0 12px 40px rgba(135, 206, 235, 0.2), 0 0 15px rgba(135, 206, 235, 0.15) !important;
        }
        body.empire-theme-shooting-star .sidebar_inner, body.empire-theme-shooting-star .content, body.empire-theme-shooting-star .content_inner,
        body.empire-theme-shooting-star #scrollable-sidebar-element, body.empire-theme-shooting-star div.trading-items > div,
        body.empire-theme-shooting-star .chat__messages, body.empire-theme-shooting-star .bg-dark-3,
        body.empire-theme-shooting-star div.main-item-info\\.grid > div, body.empire-theme-shooting-star #scrollable-sidebar-element > div > div {
            background: transparent !important; border: none !important; box-shadow: none !important;
        }
        #app > div.sidebar.sidebar__desktop.z-30 > div > div > div > div.extra-sidebar-header {
            display: flex !important; background: rgba(0, 0, 10, 0.2) !important; border-top-left-radius: 24px !important;
            border-top-right-radius: 24px !important; padding: 4px !important; margin: 0 !important;
            border-bottom: 1px solid rgba(135, 206, 235, 0.2) !important;
        }
        #app > div.sidebar.sidebar__desktop.z-30 > div > div > div > div.extra-sidebar-header > div {
            flex: 1 !important; text-align: center !important; padding: 12px 0 !important; cursor: pointer !important;
            border-radius: 20px !important; transition: all 0.2s ease-in-out !important; color: rgba(255, 255, 255, 0.7) !important;
        }
        #app > div.sidebar.sidebar__desktop.z-30 > div > div > div > div.extra-sidebar-header > div:hover {
            background-color: rgba(135, 206, 235, 0.1) !important; color: #fff !important;
        }
        #app > div.sidebar.sidebar__desktop.z-30 > div > div > div > div.extra-sidebar-header > div.extra-sidebar-header__tab.selected {
            background: linear-gradient(135deg, #4a90e2 0%, #87ceeb 100%) !important; color: #fff !important;
            box-shadow: 0 2px 10px rgba(135, 206, 235, 0.2) !important;
        }
        #scrollable-sidebar-element > div, div.item-info > div, .chat__messages .message__main button {
            background: rgba(0, 0, 10, 0.25) !important; border: 1px solid rgba(135, 206, 235, 0.15) !important;
            border-radius: 12px !important; padding: 10px !important; margin: 0 10px 10px 10px !important;
            box-shadow: inset 0 1px 8px rgba(0,0,0,0.25) !important; box-sizing: border-box !important;
        }
        button.btn-primary, .btn-primary, button.bg-gold-4, .btn-filter > .btn-primary, .filters-wrapper .btn-primary {
             background: linear-gradient(135deg, #4a90e2 0%, #87ceeb 100%) !important;
             box-shadow: 0 4px 20px rgba(135, 206, 235, 0.3) !important;
             border: none !important; border-radius: 12px !important; color: #fff !important;
        }
        button.btn-secondary {
            background: rgba(135, 206, 235, 0.1) !important;
            border: 1px solid rgba(135, 206, 235, 0.2) !important; border-radius: 12px !important;
        }
        .box-border.flex.h-\\[38px\\] > input { background: transparent !important; }
        #empire-header > div.hidden.w-full.bg-dark-grey-3.xl\\:block, #empire-footer {
            background: linear-gradient(145deg, rgba(20, 30, 55, 0.8), rgba(30, 20, 50, 0.8)) !important;
            backdrop-filter: blur(5px) !important; border-color: rgba(135, 206, 235, 0.2) !important;
        }
        #empire-header > div.hidden.w-full.bg-dark-grey-3.xl\\:block > div > div, #empire-footer > div, #empire-footer > div > div {
            background: transparent !important;
        }
        .mb-0.flex > div > div {
            background: rgba(0, 0, 10, 0.2) !important; padding: 4px; border-radius: 16px;
        }
        .mb-0.flex > div > div > a > button {
            background: transparent !important; border-radius: 12px; color: rgba(255, 255, 255, 0.7) !important;
        }
        .mb-0.flex > div > div > a:hover > button {
            background: rgba(135, 206, 235, 0.1) !important; color: #fff !important;
        }
        .mb-0.flex > div > div > a.router-link-active > button {
            background: linear-gradient(135deg, #4a90e2 0%, #87ceeb 100%) !important; color: #fff !important;
            box-shadow: 0 2px 10px rgba(135, 206, 235, 0.2) !important;
        }
        @keyframes pulse-magenta {
            0% { box-shadow: 0 0 6px rgba(214, 101, 255, 0.4); }
            50% { box-shadow: 0 0 14px rgba(214, 101, 255, 0.7); }
            100% { box-shadow: 0 0 6px rgba(214, 101, 255, 0.4); }
        }
        #scrollable-sidebar-element .flex.h-\\[42px\\] {
            width: 100% !important; background: linear-gradient(135deg, #d665ff 0%, #a855f7 100%) !important;
            border-radius: 8px !important; animation: pulse-magenta 2s infinite ease-in-out;
            padding: 0 10px !important; margin-bottom: 8px !important;
        }
        #scrollable-sidebar-element .flex.h-\\[42px\\] p, #scrollable-sidebar-element .flex.h-\\[42px\\] div.truncate { color: #fff !important; }
        #scrollable-sidebar-element .flex.h-\\[42px\\] .truncate.rounded {
            background: transparent !important; box-shadow: none !important; animation: none !important;
        }
      `; }

    /**
     * Manages the Starfield instance based on the current theme.
     */
    updateStarfieldDisplay() {
      if (this.siteThemingEnabled && this.currentTheme === 'shooting-star') {
        // If the starfield is needed, create an instance if it doesn't exist.
        if (!this.starfieldInstance) {
          // The Starfield class is now defined in this file, so this will work.
          this.starfieldInstance = new Starfield('empire-starfield-container');
        }
        this.starfieldInstance.start();
      } else {
        // If starfield is not needed, stop and remove it.
        if (this.starfieldInstance) {
          this.starfieldInstance.stop();
          this.starfieldInstance = null; // Allow for garbage collection
        }
      }
    }

    observeDOMChanges() {
        if (!this.siteThemingEnabled) {
            if (this.domObserver) this.domObserver.disconnect();
            return;
        }

        const fixNodeStyles = (node) => {
            if (node.nodeType === 1 && node.style) {
                if (node.style.border && node.style.border.includes('1px solid')) {
                    node.style.border = '1px solid rgba(255, 255, 255, 0.12)';
                }
                if (node.style.boxShadow && node.style.boxShadow !== 'none') {
                    node.style.boxShadow = 'none';
                }
            }
        };

        this.domObserver = new MutationObserver((mutations) => {
            clearTimeout(this.observerDebounceTimer);
            this.observerDebounceTimer = setTimeout(() => {
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === 1) {
                                fixNodeStyles(node);
                                node.querySelectorAll('*').forEach(fixNodeStyles);
                            }
                        }
                    }
                }
            }, 100);
        });

        this.domObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new EmpireThemeInjector());
  } else {
    new EmpireThemeInjector();
  }
})();
// --- End of Theme Injector ---
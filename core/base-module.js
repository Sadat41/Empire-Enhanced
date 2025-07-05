// core/base-module.js - Standard interface for all feature modules
class BaseModule {
  constructor(options = {}) {
    this.name = this.constructor.name.replace('Module', '').toLowerCase();
    this.eventBus = options.eventBus || window.empireEventBus;
    this.context = options.context || 'unknown';
    this.moduleLoader = options.moduleLoader || window.empireModuleLoader;
    
    this.isEnabled = true;
    this.eventListeners = [];
    this.settings = new Map();
    
    console.log(`🔧 BaseModule: Creating ${this.name} for ${this.context}`);
  }

  // Override in child classes
  async init() {
    console.log(`🔧 ${this.name}: Initializing...`);
    
    // Load settings if available
    await this.loadSettings();
    
    console.log(`✅ ${this.name}: Initialized`);
  }

  // Override in child classes for cleanup
  async cleanup() {
    console.log(`🧹 ${this.name}: Cleaning up...`);
    
    // Remove all event listeners
    this.eventListeners.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.eventListeners = [];
  }

  // Easy event listening with auto-cleanup
  listen(eventName, handler) {
    const boundHandler = handler.bind(this);
    const unsubscribe = this.eventBus.on(eventName, boundHandler, this.name);
    this.eventListeners.push(unsubscribe);
    return unsubscribe;
  }

  // Easy event emission
  async emit(eventName, data = {}) {
    return await this.eventBus.emit(eventName, {
      ...data,
      source: this.name,
      context: this.context
    });
  }

  // Get setting with default
  getSetting(key, defaultValue = null) {
    return this.settings.get(key) ?? defaultValue;
  }

  // Set setting
  setSetting(key, value) {
    this.settings.set(key, value);
  }

  // Load settings from storage
  async loadSettings() {
    try {
      const storageKey = `${this.name}_settings`;
      const result = await chrome.storage.sync.get([storageKey]);
      const savedSettings = result[storageKey] || {};
      
      for (const [key, value] of Object.entries(savedSettings)) {
        this.settings.set(key, value);
      }
      
      console.log(`💾 ${this.name}: Loaded settings`);
    } catch (error) {
      console.log(`⚠️ ${this.name}: Could not load settings (this is normal)`);
    }
  }

  // Save settings to storage
  async saveSettings() {
    try {
      const storageKey = `${this.name}_settings`;
      const settingsObject = Object.fromEntries(this.settings);
      await chrome.storage.sync.set({ [storageKey]: settingsObject });
      console.log(`💾 ${this.name}: Saved settings`);
    } catch (error) {
      console.error(`❌ ${this.name}: Failed to save settings:`, error);
    }
  }

  // Send message to other contexts
  async sendMessage(type, data = {}) {
    try {
      return await chrome.runtime.sendMessage({
        type,
        data: {
          ...data,
          source: this.name,
          context: this.context
        }
      });
    } catch (error) {
      console.log(`⚠️ ${this.name}: Could not send message (this is normal if no listeners)`);
      return null;
    }
  }

  // Check if module is in specific context
  isContext(context) {
    return this.context === context;
  }

  // Get other modules
  getModule(moduleName) {
    return this.moduleLoader?.getModule(moduleName);
  }

  // Simple debounce utility
  debounce(func, wait = 300) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
}

// Make available globally
window.BaseModule = BaseModule;

console.log('✅ Empire Enhanced Base Module ready');
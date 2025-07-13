// core/module-loader.js 
class ModuleLoader {
  constructor() {
    this.eventBus = window.empireEventBus;
    this.modules = new Map();
    this.context = 'unknown';
  }

  // Set current context (background, content, popup)
  setContext(context) {
    this.context = context;
    console.log(`🔧 ModuleLoader: Context set to "${context}"`);
  }

  // Auto-load all feature modules for current context
  async autoLoadModules() {
    console.log(`🔍 ModuleLoader: Auto-loading modules for "${this.context}" context...`);
    
   

    let loadedCount = 0;
    
    for (const featureName of featureList) {
      try {
        const loaded = await this.tryLoadModule(featureName);
        if (loaded) loadedCount++;
      } catch (error) {
        // Silently skip modules that don't exist yet
        console.log(`⏭️ Module "${featureName}" not found (this is normal)`);
      }
    }

    console.log(`✅ ModuleLoader: Loaded ${loadedCount} modules for "${this.context}"`);
    
    // Emit ready event
    await this.eventBus.emit('modules:ready', { 
      context: this.context, 
      loadedCount 
    });
  }

 
  async tryLoadModule(moduleName) {
    try {
      // Try to import the module
      const moduleFile = await import(`../features/${moduleName}/${moduleName}.js`);
      
      if (moduleFile.default) {
        return await this.loadModule(moduleName, moduleFile.default);
      }
    } catch (error) {
      // Module doesn't exist or has errors
      return false;
    }
    
    return false;
  }

  // Load a specific module class
  async loadModule(name, ModuleClass) {
    // Check if module should run in this context
    if (!this.shouldLoadInContext(name)) {
      return false;
    }

    try {
      console.log(`🚀 ModuleLoader: Loading "${name}" in "${this.context}"`);
      
      // Create module instance
      const moduleInstance = new ModuleClass({
        eventBus: this.eventBus,
        context: this.context,
        moduleLoader: this
      });

      // Initialize module
      if (typeof moduleInstance.init === 'function') {
        await moduleInstance.init();
      }

      // Register module
      this.modules.set(name, moduleInstance);
      this.eventBus.registerModule(name, moduleInstance);

      console.log(`✅ ModuleLoader: "${name}" loaded successfully`);
      return true;
    } catch (error) {
      console.error(`❌ ModuleLoader: Failed to load "${name}":`, error);
      return false;
    }
  }

  // Check if module should load in current context
  shouldLoadInContext(moduleName) {
    
    const contextRules = {
      'keychain-monitor': ['background'],
      'item-targets': ['background'], 
      'theme-system': ['content', 'popup'],
      'notifications': ['background', 'content'],
      'price-filters': ['background']
    };

    const allowedContexts = contextRules[moduleName] || ['all'];
    return allowedContexts.includes('all') || allowedContexts.includes(this.context);
  }

  // Get loaded module
  getModule(name) {
    return this.modules.get(name);
  }

  // Get all loaded modules
  getModules() {
    return Array.from(this.modules.values());
  }
}


window.empireModuleLoader = window.empireModuleLoader || new ModuleLoader();

console.log('✅ Empire Enhanced Module Loader ready');
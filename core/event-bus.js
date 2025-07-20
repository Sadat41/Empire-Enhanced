// core/event-bus.js - Universal event system for adding features without core changes
class EventBus {
  constructor() {
    this.listeners = new Map();
    this.modules = new Map();
  }

  // Register event listener
  on(eventName, callback, moduleName = 'unknown') {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    
    this.listeners.get(eventName).push({ callback, moduleName });
    console.log(`📡 EventBus: ${moduleName} listening for "${eventName}"`);
    
    // Return unsubscribe function
    return () => this.off(eventName, callback);
  }

  // Remove event listener
  off(eventName, callback) {
    if (!this.listeners.has(eventName)) return;
    
    const listeners = this.listeners.get(eventName);
    const index = listeners.findIndex(l => l.callback === callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  // Emit event to all listeners
  async emit(eventName, data = {}) {
    console.log(`📡 EventBus: Emitting "${eventName}"`);
    
    const listeners = this.listeners.get(eventName) || [];
    const results = [];

    for (const listener of listeners) {
      try {
        const result = await listener.callback(data);
        results.push(result);
      } catch (error) {
        console.error(`📡 EventBus: Error in ${listener.moduleName} for "${eventName}":`, error);
      }
    }

    return results;
  }

  // Register a module
  registerModule(name, moduleInstance) {
    this.modules.set(name, moduleInstance);
    console.log(`📦 EventBus: Registered module "${name}"`);
  }

  // Get module by name
  getModule(name) {
    return this.modules.get(name);
  }

  // Get all events (for debugging)
  getEvents() {
    const events = {};
    for (const [eventName, listeners] of this.listeners) {
      events[eventName] = listeners.map(l => l.moduleName);
    }
    return events;
  }
}


window.empireEventBus = window.empireEventBus || new EventBus();

console.log('✅ Empire Enhanced Event Bus loaded');
// PulseCore.js
let currentEffect = null;

export class PulseCore {
    constructor(value, options = {}) {
        this._value = value;
        // Keep _dependents as a Set of functions (the effects)
        this._dependents = new Set();
        this._options = options;

        // If persistence is enabled, set up storage listener
        if (this._options.key) {
            this._loadFromStorage(); // Load initial value if persistence enabled
            window.addEventListener('storage', this._handleStorageEvent.bind(this));
        }
    }

    _loadFromStorage() {
        if (this._options.key) {
            try {
                const storage = this._options.storage || localStorage;
                const stored = storage.getItem(this._options.key);
                if (stored !== null) {
                    this._value = JSON.parse(stored);
                }
            } catch (e) {
                console.warn(`Failed to load state for key "${this._options.key}" from storage`, e);
            }
        }
    }

    get value() {
        if (currentEffect) {
            // Add the current effect to this PulseCore's dependents
            // The effect is responsible for clearing its *own* old dependencies
            this._dependents.add(currentEffect);
        }
        return this._value;
    }

    set value(newValue) {
        // Only proceed if the value has actually changed
        if (this._value !== newValue) {
            this._value = newValue;

            // Persist to storage if key is provided
            if (this._options.key) {
                try {
                    const storage = this._options.storage || localStorage;
                    storage.setItem(this._options.key, JSON.stringify(newValue));
                } catch (e) {
                    console.warn(`Failed to persist state for key "${this._options.key}"`, e);
                }
            }

            // Notify all subscribed effects to re-run
            // Create a new array from the Set to prevent issues if effects modify the Set during iteration
            [...this._dependents].forEach(effect => effect());
            // IMPORTANT: Do NOT clear this._dependents here.
            // Dependents will re-add themselves when their effect re-runs and reads this value.
        }
    }

    _handleStorageEvent(event) {
        if (event.key === this._options.key && event.storageArea === (this._options.storage || localStorage)) {
            try {
                const newValue = JSON.parse(event.newValue);
                // Only update if the value from storage is different to avoid unnecessary notifications
                if (JSON.stringify(this._value) !== event.newValue) { // Compare stringified to handle complex objects
                    this._value = newValue;
                    // Notify internal dependents (effects) that this value has changed
                    // This is important for cross-tab or cross-window sync
                    [...this._dependents].forEach(effect => effect());
                }
            } catch (e) {
                console.warn(`Failed to parse stored value for key "${this._options.key}"`, e);
            }
        }
    }
}

export function getCurrentEffect() {
    return currentEffect;
}

export function setCurrentEffect(effect) {
    currentEffect = effect;
}
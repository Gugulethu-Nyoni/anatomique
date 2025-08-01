// src/runtime.js

// ===============================================
// DOM Node Creation Utilities
// ===============================================

/**
 * Creates a new DOM element with attributes and children.
 * @param {string} tagName - The tag name of the element (e.g., 'div', 'p').
 * @param {object} [attributes={}] - An object of attributes to set on the element.
 * @param {Array<Node|string|number|Array>} [children=[]] - An array of child nodes, strings, or numbers.
 * @returns {HTMLElement} The created DOM element.
 */
export function _createElement(tagName, attributes = {}, children = []) {
    const element = document.createElement(tagName);

    // Handle attributes
    for (const [key, value] of Object.entries(attributes)) {
        if (value === undefined || value === null) continue;

        // Special cases for different attribute types
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            // Handle style objects
            Object.assign(element.style, value);
        } else if (key === 'style' && typeof value === 'string') {
            element.style.cssText = value;
        } else if (key.startsWith('on') && typeof value === 'function') {
            // Handle function event handlers
            const eventType = key.substring(2).toLowerCase();
            element.addEventListener(eventType, value);
        } else if (key.startsWith('on') && typeof value === 'string') {
            // Handle string event handlers (deprecated, but supported)
            console.warn('String event handlers are deprecated. Use functions instead.');
            element.addEventListener(key.substring(2), function(e) {
                try {
                    new Function('event', value).call(element, e);
                } catch (err) {
                    console.error('Error executing event handler:', err);
                }
            });
        } else if (typeof value === 'boolean') {
            // Boolean attributes (e.g., disabled, checked)
            if (value) {
                element.setAttribute(key, '');
            } else {
                element.removeAttribute(key);
            }
        } else if (key === 'htmlFor') {
            // Special case for 'for' attribute
            element.setAttribute('for', value);
        } else {
            // Regular attributes
            element.setAttribute(key, value);
        }
    }

    // Append children
    const normalizedChildren = normalizeChildren(children);
    normalizedChildren.forEach(child => {
        try {
            if (child instanceof Node) {
                element.appendChild(child);
            } else {
                console.warn(`Skipping invalid child node for ${tagName}:`, child);
            }
        } catch (err) {
            console.error('Error appending child:', err);
        }
    });

    return element;
}

/**
 * Creates a text node.
 * @param {any} value - The content for the text node.
 * @returns {Text} The created Text node.
 */
export function _createTextNode(value) {
    return document.createTextNode(String(value));
}

/**
 * Creates a DocumentFragment to group multiple nodes.
 * @param {Array<Node|string|number|Array>} [children=[]] - An array of child nodes, strings, or numbers.
 * @returns {DocumentFragment} The created DocumentFragment.
 */
export function _createFragment(children = []) {
    const fragment = document.createDocumentFragment();
    const normalizedChildren = normalizeChildren(children);

    normalizedChildren.forEach(child => {
        try {
            if (child instanceof Node) {
                fragment.appendChild(child);
            } else {
                console.warn(`Skipping invalid child node in fragment:`, child);
            }
        } catch (err) {
            console.error('Error appending to fragment:', err);
        }
    });

    return fragment;
}

/**
 * Helper to normalize children (strings, numbers, arrays, etc.) into DOM Nodes.
 * @param {any} children - The children to normalize.
 * @returns {Array<Node>} An array of DOM Nodes.
 */
function normalizeChildren(children) {
    const result = [];

    const processChild = (child) => {
        if (child === null || child === undefined || child === false) {
            return; // Skip falsy values
        }

        if (Array.isArray(child)) {
            child.forEach(processChild);
        } else if (child instanceof Node) {
            result.push(child);
        } else if (typeof child === 'string' || typeof child === 'number') {
            result.push(document.createTextNode(String(child)));
        } else if (child && typeof child === 'object' && child.nodeType) {
            // Handle existing DOM nodes that might be wrapped
            result.push(child);
        } else if (child && typeof child === 'object' && child.value !== undefined) {
             // If it's a reactive state object ($state or $derived), use its value
            result.push(document.createTextNode(String(child.value)));
        } else {
            console.warn(`Unsupported child type:`, child);
        }
    };

    // Handle single child or array
    if (!Array.isArray(children)) {
        processChild(children);
    } else {
        children.forEach(processChild);
    }

    return result;
}

// ===============================================
// Component Lifecycle Management
// ===============================================

const lifecycleCallbacks = new WeakMap();

/**
 * Registers a callback to be run when the component is mounted to the DOM.
 * @param {object} componentInstance - The component instance.
 * @param {function} callback - The callback function.
 */
export function _onMount(componentInstance, callback) {
    if (!lifecycleCallbacks.has(componentInstance)) {
        lifecycleCallbacks.set(componentInstance, { mount: [], destroy: [] });
    }
    lifecycleCallbacks.get(componentInstance).mount.push(callback);
}

/**
 * Registers a callback to be run when the component is destroyed/unmounted from the DOM.
 * @param {object} componentInstance - The component instance.
 * @param {function} callback - The callback function.
 */
export function _onDestroy(componentInstance, callback) {
    if (!lifecycleCallbacks.has(componentInstance)) {
        lifecycleCallbacks.set(componentInstance, { mount: [], destroy: [] });
    }
    lifecycleCallbacks.get(componentInstance).destroy.push(callback);
}

/**
 * Triggers all registered mount callbacks for a component instance.
 * @param {object} componentInstance - The component instance.
 */
export function _triggerMount(componentInstance) {
    const callbacks = lifecycleCallbacks.get(componentInstance);
    if (callbacks?.mount) {
        callbacks.mount.forEach(cb => {
            try {
                cb();
            } catch (err) {
                console.error('Error in mount callback:', err);
            }
        });
        callbacks.mount = []; // Clear after triggering
    }
}

/**
 * Triggers all registered destroy callbacks for a component instance.
 * @param {object} componentInstance - The component instance.
 */
export function _triggerDestroy(componentInstance) {
    const callbacks = lifecycleCallbacks.get(componentInstance);
    if (callbacks?.destroy) {
        callbacks.destroy.forEach(cb => {
            try {
                cb();
            } catch (err) {
                console.error('Error in destroy callback:', err);
            }
        });
        callbacks.destroy = []; // Clear after triggering
    }
}

// ===============================================
// Event Handler Helpers (Legacy / Direct)
// (Consider migrating these to use reactivity if dynamic event handlers are needed)
// ===============================================

/**
 * Creates an event handler object (might be deprecated or refactored with reactivity).
 * @deprecated Consider using direct function references for events or reactive event binding.
 * @param {string} eventName - The name of the event (e.g., 'click').
 * @param {function} handler - The event handler function.
 * @returns {object} An object with attachTo method.
 */
export function _createEventHandler(eventName, handler) {
    console.warn('_createEventHandler is deprecated. Attach event listeners directly.');
    return {
        type: 'EventHandler',
        eventName,
        handler,
        attachTo(element) {
            if (!(element instanceof Node)) {
                console.error('Cannot attach event handler to non-node element');
                return () => {};
            }

            const wrappedHandler = (e) => {
                try {
                    handler.call(this, e);
                } catch (err) {
                    console.error(`Error in ${eventName} handler:`, err);
                }
            };

            element.addEventListener(eventName, wrappedHandler);
            return () => element.removeEventListener(eventName, wrappedHandler);
        }
    };
}

/**
 * Sets multiple attributes on an element.
 * @param {HTMLElement} element - The DOM element.
 * @param {object} attributes - An object of attributes to set.
 */
export function _setAttributes(element, attributes) {
    for (const [key, value] of Object.entries(attributes)) {
        if (key.startsWith('on') && typeof value === 'function') {
            const eventType = key.substring(2).toLowerCase();
            element.addEventListener(eventType, value);
        } else {
            element.setAttribute(key, value);
        }
    }
}

/**
 * Removes multiple attributes from an element.
 * @param {HTMLElement} element - The DOM element.
 * @param {...string} attributeNames - Names of attributes to remove.
 */
export function _removeAttributes(element, ...attributeNames) {
    attributeNames.forEach(name => {
        if (name.startsWith('on')) {
            // TODO: Need to track event handlers to properly remove them when they are removed dynamically
            console.warn('Dynamic removal of event handlers added via _setAttributes is not fully implemented yet.');
        }
        element.removeAttribute(name);
    });
}


// ===============================================
// Pulse-like Reactivity System
// ===============================================

/**
 * @typedef {object} ReactiveState
 * @property {any} value - The current value of the state.
 */

/**
 * @typedef {object} EffectObject
 * @property {function} _run - Internal method to run the effect.
 * @property {Set<ReactiveState>} _deps - States this effect depends on.
 * @property {function} _cleanup - Function to run on dispose or before re-running.
 * @property {function} dispose - Public method to stop the effect.
 */

let _currentEffect = null; // Global variable to hold the currently running effect

/**
 * Creates a reactive state signal.
 * @param {any} initialValue - The initial value of the state.
 * @returns {ReactiveState} An object with a `value` property.
 */
export function $state(initialValue) {
    let _value = initialValue;
    const _subscribers = new Set(); // Effects that depend on this state

    const stateObject = {
        get value() {
            if (_currentEffect) {
                _subscribers.add(_currentEffect);
                _currentEffect._deps.add(stateObject); // Let the effect know it depends on this state
            }
            return _value;
        },
        set value(newValue) {
            if (newValue !== _value) {
                _value = newValue;
                // Run effects in a new microtask to prevent re-entrancy issues
                // and batch updates (though simple for now).
                Promise.resolve().then(() => {
                    _subscribers.forEach(effect => {
                        // Ensure effect is still active before running
                        if (effect._isActive) {
                             effect._run();
                        } else {
                            // If effect is inactive, remove it from subscribers
                            _subscribers.delete(effect);
                        }
                    });
                });
            }
        },
        // Internal method for effects to unsubscribe if needed
        _unsubscribe(effect) {
            _subscribers.delete(effect);
        }
    };
    return stateObject;
}

/**
 * Creates a reactive side-effect. The callback runs immediately and re-runs
 * whenever its reactive dependencies (`$state` or `$derived` values) change.
 * @param {function(): (function() | void)} callback - The function to run. Can return a cleanup function.
 * @returns {function} A function to dispose (stop) the effect.
 */
export function $effect(callback) {
    /** @type {EffectObject} */
    const effect = {
        _deps: new Set(), // States this effect depends on
        _cleanup: null,   // Cleanup function returned by the callback
        _isActive: true,  // To track if the effect is still active

        _run() {
            if (!this._isActive) return;

            // Clean up old dependencies before running
            this._deps.forEach(depState => depState._unsubscribe(this));
            this._deps.clear();

            // Run existing cleanup from previous execution
            if (this._cleanup && typeof this._cleanup === 'function') {
                try {
                    this._cleanup();
                } catch (e) {
                    console.error('Error in effect cleanup:', e);
                }
            }

            const prevEffect = _currentEffect;
            _currentEffect = this; // Set this effect as the current active effect

            try {
                this._cleanup = callback(); // Run callback and capture new cleanup
            } catch (e) {
                console.error('Error in effect callback:', e);
                this._cleanup = null; // Ensure no invalid cleanup is stored
            } finally {
                _currentEffect = prevEffect; // Restore previous effect
            }
        },
        dispose() {
            if (!this._isActive) return;
            this._isActive = false;
            // Run final cleanup
            if (this._cleanup && typeof this._cleanup === 'function') {
                try {
                    this._cleanup();
                } catch (e) {
                    console.error('Error during effect dispose cleanup:', e);
                }
            }
            // Unsubscribe from all dependencies
            this._deps.forEach(depState => depState._unsubscribe(this));
            this._deps.clear();
        }
    };

    effect._run(); // Run immediately on creation

    return effect.dispose; // Return the dispose function
}

/**
 * Creates a derived reactive state. Its value is computed from other reactive states
 * and automatically recomputes when its dependencies change.
 * @param {function(): any} computation - A function that returns the derived value.
 * @returns {ReactiveState} An object with a `value` property.
 */
export function $derived(computation) {
    const derivedState = $state(undefined); // Internal state to hold the derived value

    // Use an effect to keep the derivedState up-to-date
    $effect(() => {
        derivedState.value = computation();
    });

    return derivedState; // Returns a $state-like object
}

/**
 * A utility to create a collection of reactive state variables.
 * @param {object} initialValues - An object where keys are state names and values are initial state values.
 * @returns {object} An object where each property is a `$state` object.
 */
export function state(initialValues) {
    const reactiveObject = {};
    for (const key in initialValues) {
        if (Object.prototype.hasOwnProperty.call(initialValues, key)) {
            reactiveObject[key] = $state(initialValues[key]);
        }
    }
    return reactiveObject;
}
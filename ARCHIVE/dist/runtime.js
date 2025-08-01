// src/runtime.js

// DOM Node creation utilities
// DOM Node creation utilities
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

export function _createTextNode(value) {
    return document.createTextNode(String(value));
}

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

// Helper to normalize children (strings, numbers, arrays, etc.)
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

// Component lifecycle management
const lifecycleCallbacks = new WeakMap();

export function _onMount(componentInstance, callback) {
    if (!lifecycleCallbacks.has(componentInstance)) {
        lifecycleCallbacks.set(componentInstance, { mount: [], destroy: [] });
    }
    lifecycleCallbacks.get(componentInstance).mount.push(callback);
}

export function _onDestroy(componentInstance, callback) {
    if (!lifecycleCallbacks.has(componentInstance)) {
        lifecycleCallbacks.set(componentInstance, { mount: [], destroy: [] });
    }
    lifecycleCallbacks.get(componentInstance).destroy.push(callback);
}

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

// Event handler helper
export function _createEventHandler(eventName, handler) {
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

// Additional helper functions
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

export function _removeAttributes(element, ...attributeNames) {
    attributeNames.forEach(name => {
        if (name.startsWith('on')) {
            // TODO: Need to track event handlers to properly remove them
            console.warn('Removing event handlers not yet implemented');
        }
        element.removeAttribute(name);
    });
}
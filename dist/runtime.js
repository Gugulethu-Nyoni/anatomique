// src/runtime.js

// DOM Node creation utilities
export function _createElement(tagName, attributes = {}, children = []) {
    const element = document.createElement(tagName);

    // Handle attributes
    for (const [key, value] of Object.entries(attributes)) {
        if (value === undefined || value === null) continue;

        // Special cases for different attribute types
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'string') {
            element.style.cssText = value;
        } else if (key.startsWith('on') && typeof value === 'string') {
            // Handle inline event handlers
            element.addEventListener(key.substring(2), function(e) {
                new Function('event', value).call(element, e);
            });
        } else if (typeof value === 'boolean') {
            // Boolean attributes (e.g., disabled, checked)
            if (value) {
                element.setAttribute(key, '');
            } else {
                element.removeAttribute(key);
            }
        } else {
            // Regular attributes
            element.setAttribute(key, value);
        }
    }

    // Append children
    const normalizedChildren = normalizeChildren(children);
    normalizedChildren.forEach(child => {
        if (child instanceof Node) {
            element.appendChild(child);
        } else {
            console.warn(`Skipping invalid child node for ${tagName}:`, child);
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
        if (child instanceof Node) {
            fragment.appendChild(child);
        } else {
            console.warn(`Skipping invalid child node in fragment:`, child);
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

    processChild(children);
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
        callbacks.mount.forEach(cb => cb());
        callbacks.mount = []; // Clear after triggering
    }
}

export function _triggerDestroy(componentInstance) {
    const callbacks = lifecycleCallbacks.get(componentInstance);
    if (callbacks?.destroy) {
        callbacks.destroy.forEach(cb => cb());
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
            element.addEventListener(this.eventName, this.handler);
            return () => element.removeEventListener(this.eventName, this.handler);
        }
    };
}
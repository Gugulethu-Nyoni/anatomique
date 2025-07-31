// src/runtime.js

// Function to create a DOM element
export function _createElement(tagName, attributes = {}, children = []) {
    const element = document.createElement(tagName);

    // Apply attributes
    for (const key in attributes) {
        if (Object.prototype.hasOwnProperty.call(attributes, key)) {
            const value = attributes[key];
            if (key === 'className') { // Special case for class as it's often 'class' in HTML
                element.className = value;
            } else {
                element.setAttribute(key, value);
            }
        }
    }

    // Append children
    children.forEach(child => {
        // Handle cases where child might be a DOM Node, a string, or a fragment
        if (child instanceof Node) {
            element.appendChild(child);
        } else if (typeof child === 'string' || typeof child === 'number') {
            element.appendChild(document.createTextNode(String(child)));
        } else if (child && typeof child === 'object' && child.type === 'Fragment') {
            // If a child is a fragment from _createFragment, append its contents
            child.children.forEach(fragChild => {
                if (fragChild instanceof Node) {
                    element.appendChild(fragChild);
                } else if (typeof fragChild === 'string' || typeof fragChild === 'number') {
                    element.appendChild(document.createTextNode(String(fragChild)));
                }
            });
        }
        // Future: handle reactive nodes, etc.
    });

    return element;
}

// Function to create a DOM text node
export function _createTextNode(value) {
    return document.createTextNode(String(value));
}

// Function to create a document fragment (for multiple top-level elements or content bodies)
export function _createFragment(children = []) {
    // A simple object to represent a fragment before it's appended to the real DOM
    // This allows _createElement to handle it correctly.
    return {
        type: 'Fragment',
        children: children.map(child => {
            if (child instanceof Node) return child;
            if (typeof child === 'string' || typeof child === 'number') return document.createTextNode(String(child));
            return child; // Pass through other AST-like objects for now
        })
    };
}

// --- Lifecycle Management Helpers (Placeholders for now) ---
// These will be used when we build the component render class
const _mountCallbacks = new WeakMap();
const _destroyCallbacks = new WeakMap();

export function _onMount(componentInstance, callback) {
    if (!_mountCallbacks.has(componentInstance)) {
        _mountCallbacks.set(componentInstance, []);
    }
    _mountCallbacks.get(componentInstance).push(callback);
}

export function _onDestroy(componentInstance, callback) {
    if (!_destroyCallbacks.has(componentInstance)) {
        _destroyCallbacks.set(componentInstance, []);
    }
    _destroyCallbacks.get(componentInstance).push(callback);
}

export function _triggerMount(componentInstance) {
    const callbacks = _mountCallbacks.get(componentInstance);
    if (callbacks) {
        callbacks.forEach(cb => cb());
        _mountCallbacks.delete(componentInstance); // Run once, then clear
    }
}

export function _triggerDestroy(componentInstance) {
    const callbacks = _destroyCallbacks.get(componentInstance);
    if (callbacks) {
        callbacks.forEach(cb => cb());
        _destroyCallbacks.delete(componentInstance);
    }
}

// Future: _createIfBlock, _createEachBlock, _reactiveText, _updateAttribute, _createEventHandler etc.
export function _createEventHandler(eventName, handler) {
    // This helper provides metadata for _createElement or a separate mount function
    // to attach the listener.
    return { type: 'EventHandlerDescriptor', name: eventName, handler: handler };
}
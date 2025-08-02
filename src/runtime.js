// src/runtime.js or runtime/index.js

// --- State Management ($state, $derived, $effect) ---
// Simple reactivity system (you might use a more robust one)
export function $state(initialValue) {
    let value = initialValue;
    const subscribers = new Set();

    return {
        get value() {
            // Track dependencies when accessed inside an effect
            if (currentEffect) {
                currentEffect.deps.add(this);
                subscribers.add(currentEffect);
            }
            return value;
        },
        set value(newValue) {
            if (newValue === value) return;
            value = newValue;
            // Notify subscribers
            subscribers.forEach(effect => effect.execute());
        },
        // For $derived and cleanup
        subscribe(fn) {
            subscribers.add(fn);
            return () => subscribers.delete(fn);
        },
        unsubscribe(fn) {
            subscribers.delete(fn);
        }
    };
}

let currentEffect = null;

export function $effect(fn) {
    const effect = {
        execute() {
            const previousEffect = currentEffect;
            currentEffect = effect;
            // Clear old dependencies before re-running
            effect.deps.forEach(dep => dep.unsubscribe(effect.execute));
            effect.deps.clear();
            fn(); // Run the function to re-collect dependencies
            currentEffect = previousEffect;
        },
        deps: new Set(),
        cleanup: null // Optional: for external cleanup like event listeners
    };
    effect.execute(); // Initial run
    return () => {
        effect.deps.forEach(dep => dep.unsubscribe(effect.execute));
        if (effect.cleanup) effect.cleanup(); // Run any custom cleanup
    };
}

export function $derived(fn) {
    const derivedState = $state(null); // Initialize with null, will be updated by effect
    let cleanupEffect = null; // To store the cleanup function of the effect

    cleanupEffect = $effect(() => {
        derivedState.value = fn(); // Recalculate and update derived value
    });

    // Provide a dispose method for external cleanup (e.g., when an item in @each is removed)
    derivedState.dispose = cleanupEffect;

    return derivedState;
}


// --- DOM Manipulation Helpers ---
export function appendChild(parent, child) {
    parent.appendChild(child);
}

export function removeChild(parent, child) {
    parent.removeChild(child);
}

export function bindText(node, derivedState) {
    const cleanup = $effect(() => {
        node.textContent = derivedState.value;
    });
    // Attach cleanup to the node's lifecycle if needed, or component cleanup
    // For now, these effects will be collected by block-level cleanups
}

export function bindAttr(element, attrName, derivedState) {
    // For boolean attributes (e.g., disabled, checked)
    if (typeof derivedState.value === 'boolean') {
        const cleanup = $effect(() => {
            element.toggleAttribute(attrName, derivedState.value);
        });
        // cleanup for this effect needs to be collected by component/block cleanup
    } else {
        // For regular attributes
        const cleanup = $effect(() => {
            element.setAttribute(attrName, derivedState.value);
        });
        // cleanup for this effect needs to be collected by component/block cleanup
    }
}

export function bind(element, stateVar) {
    // For input elements, two-way binding
    // This is a simplified example, usually needs to handle different input types
    const updateState = (e) => {
        stateVar.value = e.target.value;
    };

    // Initial set from state
    const cleanupEffect = $effect(() => {
        element.value = stateVar.value;
    });

    // Event listener for user input
    element.addEventListener('input', updateState);

    // Add cleanup for both the effect and the event listener
    // This cleanup will be pushed to the component/block cleanups list
    return () => {
        cleanupEffect(); // Cleanup the effect
        element.removeEventListener('input', updateState);
    };
}

// export function bindClass(element, className, derivedCondition) {
//     const cleanup = $effect(() => {
//         if (derivedCondition.value) {
//             element.classList.add(className);
//         } else {
//             element.classList.remove(className);
//         }
//     });
// }


// --- Each Block Runtime Helper ---
/**
 * Manages a reactive list of DOM nodes.
 * @param {HTMLElement | DocumentFragment} parentNode The parent node to render items into.
 * @param {$State<Array> | $Derived<Array>} listReactive The reactive array to iterate over (e.g., the $state object for 'people').
 * @param {function(item: any, index: number, cleanupList: Function[]): Node[]} itemTemplateFn A function that returns an array of DOM nodes for a single item.
 * @param {string | null} keyExpression A string representing the key path (e.g., 'id' if using item.id), or null.
 * @returns {Function} A cleanup function for the entire each block.
 */
export function each(parentNode, listReactive, itemTemplateFn, keyExpression = null) {
    let currentFragments = new Map(); // Maps item key (or index) to { nodes: Node[], cleanups: Function[] }
    let cleanupEffectForList = null; // To store the cleanup function of the main effect

    cleanupEffectForList = $effect(() => {
        const newList = listReactive.value; // Get the current array value
        const newKeys = new Set();
        const newFragments = new Map(); // Store new fragments to compare with old

        // 1. Process new list to determine additions and updates
        newList.forEach((item, index) => {
            const itemKey = keyExpression ? item[keyExpression] : index;
            newKeys.add(itemKey);

            if (currentFragments.has(itemKey)) {
                // If item exists, re-use its fragment.
                // In a real system, you'd trigger updates on existing nodes if item data changed.
                // For now, we assume simple reconciliation.
                newFragments.set(itemKey, currentFragments.get(itemKey));
            } else {
                // If new, create new nodes and cleanups for this item
                const itemLevelCleanups = []; // Specific cleanups for this item's effects
                const nodes = itemTemplateFn(item, index, itemLevelCleanups); // itemTemplateFn populates itemLevelCleanups
                newFragments.set(itemKey, { nodes, cleanups: itemLevelCleanups });
            }
        });

        // 2. Identify and remove items no longer in the list
        for (const [key, fragmentInfo] of currentFragments.entries()) {
            if (!newKeys.has(key)) {
                fragmentInfo.cleanups.forEach(cleanup => cleanup()); // Run item-specific cleanups
                fragmentInfo.nodes.forEach(node => {
                    if (node.parentNode) { // Ensure node is still in DOM before removing
                        parentNode.removeChild(node);
                    }
                });
            }
        }

        // 3. Reorder/Add items to match the new list order
        let previousNode = null; // The last node processed in the parent
        newList.forEach((item, index) => {
            const itemKey = keyExpression ? item[keyExpression] : index;
            const fragmentInfo = newFragments.get(itemKey);
            const nodesToInsert = fragmentInfo.nodes;

            // Find the correct insertion point
            let actualPreviousSibling = null;
            if (previousNode) {
                // If there's a previous node from the previous iteration,
                // try to find its actual next sibling in the DOM.
                actualPreviousSibling = previousNode.nextSibling;
            } else {
                // If no previous node, we're inserting at the beginning,
                // so the anchor is the first child of the parent.
                actualPreviousSibling = parentNode.firstChild;
            }

            // Check if the first node of the current item is already in the correct position
            // relative to the `actualPreviousSibling` (or the start of the parent).
            // This is a simplified check. A full diffing algorithm (like React/Vue) is complex.
            if (actualPreviousSibling !== nodesToInsert[0] && !(previousNode && previousNode === nodesToInsert[0])) {
                // If the nodes are not in the right place, remove and re-insert
                nodesToInsert.forEach(node => {
                    if (node.parentNode) {
                        node.parentNode.removeChild(node);
                    }
                });

                nodesToInsert.forEach(node => {
                    // If actualPreviousSibling exists, insert before it.
                    // Otherwise, append to parent.
                    parentNode.insertBefore(node, actualPreviousSibling);
                });
            }

            // Update `previousNode` to be the last node of the *current* item being processed.
            previousNode = nodesToInsert[nodesToInsert.length - 1];
        });

        currentFragments = newFragments; // Update for the next reactive run
    });

    return cleanupEffectForList; // Return the cleanup function for the main effect
}
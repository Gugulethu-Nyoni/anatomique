// reState.js (Corrected)
import { PulseCore, getCurrentEffect, setCurrentEffect } from './PulseCore.js';

export function reState(computation) {
    // Create a PulseCore instance to hold the derived value
    const derivedSignal = new PulseCore(undefined); // Initial value will be immediately updated by the first effect run

    // Define the effect that re-computes the derived value.
    // This effect will run whenever any of its dependencies (e.g., 'count' in your example) change.
    const derivedEffect = () => {
        setCurrentEffect(derivedEffect); // Set the current effect for dependency tracking
        const newValue = computation(); // Execute the computation. This will read 'count.value'
                                        // and add 'derivedEffect' to 'count's dependents.
        setCurrentEffect(null); // Clear the current effect

        // *** THE CRITICAL CHANGE IS HERE ***
        // Use the setter of the PulseCore instance to update its value.
        // This will automatically handle:
        // 1. Checking if the value has actually changed.
        // 2. Updating derivedSignal._value.
        // 3. Notifying all effects that depend on this 'derivedSignal'.
        derivedSignal.value = newValue; // <-- Use the setter here!
    };

    // Run the effect immediately to:
    // 1. Initialize the derived value.
    // 2. Collect initial dependencies (e.g., make 'derivedEffect' a dependent of 'count').
    derivedEffect();

    // Return a Proxy to interact with the derived signal.
    // This ensures that when derived.value is accessed (e.g., by bindText),
    // PulseCore's getter is called, and the accessing effect is added as a dependent.
    return new Proxy(derivedSignal, {
        get(target, prop) {
            if (prop === 'value') return target.value; // Accesses PulseCore's getter
            return Reflect.get(target, prop);
        },
        // Derived states should typically be read-only. You can optionally enforce this.
        set(target, prop, value) {
            console.warn(`Attempted to set a derived state's '${String(prop)}'. Derived states are read-only.`);
            return true; // Or throw an error if strict enforcement is desired
        }
    });
}

export const $derived = reState;
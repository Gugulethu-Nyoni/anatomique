// reState.js
// No need to import getCurrentEffect, setCurrentEffect here directly,
// as $effect (from effect.js) will handle that.
import { PulseCore } from './PulseCore.js';
import { $effect } from './effect.js'; // Ensure this path is correct relative to reState.js

/**
 * Creates a reactive derived value.
 * Its value is computed from other reactive states ($state) or other derived values ($derived).
 * It automatically recomputes when its dependencies change and notifies its own subscribers.
 * @param {Function} computation A function that computes the derived value. This function
 * should read from other reactive states/deriveds.
 * @returns {PulseCore} A PulseCore instance that holds the derived value.
 */
export function reState(computation) {
    // 1. Create the PulseCore instance to hold the derived value.
    // This `derivedPulse` instance will also manage its own dependents ($effect blocks
    // that read this derived value).
    const derivedPulse = new PulseCore(undefined); // Initialize with undefined, its value will be set by computation()

    // 2. Wrap the `computation` function inside an $effect.
    // This internal $effect will automatically track the dependencies (other $state or $derived
    // values) that are accessed when `computation` is executed.
    $effect(() => {
        // When this internal effect runs, it recomputes the derived value.
        const newValue = computation();

        // 3. Update the value of the `derivedPulse` ONLY IF it has changed.
        // Importantly, setting `derivedPulse.value` will trigger the setter logic
        // in `PulseCore`, which then notifies *its own* subscribers (the $effect blocks
        // that depend on this derived value, like your if_condition_X variables).
        // This is crucial for propagating the change.
        if (derivedPulse.value !== newValue) {
            derivedPulse.value = newValue;
        }
    });

    // Return the PulseCore instance directly.
    // It already has a `value` getter/setter, so a Proxy is not needed for basic access.
    return derivedPulse;
}

// Export as $derived for use in your transpiled code
export const $derived = reState;
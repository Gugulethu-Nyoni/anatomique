// src/util/diagnostics.js

export class DiagnosticReporter {
    constructor() {
        this.warnings = [];
        this.errors = [];
    }

    report(level, message, location = null) {
        const diagnostic = { level, message, location };
        if (level === 'error') {
            this.errors.push(diagnostic);
            console.error(`ERROR: ${message}`);
            if (location) console.error(`  at line ${location.start.line}, column ${location.start.column}`);
        } else if (level === 'warning') {
            this.warnings.push(diagnostic);
            console.warn(`WARNING: ${message}`);
            if (location) console.warn(`  at line ${location.start.line}, column ${location.start.column}`);
        }
    }

    hasErrors() {
        return this.errors.length > 0;
    }

    // --- ADDED THIS METHOD ---
    getDiagnostics() {
        // Combine warnings and errors into a single array
        // You might want to sort them by location or type for better readability
        return [...this.errors, ...this.warnings];
    }
    // --- END ADDITION ---

    clear() {
        this.warnings = [];
        this.errors = [];
    }
}
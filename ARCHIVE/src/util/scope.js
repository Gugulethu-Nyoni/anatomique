// src/util/scope.js

export class Scope {
    constructor(parent = null, isBlockScope = false) {
        this.parent = parent;
        this.isBlockScope = isBlockScope;
        // declarations: Map<string, { type: string, isReactive?: boolean, node?: any }>
        this.declarations = new Map();
        // this.references = new Set(); // Optional: For more advanced static analysis
    }

    // Add metadata directly
    addDeclaration(name, metadata) {
        this.declarations.set(name, metadata);
    }

    has(name) {
        return this.declarations.has(name) || (!!this.parent && this.parent.has(name));
    }

    findOwner(name) {
        if (this.declarations.has(name)) return this;
        return this.parent ? this.parent.findOwner(name) : null;
    }
}

export class SymbolTable {
    constructor() {
        this.scopes = [];
        this.currentScope = new Scope(null, false); // Global scope initially
        this.scopes.push(this.currentScope);
    }

    pushScope(isBlockScope = false) {
        const newScope = new Scope(this.currentScope, isBlockScope);
        this.currentScope = newScope;
        this.scopes.push(newScope);
    }

    popScope() {
        if (this.currentScope.parent) {
            this.scopes.pop();
            this.currentScope = this.scopes[this.scopes.length - 1];
        } else {
            throw new Error("Cannot pop global scope. This indicates a bug in scope management.");
        }
    }

    // Declare now accepts full metadata
    declare(name, metadata) {
        this.currentScope.addDeclaration(name, metadata);
    }

    // Resolve returns the scope that owns the declaration
    resolve(name) {
        return this.currentScope.findOwner(name);
    }

    /**
     * Looks up a symbol and returns its metadata.
     * This method is used by the transpiler to get symbol type (e.g., if it's reactive).
     * @param {string} name - The name of the symbol to look up.
     * @returns {{type: string, isReactive?: boolean, node?: any}|null} The symbol metadata if found, otherwise null.
     */
    lookup(name) {
        const ownerScope = this.resolve(name);
        return ownerScope ? ownerScope.declarations.get(name) : null;
    }
}
// src/util/scope.js

// Placeholder for now. Full implementation inspired by Periscopic comes later.

export class Scope {
    constructor(parent = null, isBlockScope = false) {
        this.parent = parent;
        this.isBlockScope = isBlockScope;
        this.declarations = new Map(); // Map<string, AstNode>
        this.references = new Set();    // Set<string>
    }

    addDeclaration(name, node) {
        this.declarations.set(name, node);
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
        this.scopes = []; // Stack of active scopes
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

    declare(name, node) {
        this.currentScope.addDeclaration(name, node);
    }

    resolve(name) {
        return this.currentScope.findOwner(name);
    }
}
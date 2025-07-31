// src/anatomique.js

import { DiagnosticReporter } from './util/diagnostics.js';
import { SymbolTable } from './util/scope.js';

// Transpiler Context Class
class TranspilerContext {
    constructor() {
        this.symbolTable = new SymbolTable();
        this.diagnosticReporter = new DiagnosticReporter();
        this.runtimeHelpers = new Set(); // To track required runtime imports
        this.componentHasStyles = false; // To determine if <style> output is needed
        this.componentHasScript = false; // To determine if <script> output is needed
        this.componentMethods = new Set(); // To store method names found in jsAST
    }

    addHelper(name) {
        console.debug(`[Context] Adding helper: ${name}`); // Debug log
        this.runtimeHelpers.add(name);
    }

    pushScope(isBlockScope = false) {
        console.debug(`[Context] Pushing scope. Block scope: ${isBlockScope}`); // Debug log
        this.symbolTable.pushScope(isBlockScope);
    }

    popScope() {
        console.debug(`[Context] Popping scope.`); // Debug log
        this.symbolTable.popScope();
    }
}

// Abstract Base Transpiler (Your TranspilerCore)
class TranspilerCore {
    constructor(context) {
        this.context = context;
        console.debug(`[TranspilerCore] Initialized with context.`); // Debug log
    }

    // Abstract method to be implemented by concrete visitors
    visit(node, options) { // Pass options down
        // This method will be implemented in SemantqToJsTranspiler
        // It's the central dispatch for all node types.
        throw new Error(`Abstract method 'visit' must be implemented by concrete transpiler for node type: ${node.type}`);
    }

    // Utility to generate code for children (e.g., of Element or Fragment)
    generateChildren(childrenNodes) {
        console.debug(`[TranspilerCore] Generating children. Count: ${childrenNodes ? childrenNodes.length : 0}`); // Debug log
        // Ensure childrenNodes is an array before mapping
        if (!Array.isArray(childrenNodes)) {
            this.context.diagnosticReporter.report('error', `Expected an array of children nodes, but got: ${typeof childrenNodes}.`, null);
            return '';
        }
        return childrenNodes
            .map(child => this.visit(child))
            .filter(Boolean) // Remove empty strings from skipped nodes (e.g., comments)
            .join(', ');
    }

    // Utility to generate code for attributes
    // Returns a string suitable for a JavaScript object literal's properties
    generateAttributes(attributeNodes) {
        console.debug(`[TranspilerCore] Generating attributes. Count: ${attributeNodes ? attributeNodes.length : 0}`); // Debug log
        if (!Array.isArray(attributeNodes)) {
            this.context.diagnosticReporter.report('error', `Expected an array of attribute nodes, but got: ${typeof attributeNodes}.`, null);
            return '';
        }

        const attributesMap = {}; // Use a map to handle potential duplicate attributes (last one wins)
        attributeNodes.forEach(attrNode => {
            const attr = this.visit(attrNode); // Each visit returns an object like { name: "...", value: "..." }
            if (attr && attr.name) {
                attributesMap[attr.name] = attr.value;
            }
        });
        // Convert map to a JS object literal property string
        // We need to properly stringify values that are not already strings (e.g., numbers, booleans)
        return Object.entries(attributesMap)
            .map(([key, value]) => {
                return `${JSON.stringify(key)}: ${typeof value === 'string' ? JSON.stringify(value) : value}`;
            })
            .join(', ');
    }

    // Placeholder for JS expression handling (will be delegated to ExpressionTranspiler later)
    handleJSExpression(node) {
        console.warn(`[TranspilerCore] JS Expression transpilation not yet implemented for node type: ${node.type} at ${node.loc ? `${node.loc.start.line}:${node.loc.start.column}` : 'unknown location'}`); // Debug log
        this.context.diagnosticReporter.report('error', `JS Expression transpilation not yet implemented for node type: ${node.type}`, node.loc);
        return '/* JS Expression Not Transpiled */';
    }

    // Placeholder for CSS transpilation (will be delegated to CSSTranspiler later)
    handleCSS(node) {
        console.warn(`[TranspilerCore] CSS transpilation not yet implemented for node type: ${node.type} at ${node.loc ? `${node.loc.start.line}:${node.loc.start.column}` : 'unknown location'}`); // Debug log
        this.context.diagnosticReporter.report('warning', `CSS transpilation for node type '${node.type}' not yet implemented.`, node.loc);
        return '/* CSS Not Transpiled */';
    }

    // This method now actually processes the JS Program node
    // It will return an array of transpiled statements
    handleScript(node) {
        console.debug(`[TranspilerCore] Handling script (JS Program node).`); // Debug log
        if (node.type !== 'Program' || !Array.isArray(node.body)) {
            this.context.diagnosticReporter.report('error', `Expected a Program node with a body array for script transpilation, but got: ${node.type}`, node.loc);
            return []; // Return empty array
        }
        // Transpile each statement in the program body
        return node.body.map(statement => this.visit(statement) + ';'); // Return array of statements
    }
}

// Concrete Transpiler (Your SemantqToJsTranspiler)
export class SemantqToJsTranspiler extends TranspilerCore {
    constructor() {
        const context = new TranspilerContext(); // Create a new context for each transpiler instance
        super(context);
        console.debug(`[SemantqToJsTranspiler] Initialized.`); // Debug log
    }

    // --- Main Dispatch Method ---
    visit(node, options) { // Pass options down
        if (!node || !node.type) {
            const loc = node ? (node.loc ? `${node.loc.start.line}:${node.loc.start.column}` : 'unknown location') : 'unknown location (null/undefined node)';
            console.error(`[SemantqToJsTranspiler] ERROR: Invalid or null AST node encountered or missing 'type' property at ${loc}. Node:`, node); // Detailed debug log
            this.context.diagnosticReporter.report('error', `Invalid or null AST node encountered.`, node ? node.loc : null);
            return '';
        }

        console.debug(`[SemantqToJsTranspiler] Visiting node type: ${node.type} at ${node.loc ? `${node.loc.start.line}:${node.loc.start.column}` : 'unknown location'}`); // Debug log

        switch (node.type) {
            // --- Top-Level Structure ---
            case 'Program': return this.visitProgram(node, options); // Pass options here

            // --- Custom AST Nodes (HTML-like template) ---
            case 'Element': return this.visitElement(node);
            case 'Fragment': return this.visitFragment(node);
            case 'TextNode': return this.visitTextNode(node);
            case 'CommentBlock':
                console.debug(`[SemantqToJsTranspiler] Skipping CommentBlock.`); // Debug log for skipped node
                return '';

            // --- Attribute Nodes & Values ---
            case 'KeyValueAttribute': return this.visitKeyValueAttribute(node);
            case 'Attribute': return this.visitAttribute(node); // Handles boolean attributes like 'disabled'
            case 'Text': return this.visitText(node); // For RegularAttributeValue's 'value' property

            // --- Placeholders for future nodes (will initially throw errors or return empty strings) ---
            case 'MustacheTag':
            case 'TextWithExpressions':
            case 'IfStatement':
            case 'EachStatement':
            case 'EventHandler':
            case 'TwoWayBindingAttribute':
            case 'BooleanAttribute': // This is 'smqtype', not 'type'
            case 'BooleanIdentifierAttribute': // This is 'smqtype', not 'type'
            case 'MustacheAttributeValue':
            case 'MustacheAttributeValueWithParams':
            case 'ContentBody':
                console.warn(`[SemantqToJsTranspiler] WARNING: Transpilation for custom AST node type '${node.type}' not yet implemented at ${node.loc ? `${node.loc.start.line}:${node.loc.start.column}` : 'unknown location'}.`); // Debug log
                this.context.diagnosticReporter.report('warning', `Transpilation for custom AST node type '${node.type}' not yet implemented.`, node.loc);
                return '';

            // --- JS AST Nodes (from jsAST property) ---
            case 'ExpressionStatement': return this.visitExpressionStatement(node);
            case 'CallExpression': return this.visitCallExpression(node);
            case 'MemberExpression': return this.visitMemberExpression(node);
            case 'Identifier': return this.visitIdentifier(node);
            case 'Literal': return this.visitLiteral(node);

            // --- Remaining JS AST Nodes (still placeholders) ---
            case 'VariableDeclaration':
            case 'FunctionDeclaration':
            case 'ArrowFunctionExpression':
            case 'BinaryExpression':
            case 'UnaryExpression':
            case 'ConditionalExpression': // Ternary
            case 'BlockStatement':
            case 'ReturnStatement':
                console.warn(`[SemantqToJsTranspiler] WARNING: Transpilation for JS AST node type '${node.type}' not yet fully implemented at ${node.loc ? `${node.loc.start.line}:${node.loc.start.column}` : 'unknown location'}.`); // Debug log
                this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc);
                return '';

            // --- CSS AST Nodes (from cssAST property) ---
            case 'CssRoot':
            case 'CssRule':
            case 'CssDeclaration':
                console.warn(`[SemantqToJsTranspiler] WARNING: Transpilation for CSS AST node type '${node.type}' not yet implemented at ${node.loc ? `${node.loc.start.line}:${node.loc.start.column}` : 'unknown location'}.`); // Debug log
                this.context.diagnosticReporter.report('warning', `Transpilation for CSS AST node type '${node.type}' not yet implemented.`, node.loc);
                return '';

            default:
                console.error(`[SemantqToJsTranspiler] ERROR: Unsupported AST node type encountered: '${node.type}' at ${node.loc ? `${node.loc.start.line}:${node.loc.start.column}` : 'unknown location'}. This indicates a grammar or AST generation issue. Node:`, node); // Detailed error log
                this.context.diagnosticReporter.report('error', `Unsupported AST node type encountered: '${node.type}'. This indicates a grammar or AST generation issue.`, node.loc);
                return '';
        }
    }

    // --- Implement visit methods for Top-Level Structure ---

    // Modified visitProgram to generate the component class structure
    visitProgram(node, options = {}) {
        console.debug(`[SemantqToJsTranspiler] Visiting Program node.`); // Debug log

        const componentClassName = options.componentClassName || 'GeneratedComponent'; // Default name if not provided
        console.debug(`[SemantqToJsTranspiler] Generating component class: ${componentClassName}`);

        this.context.componentHasStyles = node.cssAST?.content?.nodes?.length > 0;
        this.context.componentHasScript = node.jsAST?.content?.body?.length > 0;

        // Ensure _createFragment is always imported, as it's used for fallback
        this.context.addHelper('_createFragment'); 

        console.debug(`[SemantqToJsTranspiler] Program has styles: ${this.context.componentHasStyles}, has script: ${this.context.componentHasScript}`); // Debug log

        let customContentJs = '';
        if (node.customAST && node.customAST.content && node.customAST.content.html) {
            customContentJs = this.visit(node.customAST.content.html);
        } else if (node.customAST) {
            console.warn(`[SemantqToJsTranspiler] WARNING: 'customAST' node found but missing expected 'content.html' structure. Node:`, node.customAST);
            this.context.diagnosticReporter.report('warning', `Custom AST structure unexpected, missing 'content.html'.`, node.customAST.loc);
        }
        console.debug(`[SemantqToJsTranspiler] Transpiled custom content JS: ${customContentJs.substring(0, Math.min(customContentJs.length, 50))}...`); // Debug log

        // Transpile JS code, assuming it's a list of statements for now
        const jsStatements = this.context.componentHasScript ? this.handleScript(node.jsAST.content) : [];
        const jsCodeForMount = jsStatements.join('\n        '); // Join with proper indentation for mount method

        console.debug(`[SemantqToJsTranspiler] Transpiled JS code statements for mount: ${jsCodeForMount.substring(0, Math.min(jsCodeForMount.length, 50))}...`); // Debug log

        // CSS code is currently a placeholder, so we'll just add a comment for it.
        const cssCodeComment = this.context.componentHasStyles ? `\n        /* CSS Transpilation Placeholder: ${this.handleCSS(node.cssAST.content)} */` : '';
        console.debug(`[SemantqToJsTranspiler] Transpiled CSS code (as comment): ${cssCodeComment.substring(0, Math.min(cssCodeComment.length, 50))}...`); // Debug log

        const componentClassString = `
export class ${componentClassName} {
    constructor(props = {}) {
        this.props = props;
        this.element = null; // To hold the root DOM element of the component
        console.log("${componentClassName} constructor called");
    }

    // Lifecycle method: Called when the component is first attached to the DOM
    mount(targetElement) {
        if (this.element) {
            console.warn("Component already mounted. Call unmount first if re-mounting.");
            return;
        }
        
        console.log("Basic html working - ${componentClassName} mounting");
        ${jsCodeForMount} // Injected JS statements from AST
        
        this.element = this.render();
        targetElement.appendChild(this.element);

        console.log("${componentClassName} mounted successfully.");
    }

    // Lifecycle method: Called when component's state or props change, triggering a re-render
    update(newProps) {
        // This is a placeholder. A real update would involve diffing and patching the DOM.
        console.log("${componentClassName} update called with new props:", newProps);
        if (this.element && this.element.parentNode) {
            const oldElement = this.element;
            this.element = this.render();
            oldElement.parentNode.replaceChild(this.element, oldElement);
        }
    }

    // Lifecycle method: Called when the component is removed from the DOM
    unmount() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
            this.element = null;
            // Clean up event listeners, timers, etc.
            console.log("${componentClassName} unmounted.");
        }
    }

    // The core render function, transpiled from your AST
    render() {
        const renderedContent = ${customContentJs || '_createFragment([])'}; // Fallback to an empty fragment
        console.log("DEBUG: render() returning:", renderedContent, "Type:", typeof renderedContent);
        return renderedContent;
    }
}
        `;

        const imports = Array.from(this.context.runtimeHelpers).map(helper =>
            `import { ${helper} } from './runtime.js';`
        ).join('\n');
        console.debug(`[SemantqToJsTranspiler] Generated imports: ${imports}`); // Debug log

        return `${imports}\n\n${componentClassString}`;
    }

    // --- Implement visit methods for Basic HTML (Custom AST) ---

    visitFragment(node) {
        console.debug(`[SemantqToJsTranspiler] Visiting Fragment node.`); // Debug log
        this.context.addHelper('_createFragment');
        const childrenJs = this.generateChildren(node.children || []); // Ensure array
        return `_createFragment([${childrenJs}])`;
    }

    visitElement(node) {
        console.debug(`[SemantqToJsTranspiler] Visiting Element node: <${node.name}>`); // Debug log
        this.context.addHelper('_createElement');
        const tagName = JSON.stringify(node.name);

        const attributesJs = this.generateAttributes(node.attributes || []); // Ensure array
        const childrenJs = this.generateChildren(node.children || []); // Ensure array

        return `_createElement(${tagName}, {${attributesJs}}, [${childrenJs}])`;
    }

    visitTextNode(node) {
        console.debug(`[SemantqToJsTranspiler] Visiting TextNode: "${node.value.substring(0, Math.min(node.value.length, 20))}..."`); // Debug log
        this.context.addHelper('_createTextNode');
        return `_createTextNode(${JSON.stringify(node.value)})`;
    }

    // --- Implement visit methods for Basic Attributes ---

    visitKeyValueAttribute(node) {
        console.debug(`[SemantqToJsTranspiler] Visiting KeyValueAttribute: ${node.name}`); // Debug log
        const attrName = node.name;
        let attrValueNode = node.value;

        // CRITICAL FIX: Unwrapping the value if it's an array with a single element
        if (Array.isArray(node.value) && node.value.length === 1) {
            attrValueNode = node.value[0];
            console.debug(`[SemantqToJsTranspiler] KeyValueAttribute value is an array, unwrapped to type: ${attrValueNode.type}`);
        } else if (Array.isArray(node.value) && node.value.length > 1) {
            console.warn(`[SemantqToJsTranspiler] WARNING: KeyValueAttribute '${node.name}' has multiple value nodes in an array. Only concatenating raw values for now. Node:`, node.value);
            this.context.diagnosticReporter.report('warning', `Attribute '${node.name}' has multiple values, transpilation might be incomplete.`, node.loc);
            // Attempt to concatenate string values from complex attribute value arrays using 'raw'
            attrValueNode = {
                type: 'Text', // Synthesize a Text node
                raw: node.value.map(v => v.raw || '').join('') // Join raw or value properties
            };
        } else if (!attrValueNode || typeof attrValueNode !== 'object' || !attrValueNode.type) {
            console.error(`[SemantqToJsTranspiler] ERROR: KeyValueAttribute '${node.name}' has an invalid or malformed value node. Node:`, node.value);
            this.context.diagnosticReporter.report('error', `Attribute '${node.name}' has an invalid value node (expected object with 'type').`, node.loc);
            return null; // Return null so generateAttributes can filter it out
        }

        const attrValue = this.visit(attrValueNode); // This will correctly call visitText

        return { name: attrName, value: attrValue };
    }

    // --- NEW METHOD: Handle 'Attribute' nodes (e.g., boolean attributes) ---
    visitAttribute(node) {
        console.debug(`[SemantqToJsTranspiler] Visiting Attribute node: ${node.name?.name || 'unknown'}. smqtype: ${node.smqtype}`);
        // For boolean attributes, the 'name' is an Identifier node and 'value' is a boolean literal.
        if (node.smqtype === 'BooleanAttribute' && node.name && node.name.type === 'Identifier') {
            const attrName = node.name.name; // Get the actual name string from the Identifier node
            const attrValue = node.value; // This is directly the boolean true/false

            // Return an object that generateAttributes can use
            return { name: attrName, value: attrValue };
        } else {
            console.error(`[SemantqToJsTranspiler] ERROR: Unsupported or malformed 'Attribute' node structure. Node:`, node);
            this.context.diagnosticReporter.report('error', `Unsupported or malformed 'Attribute' node structure.`, node.loc);
            return null;
        }
    }
    // --- END NEW METHOD ---

    visitText(node) { // This handles the 'Text' node type used for regular attribute values
        // FIX: Access node.raw instead of node.value for Text nodes representing attribute values
        if (node.raw === undefined) {
             console.error(`[SemantqToJsTranspiler] ERROR: Text node missing 'raw' property. Node:`, node);
             this.context.diagnosticReporter.report('error', `Text node missing 'raw' property.`, node.loc);
             return ''; // Return empty string or handle appropriately
        }
        console.debug(`[SemantqToJsTranspiler] Visiting Text node (for attribute value): "${node.raw.substring(0, Math.min(node.raw.length, 20))}..."`); // Debug log
        return node.raw; // Returns the raw string value (e.g., "myId", "#myCircle")
    }

    // --- Implement visit methods for Basic JS AST Nodes ---

    visitExpressionStatement(node) {
        console.debug(`[SemantqToJsTranspiler] Visiting ExpressionStatement.`); // Debug log
        return this.visit(node.expression);
    }

    visitCallExpression(node) {
        console.debug(`[TranspilerCore] Visiting CallExpression.`); // Debug log
        const callee = this.visit(node.callee);
        const args = node.arguments.map(arg => this.visit(arg)).join(', ');
        return `${callee}(${args})`;
    }

    visitMemberExpression(node) {
        console.debug(`[TranspilerCore] Visiting MemberExpression.`); // Debug log
        const object = this.visit(node.object);
        const property = this.visit(node.property);
        return node.computed ? `${object}[${property}]` : `${object}.${property}`;
    }

    visitIdentifier(node) {
        console.debug(`[TranspilerCore] Visiting Identifier: ${node.name}.`); // Debug log
        return node.name;
    }

    visitLiteral(node) {
        console.debug(`[TranspilerCore] Visiting Literal: ${node.raw}.`); // Debug log
        return node.raw;
    }

    // Public method to start the transpilation process from the root AST
    transpile(astNode, options = {}) { // Added options parameter
        if (!astNode) {
            console.error("DEBUG: `transpile` method received null or undefined AST node at entry."); // Specific entry log
            throw new Error("Invalid or null AST node encountered.");
        }

        console.log(`[SemantqToJsTranspiler] Starting transpilation for root node type: ${astNode.type}`); // Clearer log
        return this.visit(astNode, options); // Pass options to visitProgram
    }
}

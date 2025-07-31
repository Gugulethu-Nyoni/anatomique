// src/anatomique.js

import { DiagnosticReporter } from './util/diagnostics.js';
import { SymbolTable } from './util/scope.js';

// Transpiler Context Class
class TranspilerContext {
    constructor() {
        this.symbolTable = new SymbolTable();
        this.diagnosticReporter = new DiagnosticReporter();
        this.runtimeHelpers = new Set(); // To track required runtime imports
        this.currentFile = 'component.sq'; // Placeholder for actual file name
        this.componentHasStyles = false; // To determine if <style> output is needed
        this.componentHasScript = false; // To determine if <script> output is needed
        this.componentMethods = new Set(); // To store method names found in jsAST
    }

    addHelper(name) {
        this.runtimeHelpers.add(name);
    }

    pushScope(isBlockScope = false) {
        this.symbolTable.pushScope(isBlockScope);
    }

    popScope() {
        this.symbolTable.popScope();
    }
}

// Abstract Base Transpiler (Your TranspilerCore)
class TranspilerCore {
    constructor(context) {
        this.context = context;
    }

    // Abstract method to be implemented by concrete visitors
    visit(node) {
        // This method will be implemented in SemantqToJsTranspiler
        // It's the central dispatch for all node types.
        throw new Error(`Abstract method 'visit' must be implemented by concrete transpiler for node type: ${node.type}`);
    }

    // Utility to generate code for children (e.g., of Element or Fragment)
    generateChildren(childrenNodes) {
        return childrenNodes
            .map(child => this.visit(child))
            .filter(Boolean) // Remove empty strings from skipped nodes (e.g., comments)
            .join(', ');
    }

    // Utility to generate code for attributes
    // Returns a string suitable for a JavaScript object literal's properties
    generateAttributes(attributeNodes) {
        const attributesMap = {}; // Use a map to handle potential duplicate attributes (last one wins)
        attributeNodes.forEach(attrNode => {
            const attr = this.visit(attrNode); // Each visit returns an object like { name: "...", value: "..." }
            if (attr && attr.name) {
                attributesMap[attr.name] = attr.value;
            }
        });
        // Convert map to a JS object literal property string
        return Object.entries(attributesMap)
            .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
            .join(', ');
    }

    // Placeholder for JS expression handling (will be delegated to ExpressionTranspiler later)
    handleJSExpression(node) {
        this.context.diagnosticReporter.report('error', `JS Expression transpilation not yet implemented for node type: ${node.type}`, node.loc);
        return '/* JS Expression Not Transpiled */';
    }

    // Placeholder for CSS transpilation (will be delegated to CSSTranspiler later)
    handleCSS(node) {
        this.context.diagnosticReporter.report('error', `CSS transpilation not yet implemented for node type: ${node.type}`, node.loc);
        return '/* CSS Not Transpiled */';
    }

    // Placeholder for JS script block transpilation (will be delegated to JSTranspiler later)
    handleScript(node) {
        this.context.diagnosticReporter.report('error', `Script block transpilation not yet implemented for node type: ${node.type}`, node.loc);
        return '/* Script Not Transpiled */';
    }
}

// Concrete Transpiler (Your SemantqToJsTranspiler)
export class SemantqToJsTranspiler extends TranspilerCore {
    constructor() {
        const context = new TranspilerContext(); // Create a new context for each transpiler instance
        super(context);
        // Initialize specialized handlers here, passing them the shared context
        // this.expressionTranspiler = new ExpressionTranspiler(this.context);
        // this.attributeTranspiler = new AttributeTranspiler(this.context);
        // this.logicTranspiler = new LogicTranspiler(this.context);
        // this.jsTranspiler = new JSTranspiler(this.context);
        // this.cssTranspiler = new CSSTranspiler(this.context);
    }

    // --- Main Dispatch Method ---
    // This method decides which specific 'visit' method to call based on the node's type.
    // It's the central point for adding support for new AST node types.
    visit(node) {
        if (!node || !node.type) {
            this.context.diagnosticReporter.report('error', `Invalid or null AST node encountered.`, node ? node.loc : null);
            return '';
        }

        switch (node.type) {
            // --- Top-Level Structure ---
            case 'Program': return this.visitProgram(node);
            case 'CustomAST': return this.visitCustomAST(node);

            // --- Custom AST Nodes (HTML-like template) ---
            case 'Element': return this.visitElement(node);
            case 'Fragment': return this.visitFragment(node);
            case 'TextNode': return this.visitTextNode(node);

            // --- Attribute Nodes & Values ---
            case 'KeyValueAttribute': return this.visitKeyValueAttribute(node);
            case 'Text': return this.visitText(node); // For RegularAttributeValue's 'value' property

            // --- Placeholders for future nodes (will initially throw errors or return empty strings) ---
            case 'MustacheTag':
            case 'TextWithExpressions':
            case 'IfStatement':
            case 'EachStatement':
            case 'EventHandler':
            case 'TwoWayBindingAttribute':
            case 'BooleanAttribute':
            case 'BooleanIdentifierAttribute':
            case 'MustacheAttributeValue':
            case 'MustacheAttributeValueWithParams':
            case 'ContentBody':
                this.context.diagnosticReporter.report('warning', `Transpilation for custom AST node type '${node.type}' not yet implemented.`, node.loc);
                return ''; // Return empty string for unimplemented custom nodes for now

            // --- JS AST Nodes (from jsAST property) ---
            // These will be handled by ExpressionTranspiler and JSTranspiler later
            case 'VariableDeclaration':
            case 'FunctionDeclaration':
            case 'ArrowFunctionExpression':
            case 'CallExpression':
            case 'MemberExpression':
            case 'Identifier':
            case 'Literal':
            case 'BinaryExpression':
            case 'UnaryExpression':
            case 'ConditionalExpression': // Ternary
            case 'BlockStatement':
            case 'ExpressionStatement':
            case 'ReturnStatement':
                // Delegate to handleScript or handleJSExpression (which will then delegate to ExpressionTranspiler)
                this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet implemented.`, node.loc);
                return ''; // Placeholder for JS nodes

            // --- CSS AST Nodes (from cssAST property) ---
            case 'CssRoot':
            case 'CssRule':
            case 'CssDeclaration':
                // Delegate to handleCSS (which will then delegate to CSSTranspiler)
                this.context.diagnosticReporter.report('warning', `Transpilation for CSS AST node type '${node.type}' not yet implemented.`, node.loc);
                return ''; // Placeholder for CSS nodes

            default:
                this.context.diagnosticReporter.report('error', `Unsupported AST node type encountered: '${node.type}'. This indicates a grammar or AST generation issue.`, node.loc);
                return '';
        }
    }

    // --- Implement visit methods for Top-Level Structure ---

    visitProgram(node) {
        // Set context flags based on presence of JS/CSS ASTs
        this.context.componentHasStyles = node.cssAST && node.cssAST.nodes && node.cssAST.nodes.length > 0;
        this.context.componentHasScript = node.jsAST && node.jsAST.body && node.jsAST.body.length > 0;

        // Transpile customAST (the main HTML-like template)
        const customContentJs = this.visit(node.customAST);

        // Transpile JS AST (placeholder for now)
        const jsCode = this.context.componentHasScript ? this.handleScript(node.jsAST) : '';

        // Transpile CSS AST (placeholder for now)
        const cssCode = this.context.componentHasStyles ? this.handleCSS(node.cssAST) : '';

        // Construct the final component render function.
        // This will evolve into a full component class later.
        const mainRenderFunction = `
            // Generated component render function
            export default function render(ctx) {
                // Component lifecycle and state management will be integrated here.
                // For now, ctx is just a placeholder.
                ${jsCode}
                ${cssCode}
                return ${customContentJs};
            }
        `;

        // Generate runtime imports based on what was used during traversal
        const imports = Array.from(this.context.runtimeHelpers).map(helper =>
            `import { ${helper} } from './runtime.js';`
        ).join('\n');

        return `${imports}\n\n${mainRenderFunction}`;
    }

    // The 'customAST' node itself is just a container for children
    visitCustomAST(node) {
        // If the root has multiple children, it needs to be a fragment.
        // If it's a single element/text node, we can return it directly.
        // For consistency in the output, let's always return a fragment for now.
        this.context.addHelper('_createFragment');
        const childrenJs = this.generateChildren(node.children);
        return `_createFragment([${childrenJs}])`;
    }

    // --- Implement visit methods for Basic HTML (Custom AST) ---

    visitFragment(node) {
        this.context.addHelper('_createFragment');
        const childrenJs = this.generateChildren(node.children);
        return `_createFragment([${childrenJs}])`;
    }

    visitElement(node) {
        this.context.addHelper('_createElement');
        const tagName = JSON.stringify(node.name);

        // Attributes are processed by generateAttributes, which calls visit on each attribute node
        const attributesJs = this.generateAttributes(node.attributes);

        // Children are processed by generateChildren, which calls visit on each child node
        const childrenJs = this.generateChildren(node.children);

        return `_createElement(${tagName}, {${attributesJs}}, [${childrenJs}])`;
    }

    visitTextNode(node) {
        this.context.addHelper('_createTextNode');
        return `_createTextNode(${JSON.stringify(node.value)})`;
    }

    // --- Implement visit methods for Basic Attributes ---

    visitKeyValueAttribute(node) {
        // 'name' is a string (e.g., "id", "src") from the AST
        const attrName = node.name;
        // 'value' is a 'Text' node (from createRegularAttributeValue) for now
        const attrValue = this.visit(node.value); // This will call visitText(node.value)
        // Return an object that generateAttributes can use
        return { name: attrName, value: attrValue };
    }

    visitText(node) { // This handles the 'Text' node type used for regular attribute values
        return node.value; // Returns the raw string value (e.g., "image.jpg")
    }

    // Public method to start the transpilation process from the root AST
    transpile(ast) {
        this.context.diagnosticReporter.clear();
        const code = this.visit(ast); // Start traversal from the Program node
        if (this.context.diagnosticReporter.hasErrors()) {
            throw new Error("Transpilation failed due to errors. Check diagnostics.");
        }
        return code;
    }
}
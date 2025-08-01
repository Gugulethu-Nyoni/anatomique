// src/anatomique.js

import { DiagnosticReporter } from './util/diagnostics.js';
import { SymbolTable } from './util/scope.js'; // Ensure this path is correct

// Transpiler Context Class
class TranspilerContext {
    constructor() {
        this.symbolTable = new SymbolTable(); // Initialized here
        this.diagnosticReporter = new DiagnosticReporter();
        this.runtimeHelpers = new Set(); // To track required runtime imports
        this.componentHasStyles = false; // To determine if <style> output is needed
        this.componentHasScript = false; // To determine if <script> output is needed
        this.reactiveStateDeclarations = []; // To store transpiled $state/$derived declarations
        this.bindingCleanupFunctions = []; // To store cleanup functions for bindings
    }

    addHelper(name) {
        this.runtimeHelpers.add(name);
    }

    addBindingCleanup(cleanupCode) {
        this.bindingCleanupFunctions.push(cleanupCode);
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
    visit(node, options = {}) { // Pass options down
        // --- ADD DEBUG LOG HERE (High priority) ---
        if (!node) {
            console.error('DEBUG: TranspilerCore.visit received a NULL/UNDEFINED node! Options:', options);
            this.context.diagnosticReporter.report('error', `Invalid or null AST node encountered.`, node ? node.loc : null);
            throw new Error('Transpilation aborted due to invalid AST node.'); // Abort to prevent cascading errors
        }
        // console.log(`DEBUG: TranspilerCore.visit - Type: ${node.type}, Name: ${node.name || 'N/A'}`); // Can be very chatty
        // --- END DEBUG LOG ---

        if (!this[`visit${node.type}`]) {
            this.context.diagnosticReporter.report('error', `Abstract method 'visit' must be implemented by concrete transpiler for node type: ${node.type}`, node.loc);
            throw new Error(`Transpilation aborted: No visitor method for node type: ${node.type}`);
        }
        return this[`visit${node.type}`](node, options);
    }

    // Utility to generate code for children (e.g., of Element or Fragment)
    generateChildren(childrenNodes) {
        // Defensive check for null/undefined childrenNodes
        const nodesToProcess = childrenNodes || [];
        // --- ADD DEBUG LOG HERE ---
        if (!Array.isArray(nodesToProcess)) {
            console.error('DEBUG: generateChildren received non-array childrenNodes:', nodesToProcess);
            this.context.diagnosticReporter.report('error', `Expected an array of children nodes, but got: ${typeof nodesToProcess}.`, null);
            return '';
        }
        // console.log(`DEBUG: generateChildren processing ${nodesToProcess.length} children.`);
        // --- END DEBUG LOG ---
        return nodesToProcess
            .map((child, index) => {
                // --- ADD DEBUG LOG HERE for each child ---
                if (!child) {
                    console.error(`DEBUG: generateChildren - Child at index ${index} is NULL/UNDEFINED!`);
                    return ''; // Return empty string for problematic child
                }
                // console.log(`DEBUG: generateChildren - Visiting child type: ${child.type}, index: ${index}`);
                // --- END DEBUG LOG ---
                return this.visit(child);
            })
            .filter(Boolean) // Remove empty strings from skipped nodes (e.g. comments, nulls)
            .join(', ');
    }

    // Utility to generate code for attributes
    generateAttributes(attributeNodes, elementVarName) {
        // Defensive check: If attributeNodes is null or undefined, treat as empty array
        const attributesToProcess = attributeNodes || [];

        // --- ADD DEBUG LOG HERE ---
        if (!Array.isArray(attributesToProcess)) {
            console.error('DEBUG: generateAttributes received non-array attributeNodes:', attributesToProcess);
            this.context.diagnosticReporter.report('error', `Expected an array of attribute nodes, but got: ${typeof attributesToProcess}.`, null);
            return { staticAttrs: [], dynamicBindings: [] };
        }
        console.log(`DEBUG: generateAttributes called for ${elementVarName} with ${attributesToProcess.length} attributes.`);
        // --- END DEBUG LOG ---

        const staticAttributes = [];
        const dynamicBindings = []; // For reactive bindings ($bind, $text, $attr, $class)

        // Flatten the attribute nodes array, as visitTwoWayBindingAttribute returns an array
        const flattenedAttrNodes = attributesToProcess.flatMap(attrNode => {
            // Pass the elementVarName to attribute visitors
            // Ensure attrNode is not null/undefined before visiting
            // --- ADD DEBUG LOG HERE for individual attribute ---
            if (!attrNode) {
                console.error('DEBUG: generateAttributes - Encountered a NULL/UNDEFINED attribute node!');
                return []; // Return empty array to filter out this problematic attribute
            }
            // console.log(`DEBUG: generateAttributes - Visiting attribute type: ${attrNode.type}, name: ${attrNode.name}`);
            // --- END DEBUG LOG ---
            const result = this.visit(attrNode, { isAttributeContext: true, elementVarName: elementVarName });
            return Array.isArray(result) ? result : [result];
        });

        flattenedAttrNodes.forEach(attr => {
            if (!attr || !attr.name) {
                console.warn('DEBUG: generateAttributes - Skipping null/undefined or malformed attribute result:', attr);
                return; // Skip null/undefined or malformed attribute results
            }

            const finalKey = attr.name.startsWith('@') ? `on${attr.name.substring(1)}` : attr.name;

            if (attr.isReactiveBinding) {
                // Reactive bindings already contain the full code including cleanup registration
                dynamicBindings.push(attr.code);
            } else if (attr.isEventHandler) {
                // Event handlers are special static attributes
                staticAttributes.push(`${JSON.stringify(finalKey)}: ${attr.value}`);
            } else {
                // Regular static attributes
                const attrValue = attr.isExpression ? attr.value : JSON.stringify(attr.value);
                staticAttributes.push(`${JSON.stringify(finalKey)}: ${attrValue}`);
            }
        });

        return {
            staticAttrs: `{${staticAttributes.join(', ')}}`,
            dynamicBindings: dynamicBindings
        };
    }

    // Placeholder for CSS transpilation (will be delegated to CSSTranspiler later)
    handleCSS(node) {
        this.context.diagnosticReporter.report('warning', `CSS transpilation for node type '${node.type}' not yet implemented.`, node.loc);
        return '/* CSS Not Transpiled */';
    }

    // This method now processes the JS Program node to find $state, $derived, and other JS
    handleScript(node) {
        if (node.type !== 'Program' || !Array.isArray(node.body)) {
            this.context.diagnosticReporter.report('error', `Expected a Program node with a body array for script transpilation, but got: ${node.type}`, node.loc);
            return { reactiveDeclarations: [], otherStatements: [] };
        }

        const reactiveDeclarations = [];
        const otherStatements = [];

        // Script block itself is a scope (this is the global scope for the component)
        this.context.pushScope();

        node.body.forEach((statement, index) => {
            // --- ADD DEBUG LOG HERE for each script statement ---
            if (!statement) {
                console.error(`DEBUG: handleScript - Skipping null/undefined statement at index ${index} in script body.`);
                this.context.diagnosticReporter.report('warning', `Skipping null/undefined statement in script body.`, null);
                return;
            }
            // console.log(`DEBUG: handleScript - Processing statement type: ${statement.type}, index: ${index}`);
            // --- END DEBUG LOG ---

            if (statement.type === 'VariableDeclaration') {
                const declaration = statement.declarations[0];
                if (declaration.id && declaration.id.type === 'Identifier' && declaration.init) {
                    const varName = declaration.id.name;
                    // Check for $state or $derived calls
                    if (declaration.init.type === 'CallExpression' && declaration.init.callee.type === 'Identifier') {
                        const calleeName = declaration.init.callee.name;
                        if (calleeName === '$state' || calleeName === '$derived') {
                            this.context.addHelper(calleeName); // Add $state or $derived to imports
                            // --- Check arguments for null/undefined before visiting ---
                            const args = declaration.init.arguments.map((arg, argIdx) => {
                                if (!arg) {
                                    console.error(`DEBUG: handleScript - CallExpression argument at index ${argIdx} is NULL/UNDEFINED for ${calleeName}.`);
                                    return 'undefined'; // Or a placeholder
                                }
                                return this.visit(arg);
                            }).join(', ');
                            reactiveDeclarations.push(`const ${varName} = ${calleeName}(${args});`);
                            this.context.symbolTable.declare(varName, { type: 'reactive', isReactive: true, node: statement }); // Register as reactive
                            return; // Don't add to otherStatements, as it's a special declaration
                        }
                    }
                    // For non-$state/$derived variable declarations, declare them in symbol table
                    this.context.symbolTable.declare(varName, { type: 'variable', isReactive: false, node: statement });
                }
            }
            // All other statements (functions, expressions, non-reactive vars)
            const transpiled = this.visit(statement);
            if (transpiled) {
                if (statement.type === 'ExpressionStatement' || statement.type === 'ReturnStatement' || statement.type === 'UpdateExpression' || statement.type === 'AssignmentExpression') {
                    otherStatements.push(`${transpiled};`);
                } else {
                    otherStatements.push(transpiled);
                }
            }
        });

        this.context.popScope(); // Pop script scope
        return { reactiveDeclarations, otherStatements };
    }
}

// Helper to convert custom element names to kebab-case
function toKebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

// Concrete Transpiler (Your SemantqToJsTranspiler)
export class SemantqToJsTranspiler extends TranspilerCore {
    constructor() {
        const context = new TranspilerContext();
        super(context);
    }

    // --- Main Dispatch Method ---
    // The main visit method now calls the super.visit which contains the core null/undefined check
    visit(node, options = {}) {
        return super.visit(node, options);
    }

    // --- Implement visit methods for Top-Level Structure ---

    visitProgram(node, options = {}) {
        const componentClassName = options.componentClassName || 'GeneratedComponent';

        this.context.componentHasStyles = node.cssAST?.content?.nodes?.length > 0;
        this.context.componentHasScript = node.jsAST?.content?.body?.length > 0;

        // Ensure base DOM helpers are imported
        this.context.addHelper('_createFragment');
        this.context.addHelper('_createTextNode');
        this.context.addHelper('_createElement');
        this.context.addHelper('$effect'); // Always need $effect for bindings
        this.context.addHelper('state');    // Always need state object for text/attr/class/bind

        // Process script block to extract reactive declarations and other statements
        let reactiveDeclarationsJs = [];
        let jsCodeForClassMembers = '';
        if (this.context.componentHasScript) {
            const { reactiveDeclarations, otherStatements } = this.handleScript(node.jsAST.content);
            reactiveDeclarationsJs = reactiveDeclarations; // These will be at the top of the mount method
            jsCodeForClassMembers = otherStatements.map(stmt => {
                // Adjust indentation for class members
                if (stmt.startsWith('function ')) { // Handle function declarations that become methods
                    return `    ${stmt}`;
                }
                return `    ${stmt}`;
            }).join('\n');
        }

        let customContentJs = '_createFragment([])'; // Default to an empty fragment
        let renderElementsVar = []; // To store created element references for binding
        if (node.customAST && node.customAST.content && node.customAST.content.html) {
            // This is where elements are created. We need to capture their variable names
            // for later use in binding.
            console.log('DEBUG: Calling _generateDomCreation for customAST content.');
            const { elementCreationCode, elementVars } = this._generateDomCreation(node.customAST.content.html);
            customContentJs = elementCreationCode;
            renderElementsVar = elementVars;
        } else if (node.customAST) {
            this.context.diagnosticReporter.report('warning', `Custom AST structure unexpected, missing 'content.html'.`, node.customAST.loc);
        }

        const cssCodeComment = this.context.componentHasStyles ? `\n          /* CSS Transpilation Placeholder: ${this.handleCSS(node.cssAST.content)} */` : '';

        // Generate binding calls AFTER elements are created in the render function
        const bindingCalls = this.context.bindingCleanupFunctions.map(code => `        this.cleanupFns.push(${code});`).join('\n');


        const componentClassString = `
export class ${componentClassName} {
    constructor(props = {}) {
        this.props = props;
        this.rootElement = null; // To hold the root DOM element of the component
        this.cleanupFns = []; // To store cleanup functions from bindings
        console.log("${componentClassName} constructor called.");
    }

    // Lifecycle method: Called when the component is first attached to the DOM
    mount(targetElement) {
        if (this.rootElement) {
            console.warn("Component already mounted. Call unmount first if re-mounting.");
            return;
        }

        console.log("Basic html working - ${componentClassName} mounting");

        // Reactive state declarations go here (e.g., const count = $state(0);)
${reactiveDeclarationsJs.map(decl => `        ${decl}`).join('\n')}

        // Reference elements for potential direct manipulation or bindings
${renderElementsVar.map(elVar => `        const ${elVar.name} = ${elVar.initCode};`).join('\n')}

        // Apply bindings
${bindingCalls}

        this.rootElement = ${renderElementsVar[0]?.name || customContentJs.split('= ')[1]}; // Assuming first element var is the root or use customContentJs directly
        targetElement.appendChild(this.rootElement);

        console.log("${componentClassName} mounted successfully.");
    }

    // Lifecycle method: Called when component's state or props change, triggering a re-render
    // With Pulse, this method's role shifts. It's less about re-rendering everything
    // and more about potentially updating props or initiating effects if needed.
    // The $effect system handles most reactive updates automatically.
    update(newProps) {
        console.log("${componentClassName} update called. New props:", newProps);
        if (newProps) {
            Object.assign(this.props, newProps); // Update props if provided
        }
        // No explicit DOM replacement here if using Pulse for updates
    }

    // Lifecycle method: Called when the component is removed from the DOM
    unmount() {
        if (this.rootElement && this.rootElement.parentNode) {
            this.rootElement.parentNode.removeChild(this.rootElement);
            this.rootElement = null;
            // Run cleanup functions for all reactive bindings
            this.cleanupFns.forEach(fn => fn());
            this.cleanupFns = [];
            console.log("${componentClassName} unmounted.");
        }
    }

    // The core render function now primarily just creates the initial DOM structure.
    // Reactive updates are handled by the $effect calls from the binding functions.
    // We can remove this.render() or repurpose it for initial element creation
    // and then apply bindings to the created elements.
    // A component may not strictly need a 'render' method in the traditional sense
    // if all DOM creation and updates are declarative via bindings.
    // For simplicity, let's keep it to create initial elements and then mount uses them.
    _createDomElements() { // Renamed from render()
        // Here, we just return the root element or fragment.
        // The bindings (state.text, state.bind, etc.) will be applied in mount().
        return ${customContentJs};
    }

    // Injected JS statements/functions from AST (these are now class methods/properties)
${jsCodeForClassMembers}
}
        `;

        // Imports for the reactivity system and DOM helpers
        const imports = Array.from(this.context.runtimeHelpers).map(helper =>
            `import { ${helper} } from './runtime.js';`
        ).join('\n');

        // Pop the global component scope at the very end
        this.context.popScope();

        return `${imports}\n\n${componentClassString}`;
    }

    // Helper: Combines adjacent TextNodes and MustacheTags into single _createTextNode calls
    // Also, now explicitly marks placeholders for reactive text binding.
    _combineTextualChildren(childrenNodes, parentVarName = 'parent') {
        const combinedNodeCalls = [];
        let elementCounter = 0; // Unique counter for generated element vars

        (childrenNodes || []).forEach(child => { // Defensive check for childrenNodes
            if (!child) {
                console.error('DEBUG: _combineTextualChildren - Encountered a NULL/UNDEFINED child!');
                return; // Skip null/undefined child
            }

            if (child.type === 'TextNode') {
                combinedNodeCalls.push(`_createTextNode(${JSON.stringify(child.value)})`);
            } else if (child.type === 'MustacheTag') {
                // For mustache tags in children, we create a text node and bind its content
                const textNodeVar = `_t${elementCounter++}`;
                const expressionCode = this.visit(child.expression, { isStateAccess: true }); // Ensure reactive access
                this.context.addHelper('$effect'); // Ensure $effect is imported
                this.context.addHelper('state');    // Ensure state helper is imported

                // Initial creation of text node
                combinedNodeCalls.push(`(${textNodeVar} = _createTextNode(${expressionCode}))`);
                // Add the binding cleanup function
                this.context.addBindingCleanup(`$effect(() => state.text(${textNodeVar}, ${expressionCode}))`);

            } else {
                // If we encounter a non-textual node (e.g., Element), just add its creation call
                combinedNodeCalls.push(this.visit(child));
            }
        });

        // console.log('DEBUG: _combineTextualChildren returning:', combinedNodeCalls.filter(Boolean).join(', '));
        return combinedNodeCalls.filter(Boolean).join(', ');
    }

    // NEW: Helper to generate DOM creation calls and capture element references
    _generateDomCreation(rootNode) {
        console.log('DEBUG: _generateDomCreation called for root node type:', rootNode?.type);
        const elementVars = []; // [{ name: 'div_1', initCode: '_createElement(...)' }]
        let elementCounter = 0;

        const generateRecursive = (node) => {
            // --- ADD DEBUG LOG HERE (High priority) ---
            if (!node) {
                console.error('DEBUG: generateRecursive received a NULL/UNDEFINED node! Returning empty string.');
                return ''; // Return empty string to skip this problematic node
            }
            console.log(`DEBUG: generateRecursive processing node type: ${node.type}, name: ${node.name || 'N/A'}`);
            // --- END DEBUG LOG ---

            if (node.type === 'Element') {
                const elementVarName = `_el${elementCounter++}`;
                this.context.addHelper('_createElement');
                this.context.addHelper('_createTextNode'); // Ensure helper is added for text children

                const tagName = JSON.stringify(toKebabCase(node.name));

                // Process attributes, capturing static ones and preparing binding code
                const { staticAttrs, dynamicBindings } = this.generateAttributes(node.attributes || [], elementVarName);

                // For children, recursively generate elements or get text/mustache strings
                const childrenJs = (node.children || []).map((child, idx) => { // Defensive check for node.children
                    // --- ADD DEBUG LOG HERE for children of an Element ---
                    if (!child) {
                        console.error(`DEBUG: Element '${node.name}' child at index ${idx} is NULL/UNDEFINED!`);
                        return ''; // Skip null/undefined child
                    }
                    // console.log(`DEBUG: Element '${node.name}' child ${idx} type: ${child.type}`);
                    // --- END DEBUG LOG ---

                    if (child.type === 'Element' || child.type === 'Fragment') {
                        return generateRecursive(child); // Recursively generate child elements
                    } else if (child.type === 'TextNode') {
                        return this.visitTextNode(child);
                    } else if (child.type === 'MustacheTag') {
                        // --- ADD DEBUG LOG HERE for MustacheTag child ---
                        if (!child.expression) {
                            console.error(`DEBUG: MustacheTag child of Element '${node.name}' has no expression!`, child);
                            this.context.diagnosticReporter.report('error', `MustacheTag has no expression.`, child.loc);
                            return '';
                        }
                        // --- END DEBUG LOG ---
                        const textNodeVar = `_t${elementCounter++}`;
                        const expressionCode = this.visit(child.expression, { isStateAccess: true });
                        this.context.addHelper('$effect');
                        this.context.addHelper('state');
                        this.context.addBindingCleanup(`$effect(() => state.text(${textNodeVar}, ${expressionCode}))`);
                        return `(${textNodeVar} = _createTextNode(${expressionCode}))`;
                    }
                    console.warn(`DEBUG: generateRecursive - Skipping unexpected child type for Element '${node.name}': ${child.type}`);
                    return ''; // Skip other nodes for DOM creation directly here
                }).filter(Boolean).join(', ');


                const initialCreation = `_createElement(${tagName}, ${staticAttrs}, [${childrenJs}])`;
                elementVars.push({ name: elementVarName, initCode: initialCreation });

                // Add dynamic bindings for this element to the cleanup list
                dynamicBindings.forEach(bindingCode => {
                    // The binding code should already contain the elementVarName correctly substituted
                    this.context.addBindingCleanup(bindingCode);
                });

                return elementVarName; // Return the variable name for use in parent's children array
            } else if (node.type === 'Fragment') {
                const fragmentVarName = `_frag${elementCounter++}`;
                this.context.addHelper('_createFragment');
                this.context.addHelper('_createTextNode'); // Ensure helper for text children

                const childrenJs = (node.children || []).map((child, idx) => { // Defensive check for node.children
                    // --- ADD DEBUG LOG HERE for children of a Fragment ---
                    if (!child) {
                        console.error(`DEBUG: Fragment child at index ${idx} is NULL/UNDEFINED!`);
                        return ''; // Skip null/undefined child
                    }
                    // console.log(`DEBUG: Fragment child ${idx} type: ${child.type}`);
                    // --- END DEBUG LOG ---

                    if (child.type === 'Element' || child.type === 'Fragment') {
                        return generateRecursive(child);
                    } else if (child.type === 'TextNode') {
                        return this.visitTextNode(child);
                    } else if (child.type === 'MustacheTag') {
                        // --- ADD DEBUG LOG HERE for MustacheTag child in Fragment ---
                        if (!child.expression) {
                            console.error(`DEBUG: MustacheTag child of Fragment has no expression!`, child);
                            this.context.diagnosticReporter.report('error', `MustacheTag has no expression.`, child.loc);
                            return '';
                        }
                        // --- END DEBUG LOG ---
                        const textNodeVar = `_t${elementCounter++}`;
                        const expressionCode = this.visit(child.expression, { isStateAccess: true });
                        this.context.addHelper('$effect');
                        this.context.addHelper('state');
                        this.context.addBindingCleanup(`$effect(() => state.text(${textNodeVar}, ${expressionCode}))`);
                        return `(${textNodeVar} = _createTextNode(${expressionCode}))`;
                    }
                    console.warn(`DEBUG: generateRecursive - Skipping unexpected child type for Fragment: ${child.type}`);
                    return '';
                }).filter(Boolean).join(', ');

                const initialCreation = `_createFragment([${childrenJs}])`;
                elementVars.push({ name: fragmentVarName, initCode: initialCreation });
                return fragmentVarName;
            } else if (node.type === 'TextNode' || node.type === 'MustacheTag') {
                // If the root node itself is a TextNode or MustacheTag, it needs to be created directly
                // and potentially bound if it's a MustacheTag.
                // This scenario means the component's root is a text node.
                // We'll return its creation code directly and ensure it's captured as the root.
                if (node.type === 'TextNode') {
                    const textNodeVar = `_t${elementCounter++}`;
                    elementVars.push({ name: textNodeVar, initCode: `_createTextNode(${JSON.stringify(node.value)})` });
                    return textNodeVar;
                } else if (node.type === 'MustacheTag') {
                    // --- ADD DEBUG LOG HERE for root MustacheTag ---
                    if (!node.expression) {
                        console.error(`DEBUG: Root MustacheTag has no expression!`, node);
                        this.context.diagnosticReporter.report('error', `MustacheTag has no expression.`, node.loc);
                        return '';
                    }
                    // --- END DEBUG LOG ---
                    const textNodeVar = `_t${elementCounter++}`;
                    const expressionCode = this.visit(node.expression, { isStateAccess: true });
                    this.context.addHelper('$effect');
                    this.context.addHelper('state');
                    this.context.addBindingCleanup(`$effect(() => state.text(${textNodeVar}, ${expressionCode}))`);
                    elementVars.push({ name: textNodeVar, initCode: `_createTextNode(${expressionCode})` });
                    return textNodeVar;
                }
            }
            console.warn(`DEBUG: _generateDomCreation - Skipping unexpected root node type: ${node.type}`);
            return ''; // This function focuses on element/fragment creation recursions
        };

        const rootElementVarName = generateRecursive(rootNode);
        return {
            elementCreationCode: rootElementVarName, // This will be the variable name of the root element
            elementVars: elementVars
        };
    }


    // --- Implement visit methods for Basic HTML (Custom AST) ---

    // Fragment and Element now primarily handle their structure,
    // actual binding logic is handled after element creation.
    visitFragment(node) {
        // This is now handled by _generateDomCreation
        this.context.diagnosticReporter.report('warning', `visitFragment should be called via _generateDomCreation. Direct call might be incomplete.`, node.loc);
        return `_createFragment([${this.generateChildren(node.children || [])}])`;
    }

    visitElement(node) {
        // This is now handled by _generateDomCreation
        this.context.diagnosticReporter.report('warning', `visitElement should be called via _generateDomCreation. Direct call might be incomplete.`, node.loc);
        return `_createElement(${JSON.stringify(toKebabCase(node.name))}, {}, [${this.generateChildren(node.children || [])}])`;
    }


    // visitTextNode now returns the raw string value, to be handled by _combineTextualChildren or _generateDomCreation
    visitTextNode(node) {
        if (node.value === undefined) {
            this.context.diagnosticReporter.report('error', `Text node missing 'value' property.`, node.loc);
            return '';
        }
        return JSON.stringify(node.value); // Return string literal for direct use in _createTextNode
    }

    // --- Implement visit methods for Text Interpolations (Mustache Tags) ---
    // visitMustacheTag now returns the transpiled expression, to be handled by _combineTextualChildren
    visitMustacheTag(node) {
        // --- ADD DEBUG LOG HERE ---
        if (!node.expression) {
            console.error('DEBUG: visitMustacheTag received a node with no expression!', node);
            this.context.diagnosticReporter.report('error', `MustacheTag node missing 'expression' property.`, node.loc);
            return '';
        }
        // --- END DEBUG LOG ---
        // For MustacheTag, we want the *expression* that should be evaluated.
        // The binding logic (_createTextNode + $effect) is handled by the parent
        // `_combineTextualChildren` or `_generateDomCreation`.
        return this.visit(node.expression, { isStateAccess: true });
    }

    visitMustacheExpression(node) {
        // --- ADD DEBUG LOG HERE ---
        if (!node.expression) {
            console.error('DEBUG: visitMustacheExpression received a node with no expression!', node);
            this.context.diagnosticReporter.report('error', `MustacheExpression node missing 'expression' property.`, node.loc);
            return '';
        }
        // --- END DEBUG LOG ---
        // Same as MustacheTag, just returns the expression string
        return this.visit(node.expression, { isStateAccess: true });
    }

    // --- Implement visit methods for Basic Attributes ---

    visitKeyValueAttribute(node, options = {}) {
        const attrName = node.name;
        const attrValueNode = node.value; // This is typically a Text (string) or MustacheAttribute

        // --- ADD DEBUG LOG HERE ---
        if (!attrValueNode) {
            console.error(`DEBUG: KeyValueAttribute '${attrName}' has a NULL/UNDEFINED value node!`, node);
            this.context.diagnosticReporter.report('error', `KeyValueAttribute '${attrName}' has a null or undefined value node.`, node.loc);
            return null; // Return null to indicate a problem with this attribute
        }
        console.log(`DEBUG: visitKeyValueAttribute processing '${attrName}'. Value node type: ${attrValueNode.type}`);
        // --- END DEBUG LOG ---

        // Handle cases for directive attributes like :text, :value, :class, :attr
        // These will translate into `state.bind` calls
        if (attrName.startsWith(':')) {
            const directive = attrName.substring(1); // e.g., 'text', 'value', 'attr', 'class'
            this.context.addHelper('state');
            this.context.addHelper('$effect');

            const elementVarName = options.elementVarName || 'UNKNOWN_ELEMENT'; // Get element var name from options

            let bindingCode = '';
            let isReactive = true;

            switch (directive) {
                case 'text':
                    if (attrValueNode.type === 'MustacheAttribute') {
                        // --- ADD DEBUG LOG HERE ---
                        if (!attrValueNode.expression) {
                            console.error(`DEBUG: :text directive value (MustacheAttribute) has no expression!`, attrValueNode);
                            this.context.diagnosticReporter.report('error', `:text directive value (MustacheAttribute) missing 'expression'.`, node.loc);
                            isReactive = false;
                            break;
                        }
                        // --- END DEBUG LOG ---
                        const boundVar = this.visit(attrValueNode.expression, { isStateAccess: true });
                        bindingCode = `$effect(() => state.text(${elementVarName}, ${boundVar}))`;
                    } else {
                        this.context.diagnosticReporter.report('error', `:text directive value must be a MustacheAttribute (e.g., :text={someState}).`, node.loc);
                        isReactive = false;
                    }
                    break;
                case 'value': // General bind for value attribute
                    if (attrValueNode.type === 'MustacheAttribute') {
                        // --- ADD DEBUG LOG HERE ---
                        if (!attrValueNode.expression) {
                            console.error(`DEBUG: :value directive value (MustacheAttribute) has no expression!`, attrValueNode);
                            this.context.diagnosticReporter.report('error', `:value directive value (MustacheAttribute) missing 'expression'.`, node.loc);
                            isReactive = false;
                            break;
                        }
                        // --- END DEBUG LOG ---
                        const boundVar = this.visit(attrValueNode.expression, { isStateAccess: true });
                        bindingCode = `$effect(() => state.bind(${elementVarName}, 'value', ${boundVar}))`; // assuming state.bind handles both value and change
                    } else {
                        this.context.diagnosticReporter.report('error', `:value directive value must be a MustacheAttribute (e.g., :value={someState}).`, node.loc);
                        isReactive = false;
                    }
                    break;
                case 'class':
                case 'attr':
                    // These typically expect a MustacheAttribute with an expression
                    if (attrValueNode.type === 'MustacheAttribute') {
                        // --- ADD DEBUG LOG HERE ---
                        if (!attrValueNode.expression) {
                            console.error(`DEBUG: :${directive} directive value (MustacheAttribute) has no expression!`, attrValueNode);
                            this.context.diagnosticReporter.report('error', `:${directive} directive value (MustacheAttribute) missing 'expression'.`, node.loc);
                            isReactive = false;
                            break;
                        }
                        // --- END DEBUG LOG ---
                        const boundVar = this.visit(attrValueNode.expression, { isStateAccess: true });
                        bindingCode = `$effect(() => state.${directive}(${elementVarName}, ${boundVar}))`;
                    } else {
                        this.context.diagnosticReporter.report('error', `:${directive} directive value must be a MustacheAttribute (e.g., :${directive}={someValue}).`, node.loc);
                        isReactive = false;
                    }
                    break;
                default:
                    this.context.diagnosticReporter.report('warning', `Unsupported directive attribute: '${attrName}'.`, node.loc);
                    isReactive = false;
                    break;
            }

            if (isReactive && bindingCode) {
                return { name: attrName, isReactiveBinding: true, code: bindingCode };
            } else {
                return null; // Indicate problematic or unhandled reactive attribute
            }
        }

        // Handle regular HTML attributes
        let value = null;
        let isExpression = false;

        if (attrValueNode.type === 'Text') {
            value = attrValueNode.value;
        } else if (attrValueNode.type === 'MustacheAttribute') {
            // This case handles regular attributes whose values are expressions, e.g., id={someId}
            // These still become static props initially, but their value comes from an expression.
            // Note: If you want these to be truly reactive, you'd need specific $effect bindings for them.
            // For now, they are resolved once at creation.
            // --- ADD DEBUG LOG HERE ---
            if (!attrValueNode.expression) {
                console.error(`DEBUG: MustacheAttribute value for '${attrName}' has no expression!`, attrValueNode);
                this.context.diagnosticReporter.report('error', `MustacheAttribute value for '${attrName}' missing 'expression'.`, node.loc);
                return null;
            }
            // --- END DEBUG LOG ---
            value = this.visit(attrValueNode.expression, { isStateAccess: true });
            isExpression = true;
        } else {
            this.context.diagnosticReporter.report('error', `Unsupported attribute value node type for attribute '${attrName}': ${attrValueNode.type}.`, node.loc);
            return null;
        }

        return { name: attrName, value: value, isReactiveBinding: false, isEventHandler: false, isExpression: isExpression };
    }

    visitBooleanAttribute(node) {
        // Boolean attributes in HTML don't need a value, presence implies true.
        // In JSX/JS, it's typically `attributeName={true}` or just `attributeName`.
        // We'll treat it as a static attribute with a value of `true`.
        return { name: node.name, value: 'true', isReactiveBinding: false, isEventHandler: false, isExpression: false };
    }

    visitTwoWayBindingAttribute(node, options = {}) {
        this.context.addHelper('state');
        this.context.addHelper('$effect');

        const elementVarName = options.elementVarName || 'UNKNOWN_ELEMENT';

        // --- ADD DEBUG LOG HERE ---
        if (!node.expression) {
            console.error(`DEBUG: TwoWayBindingAttribute '${node.name}' has no expression!`, node);
            this.context.diagnosticReporter.report('error', `TwoWayBindingAttribute '${node.name}' missing 'expression'.`, node.loc);
            return null;
        }
        // --- END DEBUG LOG ---

        const bindingTarget = this.visit(node.expression, { isStateAccess: true, isAssignmentTarget: true });

        // Generate binding for input/textarea 'value' or checkbox/radio 'checked'
        // This is simplified; real-world might need more checks (e.g., input type)
        const bindingCode = `$effect(() => state.bind(${elementVarName}, ${JSON.stringify(node.name)}, ${bindingTarget}))`;

        // Return a special object that generateAttributes can interpret as a reactive binding
        return { name: node.name, isReactiveBinding: true, code: bindingCode };
    }

    visitText(node) {
        // This 'Text' type for attribute values just returns its literal value.
        // It's different from a 'TextNode' in children.
        if (node.value === undefined) {
            this.context.diagnosticReporter.report('error', `Attribute 'Text' node missing 'value' property.`, node.loc);
            return '';
        }
        return JSON.stringify(node.value);
    }

    visitEventHandler(node) {
        this.context.addHelper('state'); // State helper for `state.on`

        // --- ADD DEBUG LOG HERE ---
        if (!node.value || !node.value.expression) {
            console.error(`DEBUG: EventHandler '${node.name}' has missing value or expression!`, node);
            this.context.diagnosticReporter.report('error', `EventHandler '${node.name}' has no valid expression.`, node.loc);
            return null;
        }
        // --- END DEBUG LOG ---

        const handlerExpression = this.visit(node.value.expression, { isStateAccess: false }); // Event handlers usually call functions, not access state.value

        // For event handlers, we return an object that `generateAttributes` will use to create a static `onEvent` property.
        // The actual `state.on` call will be generated directly in `generateAttributes` or `_generateDomCreation`.
        return { name: `@${node.name}`, value: handlerExpression, isEventHandler: true };
    }

    visitMustacheAttribute(node, options = {}) {
        // This represents an expression used as an attribute's value, e.g., id={someVar}
        // It's not a binding by itself, but its *expression* might contain reactive vars.
        // The `visitKeyValueAttribute` or `visitEventHandler` will call this.
        // --- ADD DEBUG LOG HERE ---
        if (!node.expression) {
            console.error('DEBUG: visitMustacheAttribute received a node with no expression!', node);
            this.context.diagnosticReporter.report('error', `MustacheAttribute node missing 'expression' property.`, node.loc);
            return '';
        }
        // --- END DEBUG LOG ---
        return { value: this.visit(node.expression, options), isExpression: true };
    }


    // --- Implement visit methods for JS AST Nodes ---

    visitVariableDeclaration(node) {
        this.context.pushScope(); // Each VariableDeclaration introduces a new scope for its declarations

        const kind = node.kind; // 'const', 'let', 'var'
        const declarations = node.declarations.map(decl => {
            const id = this.visit(decl.id);
            const init = decl.init ? this.visit(decl.init) : '';

            // Register variable in the current scope
            this.context.symbolTable.declare(id, { type: 'variable', isReactive: false, node: decl.id });

            return `${id}${init ? ` = ${init}` : ''}`;
        }).join(', ');

        this.context.popScope();
        return `${kind} ${declarations}`;
    }

    visitExpressionStatement(node) {
        // --- ADD DEBUG LOG HERE ---
        if (!node.expression) {
            console.error('DEBUG: ExpressionStatement node has no expression!', node);
            this.context.diagnosticReporter.report('error', `ExpressionStatement node missing 'expression'.`, node.loc);
            return '';
        }
        // --- END DEBUG LOG ---
        return this.visit(node.expression);
    }

    visitCallExpression(node, options = {}) {
        // --- ADD DEBUG LOG HERE ---
        if (!node.callee) {
            console.error('DEBUG: CallExpression node has no callee!', node);
            this.context.diagnosticReporter.report('error', `CallExpression node missing 'callee'.`, node.loc);
            return 'null()'; // Return a safe default
        }
        // --- END DEBUG LOG ---

        const callee = this.visit(node.callee, options);
        // --- ADD DEBUG LOG HERE ---
        const args = (node.arguments || []).map((arg, idx) => {
            if (!arg) {
                console.error(`DEBUG: CallExpression '${callee}' argument at index ${idx} is NULL/UNDEFINED!`);
                return 'undefined'; // Provide a placeholder or error
            }
            return this.visit(arg, options);
        }).join(', ');
        // --- END DEBUG LOG ---

        return `${callee}(${args})`;
    }

    visitMemberExpression(node, options = {}) {
        // --- ADD DEBUG LOG HERE ---
        if (!node.object || !node.property) {
            console.error('DEBUG: MemberExpression node missing object or property!', node);
            this.context.diagnosticReporter.report('error', `MemberExpression node missing 'object' or 'property'.`, node.loc);
            return 'null.null';
        }
        // --- END DEBUG LOG ---

        const object = this.visit(node.object, options);
        const property = node.computed ? this.visit(node.property, options) : node.property.name;

        // If the object is a reactive state variable, ensure we access its .value
        const symbolInfo = this.context.symbolTable.resolve(node.object.name);
        if (symbolInfo && symbolInfo.isReactive && options.isStateAccess) {
            return `${object}.value.${property}`; // e.g., count.value.property
        }

        return `${object}${node.computed ? `[${property}]` : `.${property}`}`;
    }

    visitIdentifier(node, options = {}) {
        const symbolInfo = this.context.symbolTable.resolve(node.name);
        if (symbolInfo && symbolInfo.isReactive && options.isStateAccess) {
            // For reactive variables when reading their value
            return `${node.name}.value`;
        } else if (symbolInfo && symbolInfo.isReactive && options.isAssignmentTarget) {
            // For reactive variables when they are the target of an assignment
            return `${node.name}.value`;
        }
        return node.name;
    }

    visitLiteral(node) {
        return JSON.stringify(node.value);
    }

    visitFunctionDeclaration(node) {
        this.context.pushScope(); // Functions create a new scope

        const id = node.id ? this.visit(node.id) : ''; // Function name
        const params = (node.params || []).map(param => {
            // Register parameters in the function's scope
            this.context.symbolTable.declare(param.name, { type: 'parameter', isReactive: false, node: param });
            return this.visit(param);
        }).join(', ');

        const body = this.visit(node.body); // Visit the function body (BlockStatement)

        this.context.popScope(); // Pop the function scope

        return `function ${id}(${params}) ${body}`;
    }

    visitBlockStatement(node) {
        this.context.pushScope(true); // Block statements create a block scope

        const body = (node.body || []).map(stmt => {
            // --- ADD DEBUG LOG HERE ---
            if (!stmt) {
                console.error('DEBUG: BlockStatement has a NULL/UNDEFINED statement!', node);
                this.context.diagnosticReporter.report('warning', `Skipping null/undefined statement in block body.`, null);
                return '';
            }
            // --- END DEBUG LOG ---
            const transpiled = this.visit(stmt);
            return transpiled ? `${transpiled};` : ''; // Add semicolon for statements
        }).filter(Boolean).join('\n    '); // Join with newline and indentation

        this.context.popScope(); // Pop the block scope

        return `{\n    ${body}\n}`;
    }

    visitReturnStatement(node) {
        // --- ADD DEBUG LOG HERE ---
        if (!node.argument) {
            console.warn('DEBUG: ReturnStatement has no argument!', node);
            // This might be valid for `return;` but good to log for debugging
        }
        // --- END DEBUG LOG ---
        const argument = node.argument ? this.visit(node.argument) : '';
        return `return ${argument}`;
    }

    visitUpdateExpression(node) {
        this.context.addHelper('state'); // For reactive updates via state.set

        // --- ADD DEBUG LOG HERE ---
        if (!node.argument) {
            console.error('DEBUG: UpdateExpression node has no argument!', node);
            this.context.diagnosticReporter.report('error', `UpdateExpression node missing 'argument'.`, node.loc);
            return '';
        }
        // --- END DEBUG LOG ---

        const argumentCode = this.visit(node.argument, { isStateAccess: true, isAssignmentTarget: true });
        const operator = node.operator;

        // If the argument is a reactive variable (e.g., `count.value`), we need to wrap the update
        // in a `state.set` call to trigger reactivity.
        const symbolInfo = this.context.symbolTable.resolve(node.argument.name); // Assumes argument is Identifier for simplicity
        if (symbolInfo && symbolInfo.isReactive) {
            // For `count++` becomes `state.set(count, count.value + 1)`
            // For `count--` becomes `state.set(count, count.value - 1)`
            const op = operator === '++' ? '+' : '-';
            return `state.set(${node.argument.name}, ${node.argument.name}.value ${op} 1)`;
        } else {
            // For non-reactive variables, regular JS update expression
            return `${node.prefix ? operator : ''}${this.visit(node.argument)}${!node.prefix ? operator : ''}`;
        }
    }

    visitAssignmentExpression(node) {
        this.context.addHelper('state'); // For reactive assignments via state.set

        // --- ADD DEBUG LOG HERE ---
        if (!node.left || !node.right) {
            console.error('DEBUG: AssignmentExpression node missing left or right side!', node);
            this.context.diagnosticReporter.report('error', `AssignmentExpression node missing 'left' or 'right' side.`, node.loc);
            return '';
        }
        // --- END DEBUG LOG ---

        const left = this.visit(node.left, { isStateAccess: true, isAssignmentTarget: true });
        const right = this.visit(node.right, { isStateAccess: true });
        const operator = node.operator; // e.g., '=', '+=', '-='

        const symbolInfo = this.context.symbolTable.resolve(node.left.name);
        if (symbolInfo && symbolInfo.isReactive) {
            // For reactive variables, use state.set
            if (operator === '=') {
                return `state.set(${node.left.name}, ${right})`;
            } else {
                // Handle compound assignments like `count += 5`
                // Becomes `state.set(count, count.value + 5)`
                const baseOperator = operator.substring(0, operator.length - 1); // Extract +, -, etc.
                return `state.set(${node.left.name}, ${node.left.name}.value ${baseOperator} ${right})`;
            }
        } else {
            // For non-reactive variables, regular JS assignment
            return `${left} ${operator} ${right}`;
        }
    }

    visitObjectLiteral(node, options = {}) {
        // --- ADD DEBUG LOG HERE ---
        if (!node.properties) {
            console.error('DEBUG: ObjectLiteral node has no properties array!', node);
            this.context.diagnosticReporter.report('error', `ObjectLiteral node missing 'properties' array.`, node.loc);
            return '{}';
        }
        // --- END DEBUG LOG ---
        const properties = (node.properties || []).map((prop, idx) => {
            if (!prop) {
                console.error(`DEBUG: ObjectLiteral property at index ${idx} is NULL/UNDEFINED!`);
                return '';
            }
            return this.visit(prop, options);
        }).filter(Boolean).join(', ');
        return `{ ${properties} }`;
    }

    visitProperty(node, options = {}) {
        // --- ADD DEBUG LOG HERE ---
        if (!node.key || !node.value) {
            console.error('DEBUG: Object Property node missing key or value!', node);
            this.context.diagnosticReporter.report('error', `Object Property node missing 'key' or 'value'.`, node.loc);
            return '';
        }
        // --- END DEBUG LOG ---
        const key = this.visit(node.key, options);
        const value = this.visit(node.value, options);
        return `${key}: ${value}`;
    }

    visitArrayLiteral(node, options = {}) {
        // --- ADD DEBUG LOG HERE ---
        if (!node.elements) {
            console.error('DEBUG: ArrayLiteral node has no elements array!', node);
            this.context.diagnosticReporter.report('error', `ArrayLiteral node missing 'elements' array.`, node.loc);
            return '[]';
        }
        // --- END DEBUG LOG ---
        const elements = (node.elements || []).map((el, idx) => {
            if (!el) {
                console.error(`DEBUG: ArrayLiteral element at index ${idx} is NULL/UNDEFINED!`);
                return 'undefined'; // Or throw
            }
            return this.visit(el, options);
        }).filter(Boolean).join(', ');
        return `[${elements}]`;
    }

    visitTemplateLiteral(node, options = {}) {
        // --- ADD DEBUG LOG HERE ---
        if (!node.quasis || !node.expressions) {
            console.error('DEBUG: TemplateLiteral node missing quasis or expressions!', node);
            this.context.diagnosticReporter.report('error', `TemplateLiteral node missing 'quasis' or 'expressions'.`, node.loc);
            return '""';
        }
        // --- END DEBUG LOG ---
        let result = '`';
        node.quasis.forEach((quasi, i) => {
            result += quasi.value.raw;
            if (node.expressions[i]) {
                result += `\${${this.visit(node.expressions[i], options)}}`;
            }
        });
        result += '`';
        return result;
    }

    visitArrowFunctionExpression(node, options = {}) {
        this.context.pushScope(); // Arrow functions create a new scope

        const params = (node.params || []).map(param => {
            this.context.symbolTable.declare(param.name, { type: 'parameter', isReactive: false, node: param });
            return this.visit(param);
        }).join(', ');

        // If the body is not a BlockStatement, it's an implicit return
        const body = node.body.type === 'BlockStatement' ? this.visit(node.body) : `(${this.visit(node.body, options)})`;

        this.context.popScope(); // Pop the function scope

        return `(${params}) => ${body}`;
    }

    // --- Remaining JS AST Nodes (still placeholders, adding a few common ones) ---
    // You would implement these similarly, ensuring null/undefined checks for their properties

    // Example for a binary expression (if it had more complex structure)
    // visitBinaryExpression(node, options) {
    //     if (!node.left || !node.right) {
    //         this.context.diagnosticReporter.report('error', `BinaryExpression missing left or right operand.`, node.loc);
    //         return '';
    //     }
    //     const left = this.visit(node.left, options);
    //     const right = this.visit(node.right, options);
    //     return `${left} ${node.operator} ${right}`;
    // }

    // ... (rest of your visit methods for other AST types)

    // Fallback for unimplemented JS AST Nodes
    visitTernaryExpression(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitLogicalORExpression(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitLogicalNullishExpression(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitLogicalANDExpression(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitBitwiseExpression(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitEqualityExpression(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitRelationalExpression(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitAdditiveExpression(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitMultiplicativeExpression(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitLeftHandSideExpression(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitPostfixUnaryExpression(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitPrimaryExpression(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitUnaryExpression(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitParenthesizedExpressions(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitChainedIdentifier(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitIIFE(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }
    visitConsequentExpression(node) { this.context.diagnosticReporter.report('warning', `Transpilation for JS AST node type '${node.type}' not yet fully implemented.`, node.loc); return ''; }

    // --- CSS AST Nodes (from cssAST property) ---
    visitCssRoot(node) { return this.handleCSS(node); } // Delegate to handleCSS
    visitCssRule(node) { return this.handleCSS(node); }
    visitCssDeclaration(node) { return this.handleCSS(node); }

    default(node) {
        this.context.diagnosticReporter.report('error', `Unsupported AST node type encountered: '${node.type}'. This indicates a grammar or AST generation issue.`, node.loc);
        return '';
    }
}
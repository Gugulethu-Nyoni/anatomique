import { writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import escodegen from 'escodegen';
import { parse } from 'acorn';

// Helper for deep cloning an AST node (needed because we'll modify it)
function deepCloneAstNode(node) {
    // A simple JSON parse/stringify is usually sufficient for most ASTs
    // generated by Acorn, as long as they don't contain circular references
    // or non-JSON-serializable properties (like functions).
    return JSON.parse(JSON.stringify(node));
}

// Recursive AST transformation function
// This function will walk the AST and replace any reactive variable identifier
// with a MemberExpression that accesses its `.value` property.
function transformReactiveIdentifiersInExpression(node, isReactiveVariableFn) {
    if (!node || typeof node !== 'object' || !node.type) {
        return node;
    }

    // Process the current node
    if (node.type === 'Identifier' && isReactiveVariableFn(node.name)) {
        // If this identifier is a reactive variable, transform it to `identifier.value`
        // Ensure it's not already part of a '.value' access (though unlikely if it's a bare Identifier)
        return {
            type: 'MemberExpression',
            object: deepCloneAstNode(node), // The original identifier becomes the object
            property: { type: 'Identifier', name: 'value' },
            computed: false,
            optional: false
        };
    }

    // Recursively process children of the current node
    for (const key in node) {
        if (node.hasOwnProperty(key) && key !== 'loc' && key !== 'range' && key !== 'comments' && key !== 'tokens') {
            const value = node[key];
            if (Array.isArray(value)) {
                node[key] = value.map(item => transformReactiveIdentifiersInExpression(item, isReactiveVariableFn));
            } else if (typeof value === 'object' && value !== null) {
                node[key] = transformReactiveIdentifiersInExpression(value, isReactiveVariableFn);
            }
        }
    }
    return node;
}


export default class Anatomique {
    constructor(jsAST, cssAST, customAST, filePath) {
        this.filePath = filePath;
        this.fileName = basename(filePath, '.ast');
        this.appRootId = 'app';
        this.jsAST = jsAST;
        this.cssAST = cssAST;
        this.customAST = customAST;
        this.transpiledJSContent = [];
        this.componentCleanups = [];
        this.transpiledHTML = '';
        this.distDir = './dist';
        this.addState = true;
        this.reactiveVariables = new Set(); // Stores names of $state and $derived variables

        this.globalDerivedCache = new Map(); // Map: expressionString -> varName
        this.globalDerivedDeclarations = []; // Array of actual 'const varName = $derived(...);' strings

        this.currentBlockDerivedDeclarations = []; // Temporary storage for deriveds in create_fragment functions

        this.analyzeJsAST(); // Populate `this.reactiveVariables`

        this.nodeToTranspilerMap = {
            Element: this.Element.bind(this),
            KeyValueAttribute: this.Attribute.bind(this),
            BooleanAttribute: this.Attribute.bind(this),
            EventHandler: this.Attribute.bind(this),
            TwoWayBindingAttribute: this.Attribute.bind(this),
            MustacheAttribute: this.Attribute.bind(this),
            BooleanIdentifierAttribute: this.Attribute.bind(this),
            Fragment: this.Fragment.bind(this),
            TextNode: this.TextNode.bind(this),
            MustacheTag: this.MustacheTag.bind(this),
            IfStatement: this.IfStatement.bind(this),
        };

        this.transpiledJSContent.push(`const appRoot = document.getElementById('${this.appRootId}');\n`);

        this.traverse();

        this.output();
    }

    // --- Utility Methods ---
    analyzeJsAST() {
        const jsBody = this.jsAST.content.body;
        for (const node of jsBody) {
            if (node.type === 'VariableDeclaration') {
                for (const declaration of node.declarations) {
                    if (declaration.init && declaration.init.type === 'CallExpression') {
                        const callee = declaration.init.callee;
                        if (callee.type === 'Identifier' && (callee.name === '$state' || callee.name === '$derived')) {
                            this.reactiveVariables.add(declaration.id.name);
                        }
                    }
                }
            }
        }
    }

    isReactiveVariable(varName) {
        return this.reactiveVariables.has(varName);
    }

    getUniqueId(prefix = '') {
        return `${prefix}${Math.random().toString(36).slice(2, 8)}`;
    }

    // --- NEW / UPDATED: Helper to get/create a global derived variable ---
    getOrCreateDerived(expressionCode) {
        let transformedExpressionCode;
        try {
            // Parse the full expression (e.g., "isAdmin ? 'Logout' : 'Login'")
            // Note: Acorn's `parse` expects a program or module, so we wrap the expression in parentheses.
            // Then access the expression itself.
            const parsedProgram = parse(`(${expressionCode})`, { ecmaVersion: 2020 });
            const expressionAst = parsedProgram.body[0].expression;

            // Apply the transformation to the AST of the expression
            const transformedAst = transformReactiveIdentifiersInExpression(expressionAst, (name) => this.isReactiveVariable(name));

            // Generate code from the transformed AST
            transformedExpressionCode = escodegen.generate(transformedAst);
        } catch (e) {
            console.error(`Error parsing or transforming derived expression "${expressionCode}":`, e);
            // Fallback: if AST transformation fails, use original code (might be incorrect)
            transformedExpressionCode = expressionCode;
        }

        // Use the transformed code for caching
        if (this.globalDerivedCache.has(transformedExpressionCode)) {
            return this.globalDerivedCache.get(transformedExpressionCode);
        }

        const derivedVarName = this.getUniqueId('derived_');
        this.globalDerivedCache.set(transformedExpressionCode, derivedVarName);
        // The `$derived` factory function wraps the transformed expression
        this.globalDerivedDeclarations.push(`const ${derivedVarName} = $derived(() => ${transformedExpressionCode});`);
        return derivedVarName;
    }
    // --- END NEW / UPDATED getOrCreateDerived ---

    // --- Traversal Method ---
    traverse() {
        const htmlFragment = this.customAST?.content?.html;
        if (!htmlFragment || !Array.isArray(htmlFragment.children)) {
            console.warn("customAST.content.html or its children not found.");
            return;
        }

        const customSyntaxNode = htmlFragment.children.find(
            child => child.type === 'Element' && child.name === 'customSyntax'
        );

        if (!customSyntaxNode || !Array.isArray(customSyntaxNode.children)) {
            console.error("Custom syntax wrapper element 'customSyntax' not found or has no children.");
            return;
        }

        for (const child of customSyntaxNode.children) {
            if (child.type === 'CommentBlock') continue;

            const transpileFn = this.nodeToTranspilerMap[child.type];
            if (transpileFn) {
                transpileFn(child, 'appRoot'); // Start with appRoot as the parent
            } else {
                console.warn(`No transpiler function found for node type: ${child.type}`);
            }
        }
    }

    // --- Node Transpilation Methods ---

    Element(node, parentVar) {
        const varName = `${node.name}_elem_${this.getUniqueId()}`;

        this.transpiledJSContent.push(`const ${varName} = document.createElement("${node.name}");`);
        this.transpiledJSContent.push(`${parentVar}.appendChild(${varName});`);

        if (Array.isArray(node.attributes)) {
            for (const attr of node.attributes) {
                const transpileFn = this.nodeToTranspilerMap[attr.type];
                if (transpileFn) transpileFn(attr, varName);
            }
        }

        let textParts = [];
        let hasReactiveText = false;

        const processChildren = (children) => {
            if (!Array.isArray(children)) return;
            for (const child of children) {
                if (child.type === 'Fragment' || child.type === 'Element' || child.type === 'IfStatement') {
                    this.outputElementTextContent(textParts, hasReactiveText, varName);
                    textParts = [];
                    hasReactiveText = false;

                    const transpileFn = this.nodeToTranspilerMap[child.type];
                    if (transpileFn) transpileFn(child, varName);
                } else if (child.type === 'TextNode') {
                    textParts.push({ type: 'static', value: child.value });
                } else if (child.type === 'MustacheTag') {
                    const expr = child.expression;
                    const exprCode = escodegen.generate(expr);

                    // A robust check for reactivity now relies on the `getOrCreateDerived`'s
                    // ability to transform the expression internally.
                    // If the expression doesn't contain any reactive variables *after* transformation,
                    // it will essentially be static.
                    // For now, we'll continue to assume if it contains a reactive variable name, it's reactive.
                    const isExpressionReactive = Array.from(this.reactiveVariables).some(rv => exprCode.includes(rv));


                    if (isExpressionReactive) {
                        const derivedVar = this.getOrCreateDerived(exprCode);
                        textParts.push({ type: 'reactive', value: derivedVar });
                        hasReactiveText = true;
                    } else {
                        textParts.push({ type: 'static_expression', value: exprCode });
                    }
                } else if (child.type === 'CommentBlock') {
                    // Skip comments
                } else {
                    this.outputElementTextContent(textParts, hasReactiveText, varName);
                    textParts = [];
                    hasReactiveText = false;

                    const transpileFn = this.nodeToTranspilerMap[child.type];
                    if (transpileFn) transpileFn(child, varName);
                }
            }
        };

        processChildren(node.children);

        if (textParts.length > 0) {
            this.outputElementTextContent(textParts, hasReactiveText, varName);
        }
        this.transpiledJSContent.push('\n');
    }

    outputElementTextContent(textParts, hasReactiveText, elementVarName) {
        if (textParts.length === 0) return;

        if (hasReactiveText) {
            const derivedExpressionString = textParts.map(part => {
                if (part.type === 'static') {
                    return JSON.stringify(part.value);
                } else if (part.type === 'reactive') {
                    return `${part.value}.value`; // Access the .value of the derived
                } else if (part.type === 'static_expression') {
                    return `(${part.value})`;
                }
                return "''";
            }).join(' + ');

            const derivedTextVar = this.getOrCreateDerived(derivedExpressionString);
            this.transpiledJSContent.push(`bindText(${elementVarName}, ${derivedTextVar});`);
        } else {
            const staticContent = textParts.map(part => {
                if (part.type === 'static') {
                    return part.value;
                } else if (part.type === 'static_expression') {
                    return `\${${part.value}}`;
                }
                return '';
            }).join('');

            if (textParts.some(p => p.type === 'static_expression')) {
                this.transpiledJSContent.push(`${elementVarName}.textContent = \`${staticContent}\`;`);
            } else {
                this.transpiledJSContent.push(`${elementVarName}.textContent = ${JSON.stringify(staticContent)};`);
            }
        }
    }

    Fragment(node, parentVar) {
        for (const child of node.children) {
            const transpileFn = this.nodeToTranspilerMap[child.type];
            if (transpileFn) {
                transpileFn(child, parentVar);
            } else {
                console.warn(`No transpiler function found for node type: ${child.type} within a fragment.`);
            }
        }
    }

    Attribute(attr, elementVarName) {
        switch (attr.type) {
            case "KeyValueAttribute": {
                const attrName = attr.name;
                const attrValue = attr.value?.[0]?.data || "";
                this.transpiledJSContent.push(`${elementVarName}.setAttribute("${attrName}", ${JSON.stringify(attrValue)});`);
                break;
            }

            case "TwoWayBindingAttribute": {
                const bindVarName = attr.expression?.name || "undefinedVar";

                if (!this.isReactiveVariable(bindVarName)) {
                    console.warn(`Two-way binding on non-reactive variable: ${bindVarName}`);
                    this.transpiledJSContent.push(`${elementVarName}.value = ${bindVarName};`);
                    break;
                }
                this.transpiledJSContent.push(`bind(${elementVarName}, ${bindVarName});`);
                break;
            }

            case "MustacheAttribute": {
                const dynAttr = attr.name;
                const expression = attr.expression;

                if (!expression) {
                    console.error("MustacheAttribute: Missing expression for", dynAttr);
                    return;
                }

                const dynValueCode = escodegen.generate(expression);

                const derivedAttrValueVar = this.getOrCreateDerived(dynValueCode);

                this.transpiledJSContent.push(`bindAttr(${elementVarName}, "${dynAttr}", () => ${derivedAttrValueVar}.value);`);
                break;
            }

            case "EventHandler": {
                const eventName = attr.name;
                const eventHandlerExpression = attr.expression;

                if (!eventHandlerExpression) {
                    console.error("EventHandler: Missing expression for", eventName);
                    return;
                }

                const handlerCode = escodegen.generate(eventHandlerExpression);

                let finalHandlerCode;

                if (eventHandlerExpression.type === 'ArrowFunctionExpression' ||
                    eventHandlerExpression.type === 'FunctionExpression') {
                    finalHandlerCode = handlerCode;
                } else if (eventHandlerExpression.type === 'Identifier') {
                    finalHandlerCode = `() => ${handlerCode}()`;
                } else if (eventHandlerExpression.type === 'CallExpression') {
                    finalHandlerCode = `() => ${handlerCode}`;
                } else {
                    finalHandlerCode = `() => ${handlerCode}`;
                }

                this.transpiledJSContent.push(`${elementVarName}.addEventListener("${eventName}", ${finalHandlerCode});`);
                break;
            }

            case "BooleanAttribute":
            case "BooleanIdentifierAttribute": {
                const attrName = attr.name;
                const attrValue = attr.value;

                if (typeof attrValue === 'string' && this.isReactiveVariable(attrValue)) {
                    // For reactive variables used as boolean attributes (e.g., `disabled={isAdmin}`)
                    // We need to pass the derived's value to bindAttr
                    const derivedCondition = this.getOrCreateDerived(attrValue); // This handles `isAdmin` -> `isAdmin.value`
                    this.transpiledJSContent.push(`bindAttr(${elementVarName}, "${attrName}", () => ${derivedCondition}.value);`);
                } else if (typeof attrValue === 'string' && (attrValue === 'true' || attrValue === 'false')) {
                    this.transpiledJSContent.push(`${elementVarName}.toggleAttribute("${attrName}", ${attrValue});`);
                } else {
                    this.transpiledJSContent.push(`${elementVarName}.toggleAttribute("${attrName}", ${!!attrValue});`);
                }
                break;
            }

            default:
                this.transpiledJSContent.push(`// Unknown attribute type: ${attr.type}`);
        }
    }

    TextNode(node, parentVar) {
        const varName = `text_node_${this.getUniqueId()}`;
        this.transpiledJSContent.push(`const ${varName} = document.createTextNode(${JSON.stringify(node.value)});`);
        this.transpiledJSContent.push(`${parentVar}.appendChild(${varName});`);
    }

    MustacheTag(node, parentVar) {
        const varName = `mustache_node_${this.getUniqueId()}`;

        this.transpiledJSContent.push(`const ${varName} = document.createTextNode('');`);
        this.transpiledJSContent.push(`${parentVar}.appendChild(${varName});`);

        if (!node.expression) {
            console.error("MustacheTag: Missing expression");
            return;
        }

        const expressionCode = escodegen.generate(node.expression);
        // isExpressionReactive logic for MustacheTag now also leverages the smarter getOrCreateDerived
        const isExpressionReactive = Array.from(this.reactiveVariables).some(rv => expressionCode.includes(rv));


        if (isExpressionReactive) {
            const derivedVar = this.getOrCreateDerived(expressionCode);
            this.transpiledJSContent.push(`bindText(${varName}, ${derivedVar});`);
        } else {
            this.transpiledJSContent.push(`${varName}.textContent = ${expressionCode};`);
        }
    }

    // --- Conditional Block Handling ---
    transpileBlock(blockNodes) {
        const originalTranspiledContent = this.transpiledJSContent;
        const originalCurrentBlockDerivedDeclarations = this.currentBlockDerivedDeclarations; // Save this too
        const originalComponentCleanups = this.componentCleanups;

        this.transpiledJSContent = [];
        this.currentBlockDerivedDeclarations = [];
        this.componentCleanups = [];

        const fragmentVar = `fragmentRoot_${this.getUniqueId()}`;
        this.transpiledJSContent.push(`const ${fragmentVar} = document.createDocumentFragment();`);

        for (const child of blockNodes) {
            const transpileFn = this.nodeToTranspilerMap[child.type];
            if (transpileFn) {
                transpileFn(child, fragmentVar);
            } else {
                console.warn(`No transpiler function found for node type: ${child.type} within a block.`);
            }
        }

        const blockJS = this.currentBlockDerivedDeclarations.join('\n') + '\n' + this.transpiledJSContent.join('\n');
        const blockCleanups = this.componentCleanups.join('\n');

        this.transpiledJSContent = originalTranspiledContent;
        this.currentBlockDerivedDeclarations = originalCurrentBlockDerivedDeclarations; // Restore this
        this.componentCleanups = originalComponentCleanups;

        return {
            blockJS,
            blockCleanups,
            fragmentVar
        };
    }

    IfStatement(node, parentVar) {
        const id = this.getUniqueId();
        const placeholderCommentVar = `if_placeholder_${id}`;
        
        // The condition for the if statement. Use getOrCreateDerived for the condition itself.
        // This will now correctly transform `isAdmin` to `isAdmin.value`
        const conditionCode = escodegen.generate(node.test);
        const derivedConditionVar = this.getOrCreateDerived(conditionCode);

        this.transpiledJSContent.push(`const ${placeholderCommentVar} = document.createComment('if block');`);
        this.transpiledJSContent.push(`${parentVar}.appendChild(${placeholderCommentVar});`);

        const ifBranchData = this.transpileBlock(node.consequent.body);
        const createIfFragmentFunction = `create_if_fragment_${id}`;

        this.transpiledJSContent.push(`const ${createIfFragmentFunction} = () => {`);
        this.transpiledJSContent.push(ifBranchData.blockJS);
        this.transpiledJSContent.push(`    return {`);
        this.transpiledJSContent.push(`        nodes: Array.from(${ifBranchData.fragmentVar}.childNodes),`);
        this.transpiledJSContent.push(`        cleanups: () => { ${ifBranchData.blockCleanups} }`);
        this.transpiledJSContent.push(`    };`);
        this.transpiledJSContent.push(`};`);

        let createElseFragmentFunction = null;
        if (node.alternate) {
            const elseBranchData = this.transpileBlock(node.alternate.body);
            createElseFragmentFunction = `create_else_fragment_${id}`;

            this.transpiledJSContent.push(`const ${createElseFragmentFunction} = () => {`);
            this.transpiledJSContent.push(elseBranchData.blockJS);
            this.transpiledJSContent.push(`    return {`);
            this.transpiledJSContent.push(`        nodes: Array.from(${elseBranchData.fragmentVar}.childNodes),`);
            this.transpiledJSContent.push(`        cleanups: () => { ${elseBranchData.blockCleanups} }`);
            this.transpiledJSContent.push(`    };`);
            this.transpiledJSContent.push(`};`);
        }

        this.transpiledJSContent.push(`let if_elements_${id} = [];`);
        this.transpiledJSContent.push(`let if_element_cleanups_${id} = [];`);

        this.transpiledJSContent.push(`$effect(() => {`);
        this.transpiledJSContent.push(`    // Run previous cleanups (if any)`);
        this.transpiledJSContent.push(`    if_element_cleanups_${id}.forEach(fn => fn());`);
        this.transpiledJSContent.push(`    if_element_cleanups_${id}.length = 0;`);

        this.transpiledJSContent.push(`    // Remove previous elements from DOM`);
        this.transpiledJSContent.push(`    if_elements_${id}.forEach(el => el.remove());`);
        this.transpiledJSContent.push(`    if_elements_${id}.length = 0;`);

        this.transpiledJSContent.push(`    let fragmentData;`);
        this.transpiledJSContent.push(`    if (${derivedConditionVar}.value) {`); // Access value of derived condition
        this.transpiledJSContent.push(`        fragmentData = ${createIfFragmentFunction}();`);
        this.transpiledJSContent.push(`    } `);

        if (createElseFragmentFunction) {
            this.transpiledJSContent.push(`else {`);
            this.transpiledJSContent.push(`        fragmentData = ${createElseFragmentFunction}();`);
            this.transpiledJSContent.push(`    }`);
        } else {
            this.transpiledJSContent.push(`else {`);
            this.transpiledJSContent.push(`        fragmentData = null;`);
            this.transpiledJSContent.push(`    }`);
        }

        this.transpiledJSContent.push(`    if (fragmentData) {`);
        this.transpiledJSContent.push(`        ${placeholderCommentVar}.after(...fragmentData.nodes);`);
        this.transpiledJSContent.push(`        if_elements_${id}.push(...fragmentData.nodes);`);
        this.transpiledJSContent.push(`        if_element_cleanups_${id}.push(fragmentData.cleanups);`);
        this.transpiledJSContent.push(`    }`);
        this.transpiledJSContent.push(`});`);
    }

    // --- Output Generation ---
    async output() {
        try {
            await mkdir(this.distDir, { recursive: true });

            const strippedFileName = this.filePath.replace('.ast', '');
            const finalFileName = basename(strippedFileName);
            const jsFilePath = join(this.distDir, `${finalFileName}.js`);

            const originalJsCode = escodegen.generate(this.jsAST.content);

            const finalJsCode =
                this.generateStateImports() +
                originalJsCode + '\n\n' +
                this.globalDerivedDeclarations.join('\n') + '\n\n' +
                this.transpiledJSContent.join('\n') + '\n\n' +
                (this.componentCleanups.length > 0 ? `// Component Cleanups\n${this.componentCleanups.join('\n')}\n` : '');

            await writeFile(jsFilePath, finalJsCode, 'utf8');

            const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Semantq Output</title>
</head>
<body>
    <div id="${this.appRootId}"></div>
    <script type="module" src="./${finalFileName}.js"></script>
</body>
</html>
`.trim();

            const htmlFilePath = join(this.distDir, 'index.html');
            await writeFile(htmlFilePath, htmlContent, 'utf8');

            console.log(`✅ Output written to ./dist (${finalFileName}.js + index.html)`);
        } catch (err) {
            console.error('❌ Failed to write output files:', err);
        }
    }

    generateStateImports() {
        return `import { $state, $derived, $effect, bind, bindText, bindAttr, bindClass } from './state/index.js';\n\n`;
    }
}
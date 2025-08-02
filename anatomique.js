import { writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import escodegen from 'escodegen';
import { parse } from 'acorn'; // Keep acorn for parsing JS content

export default class Anatomique {
    constructor(jsAST, cssAST, customAST, filePath) {
        this.filePath = filePath;
        this.fileName = basename(filePath, '.ast');
        this.appRootId = 'app';
        this.jsAST = jsAST;
        this.cssAST = cssAST;
        this.customAST = customAST;
        this.transpiledJSContent = ``;
        this.derivedDeclarations = [];
        this.transpiledHTML = '';
        this.distDir = './dist';
        this.addState = true;
        this.reactiveVariables = new Set();

        this.analyzeJsAST();

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
        };

        this.transpiledJSContent += `const appRoot = document.getElementById('${this.appRootId}');\n\n`;
        this.traverse();
        this.output();
    }

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

    traverse() {
        const htmlFragment = this.customAST?.content?.html;
        if (!htmlFragment || !Array.isArray(htmlFragment.children)) {
            console.warn("customAST.content.html or its children not found.");
            return;
        }

        // Find the 'customSyntax' element within the top-level fragment children
        const customSyntaxNode = htmlFragment.children.find(
            child => child.type === 'Element' && child.name === 'customSyntax'
        );

        if (!customSyntaxNode || !Array.isArray(customSyntaxNode.children)) {
            console.error("Custom syntax wrapper element 'customSyntax' not found or has no children.");
            return;
        }

        // Now, iterate through the children of the 'customSyntax' node
        for (const child of customSyntaxNode.children) {
            if (child.type === 'CommentBlock') continue; // Skip CommentBlock nodes

            const transpileFn = this.nodeToTranspilerMap[child.type];
            if (transpileFn) {
                transpileFn(child, 'appRoot');
            } else {
                console.warn(`No transpiler function found for node type: ${child.type}`);
            }
        }
    }


    Element(node, parentVar) {
        const id = Math.random().toString(36).slice(2, 8);
        const varName = `${node.name}_${id}_elem`;

        this.transpiledJSContent += `const ${varName} = document.createElement("${node.name}");\n`;
        this.transpiledJSContent += `${parentVar}.appendChild(${varName});\n`;

        let hasUserDefinedId = false;
        if (Array.isArray(node.attributes)) {
            for (const attr of node.attributes) {
                if (attr.name === "id" && attr.type === "KeyValueAttribute") {
                    hasUserDefinedId = true;
                    break;
                }
            }
        }

        if (!hasUserDefinedId) {
            this.transpiledJSContent += `${varName}.setAttribute("id", "${varName}");\n`;
        }

        if (Array.isArray(node.attributes)) {
            for (const attr of node.attributes) {
                const transpileFn = this.nodeToTranspilerMap[attr.type];
                if (transpileFn) transpileFn(attr, varName);
            }
        }

        let textParts = [];
        let hasMustacheTag = false;
        let hasReactiveText = false; // Tracks if any reactive variable is in text content

        const processChildren = (children) => {
            if (!Array.isArray(children)) return;
            for (const child of children) {
                if (child.type === 'Fragment') {
                    processChildren(child.children);
                } else if (child.type === 'TextNode') {
                    textParts.push({ type: 'static', value: JSON.stringify(child.value) });
                } else if (child.type === 'MustacheTag') {
                    hasMustacheTag = true;
                    const exprName = child.expression?.name;
                    if (exprName) {
                        if (this.isReactiveVariable(exprName)) {
                            textParts.push({ type: 'reactive', value: exprName });
                            hasReactiveText = true;
                        } else {
                            textParts.push({ type: 'static_variable', value: exprName });
                        }
                    } else {
                        console.error("MustacheTag: Expected an identifier for expression, but got:", child.expression);
                        textParts.push({ type: 'static', value: "''" });
                    }
                } else {
                    const transpileFn = this.nodeToTranspilerMap[child.type];
                    if (transpileFn) transpileFn(child, varName);
                }
            }
        };

        processChildren(node.children);

        if (textParts.length > 0) {
            if (hasReactiveText) {
                const derivedExpressionString = textParts.map(part => {
                    if (part.type === 'static') {
                        return part.value;
                    } else if (part.type === 'reactive') {
                        return `${part.value}.value`;
                    } else if (part.type === 'static_variable') {
                        return part.value;
                    }
                }).join(' + ');

                const derivedVarName = `${node.name}_text_derived_${id}`;
                this.derivedDeclarations.push(`const ${derivedVarName} = $derived(() => ${derivedExpressionString});`);
                this.transpiledJSContent += `bindText(${varName}, ${derivedVarName});\n`;

            } else {
                const staticContentParts = [];
                for (const part of textParts) {
                    if (part.type === 'static') {
                        staticContentParts.push(JSON.parse(part.value));
                    } else if (part.type === 'static_variable') {
                        staticContentParts.push(`\$\{${part.value}\}`);
                    } else {
                        staticContentParts.push(part.value);
                    }
                }
                const finalStaticContent = staticContentParts.join('');

                if (textParts.some(p => p.type === 'static_variable')) {
                    this.transpiledJSContent += `${varName}.textContent = \`${finalStaticContent}\`;\n`;
                } else {
                    this.transpiledJSContent += `${varName}.textContent = ${JSON.stringify(finalStaticContent)};\n`;
                }
            }
        }

        this.transpiledJSContent += '\n';
    }

    Fragment(node, parentVar) {
        const id = Math.random().toString(36).slice(2, 8);
        let currentTextParts = [];
        let hasReactiveContentInFragment = false;

        const processFragmentChild = (child) => {
            if (child.type === 'TextNode') {
                currentTextParts.push({ type: 'static', value: JSON.stringify(child.value) });
            } else if (child.type === 'MustacheTag') {
                const exprName = child.expression?.name;
                if (exprName) {
                    if (this.isReactiveVariable(exprName)) {
                        currentTextParts.push({ type: 'reactive', value: exprName });
                        hasReactiveContentInFragment = true;
                    } else {
                        currentTextParts.push({ type: 'static_variable', value: exprName });
                    }
                } else {
                    console.error("Fragment MustacheTag: Expected an identifier for expression, but got:", child.expression);
                    currentTextParts.push({ type: 'static', value: "''" });
                }
            } else {
                this.outputFragmentTextContent(currentTextParts, hasReactiveContentInFragment, parentVar, id);
                currentTextParts = [];
                hasReactiveContentInFragment = false;

                const transpileFn = this.nodeToTranspilerMap[child.type];
                if (transpileFn) transpileFn(child, parentVar);
            }
        };

        for (const child of node.children) {
            if (child.type === 'CommentBlock') continue;
            processFragmentChild(child);
        }

        this.outputFragmentTextContent(currentTextParts, hasReactiveContentInFragment, parentVar, id);
    }

    outputFragmentTextContent(textParts, hasReactiveText, parentVar, fragmentId) {
        if (textParts.length === 0) return;

        if (hasReactiveText) {
            const derivedExpressionString = textParts.map(part => {
                if (part.type === 'static') {
                    return part.value;
                } else if (part.type === 'reactive') {
                    return `${part.value}.value`;
                } else if (part.type === 'static_variable') {
                    return part.value;
                }
            }).join(' + ');

            const textNodeVarName = `text_frag_${fragmentId}_part_${Math.random().toString(36).slice(2, 8)}_node`;
            this.transpiledJSContent += `const ${textNodeVarName} = document.createTextNode('');\n`;
            this.transpiledJSContent += `${parentVar}.appendChild(${textNodeVarName});\n`;
            this.derivedDeclarations.push(`const ${textNodeVarName}_derived = $derived(() => ${derivedExpressionString});`);
            this.transpiledJSContent += `bindText(${textNodeVarName}, ${textNodeVarName}_derived);\n`;

        } else {
            const staticContentParts = [];
            for (const part of textParts) {
                if (part.type === 'static') {
                    staticContentParts.push(JSON.parse(part.value));
                } else if (part.type === 'static_variable') {
                    staticContentParts.push(`\$\{${part.value}\}`);
                }
            }
            const finalStaticContent = staticContentParts.join('');

            const textNodeVarName = `text_frag_${fragmentId}_part_${Math.random().toString(36).slice(2, 8)}_node`;
            this.transpiledJSContent += `const ${textNodeVarName} = document.createTextNode(`;
            if (textParts.some(p => p.type === 'static_variable')) {
                this.transpiledJSContent += `\`${finalStaticContent}\``;
            } else {
                this.transpiledJSContent += `${JSON.stringify(finalStaticContent)}`;
            }
            this.transpiledJSContent += `);\n`;
            this.transpiledJSContent += `${parentVar}.appendChild(${textNodeVarName});\n`;
        }
    }


    Attribute(attr, elementVarName) {
        switch (attr.type) {
            case "KeyValueAttribute": {
                const attrName = attr.name;
                const attrValue = attr.value?.[0]?.data || "";
                this.transpiledJSContent += `${elementVarName}.setAttribute("${attrName}", "${attrValue}");\n`;
                break;
            }

            case "TwoWayBindingAttribute": {
                const bindProp = attr.name;
                const bindVarName = attr.expression?.name || "undefinedVar";
                const valueAccess = this.isReactiveVariable(bindVarName) ? `${bindVarName}.value` : bindVarName;
                this.transpiledJSContent += `${elementVarName}.${bindProp} = ${valueAccess};\n`;
                this.transpiledJSContent += `bind(${elementVarName}, ${bindVarName});\n`;
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
                const variableUsedInExpression = expression.type === 'Identifier' ? expression.name : null;

                if (dynAttr === 'value') {
                    if (variableUsedInExpression && this.isReactiveVariable(variableUsedInExpression)) {
                        this.transpiledJSContent += `
                            $effect(() => {
                                ${elementVarName}.value = ${variableUsedInExpression}.value;
                            });
                        `;
                    } else {
                        this.transpiledJSContent += `${elementVarName}.value = ${dynValueCode};\n`;
                    }
                } else {
                    if (variableUsedInExpression && this.isReactiveVariable(variableUsedInExpression)) {
                        this.transpiledJSContent += `bindAttr(${elementVarName}, "${dynAttr}", () => ${variableUsedInExpression}.value);\n`;
                    } else {
                        this.transpiledJSContent += `${elementVarName}.setAttribute("${dynAttr}", ${dynValueCode});\n`;
                    }
                }
                break;
            }

        /*
            case "EventHandler": {
                const eventName = attr.name;
                const eventHandlerCode = escodegen.generate(attr.expression);
                this.transpiledJSContent += `${elementVarName}.addEventListener("${eventName}", ${eventHandlerCode});\n`;
                break;
            }

            */

        case "EventHandler": {
                const eventName = attr.name;
                const eventHandlerExpression = attr.expression; // This is the AST node for the expression

                if (!eventHandlerExpression) {
                    console.error("EventHandler: Missing expression for", eventName);
                    return;
                }

                let finalHandlerCode;

                // Check if the expression is a CallExpression (e.g., add(1,2))
                if (eventHandlerExpression.type === 'CallExpression') {
                    // Generate the call itself (e.g., "add(1, 2)")
                    const callCode = escodegen.generate(eventHandlerExpression);
                    // Wrap it in an anonymous arrow function: "() => add(1, 2)"
                    finalHandlerCode = `() => ${callCode}`;
                } else {
                    // For simple identifiers (e.g., "increment"), just use the generated code
                    finalHandlerCode = escodegen.generate(eventHandlerExpression);
                }

                this.transpiledJSContent += `${elementVarName}.addEventListener("${eventName}", ${finalHandlerCode});\n`;
                break;
            }

            case "BooleanAttribute":
            case "BooleanIdentifierAttribute": {
                const attrName = attr.name;
                const attrValue = attr.value;
                let toggleValue = attrValue;
                if (typeof attrValue === 'string' && this.isReactiveVariable(attrValue)) {
                    toggleValue = `${attrValue}.value`;
                    this.transpiledJSContent += `$effect(() => { ${elementVarName}.toggleAttribute("${attrName}", ${toggleValue}); });\n`;
                } else {
                    this.transpiledJSContent += `${elementVarName}.toggleAttribute("${attrName}", ${toggleValue});\n`;
                }
                break;
            }

            default:
                this.transpiledJSContent += `// Unknown attribute type: ${attr.type}\n`;
        }
    }

    TextNode(node, parentVar) {
        const id = Math.random().toString(36).slice(2, 8);
        const varName = `text_${id}_node`;
        const content = JSON.stringify(node.value);

        this.transpiledJSContent += `const ${varName} = document.createTextNode(${content});\n`;
        this.transpiledJSContent += `${parentVar}.appendChild(${varName});\n`;
    }

    MustacheTag(node, parentVar) {
        const id = Math.random().toString(36).slice(2, 8);
        const varName = `mustache_text_${id}_node`;
        const exprName = node.expression.name;

        if (!exprName) {
            console.error("MustacheTag: Expected an identifier for expression, but got:", node.expression);
            return;
        }

        this.transpiledJSContent += `const ${varName} = document.createTextNode('');\n`;
        this.transpiledJSContent += `${parentVar}.appendChild(${varName});\n`;

        if (this.isReactiveVariable(exprName)) {
            this.derivedDeclarations.push(`const ${varName}_derived = $derived(() => ${exprName}.value);`);
            this.transpiledJSContent += `bindText(${varName}, ${varName}_derived);\n`;
        } else {
            this.transpiledJSContent += `${varName}.textContent = ${exprName};\n`;
        }
    }

    generateStateImports() {
        return `import { $state, $derived, $effect, bind, bindText, bindAttr, bindClass } from './state/index.js';\n\n`;
    }

    async output() {
        try {
            await mkdir(this.distDir, { recursive: true });

            const strippedFileName = this.filePath.replace('.ast', '');
            const finalFileName = basename(strippedFileName);
            const jsFilePath = join(this.distDir, `${finalFileName}.js`);

            const originalJsCode = escodegen.generate(this.jsAST.content);
            const derivedCode = this.derivedDeclarations.length > 0
                ? this.derivedDeclarations.join('\n') + '\n\n'
                : '';

            const finalJsCode =
                this.generateStateImports() +
                originalJsCode + '\n\n' +
                derivedCode +
                this.transpiledJSContent;

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
}
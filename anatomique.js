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
        // New: Store reactive variable names
        this.reactiveVariables = new Set();

        // Analyze JS AST to identify reactive variables
        this.analyzeJsAST();

        this.nodeToTranspilerMap = {
            Element: this.Element.bind(this),
            KeyValueAttribute: this.Attribute.bind(this),
            BooleanAttribute: this.Attribute.bind(this),
            EventHandler: this.Attribute.bind(this),
            TwoWayBindingAttribute: this.Attribute.bind(this),
            MustacheAttribute: this.Attribute.bind(this),
            BooleanIdentifierAttribute: this.Attribute.bind(this),
        };

        this.transpiledJSContent += `const appRoot = document.getElementById('${this.appRootId}');\n\n`;
        this.traverse();
        this.output();
    }

    // New method: Analyze the JavaScript AST to identify reactive variables
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

    // New method: Check if a variable is reactive
    isReactiveVariable(varName) {
        return this.reactiveVariables.has(varName);
    }

    traverse() {
        const children = this.customAST?.content?.html?.children;
        if (!Array.isArray(children)) return;

        for (const node of children) {
            if (node.name === 'customSyntax' && Array.isArray(node.children)) {
                for (const child of node.children) {
                    const transpileFn = this.nodeToTranspilerMap[child.type];
                    if (transpileFn) transpileFn(child, 'appRoot');
                }
            } else {
                const transpileFn = this.nodeToTranspilerMap[node.type];
                if (transpileFn) transpileFn(node, 'appRoot');
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
        let hasMustacheTag = false; // Renamed to accurately reflect the presence of *any* mustache tag
        let allPartsStatic = true; // New: Flag to check if all parts are static

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
                            allPartsStatic = false; // If there's a reactive part, it's not all static
                        } else {
                            textParts.push({ type: 'static_variable', value: exprName });
                            // If it's a static variable, it contributes to overall static text content
                            // but still means we need to evaluate the expression once.
                        }
                    } else {
                        console.error("MustacheTag: Expected an identifier for expression, but got:", child.expression);
                        // Fallback: treat as empty or error string
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
            if (hasMustacheTag && !allPartsStatic) {
                // At least one mustache tag and at least one reactive variable
                const derivedExpressionString = textParts.map(part => {
                    if (part.type === 'static') {
                        return part.value;
                    } else if (part.type === 'reactive') {
                        return `${part.value}.value`; // Access .value for reactive variables
                    } else if (part.type === 'static_variable') {
                        return part.value; // Access static variable directly
                    }
                }).join(' + ');

                const derivedVarName = `${node.name}_text_derived_${id}`;
                this.derivedDeclarations.push(`const ${derivedVarName} = $derived(() => ${derivedExpressionString});`);
                this.transpiledJSContent += `bindText('#' + ${varName}.id, ${derivedVarName});\n`;

            } else {
                // No mustache tags OR mustache tags only contain static variables
                // In this case, calculate the final content once and set textContent
                const staticContentParts = [];
                for (const part of textParts) {
                    if (part.type === 'static') {
                        staticContentParts.push(JSON.parse(part.value));
                    } else if (part.type === 'static_variable') {
                        // This assumes the static variable is a simple identifier directly in scope
                        // For more complex expressions, `escodegen.generate` would be needed.
                        staticContentParts.push(`\$\{${part.value}\}`); // Use template literal for evaluation
                    } else {
                        // This case should ideally not happen if allPartsStatic is true
                        // but as a fallback, include its raw value
                        staticContentParts.push(part.value);
                    }
                }
                const finalStaticContent = staticContentParts.join('');

                // If any static_variable was found, use template literal for evaluation
                if (textParts.some(p => p.type === 'static_variable')) {
                     this.transpiledJSContent += `${varName}.textContent = \`${finalStaticContent}\`;\n`;
                } else {
                     this.transpiledJSContent += `${varName}.textContent = ${JSON.stringify(finalStaticContent)};\n`;
                }
            }
        }

        this.transpiledJSContent += '\n';
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
                // Ensure we access .value for reactive variables
                const valueAccess = this.isReactiveVariable(bindVarName) ? `${bindVarName}.value` : bindVarName;
                this.transpiledJSContent += `${elementVarName}.${bindProp} = ${valueAccess};\n`;
                this.transpiledJSContent += `bind('#' + ${elementVarName}.id, ${bindVarName});\n`;
                break;
            }
            
            case "MustacheAttribute": {
                const dynAttr = attr.name;
                const expression = attr.expression;
                
                if (!expression) {
                    console.error("MustacheAttribute: Missing expression for", dynAttr);
                    return;
                }

                // Generate code for the expression, handling reactive variables correctly
                // This requires a deeper analysis if the expression itself contains reactive variables.
                // For now, assuming simple identifier expressions within MustacheAttribute.
                const dynValueCode = escodegen.generate(expression);
                const variableUsedInExpression = expression.type === 'Identifier' ? expression.name : null;

                if (dynAttr === 'value') {
                    // Reactive 'value' attribute
                    if (variableUsedInExpression && this.isReactiveVariable(variableUsedInExpression)) {
                        this.transpiledJSContent += `
                            $effect(() => {
                                ${elementVarName}.value = ${variableUsedInExpression}.value;
                            });
                        `;
                    } else {
                        // If it's not a reactive variable, set it once
                        this.transpiledJSContent += `${elementVarName}.value = ${dynValueCode};\n`;
                    }
                } else {
                    // For other attributes, use bindAttr if it contains a reactive variable, otherwise set directly
                    if (variableUsedInExpression && this.isReactiveVariable(variableUsedInExpression)) {
                        this.transpiledJSContent += `bindAttr(${elementVarName}, "${dynAttr}", () => ${variableUsedInExpression}.value);\n`;
                    } else {
                        this.transpiledJSContent += `${elementVarName}.setAttribute("${dynAttr}", ${dynValueCode});\n`;
                    }
                }
                break;
            }

            case "EventHandler": {
                const eventName = attr.name;
                const eventHandlerCode = escodegen.generate(attr.expression);
                this.transpiledJSContent += `${elementVarName}.addEventListener("${eventName}", ${eventHandlerCode});\n`;
                break;
            }

            case "BooleanAttribute":
            case "BooleanIdentifierAttribute": {
                const attrName = attr.name;
                const attrValue = attr.value; // This should be a boolean literal or an identifier
                // If attrValue is an identifier, check its reactivity
                let toggleValue = attrValue;
                if (typeof attrValue === 'string' && this.isReactiveVariable(attrValue)) {
                    toggleValue = `${attrValue}.value`;
                    // If it's a reactive boolean, use $effect to update
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

    TextNode(node, parentVar = 'appRoot') {
        const id = Math.random().toString(36).slice(2, 8);
        const varName = `text_${id}_node`;
        const content = JSON.stringify(node.value);

        this.transpiledJSContent += `const ${varName} = document.createTextNode(${content});\n`;
        this.transpiledJSContent += `${parentVar}.appendChild(${varName});\n`;
    }

    // This method is now effectively handled by the Element's text processing,
    // as it combines TextNodes and MustacheTags.
    // If a standalone MustacheTag ever appears outside an element, this would be relevant.
    // For now, it's safer to leave it as it might be called in other contexts.
    MustacheTag(node, parentVar) {
        const exprName = node.expression.name;
        if (!exprName) {
            console.error("MustacheTag: Expected an identifier for expression, but got:", node.expression);
            return;
        }

        if (this.isReactiveVariable(exprName)) {
            this.transpiledJSContent += `bindText('#' + ${parentVar}.id, ${exprName});\n`;
        } else {
            // For a standalone mustache tag that is static, set textContent directly
            this.transpiledJSContent += `${parentVar}.textContent = ${exprName};\n`;
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
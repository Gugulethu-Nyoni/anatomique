import { writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import escodegen from 'escodegen';
import { parse } from 'acorn';

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

        this.nodeToTranspilerMap = {
            Element: this.Element.bind(this),
            KeyValueAttribute: this.Attribute.bind(this),
            BooleanAttribute: this.Attribute.bind(this),
            EventHandler: this.Attribute.bind(this),
            TwoWayBindingAttribute: this.Attribute.bind(this),
            MustacheAttribute: this.Attribute.bind(this),
            BooleanIdentifierAttribute: this.Attribute.bind(this),
            // Note: Attribute and MustacheAttributeValueWithParams are not top-level nodes in the corrected AST,
            // so they're removed from the map.
        };

        this.transpiledJSContent += `const appRoot = document.getElementById('${this.appRootId}');\n\n`;
        this.traverse();
        this.output();
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
        let containsDynamicText = false;

        const processChildren = (children) => {
            if (!Array.isArray(children)) return;
            for (const child of children) {
                if (child.type === 'Fragment') {
                    processChildren(child.children);
                } else if (child.type === 'TextNode') {
                    textParts.push(JSON.stringify(child.value));
                } else if (child.type === 'MustacheTag') {
                    containsDynamicText = true;
                    textParts.push(child.expression?.name);
                } else {
                    const transpileFn = this.nodeToTranspilerMap[child.type];
                    if (transpileFn) transpileFn(child, varName);
                }
            }
        };

        processChildren(node.children);

        if (textParts.length > 0) {
            if (containsDynamicText) {
                const derivedExpressionString = textParts.map(part => {
                    if (part.startsWith('"')) {
                        return part;
                    } else {
                        return `${part}.value`;
                    }
                }).join(' + ');

                const derivedVarName = `${node.name}_text_derived_${id}`;
                this.derivedDeclarations.push(`const ${derivedVarName} = $derived(() => ${derivedExpressionString});`);
                this.transpiledJSContent += `bindText('#' + ${varName}.id, ${derivedVarName});\n`;

            } else {
                const staticContent = textParts.map(part => JSON.parse(part)).join('');
                const textNodeId = Math.random().toString(36).slice(2, 8);
                const textVarName = `text_${textNodeId}_node`;
                this.transpiledJSContent += `const ${textVarName} = document.createTextNode(${JSON.stringify(staticContent)});\n`;
                this.transpiledJSContent += `${varName}.appendChild(${textVarName});\n`;
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
                this.transpiledJSContent += `${elementVarName}.${bindProp} = ${bindVarName}.value;\n`;
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

                const dynValueCode = escodegen.generate(expression);
                
                if (dynAttr === 'value') {
                    this.transpiledJSContent += `
                        // Reactive 'value' attribute
                        $effect(() => {
                            ${elementVarName}.value = ${dynValueCode};
                        });
                    `;
                } else {
                    this.transpiledJSContent += `bindAttr(${elementVarName}, "${dynAttr}", () => ${dynValueCode});\n`;
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
                const attrValue = attr.value;
                this.transpiledJSContent += `${elementVarName}.toggleAttribute("${attrName}", ${attrValue});\n`;
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

    MustacheTag(node, parentVar) {
        const exprName = node.expression.name;
        if (!exprName) {
            console.error("MustacheTag: Expected an identifier for expression, but got:", node.expression);
            return;
        }
        this.transpiledJSContent += `bindText('#' + ${parentVar}.id, ${exprName});\n`;
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
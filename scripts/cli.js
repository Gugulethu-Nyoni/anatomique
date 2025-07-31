// scripts/cli.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { SemantqToJsTranspiler } from '../src/anatomique.js';

async function build() {
    // Get component name from argument or default to 'main'
    // Example usage: node scripts/cli.js mycomponent -> reads src/mycomponent.ast
    const componentName = process.argv[2] || 'main'; 
    const astInputFileName = `${componentName}.ast`;
    
    const distDir = path.resolve(process.cwd(), 'dist');
    const runtimeSrcPath = path.resolve(process.cwd(), 'src', 'runtime.js');
    const astInputPath = path.resolve(process.cwd(), 'src', astInputFileName); // Dynamic AST input file path

    const transpiledComponentDestPath = path.join(distDir, 'component.js'); // Keeping output fixed for now
    const runtimeDestPath = path.join(distDir, 'runtime.js');
    const indexHtmlDestPath = path.join(distDir, 'index.html');

    console.log(`Starting transpilation for component: ${componentName}`);
    console.log(`Reading AST from: ${astInputPath}`);

    try {
        // 1. Create dist directory
        await fs.mkdir(distDir, { recursive: true });
        console.log(`Created directory: ${distDir}`);

        // 2. Read the AST from the specified .ast file
        const astJsonContent = await fs.readFile(astInputPath, 'utf8');
        const ast = JSON.parse(astJsonContent);
        console.log(`AST loaded successfully.`);

        // 3. Transpile the AST
        const transpiler = new SemantqToJsTranspiler();
        const transpiledJsCode = transpiler.transpile(ast);

        if (transpiler.context.diagnosticReporter.hasErrors()) {
            console.error('Transpilation failed with errors:');
            transpiler.context.diagnosticReporter.errors.forEach(err => console.error(err.message));
            process.exit(1);
        }

        // 4. Write the transpiled JS to dist/component.js
        await fs.writeFile(transpiledComponentDestPath, transpiledJsCode, 'utf8');
        console.log(`Transpiled JS written to: ${transpiledComponentDestPath}`);

        // 5. Copy runtime.js to dist/runtime.js
        await fs.copyFile(runtimeSrcPath, runtimeDestPath);
        console.log(`Runtime helpers copied to: ${runtimeDestPath}`);

        // 6. Generate dist/index.html
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Semantq Component: ${componentName}</title>
</head>
<body>
    <div id="app-root"></div>
    <script type="module">
        import render from './component.js';

        // Assuming render function returns a DOM node or fragment
        const rootElement = document.getElementById('app-root');
        const componentTree = render(); // Call the render function to get the DOM tree

        if (componentTree.type === 'Fragment' && componentTree.children) {
            // If it's a fragment from _createFragment, append its actual DOM children
            componentTree.children.forEach(child => {
                if (child instanceof Node) {
                    rootElement.appendChild(child);
                }
            });
        } else if (componentTree instanceof Node) {
            // If it's a single DOM node
            rootElement.appendChild(componentTree);
        } else {
            console.error("Render function did not return a valid DOM node or fragment:", componentTree);
        }

        // TODO: Integrate component lifecycle (mount, destroy) here later.
        // For a full component, we'd instantiate a class and manage its lifecycle.
    </script>
</body>
</html>
`;
        await fs.writeFile(indexHtmlDestPath, htmlContent, 'utf8');
        console.log(`HTML file generated at: ${indexHtmlDestPath}`);

        console.log('Transpilation complete! Now run `npx serve dist` to view in browser.');

    } catch (error) {
        console.error('Transpilation failed:', error);
        process.exit(1);
    }
}

build();
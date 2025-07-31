// scripts/cli.js

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { dirname, resolve, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { SemantqToJsTranspiler } from '../src/anatomique.js'; // Assuming your transpiler class is named SemantqToJsTranspiler

// Get the current directory name (equivalent to __dirname in CommonJS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define input and output paths relative to the project root
const projectRoot = resolve(__dirname, '..');
const inputFilePath = resolve(projectRoot, 'src', 'main.ast'); // Assuming main.ast is your primary AST input
const runtimeSourcePath = resolve(projectRoot, 'src', 'runtime.js'); // Source path for runtime.js
const outputDir = resolve(projectRoot, 'dist');

// Extract component name from input file (e.g., 'main' from 'main.ast')
const componentName = basename(inputFilePath, extname(inputFilePath)); // This will be 'main' for main.ast
// We'll use a PascalCase convention for the component class name for better JS readability
const componentClassName = componentName.charAt(0).toUpperCase() + componentName.slice(1) + 'Component'; // e.g., 'MainComponent'

const outputComponentJsFileName = `${componentName}.js`; // e.g., 'main.js'
const outputComponentJsFilePath = resolve(outputDir, outputComponentJsFileName);
const outputRuntimeJsFilePath = resolve(outputDir, 'runtime.js'); // Output path for runtime.js
const outputHtmlFilePath = resolve(outputDir, 'index.html'); // Always named index.html

console.log(`Starting transpilation for component: ${componentName}`);
console.log(`Reading AST from: ${inputFilePath}`);

try {
    // 1. Read the AST JSON
    const astJson = readFileSync(inputFilePath, 'utf8');
    const loadedAstContent = JSON.parse(astJson);
    const rootProgramNode = {
        type: 'Program',
        jsAST: loadedAstContent.jsAST,
        cssAST: loadedAstContent.cssAST,
        customAST: loadedAstContent.customAST,
    };
    console.log('AST loaded successfully.');

    // 2. Ensure the output directory exists
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
        console.log(`Created directory: ${outputDir}`);
    }

    // 3. Transpile the AST
    // This part assumes SemantqToJsTranspiler.transpile now produces the full component class string.
    const transpiler = new SemantqToJsTranspiler();
    // Pass the componentClassName so the transpiler can name the exported class correctly
    const transpiledComponentCode = transpiler.transpile(rootProgramNode, { componentClassName }); 

    // --- DEBUGGING: Check transpiledComponentCode content before writing ---
    console.log(`DEBUG: Transpiled Component JS Code Length: ${transpiledComponentCode.length}`);
    if (transpiledComponentCode.length < 500) { // Print full code if short, otherwise truncated
        console.log(`DEBUG: Transpiled Component JS Code Preview:\n${transpiledComponentCode}`);
    } else {
        console.log(`DEBUG: Transpiled Component JS Code Preview (first 500 chars):\n${transpiledComponentCode.substring(0, 500)}...`);
    }
    // --- END DEBUGGING ---

    // 4. Write the transpiled JavaScript component to its file
    writeFileSync(outputComponentJsFilePath, transpiledComponentCode);
    console.log(`Transpilation successful. Component output written to ${outputComponentJsFilePath}`);

    // **FIXED**: 5. Copy the runtime.js file to the dist directory
    copyFileSync(runtimeSourcePath, outputRuntimeJsFilePath);
    console.log(`Copied runtime.js to ${outputRuntimeJsFilePath}`);

    // 6. Generate a basic index.html file to load the component
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${componentName} Component</title>
    <style>
        body { margin: 20px; font-family: sans-serif; }
        #app { border: 1px solid #eee; padding: 20px; max-width: 600px; margin: 0 auto; }
    </style>
</head>
<body>
    <h1>${componentName} Component Output</h1>
    <div id="app"></div>
    <script type="module" src="./${outputComponentJsFileName}"></script>
    <script type="module">
        // **FIXED**: Import the named export for the component class
        import { ${componentClassName} } from './${outputComponentJsFileName}'; 

        document.addEventListener('DOMContentLoaded', () => {
            const appRoot = document.getElementById('app');
            const componentInstance = new ${componentClassName}(); // Instantiate the component
            
            // Assuming the component has a 'mount' method
            componentInstance.mount(appRoot); 
            console.log('${componentName} component mounted to #app');
        });
    </script>
</body>
</html>`;

    writeFileSync(outputHtmlFilePath, htmlContent);
    console.log(`Generated ${outputHtmlFilePath}`);

    // Report diagnostics if any
    const diagnostics = transpiler.context.diagnosticReporter.getDiagnostics();
    if (diagnostics.length > 0) {
        console.warn('\nTranspilation completed with diagnostics:');
        diagnostics.forEach(d => console.log(`[${d.level}] ${d.message}`));
    } else {
        console.log('\nTranspilation completed with no diagnostics.');
    }

} catch (error) {
    console.error('Transpilation failed with errors:');
    console.error(error);
}
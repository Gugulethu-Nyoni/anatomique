// scripts/cli.js
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { SemantqToJsTranspiler } from '../src/anatomique.js'; // Adjust path if necessary

// Convert import.meta.url to a directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AST_INPUT_PATH = path.join(__dirname, '../src/main.ast'); // Path to your AST JSON file
const OUTPUT_DIR = path.join(__dirname, '../dist'); // Output directory for transpiled JS
const OUTPUT_FILE_NAME = 'main.js'; // Output file name

async function build() {
    console.log('Starting transpilation for component: main');

    try {
        // 1. Read the AST from the .ast file
        console.log(`Reading AST from: ${AST_INPUT_PATH}`);
        const astJson = await fs.readFile(AST_INPUT_PATH, 'utf8');
        const ast = JSON.parse(astJson);
        console.log('AST loaded successfully.');

        // 2. Initialize the transpiler
        const transpiler = new SemantqToJsTranspiler();

        // 3. Transpile the AST
        // The main method for transpilation is `visit` on the root Program node
        const transpiledCode = transpiler.visit(ast);

        // 4. Handle diagnostics (errors and warnings)
        const diagnostics = transpiler.context.diagnosticReporter.getDiagnostics();
        if (diagnostics.length > 0) {
            console.warn('\nTranspilation completed with diagnostics:');
            diagnostics.forEach(d => {
                const location = d.loc ? `(${d.loc.start.line}:${d.loc.start.column})` : '(unknown location)';
                console.log(`  [${d.level.toUpperCase()}] ${d.message} ${location}`);
            });
        }

        // Check if there were any errors before writing the file
        const hasErrors = diagnostics.some(d => d.level === 'error');
        if (hasErrors) {
            console.error('\nTranspilation failed with errors. Aborting build.');
            process.exit(1); // Exit with a non-zero code to indicate failure
        }

        // 5. Ensure output directory exists
        await fs.mkdir(OUTPUT_DIR, { recursive: true });

        // 6. Write the transpiled code to a .js file
        const outputPath = path.join(OUTPUT_DIR, OUTPUT_FILE_NAME);
        await fs.writeFile(outputPath, transpiledCode, 'utf8');
        console.log(`\nTranspilation successful! Output written to: ${outputPath}`);

    } catch (error) {
        console.error('Transpilation failed with errors:');
        console.error(error);
        process.exit(1); // Exit with a non-zero code to indicate failure
    }
}

build();
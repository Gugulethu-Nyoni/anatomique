import { _createFragment } from './runtime.js';
import { _createElement } from './runtime.js';
import { _createTextNode } from './runtime.js';


            // Generated component render function
            export default function render(ctx) {
                // Component lifecycle and state management will be integrated here.
                // For now, ctx is just a placeholder.
                alert('Within!!');
console.log("Basic html working");
                
                return _createFragment([_createElement("customSyntax", {}, [_createElement("h1", {}, [_createTextNode("Real Time AST Output For the Node in Focus")]), _createElement("h3", {}, [_createTextNode("Hello World")])])]);
            }
        
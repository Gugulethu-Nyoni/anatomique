import { _createFragment } from './runtime.js';
import { _createElement } from './runtime.js';
import { _createTextNode } from './runtime.js';


export class MainComponent {
    constructor(props = {}) {
        this.props = props;
        this.element = null; // To hold the root DOM element of the component
        console.log("MainComponent constructor called");
    }

    // Lifecycle method: Called when the component is first attached to the DOM
    mount(targetElement) {
        if (this.element) {
            console.warn("Component already mounted. Call unmount first if re-mounting.");
            return;
        }
        
        console.log("Basic html working - MainComponent mounting");
        alert('Within 2!!');
        console.log("Basic html working"); // Injected JS statements from AST
        
        this.element = this.render();
        targetElement.appendChild(this.element);

        console.log("MainComponent mounted successfully.");
    }

    // Lifecycle method: Called when component's state or props change, triggering a re-render
    update(newProps) {
        // This is a placeholder. A real update would involve diffing and patching the DOM.
        console.log("MainComponent update called with new props:", newProps);
        if (this.element && this.element.parentNode) {
            const oldElement = this.element;
            this.element = this.render();
            oldElement.parentNode.replaceChild(this.element, oldElement);
        }
    }

    // Lifecycle method: Called when the component is removed from the DOM
    unmount() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
            this.element = null;
            // Clean up event listeners, timers, etc.
            console.log("MainComponent unmounted.");
        }
    }

    // The core render function, transpiled from your AST
    render() {
        const renderedContent = _createFragment([_createElement("customSyntax", {}, [_createElement("h1", {"id": "myid", "class": "first second", "someblattr": true}, [_createTextNode("Real Time AST Output For the Node in Focus")]), _createElement("br", {}, []), _createElement("input", {"type": "text", "disabled": true, "placeholder": "Disabled Text Input"}, []), _createElement("h3", {"data-user-id": "42", "data-role": "admin"}, [_createTextNode("Hello World")]), _createElement("button", {"onclick": "alert('Hello')", "aria-label": "Close", "aria-hidden": "true"}, [_createTextNode("Click me")]), _createElement("div", {"style": "color: red; font-weight: bold;"}, [_createTextNode("Red Div")]), _createElement("svg", {"xmlns:xlink": "http://www.w3.org/1999/xlink"}, []), _createElement("svg", {"width": "200", "height": "200", "xmlns": "http://www.w3.org/2000/svg", "xmlns:xlink": "http://www.w3.org/1999/xlink"}, [_createFragment([_createFragment([_createElement("defs", {}, [_createElement("circle", {"id": "myCircle", "cx": "50", "cy": "50", "r": "40", "stroke": "black", "stroke-width": "3", "fill": "lightblue"}, [])]), _createElement("use", {"xlink:href": "#myCircle", "x": "0", "y": "0"}, []), _createElement("use", {"xlink:href": "#myCircle", "x": "100", "y": "100", "fill": "lightgreen"}, [])])])]), _createElement("iframe", {"srcdoc": "<p>Hello</p>"}, [])])]); // Fallback to an empty fragment
        console.log("DEBUG: render() returning:", renderedContent, "Type:", typeof renderedContent);
        return renderedContent;
    }
}
        
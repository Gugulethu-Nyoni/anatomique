import { _createFragment } from './runtime.js';
import { _createTextNode } from './runtime.js';
import { _createElement } from './runtime.js';


export class MainComponent {
    constructor(props = {}) {
        this.props = props;
        this.element = null; // To hold the root DOM element of the component
        this.state = {"count":0}; // Initialize state from parsed declarations
        console.log("MainComponent constructor called. Initial state:", this.state);

        // Debugging: Log 'this' in constructor
        console.log("Constructor 'this':", this);
        console.log("Does alerter exist in constructor (should be undefined before methods are fully defined)?", typeof this.alerter);
    }

    // setState method for reactive updates
    setState(newState) {
        Object.assign(this.state, newState);
        console.log("MainComponent state updated:", this.state);
        this.update(); // Trigger re-render
    }

    // Lifecycle method: Called when the component is first attached to the DOM
    mount(targetElement) {
        if (this.element) {
            console.warn("Component already mounted. Call unmount first if re-mounting.");
            return;
        }
        
        console.log("Basic html working - MainComponent mounting");
        
        this.element = this.render();
        targetElement.appendChild(this.element);

        console.log("MainComponent mounted successfully.");
    }

    // Lifecycle method: Called when component's state or props change, triggering a re-render
    update(newProps) {
        console.log("MainComponent update called. New props:", newProps);
        if (newProps) {
            Object.assign(this.props, newProps); // Update props if provided
        }
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
        // Debugging: Log 'this' in render
        console.log("Render method 'this':", this);
        console.log("Does alerter exist in render?", typeof this.alerter);

        const renderedContent = _createFragment([_createElement("custom-syntax", {}, [_createElement("h1", {}, [_createTextNode("EventHandler and Reactivity")]), _createElement("div", {"value": this.state.count, "oninput": (e) => this.setState({ count: e.target.value })}, []), _createElement("button", {"onclick": this.increment.bind(this)}, [_createTextNode("+")]), _createElement("button", {"onclick": this.decrement.bind(this)}, [_createTextNode("-")])])]);
        console.log("DEBUG: render() returning:", renderedContent, "Type:", typeof renderedContent);
        return renderedContent;
    }

    // Injected JS statements/functions from AST (these are now class methods/properties)
    increment() {
    this.setState({ count: this.state.count + 1 });
}
    decrement() {
    this.setState({ count: this.state.count - 1 });
}
}
        
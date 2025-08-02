import { $state, $derived, $effect, bind, bindText, bindAttr, bindClass, $props } from './state/index.js';



// Original script content (includes $state, $derived, $props declarations)
const num = $state(6);
const name = 'World';
let sum = $state(0);
function add(left, right) {
    sum.value = left + right + num.value;
}
function double() {
    num.value = num.value * 2;
}

// Global Derived Declarations created by the transpiler
const derived_ah1qhd = $derived(() => name);
const derived_5c9hny = $derived(() => sum.value);

export function renderComponent(targetElement) {
    const fragment = document.createDocumentFragment();

    // Transpiled DOM creation and reactive effects
    const appRoot = document.getElementById('app');

const h1_elem_zrpqug = document.createElement("h1");
appRoot.appendChild(h1_elem_zrpqug);
const text_node_yxar6b = document.createTextNode("Hello ");
h1_elem_zrpqug.appendChild(text_node_yxar6b);
const mustache_node_0uvnc4 = document.createTextNode('');
h1_elem_zrpqug.appendChild(mustache_node_0uvnc4);
bindText(mustache_node_0uvnc4, derived_ah1qhd);
const text_node_ezscgb = document.createTextNode("My Number: ");
appRoot.appendChild(text_node_ezscgb);
const span_elem_jpnn9d = document.createElement("span");
appRoot.appendChild(span_elem_jpnn9d);
bind(span_elem_jpnn9d, num);
const br_elem_57e8h2 = document.createElement("br");
appRoot.appendChild(br_elem_57e8h2);
const input_elem_0aave4 = document.createElement("input");
appRoot.appendChild(input_elem_0aave4);
input_elem_0aave4.setAttribute("type", "number");
input_elem_0aave4.addEventListener("input", double);
bind(input_elem_0aave4, num);
const text_node_8v9lhz = document.createTextNode("My math: ");
appRoot.appendChild(text_node_8v9lhz);
const button_elem_0z2hb3 = document.createElement("button");
appRoot.appendChild(button_elem_0z2hb3);
button_elem_0z2hb3.addEventListener("click", () => { add(1, 3); });
button_elem_0z2hb3.setAttribute("title", "Click to get sum");
const text_node_slxk2j = document.createTextNode("Sum(");
button_elem_0z2hb3.appendChild(text_node_slxk2j);
const mustache_node_svxvb8 = document.createTextNode('');
button_elem_0z2hb3.appendChild(mustache_node_svxvb8);
bindText(mustache_node_svxvb8, derived_5c9hny);
const text_node_0p8ih1 = document.createTextNode(") ");
button_elem_0z2hb3.appendChild(text_node_0p8ih1);

    // Append the fragment to the target element
    targetElement.appendChild(fragment);

    // Lifecycle management: return a cleanup function
    return () => {
        // Run all component-level cleanups
        
        // Remove all direct children added by this component
        while (targetElement.firstChild) {
            targetElement.removeChild(targetElement.firstChild);
        }
    };
}
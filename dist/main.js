import { $state, $derived, $effect, bind, bindText, bindAttr, bindClass } from './state/index.js';

let isAdmin = $state(true);
const dash_message = 'Welcome Admin';
const guest_message = 'Welcome Guest';
function toggle(status) {
    isAdmin.value = status;
}
function alerter() {
    alert('NAZOKE!!!!');
}
let count = $state(0);
function increment() {
    count.value++;
}

const derived_odk9y6 = $derived(() => count.value);
const derived_46uubz = $derived(() => isAdmin.value);
const derived_upqlg2 = $derived(() => isAdmin.value ? 'Logout' : 'Login');
const derived_15pqoc = $derived(() => derived_upqlg2.value);

const appRoot = document.getElementById('app');

const text_node_8nah3v = document.createTextNode("Counter: ");
appRoot.appendChild(text_node_8nah3v);
const mustache_node_dysxz1 = document.createTextNode('');
appRoot.appendChild(mustache_node_dysxz1);
bindText(mustache_node_dysxz1, derived_odk9y6);
const br_elem_w06wts = document.createElement("br");
appRoot.appendChild(br_elem_w06wts);


const input_elem_umj5bi = document.createElement("input");
appRoot.appendChild(input_elem_umj5bi);
input_elem_umj5bi.addEventListener("input", () => increment());
input_elem_umj5bi.setAttribute("type", "number");
bind(input_elem_umj5bi, count);


const h1_elem_mmo0jj = document.createElement("h1");
appRoot.appendChild(h1_elem_mmo0jj);
h1_elem_mmo0jj.setAttribute("style", "color: red");
h1_elem_mmo0jj.setAttribute("class", "container grid something");
h1_elem_mmo0jj.textContent = "Node Stuff ";


const input_elem_bldpbw = document.createElement("input");
appRoot.appendChild(input_elem_bldpbw);
input_elem_bldpbw.setAttribute("type", "text");
input_elem_bldpbw.setAttribute("placeholder", "DISABLED TEXT");
input_elem_bldpbw.toggleAttribute("disabled", true);


const button_elem_6uryo7 = document.createElement("button");
appRoot.appendChild(button_elem_6uryo7);
button_elem_6uryo7.addEventListener("click", () => alerter());
button_elem_6uryo7.textContent = "Click Me ";


const if_placeholder_7pfx7l = document.createComment('if block');
appRoot.appendChild(if_placeholder_7pfx7l);
const create_if_fragment_7pfx7l = () => {

const fragmentRoot_jc7olo = document.createDocumentFragment();
const div_elem_fezbfd = document.createElement("div");
fragmentRoot_jc7olo.appendChild(div_elem_fezbfd);
div_elem_fezbfd.setAttribute("class", "premium-banner");
div_elem_fezbfd.textContent = "Welcome back, Admin!";


    return {
        nodes: Array.from(fragmentRoot_jc7olo.childNodes),
        cleanups: () => {  }
    };
};
let if_elements_7pfx7l = [];
let if_element_cleanups_7pfx7l = [];
$effect(() => {
    // Run previous cleanups (if any)
    if_element_cleanups_7pfx7l.forEach(fn => fn());
    if_element_cleanups_7pfx7l.length = 0;
    // Remove previous elements from DOM
    if_elements_7pfx7l.forEach(el => el.remove());
    if_elements_7pfx7l.length = 0;
    let fragmentData;
    if (derived_46uubz.value) {
        fragmentData = create_if_fragment_7pfx7l();
    } 
else {
        fragmentData = null;
    }
    if (fragmentData) {
        if_placeholder_7pfx7l.after(...fragmentData.nodes);
        if_elements_7pfx7l.push(...fragmentData.nodes);
        if_element_cleanups_7pfx7l.push(fragmentData.cleanups);
    }
});
const if_placeholder_lwxk3r = document.createComment('if block');
appRoot.appendChild(if_placeholder_lwxk3r);
const create_if_fragment_lwxk3r = () => {

const fragmentRoot_w6uzjy = document.createDocumentFragment();
const h1_elem_zr06jw = document.createElement("h1");
fragmentRoot_w6uzjy.appendChild(h1_elem_zr06jw);
h1_elem_zr06jw.textContent = `${dash_message}`;


const br_elem_922b36 = document.createElement("br");
fragmentRoot_w6uzjy.appendChild(br_elem_922b36);


const button_elem_bkxh0t = document.createElement("button");
fragmentRoot_w6uzjy.appendChild(button_elem_bkxh0t);
button_elem_bkxh0t.addEventListener("click", () => toggle(false));
bindText(button_elem_bkxh0t, derived_15pqoc);


    return {
        nodes: Array.from(fragmentRoot_w6uzjy.childNodes),
        cleanups: () => {  }
    };
};
const create_else_fragment_lwxk3r = () => {

const fragmentRoot_huv0f9 = document.createDocumentFragment();
const h1_elem_lxmuez = document.createElement("h1");
fragmentRoot_huv0f9.appendChild(h1_elem_lxmuez);
h1_elem_lxmuez.textContent = `${guest_message}`;


const br_elem_q5jl5k = document.createElement("br");
fragmentRoot_huv0f9.appendChild(br_elem_q5jl5k);


const button_elem_47fset = document.createElement("button");
fragmentRoot_huv0f9.appendChild(button_elem_47fset);
button_elem_47fset.addEventListener("click", () => toggle(true));
bindText(button_elem_47fset, derived_15pqoc);


    return {
        nodes: Array.from(fragmentRoot_huv0f9.childNodes),
        cleanups: () => {  }
    };
};
let if_elements_lwxk3r = [];
let if_element_cleanups_lwxk3r = [];
$effect(() => {
    // Run previous cleanups (if any)
    if_element_cleanups_lwxk3r.forEach(fn => fn());
    if_element_cleanups_lwxk3r.length = 0;
    // Remove previous elements from DOM
    if_elements_lwxk3r.forEach(el => el.remove());
    if_elements_lwxk3r.length = 0;
    let fragmentData;
    if (derived_46uubz.value) {
        fragmentData = create_if_fragment_lwxk3r();
    } 
else {
        fragmentData = create_else_fragment_lwxk3r();
    }
    if (fragmentData) {
        if_placeholder_lwxk3r.after(...fragmentData.nodes);
        if_elements_lwxk3r.push(...fragmentData.nodes);
        if_element_cleanups_lwxk3r.push(fragmentData.cleanups);
    }
});
const br_elem_hriwkz = document.createElement("br");
appRoot.appendChild(br_elem_hriwkz);




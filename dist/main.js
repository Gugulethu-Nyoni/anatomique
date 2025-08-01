import { $state, $derived, $effect, bind, bindText, bindAttr, bindClass } from './state/index.js';

let count = $state(0);
const message = $state('World');

const h1_text_derived_2w24pq = $derived(() => "Hello" + message.value);
const h2_text_derived_oefun8 = $derived(() => "MyCount:" + count.value);

const appRoot = document.getElementById('app');

const h1_2w24pq_elem = document.createElement("h1");
appRoot.appendChild(h1_2w24pq_elem);
h1_2w24pq_elem.setAttribute("id", "h1_2w24pq_elem");
bindText('#' + h1_2w24pq_elem.id, h1_text_derived_2w24pq);

const h2_oefun8_elem = document.createElement("h2");
appRoot.appendChild(h2_oefun8_elem);
h2_oefun8_elem.setAttribute("id", "h2_oefun8_elem");
bindText('#' + h2_oefun8_elem.id, h2_text_derived_oefun8);

const div_0xowsq_elem = document.createElement("div");
appRoot.appendChild(div_0xowsq_elem);
div_0xowsq_elem.setAttribute("id", "div_0xowsq_elem");
div_0xowsq_elem.setAttribute("class", "container grid something");
const input_vfh8el_elem = document.createElement("input");
div_0xowsq_elem.appendChild(input_vfh8el_elem);
input_vfh8el_elem.setAttribute("id", "input_vfh8el_elem");
input_vfh8el_elem.setAttribute("type", "number");
input_vfh8el_elem.value = count.value;
bind('#' + input_vfh8el_elem.id, count);

const input_w8em8u_elem = document.createElement("input");
div_0xowsq_elem.appendChild(input_w8em8u_elem);
input_w8em8u_elem.setAttribute("id", "input_w8em8u_elem");
input_w8em8u_elem.setAttribute("type", "text");
input_w8em8u_elem.value = message.value;
bind('#' + input_w8em8u_elem.id, message);



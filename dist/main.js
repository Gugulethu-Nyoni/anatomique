import { $state, $derived, $effect, bind, bindText, bindAttr, bindClass } from './state/index.js';

const name = 'World';

const appRoot = document.getElementById('app');

const h1_6w31l2_elem = document.createElement("h1");
appRoot.appendChild(h1_6w31l2_elem);
h1_6w31l2_elem.setAttribute("id", "h1_6w31l2_elem");
h1_6w31l2_elem.textContent = `Hello ${name}`;


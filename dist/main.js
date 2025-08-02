import { $state, $derived, $effect, bind, bindText, bindAttr, bindClass } from './state/index.js';

const isAdmin = true;
const items = $state([
    {
        id: 1,
        name: 'John',
        active: false
    },
    {
        id: 2,
        name: 'Musa',
        active: true
    },
    {
        id: 3,
        name: 'Jane',
        active: false
    }
]);

const derived_53bf75 = $derived(() => items.value.length > 0);

const appRoot = document.getElementById('app');

const h1_elem_hygzqo = document.createElement("h1");
appRoot.appendChild(h1_elem_hygzqo);
const text_node_ctg48l = document.createTextNode("Azkhale ");
h1_elem_hygzqo.appendChild(text_node_ctg48l);
const if_placeholder_b083uu = document.createComment('if block');
appRoot.appendChild(if_placeholder_b083uu);
const create_if_fragment_b083uu = () => {
 const fragmentRoot_egp9qg = document.createDocumentFragment();

const each_placeholder_yq4khi = document.createComment('each block');
fragmentRoot_egp9qg.appendChild(each_placeholder_yq4khi);
let each_items_yq4khi = [];
let each_cleanups_yq4khi = [];
const render_each_item_yq4khi = (item) => {
 const fragmentRoot_au81z2 = document.createDocumentFragment();
 const derived_gqok24 = $derived(() => item.active);
 const if_placeholder_qermri = document.createComment('if block');
fragmentRoot_au81z2.appendChild(if_placeholder_qermri);
const create_if_fragment_qermri = () => {
 const fragmentRoot_0vjjgr = document.createDocumentFragment();
const derived_ml55u8 = $derived(() => item.name);
const li_elem_nzz1nz = document.createElement("li");
fragmentRoot_0vjjgr.appendChild(li_elem_nzz1nz);
const mustache_node_7991lo = document.createTextNode('');
li_elem_nzz1nz.appendChild(mustache_node_7991lo);
bindText(mustache_node_7991lo, derived_ml55u8);
 return {
  nodes: Array.from(fragmentRoot_0vjjgr.childNodes),
  cleanups: () => {  }
 };
};
const create_else_fragment_qermri = () => {
 const fragmentRoot_s01ccb = document.createDocumentFragment();

const li_elem_ydrmzu = document.createElement("li");
fragmentRoot_s01ccb.appendChild(li_elem_ydrmzu);
const text_node_ag6vl0 = document.createTextNode("Member is inactive");
li_elem_ydrmzu.appendChild(text_node_ag6vl0);
 return {
  nodes: Array.from(fragmentRoot_s01ccb.childNodes),
  cleanups: () => {  }
 };
};
let if_elements_qermri = [];
let if_element_cleanups_qermri = [];
$effect(() => {
 // Run previous cleanups (if any)
 if_element_cleanups_qermri.forEach(fn => fn());
 if_element_cleanups_qermri.length = 0;
 // Remove previous elements from DOM
 if_elements_qermri.forEach(el => el.remove());
 if_elements_qermri.length = 0;
 let fragmentData;
 if (derived_gqok24.value) {
  fragmentData = create_if_fragment_qermri();
 } 
else {
  fragmentData = create_else_fragment_qermri();
 }
 if (fragmentData) {
  if_placeholder_qermri.after(...fragmentData.nodes);
  if_elements_qermri.push(...fragmentData.nodes);
  if_element_cleanups_qermri.push(fragmentData.cleanups);
 }
});
 return { nodes: Array.from(fragmentRoot_au81z2.childNodes), cleanups: [] };
};
$effect(() => {
 each_cleanups_yq4khi.forEach(fn => fn());
 each_cleanups_yq4khi.length = 0;
 each_items_yq4khi.forEach(el => el.remove());
 each_items_yq4khi.length = 0;
 const sourceArray = items?.value ?? [];
 sourceArray.forEach((item, index) => {
  const itemData = render_each_item_yq4khi(item);
  each_placeholder_yq4khi.after(...itemData.nodes);
  each_items_yq4khi.push(...itemData.nodes);
  each_cleanups_yq4khi.push(...itemData.cleanups);
 });
});
 return {
  nodes: Array.from(fragmentRoot_egp9qg.childNodes),
  cleanups: () => {  }
 };
};
const create_else_fragment_b083uu = () => {
 const fragmentRoot_9trm3w = document.createDocumentFragment();

const p_elem_x1n543 = document.createElement("p");
fragmentRoot_9trm3w.appendChild(p_elem_x1n543);
const text_node_lpw1jw = document.createTextNode("No items available");
p_elem_x1n543.appendChild(text_node_lpw1jw);
 return {
  nodes: Array.from(fragmentRoot_9trm3w.childNodes),
  cleanups: () => {  }
 };
};
let if_elements_b083uu = [];
let if_element_cleanups_b083uu = [];
$effect(() => {
 // Run previous cleanups (if any)
 if_element_cleanups_b083uu.forEach(fn => fn());
 if_element_cleanups_b083uu.length = 0;
 // Remove previous elements from DOM
 if_elements_b083uu.forEach(el => el.remove());
 if_elements_b083uu.length = 0;
 let fragmentData;
 if (derived_53bf75.value) {
  fragmentData = create_if_fragment_b083uu();
 } 
else {
  fragmentData = create_else_fragment_b083uu();
 }
 if (fragmentData) {
  if_placeholder_b083uu.after(...fragmentData.nodes);
  if_elements_b083uu.push(...fragmentData.nodes);
  if_element_cleanups_b083uu.push(fragmentData.cleanups);
 }
});


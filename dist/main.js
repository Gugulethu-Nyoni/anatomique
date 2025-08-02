import { $state, $derived, $effect, bind, bindText, bindAttr, bindClass } from './state/index.js';



// Original script content
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

// Global Derived Declarations
const derived_v5gfd5 = $derived(() => items.value.length > 0);

export function renderComponent(targetElement) {
  const fragment = document.createDocumentFragment();

  // Transpiled DOM creation and reactive effects
  const appRoot = document.getElementById('app');

const h1_elem_yyd32d = document.createElement("h1");
appRoot.appendChild(h1_elem_yyd32d);
const text_node_nzs5jh = document.createTextNode("Azkhale ");
h1_elem_yyd32d.appendChild(text_node_nzs5jh);
const if_placeholder_yuytr1 = document.createComment('if block');
appRoot.appendChild(if_placeholder_yuytr1);
const create_if_fragment_yuytr1 = () => {
 const fragmentRoot_20dq12 = document.createDocumentFragment();

const each_placeholder_qh422u = document.createComment('each block');
fragmentRoot_20dq12.appendChild(each_placeholder_qh422u);
let each_items_qh422u = [];
let each_cleanups_qh422u = [];
const render_each_item_qh422u = (item) => {
 const fragmentRoot_ueuw2g = document.createDocumentFragment();
 const derived_nawb8b = $derived(() => item.active);
 const if_placeholder_jzzjt4 = document.createComment('if block');
fragmentRoot_ueuw2g.appendChild(if_placeholder_jzzjt4);
const create_if_fragment_jzzjt4 = () => {
 const fragmentRoot_tklvrg = document.createDocumentFragment();
const derived_q1eh5b = $derived(() => item.name);
const li_elem_560tkv = document.createElement("li");
fragmentRoot_tklvrg.appendChild(li_elem_560tkv);
const mustache_node_0m6et2 = document.createTextNode('');
li_elem_560tkv.appendChild(mustache_node_0m6et2);
bindText(mustache_node_0m6et2, derived_q1eh5b);
 return {
  nodes: Array.from(fragmentRoot_tklvrg.childNodes),
  cleanups: () => {  }
 };
};
const create_else_fragment_jzzjt4 = () => {
 const fragmentRoot_jf3vjr = document.createDocumentFragment();

const li_elem_19u4g2 = document.createElement("li");
fragmentRoot_jf3vjr.appendChild(li_elem_19u4g2);
const text_node_p09e6c = document.createTextNode("Member is inactive");
li_elem_19u4g2.appendChild(text_node_p09e6c);
 return {
  nodes: Array.from(fragmentRoot_jf3vjr.childNodes),
  cleanups: () => {  }
 };
};
let if_elements_jzzjt4 = [];
let if_element_cleanups_jzzjt4 = [];
$effect(() => {
 // Run previous cleanups (if any)
 if_element_cleanups_jzzjt4.forEach(fn => fn());
 if_element_cleanups_jzzjt4.length = 0;
 // Remove previous elements from DOM
 if_elements_jzzjt4.forEach(el => el.remove());
 if_elements_jzzjt4.length = 0;
 let fragmentData;
 if (derived_nawb8b.value) {
  fragmentData = create_if_fragment_jzzjt4();
 } 
else {
  fragmentData = create_else_fragment_jzzjt4();
 }
 if (fragmentData) {
  if_placeholder_jzzjt4.after(...fragmentData.nodes);
  if_elements_jzzjt4.push(...fragmentData.nodes);
  if_element_cleanups_jzzjt4.push(fragmentData.cleanups);
 }
});
 return { nodes: Array.from(fragmentRoot_ueuw2g.childNodes), cleanups: [] };
};
$effect(() => {
 each_cleanups_qh422u.forEach(fn => fn());
 each_cleanups_qh422u.length = 0;
 each_items_qh422u.forEach(el => el.remove());
 each_items_qh422u.length = 0;
 const sourceArray = items?.value ?? [];
 sourceArray.forEach((item, index) => {
  const itemData = render_each_item_qh422u(item);
  each_placeholder_qh422u.after(...itemData.nodes);
  each_items_qh422u.push(...itemData.nodes);
  each_cleanups_qh422u.push(...itemData.cleanups);
 });
});
 return {
  nodes: Array.from(fragmentRoot_20dq12.childNodes),
  cleanups: () => {  }
 };
};
const create_else_fragment_yuytr1 = () => {
 const fragmentRoot_wtj858 = document.createDocumentFragment();

const p_elem_aktph7 = document.createElement("p");
fragmentRoot_wtj858.appendChild(p_elem_aktph7);
const text_node_pp3kgk = document.createTextNode("No items available");
p_elem_aktph7.appendChild(text_node_pp3kgk);
 return {
  nodes: Array.from(fragmentRoot_wtj858.childNodes),
  cleanups: () => {  }
 };
};
let if_elements_yuytr1 = [];
let if_element_cleanups_yuytr1 = [];
$effect(() => {
 // Run previous cleanups (if any)
 if_element_cleanups_yuytr1.forEach(fn => fn());
 if_element_cleanups_yuytr1.length = 0;
 // Remove previous elements from DOM
 if_elements_yuytr1.forEach(el => el.remove());
 if_elements_yuytr1.length = 0;
 let fragmentData;
 if (derived_v5gfd5.value) {
  fragmentData = create_if_fragment_yuytr1();
 } 
else {
  fragmentData = create_else_fragment_yuytr1();
 }
 if (fragmentData) {
  if_placeholder_yuytr1.after(...fragmentData.nodes);
  if_elements_yuytr1.push(...fragmentData.nodes);
  if_element_cleanups_yuytr1.push(fragmentData.cleanups);
 }
});

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
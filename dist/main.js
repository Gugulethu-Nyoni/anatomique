import { $state, $derived, $effect, bind, bindText, bindAttr, bindClass } from './state/index.js';

const isAdmin = true;
const people = $state([
    {
        id: 1,
        name: 'John'
    },
    {
        id: 2,
        name: 'Musa'
    },
    {
        id: 3,
        name: 'Jane'
    }
]);



const appRoot = document.getElementById('app');

const each_placeholder_uz1y6z = document.createComment('each block');
appRoot.appendChild(each_placeholder_uz1y6z);
let each_items_uz1y6z = [];
let each_cleanups_uz1y6z = [];
const render_each_item_uz1y6z = (person) => {
  const itemFragment_uz1y6z = document.createDocumentFragment();
const p_elem_iporam = document.createElement("p");
itemFragment_uz1y6z.appendChild(p_elem_iporam);
const mustache_node_8nnt8r = document.createTextNode('');
p_elem_iporam.appendChild(mustache_node_8nnt8r);
mustache_node_8nnt8r.textContent = person.name;
  return { nodes: Array.from(itemFragment_uz1y6z.childNodes), cleanups: [] };
};
$effect(() => {
  each_cleanups_uz1y6z.forEach(fn => fn());
  each_cleanups_uz1y6z.length = 0;
  each_items_uz1y6z.forEach(el => el.remove());
  each_items_uz1y6z.length = 0;
  const items = people?.value ?? [];
  items.forEach((person, index) => {
    const itemData = render_each_item_uz1y6z(person);
    each_placeholder_uz1y6z.after(...itemData.nodes);
    each_items_uz1y6z.push(...itemData.nodes);
    each_cleanups_uz1y6z.push(...itemData.cleanups);
  });
});


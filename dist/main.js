import { $state, $derived, $effect, bind, bindText, bindAttr, bindClass } from './state/index.js';

const name = 'World';
const post = {
    featuredImage: {
        url: 'https://cdn.pixabay.com/photo/2017/03/17/11/38/blog-2151307_1280.png',
        alt: 'A description of the featured image'
    }
};
let count = $state(0);
let sum = $state(0);
function increment() {
    count.value++;
}
function decrement() {
    count.value--;
}
function add(left, right) {
    sum.value = left + right;
}

const h2_text_derived_e0qvyw = $derived(() => "Sum: " + sum.value);
const text_frag_6subnc_part_d8erke_node_derived = $derived(() => "My Count: " + count.value);

const appRoot = document.getElementById('app');

const h1_tq0m3p_elem = document.createElement("h1");
appRoot.appendChild(h1_tq0m3p_elem);
h1_tq0m3p_elem.setAttribute("id", "h1_tq0m3p_elem");
h1_tq0m3p_elem.setAttribute("style", "color: red");
h1_tq0m3p_elem.setAttribute("class", "header head1 two");
h1_tq0m3p_elem.textContent = `Hello ${name}`;

const h2_e0qvyw_elem = document.createElement("h2");
appRoot.appendChild(h2_e0qvyw_elem);
h2_e0qvyw_elem.setAttribute("id", "h2_e0qvyw_elem");
bindText(h2_e0qvyw_elem, h2_text_derived_e0qvyw);

const br_gfujoa_elem = document.createElement("br");
appRoot.appendChild(br_gfujoa_elem);
br_gfujoa_elem.setAttribute("id", "br_gfujoa_elem");

const button_ialb76_elem = document.createElement("button");
appRoot.appendChild(button_ialb76_elem);
button_ialb76_elem.setAttribute("id", "button_ialb76_elem");
button_ialb76_elem.addEventListener("click", () => add(1, 2));
button_ialb76_elem.textContent = "Add 1 plus 2 ";

const text_frag_6subnc_part_d8erke_node = document.createTextNode('');
appRoot.appendChild(text_frag_6subnc_part_d8erke_node);
bindText(text_frag_6subnc_part_d8erke_node, text_frag_6subnc_part_d8erke_node_derived);
const br_n7foyk_elem = document.createElement("br");
appRoot.appendChild(br_n7foyk_elem);
br_n7foyk_elem.setAttribute("id", "br_n7foyk_elem");

const text_frag_43g8tn_part_izvcvs_node = document.createTextNode("Increment: ");
appRoot.appendChild(text_frag_43g8tn_part_izvcvs_node);
const input_xb4vrs_elem = document.createElement("input");
appRoot.appendChild(input_xb4vrs_elem);
input_xb4vrs_elem.setAttribute("id", "input_xb4vrs_elem");
input_xb4vrs_elem.addEventListener("input", increment);
input_xb4vrs_elem.setAttribute("type", "number");
input_xb4vrs_elem.value = count.value;
bind(input_xb4vrs_elem, count);

const input_i3qonh_elem = document.createElement("input");
appRoot.appendChild(input_i3qonh_elem);
input_i3qonh_elem.setAttribute("id", "input_i3qonh_elem");
input_i3qonh_elem.setAttribute("type", "text");
input_i3qonh_elem.setAttribute("placeholder", "Disabled Input");
input_i3qonh_elem.toggleAttribute("disabled", true);

const button_oaabpx_elem = document.createElement("button");
appRoot.appendChild(button_oaabpx_elem);
button_oaabpx_elem.setAttribute("id", "button_oaabpx_elem");
button_oaabpx_elem.addEventListener("click", increment);
button_oaabpx_elem.textContent = "+ ";

const br_w1ko6a_elem = document.createElement("br");
appRoot.appendChild(br_w1ko6a_elem);
br_w1ko6a_elem.setAttribute("id", "br_w1ko6a_elem");

const button_jvc9dv_elem = document.createElement("button");
appRoot.appendChild(button_jvc9dv_elem);
button_jvc9dv_elem.setAttribute("id", "button_jvc9dv_elem");
button_jvc9dv_elem.addEventListener("click", decrement);
button_jvc9dv_elem.textContent = "- ";

const br_ey19gq_elem = document.createElement("br");
appRoot.appendChild(br_ey19gq_elem);
br_ey19gq_elem.setAttribute("id", "br_ey19gq_elem");

const img_xsum4f_elem = document.createElement("img");
appRoot.appendChild(img_xsum4f_elem);
img_xsum4f_elem.setAttribute("id", "img_xsum4f_elem");
img_xsum4f_elem.setAttribute("src", post.featuredImage.url);
img_xsum4f_elem.setAttribute("alt", post.featuredImage.alt);


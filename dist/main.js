import { $state, $derived, $effect, bind, bindText, bindAttr, bindClass } from './state/index.js';

const name = 'World';
const post = {
    featuredImage: {
        url: 'https://cdn.pixabay.com/photo/2017/03/17/11/38/blog-2151307_1280.png',
        alt: 'A description of the featured image'
    }
};
let count = $state(0);
function increment() {
    count.value++;
}
function decrement() {
    count.value--;
}

const text_frag_bpbtvv_part_bth5e3_node_derived = $derived(() => "My Count: " + count.value);

const appRoot = document.getElementById('app');

const h1_ai5vxl_elem = document.createElement("h1");
appRoot.appendChild(h1_ai5vxl_elem);
h1_ai5vxl_elem.setAttribute("id", "h1_ai5vxl_elem");
h1_ai5vxl_elem.setAttribute("style", "color: red");
h1_ai5vxl_elem.setAttribute("class", "header head1 two");
h1_ai5vxl_elem.textContent = `Hello ${name}`;

const text_frag_bpbtvv_part_bth5e3_node = document.createTextNode('');
appRoot.appendChild(text_frag_bpbtvv_part_bth5e3_node);
bindText(text_frag_bpbtvv_part_bth5e3_node, text_frag_bpbtvv_part_bth5e3_node_derived);
const br_wydrv6_elem = document.createElement("br");
appRoot.appendChild(br_wydrv6_elem);
br_wydrv6_elem.setAttribute("id", "br_wydrv6_elem");

const text_frag_rckrxs_part_lrhxsu_node = document.createTextNode("Increment: ");
appRoot.appendChild(text_frag_rckrxs_part_lrhxsu_node);
const input_wjwix8_elem = document.createElement("input");
appRoot.appendChild(input_wjwix8_elem);
input_wjwix8_elem.setAttribute("id", "input_wjwix8_elem");
input_wjwix8_elem.addEventListener("input", increment);
input_wjwix8_elem.setAttribute("type", "number");
input_wjwix8_elem.value = count.value;
bind(input_wjwix8_elem, count);

const input_w74cft_elem = document.createElement("input");
appRoot.appendChild(input_w74cft_elem);
input_w74cft_elem.setAttribute("id", "input_w74cft_elem");
input_w74cft_elem.setAttribute("type", "text");
input_w74cft_elem.setAttribute("placeholder", "Disabled Input");
input_w74cft_elem.toggleAttribute("disabled", true);

const button_mi6osr_elem = document.createElement("button");
appRoot.appendChild(button_mi6osr_elem);
button_mi6osr_elem.setAttribute("id", "button_mi6osr_elem");
button_mi6osr_elem.addEventListener("click", increment);
button_mi6osr_elem.textContent = "+ ";

const br_vgkbmf_elem = document.createElement("br");
appRoot.appendChild(br_vgkbmf_elem);
br_vgkbmf_elem.setAttribute("id", "br_vgkbmf_elem");

const button_u016uj_elem = document.createElement("button");
appRoot.appendChild(button_u016uj_elem);
button_u016uj_elem.setAttribute("id", "button_u016uj_elem");
button_u016uj_elem.addEventListener("click", decrement);
button_u016uj_elem.textContent = "- ";

const br_n4zaxe_elem = document.createElement("br");
appRoot.appendChild(br_n4zaxe_elem);
br_n4zaxe_elem.setAttribute("id", "br_n4zaxe_elem");

const img_szmfud_elem = document.createElement("img");
appRoot.appendChild(img_szmfud_elem);
img_szmfud_elem.setAttribute("id", "img_szmfud_elem");
img_szmfud_elem.setAttribute("src", post.featuredImage.url);
img_szmfud_elem.setAttribute("alt", post.featuredImage.alt);


import { $state, $derived, $effect, bind, bindText, bindAttr, bindClass } from './state/index.js';

const celsius = $state(0);
const fahrenheit = $state(32);
function updateCelsius(event) {
    const c = parseFloat(event.target.value);
    if (!isNaN(c)) {
        celsius.value = c;
        fahrenheit.value = c * 9 / 5 + 32;
    }
}
function updateFahrenheit(event) {
    const f = parseFloat(event.target.value);
    if (!isNaN(f)) {
        fahrenheit.value = f;
        celsius.value = (f - 32) * 5 / 9;
    }
}
function alerter() {
    alert('NAZOKE!!!!');
}

const appRoot = document.getElementById('app');

const h1_z2ymy9_elem = document.createElement("h1");
appRoot.appendChild(h1_z2ymy9_elem);
h1_z2ymy9_elem.setAttribute("id", "h1_z2ymy9_elem");
h1_z2ymy9_elem.setAttribute("style", "color: red");
h1_z2ymy9_elem.setAttribute("class", "container grid something");
const text_q594da_node = document.createTextNode("Node Stuff");
h1_z2ymy9_elem.appendChild(text_q594da_node);

const input_q0b785_elem = document.createElement("input");
appRoot.appendChild(input_q0b785_elem);
input_q0b785_elem.setAttribute("id", "input_q0b785_elem");
input_q0b785_elem.setAttribute("type", "text");
input_q0b785_elem.setAttribute("placeholder", "DISABLED TEXT");
input_q0b785_elem.toggleAttribute("disabled", true);

const div_1pigxb_elem = document.createElement("div");
appRoot.appendChild(div_1pigxb_elem);
div_1pigxb_elem.setAttribute("id", "div_1pigxb_elem");
div_1pigxb_elem.setAttribute("class", "converter-container");
const input_6ga7nl_elem = document.createElement("input");
div_1pigxb_elem.appendChild(input_6ga7nl_elem);
input_6ga7nl_elem.setAttribute("id", "input_6ga7nl_elem");
input_6ga7nl_elem.setAttribute("type", "number");

                        // Reactive 'value' attribute
                        $effect(() => {
                            input_6ga7nl_elem.value = celsius.value;
                        });
                    input_6ga7nl_elem.addEventListener("input", updateCelsius);

const span_3nwpv0_elem = document.createElement("span");
div_1pigxb_elem.appendChild(span_3nwpv0_elem);
span_3nwpv0_elem.setAttribute("id", "span_3nwpv0_elem");
const text_vyiwx6_node = document.createTextNode("Celsius =");
span_3nwpv0_elem.appendChild(text_vyiwx6_node);

const input_ff607w_elem = document.createElement("input");
div_1pigxb_elem.appendChild(input_ff607w_elem);
input_ff607w_elem.setAttribute("id", "input_ff607w_elem");
input_ff607w_elem.setAttribute("type", "number");

                        // Reactive 'value' attribute
                        $effect(() => {
                            input_ff607w_elem.value = fahrenheit.value;
                        });
                    input_ff607w_elem.addEventListener("input", updateFahrenheit);

const span_wvpmy2_elem = document.createElement("span");
div_1pigxb_elem.appendChild(span_wvpmy2_elem);
span_wvpmy2_elem.setAttribute("id", "span_wvpmy2_elem");
const text_irnyn2_node = document.createTextNode("Fahrenheit");
span_wvpmy2_elem.appendChild(text_irnyn2_node);


const button_e99ov8_elem = document.createElement("button");
appRoot.appendChild(button_e99ov8_elem);
button_e99ov8_elem.setAttribute("id", "button_e99ov8_elem");
button_e99ov8_elem.addEventListener("click", alerter);
const text_81m5b3_node = document.createTextNode("Click Me");
button_e99ov8_elem.appendChild(text_81m5b3_node);


"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const brain_js_1 = require("brain.js");
const RandomUtil_1 = __importDefault(require("util/RandomUtil"));
const inputLen = 10;
let nn = new brain_js_1.NeuralNetwork({
    binaryThresh: 0.5,
    inputSize: inputLen,
    outputSize: 2,
    hiddenLayers: [8, 6, 4],
    activation: "sigmoid",
});
let sets = [];
for (let i = 0; i < 40; i++) {
    sets.push(generateSet());
}
nn.train(sets);
for (let i = 0; i < 10; i++) {
    const set = generateSet();
    const output = nn.run(set.input);
    console.log(`RUN ${i} --------------`);
    console.log("input", set.input);
    console.log("output (expected)", set.output);
    console.log("output (actual)", output);
    console.log();
}
function generateSet() {
    const f = RandomUtil_1.default.value((x) => Math.sin(x * (Math.PI / 2.0)), (x) => x, (x) => 0.25 * Math.pow(x, x), (x) => -x);
    const xStart = RandomUtil_1.default.number(-inputLen, inputLen);
    const input = Array(inputLen).fill((x) => f(x), xStart, xStart + inputLen - 1);
    const nextVal = f(xStart + inputLen);
    const output = [nextVal > input[input.length - 1] ? 1.0 : 0.0, nextVal < input[input.length - 1] ? 1.0 : 0.0];
    return { input: input, output: output };
}
//# sourceMappingURL=server.js.map
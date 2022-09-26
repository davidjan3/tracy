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
    inputSize: inputLen * 2,
    outputSize: 2,
    hiddenLayers: [10, 8, 6, 4],
    activation: "sigmoid",
});
let sets = [];
for (let i = 0; i < 50; i++) {
    sets.push(generateSet());
}
nn.train(sets);
for (let i = 0; i < 20; i++) {
    const set = generateSet();
    const output = nn.run(set.input);
    console.log(`RUN ${i} --------------`);
    console.log("input", set.input);
    if (outputMatches(set.output, output, 0.2)) {
        console.log("output (expected)", set.output);
        console.log("output (actual)", output);
    }
    else {
        console.error("output (expected)", set.output);
        console.error("output (actual)", output);
    }
    console.log();
}
function outputMatches(expected, actual, threshold) {
    for (let i = 0; i < expected.length; i++) {
        if (Math.abs(expected[i] - actual[i]) > threshold)
            return false;
    }
    return true;
}
function generateSet() {
    const f = RandomUtil_1.default.value((x) => Math.sin(x * (Math.PI / 2.0)), (x) => x, (x) => 0.25 * Math.pow(x, x), (x) => -x);
    const xStart = RandomUtil_1.default.number(-inputLen, inputLen);
    const input = Array(inputLen)
        .fill(0)
        .map((v, i) => f(xStart + i));
    const nextVal = f(xStart + inputLen);
    const output = [nextVal > input[input.length - 1] ? 1.0 : 0.0, nextVal < input[input.length - 1] ? 1.0 : 0.0];
    return { input: input, output: output };
}
//# sourceMappingURL=tracy.js.map
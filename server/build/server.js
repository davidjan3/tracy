"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tracy_1 = __importDefault(require("ai/tracy"));
const CSVUtil_1 = __importDefault(require("util/CSVUtil"));
const tracy = new tracy_1.default();
const history = CSVUtil_1.default.parse("./server/src/data/hourly_btc.csv", [3, 7], 2);
console.log("History parsed");
const sets = tracy.valuesToSets(history);
console.log("History converted to sets");
const trainTestDistribution = 0.6; //Use 60% for training, 40% for testing
const trainSize = sets.length * trainTestDistribution;
const trainSets = sets.slice(0, trainSize);
const testSets = sets.slice(trainSize, sets.length);
console.log("Sets sliced");
tracy.train(trainSets);
console.log("Training done");
tracy.test(testSets, true);
console.log("Testing done");
/*
type Set = {
  input: number[];
  output: number[];
};

const inputLen = 10;

let nn = new NeuralNetwork({
  binaryThresh: 0.5,
  inputSize: inputLen,
  outputSize: 2,
  hiddenLayers: [8, 6, 4],
  activation: "sigmoid",
});

let sets: Set[] = [];

for (let i = 0; i < 50; i++) {
  sets.push(generateSet());
}

nn.train(sets);

for (let i = 0; i < 20; i++) {
  const set = generateSet();
  const output = nn.run(set.input) as number[];
  console.log(`RUN ${i} --------------`);
  console.log("input", set.input);
  if (outputMatches(set.output, output, 0.2)) {
    console.log("output (expected)", set.output);
    console.log("output (actual)", output);
  } else {
    console.error("output (expected)", set.output);
    console.error("output (actual)", output);
  }
  console.log();
}

function outputMatches(expected: number[], actual: number[], threshold: number): boolean {
  for (let i = 0; i < expected.length; i++) {
    if (Math.abs(expected[i] - actual[i]) > threshold) return false;
  }
  return true;
}

function generateSet(): Set {
  const f = RandomUtil.value(
    (x: number) => Math.sin(x * (Math.PI / 2.0)),
    (x: number) => x,
    (x: number) => 0.25 * x ** x,
    (x: number) => -x
  );
  const xStart = RandomUtil.number(-inputLen, inputLen);
  const input = Array(inputLen)
    .fill(0)
    .map((v, i) => f(xStart + i));
  const nextVal = f(xStart + inputLen);
  const output = [nextVal > input[input.length - 1] ? 1.0 : 0.0, nextVal < input[input.length - 1] ? 1.0 : 0.0];
  return { input: input, output: output };
}
*/
//# sourceMappingURL=server.js.map
import Account from "ai/account";
import Tracy from "ai/tracy";
import CSVUtil from "util/CSVUtil";

const tracy = new Tracy(new Account(1000));
const history = CSVUtil.parse(
  "./server/src/data/hourly_btc.csv",
  { endPrice: 6, maxPrice: 4, minPrice: 5, volume: 7 },
  2
) as { endPrice: number; maxPrice: number; minPrice: number; volume: number }[]; //endPrice, maxPrice, minPrice, volume
console.log("History parsed");
console.log("History converted to sets");
const trainTestDistribution = 0.5; //0.6 => Use 60% for training, 40% for testing
const trainSize = history.length * trainTestDistribution;
const trainSets = history.slice(0, trainSize);
const testSets = history.slice(trainSize, history.length);
console.log("Sets sliced");
tracy.train(trainSets);
console.log("Training done");
tracy.test(testSets);
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

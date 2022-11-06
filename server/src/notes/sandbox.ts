import RandomUtil from "util/RandomUtil";
import * as tf from "@tensorflow/tfjs-node-gpu";
import MathUtil from "util/MathUtil";

/*async function test() {
  await tf.setBackend("tensorflow");
  const inSize = 400;
  const amount = 1000;
  const il = tf.input({ shape: [inSize] });
  const hl0 = tf.layers.dense({ activation: "sigmoid", units: 80 });
  const hl1 = tf.layers.dense({ activation: "sigmoid", units: 80 });
  const hl2 = tf.layers.dense({ activation: "sigmoid", units: 80 });
  const hl3 = tf.layers.dense({ activation: "sigmoid", units: 1 });
  const ol = hl3.apply(hl2.apply(hl1.apply(hl0.apply(il)))) as tf.SymbolicTensor;
  const net = tf.model({ inputs: il, outputs: ol });
  net.compile({ optimizer: "sgd", loss: "meanSquaredError" });

  const xsArr = [];
  const ysArr = [];

  for (let i = 0; i < amount; i++) {
    xsArr.push(new Array(inSize).fill(i / 10));
    ysArr.push([(Math.sin(i / 10) + 1) / 2]);
  }

  const xs = tf.tensor2d(xsArr);
  const ys = tf.tensor2d(ysArr);
  xs.print();
  ys.print();
  console.time("timer");
  await net.fit(xs, ys, { batchSize: 1, epochs: 200 });
  const output = net.predict(tf.tensor2d([new Array(inSize).fill(Math.PI)])) as tf.Tensor;
  console.log("output", await output.data());
  console.timeEnd("timer");
}*/

async function test() {
  console.log(MathUtil.normalizeSplit([-2, -1, 0, 1, 2, 3], 0.0, [-1, 1])); //-1, -0.5, 0, 0.33, 0.66, 1
}

test();

/*
import * as brain from "brain.js";
//CPU Time: 5.186s
//GPU Time: 13.607s
const inSize = 20;
const net = new brain.NeuralNetworkGPU({ hiddenLayers: [40, 40, 40], inputSize: inSize, outputSize: 1, mode: "gpu" });
const inputs = [];

for (let i = 0; i < 100; i++) {
  inputs.push({ input: new Array(inSize).fill(i), output: [(Math.sin(i) + 1) / 2] });
}

console.time("timer");
net.train(inputs, {
  log: true,
  logPeriod: 10,
  iterations: 200,
});

const output = net.run(new Array(inSize).fill(Math.PI));
console.log(output);
console.timeEnd("timer");
*/

import RandomUtil from "util/RandomUtil";
import * as tf from "@tensorflow/tfjs-node-gpu";

async function test() {
  await tf.setBackend("cpu");
  const inSize = 20;
  const amount = 100;
  const net = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [inSize], activation: "sigmoid", units: 40 }),
      tf.layers.dense({ activation: "sigmoid", units: 40 }),
      tf.layers.dense({ activation: "sigmoid", units: 40 }),
      tf.layers.dense({ activation: "sigmoid", units: 1 }),
    ],
  });
  net.compile({ optimizer: "sgd", loss: "meanSquaredError" });

  const xsArr = [];
  const ysArr = [];

  for (let i = 0; i < amount; i++) {
    xsArr.push(new Array(inSize).fill(i));
    ysArr.push([(Math.sin(i) + 1) / 2]);
  }

  const xs = tf.tensor(xsArr);
  const ys = tf.tensor(ysArr);
  console.time("timer");
  await net.fit(xs, ys, { batchSize: 1, epochs: 200 });
  const output = net.predict(tf.tensor2d([new Array(inSize).fill(Math.PI)])) as tf.Tensor;
  console.log("output", await output.data());
  console.timeEnd("timer");
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

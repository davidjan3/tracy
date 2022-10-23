import * as tf from "@tensorflow/tfjs-node-gpu";
import MathUtil from "util/MathUtil";
import Account from "./account";
import Indicators, { ChartData } from "./indicators";
import { Strategy } from "./runner";

export type Input = { endPrice: number; maxPrice: number; minPrice: number; volume: number };
export type Sets = {
  inputs: tf.Tensor3D;
  outputs: tf.Tensor1D;
};

export default class Tracy implements Strategy {
  public name = "Tracy";
  static readonly inputLen = 5; //input length in units of time
  static readonly inputShape = [8, Tracy.inputLen]; //8 indicators
  static readonly minTradeLen = 1; //minimum trade length in units of time
  static readonly decisionThreshold = 0.25; //minimum deviation from 0 where decision is made
  static readonly maxAmount = 20.0; //Max amount / leverage to buy&sell
  public net: tf.LayersModel;
  public minMax: [number, number][] | undefined;

  constructor(model?: tf.LayersModel) {
    tf.setBackend("cpu");
    if (model) this.net = model;
    else {
      const layers = [
        tf.input({ shape: Tracy.inputShape }),
        tf.layers.flatten(),
        tf.layers.dense({
          activation: "sigmoid",
          units: 16,
        }),
        tf.layers.dense({
          activation: "sigmoid",
          units: 10,
        }),
        tf.layers.dense({
          activation: "tanh",
          units: 1,
          useBias: true,
        }),
      ];
      this.net = tf.model({ inputs: layers[0] as tf.SymbolicTensor, outputs: Tracy.applyCascade(layers) });
    }
    this.net.compile({ optimizer: tf.train.sgd(0.04), loss: tf.losses.meanSquaredError });
  }

  public async train(arr: ChartData[]) {
    const sets = Tracy.valuesToSets(arr);
    this.minMax = sets.minMax;
    await tf.ready();
    return await this.net.fit(sets.sets.inputs, sets.sets.outputs, {
      batchSize: 64,
      epochs: 10,
      shuffle: true,
    });
  }

  public static valuesToSets(
    arr: ChartData[],
    minMax?: [number, number][],
    withoutOutputs: boolean = false
  ): {
    sets: Sets;
    minMax?: [number, number][];
  } {
    if (arr.length < Tracy.inputLen + Tracy.minTradeLen)
      return {
        sets: { inputs: tf.tensor3d([], [Tracy.inputShape[0], Tracy.inputShape[1], 0]), outputs: tf.tensor1d([]) },
      };

    let inputs: number[][][] = [];
    let outputs: number[] = [];
    const closePrice = Indicators.meta(arr, "closePrice");
    const volume = Indicators.meta(arr, "volume");
    const sma20 = Indicators.sma(arr, 20);
    const ema20 = Indicators.ema(arr, 20);
    const tema20 = Indicators.tema(arr, 20);
    const bb = Indicators.bb(arr, 20);
    const indicators = [closePrice, volume, sma20, ema20, tema20, bb.lower, bb.middle, bb.upper];
    const indicatorDiffs = indicators.map((id) => Indicators.diff(id));
    minMax ??= [...[...indicators, ...indicatorDiffs].map((id) => MathUtil.getMinMax(id.data.map((v) => v[1])))];
    const maxDelay = Math.max(...[...indicators, ...indicatorDiffs].map((id) => id.delay));
    for (let i = maxDelay + Tracy.inputLen; i <= arr.length - (withoutOutputs ? 0 : Tracy.minTradeLen); i++) {
      let input: number[][] = [];
      for (let id = 0; id < indicators.length; id++) {
        const lastValue = indicators[id].data[i - 1][1];
        const prevDiffs = indicatorDiffs[id].data.slice(i - Tracy.inputLen + 1, i).map((v) => v[1]);
        input.push([
          ...MathUtil.normalize(prevDiffs, [0, 1], minMax[id + indicators.length]),
          MathUtil.normalize([lastValue], [0, 1], minMax[id])[0],
        ]);
      }
      inputs.push(input);

      let output: number = 0;
      output = withoutOutputs ? 0 : Tracy.makePrediction(arr[i - 1], arr.slice(i, i + Tracy.minTradeLen));
      outputs.push(output);
    }
    if (!withoutOutputs) {
      let outputScale = 1.0 / MathUtil.getMaxDeviation(outputs);
      outputs = outputs.map((o) => Math.sign(o) * MathUtil.saturation(Math.abs(o * outputScale), 1.0));
    }
    return { minMax: minMax, sets: { inputs: tf.tensor3d(inputs), outputs: tf.tensor1d(outputs) } };
  }

  public run(data: ChartData[]): number {
    const input = Tracy.valuesToSets(data, this.minMax, true).sets.inputs;
    const output = this.net.predict(input) as tf.Tensor2D;
    return output.arraySync().slice(-1)[0][0];
  }

  public averageDiffNext(lastValue: number[], nextValues: number[][]): number {
    let diffSum = 0;
    for (let v of nextValues) {
      diffSum += (v[0] - lastValue[0]) / lastValue[0];
    }
    return diffSum / nextValues.length > 0 ? 1.0 : -1.0;
  }

  public static makeDecision(prediction: number, thresholdOverride?: number): -1.0 | 0.0 | 1.0 {
    if (prediction > (thresholdOverride ?? Tracy.decisionThreshold)) return 1.0;
    if (prediction < -(thresholdOverride ?? Tracy.decisionThreshold)) return -1.0;
    return 0;
  }

  public static makePrediction(lastValue: ChartData, nextValues: ChartData[]): number {
    let buy = 0.0;
    let sell = 0.0;
    for (let v of nextValues) {
      const priceDiff = (v.closePrice - lastValue.closePrice) / lastValue.closePrice;
      if (priceDiff > 0) {
        buy += 1 / nextValues.length;
      } else {
        buy = 0.0;
        break;
      }
    }
    for (let v of nextValues) {
      const priceDiff = (v.closePrice - lastValue.closePrice) / lastValue.closePrice;
      if (priceDiff < 0) {
        sell -= -1 / nextValues.length;
      } else {
        sell = 0.0;
        break;
      }
    }
    return buy - sell;
  }

  public static splitOutput(output: number) {
    return [output >= 0 ? output : 0, output <= 0 ? -output : 0];
  }

  public static combOutput(output: [number, number]) {
    return output[0] - output[1];
  }

  private static applyCascade(layers: (tf.layers.Layer | tf.SymbolicTensor)[]): tf.SymbolicTensor {
    if (layers.length == 1) return layers[0] as tf.SymbolicTensor;
    return (layers[layers.length - 1] as tf.layers.Layer).apply(
      this.applyCascade(layers.slice(0, layers.length - 1))
    ) as tf.SymbolicTensor;
  }
}

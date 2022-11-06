import * as tf from "@tensorflow/tfjs-node";
import MathUtil from "util/MathUtil";
import Indicators, { ChartData } from "./indicators";
import { Strategy } from "./runner";
import Tracy from "./tracy";

export type Input = { endPrice: number; maxPrice: number; minPrice: number; volume: number };
export type Sets = {
  inputs: tf.Tensor2D;
  outputs: tf.Tensor1D;
};

export default class TracyTF extends Tracy {
  public name = "TracyTF";
  static readonly inputLen = 6; //input length in units of time
  static readonly indicatorCount = 5; //number of indicators used
  static readonly inputShape = [this.indicatorCount * Tracy.inputRange]; //8 indicators
  static readonly minTradeLen = 3; //minimum trade length in units of time
  static readonly decisionThreshold = 0.4; //minimum deviation from 0 where decision is made
  static readonly maxAmount = 20.0; //Max amount / leverage to buy&sell
  public net: tf.LayersModel;
  public inputMinMax: [number, number][] | undefined;
  public outputMinMax: [number, number] | undefined;

  constructor(model?: tf.LayersModel) {
    tf.setBackend("cpu");
    if (model) this.net = model;
    else {
      const layers = [
        tf.input({ shape: Tracy.inputShape }),
        tf.layers.dense({
          activation: "tanh",
          units: 64,
        }),
        tf.layers.dense({
          activation: "tanh",
          units: 32,
        }),
        tf.layers.dense({
          activation: "tanh",
          units: 16,
        }),
        tf.layers.dense({
          activation: "tanh",
          units: 1,
        }),
      ];
      this.net = tf.model({ inputs: layers[0] as tf.SymbolicTensor, outputs: Tracy.applyCascade(layers) });
    }
    this.net.compile({ optimizer: tf.train.momentum(0.000008, 0.4), loss: tf.losses.absoluteDifference });
  }

  public async train(arr: ChartData[]) {
    const sets = Tracy.valuesToSets(arr);
    this.inputMinMax = sets.inputMinMax;
    this.outputMinMax = sets.outputMinMax;
    await tf.ready();
    return await this.net.fit(sets.sets.inputs, sets.sets.outputs, {
      batchSize: 1,
      epochs: 5,
      shuffle: true,
    });
  }

  public static valuesToSets(
    arr: ChartData[],
    inputMinMax?: [number, number][],
    outputMinMax?: [number, number],
    withoutOutputs: boolean = false
  ): {
    sets: Sets;
    inputMinMax: [number, number][];
    outputMinMax: [number, number];
  } {
    if (arr.length < Tracy.inputRange + Tracy.outputLookahead)
      return {
        sets: { inputs: tf.tensor2d([]), outputs: tf.tensor1d([]) },
        inputMinMax: Array(Tracy.indicatorCount).fill([-1, 1]),
        outputMinMax: [-1, 1],
      };

    let inputs: number[][] = [];
    let outputs: number[] = [];
    const closePrice = Indicators.meta(arr, "closePrice");
    const volume = Indicators.meta(arr, "volume");
    const sma20 = Indicators.sma(arr, 20);
    const ema20 = Indicators.ema(arr, 20);
    const tema20 = Indicators.tema(arr, 20);
    const bb = Indicators.bb(arr, 20);
    const indicators = [closePrice /*, volume*/ /*, sma20*/, ema20, tema20, bb.lower /*, bb.middle*/, bb.upper]; //Array(6).fill(Indicators.random(arr)) as IndicatorData[];
    const indicatorDiffs = indicators.map((id) => Indicators.diff(id));
    inputMinMax ??= [...[...indicators, ...indicatorDiffs].map((id) => MathUtil.getMinMax(id.data.map((v) => v[1])))];
    const maxDelay = MathUtil.max([...indicators, ...indicatorDiffs].map((id) => id.delay));
    for (let i = maxDelay + Tracy.inputRange; i <= arr.length - (withoutOutputs ? 0 : Tracy.outputLookahead); i++) {
      let input: number[] = [];
      for (let id = 0; id < indicators.length; id++) {
        const lastValue = indicators[id].data[i - 1][1];
        const prevDiffs = indicatorDiffs[id].data.slice(i - Tracy.inputRange + 1, i).map((v) => v[1]);
        input.push(
          ...MathUtil.normalizeSplit(prevDiffs, 0, [-3, 3], inputMinMax[id + indicators.length]),
          MathUtil.normalize([lastValue], [-3, 3], inputMinMax[id])[0]
        );
      }
      inputs.push(input);

      let output: number = 0;
      output = withoutOutputs ? 0 : Tracy.makePrediction(arr[i - 1], arr.slice(i, i + Tracy.outputLookahead));
      outputs.push(output);
    }
    if (!withoutOutputs) {
      outputMinMax ??= MathUtil.getMinMax(outputs);
      outputs = MathUtil.normalizeSplit(outputs, 0, [-1, 1], outputMinMax).map((v) => MathUtil.saturation(v));
    }
    return {
      inputMinMax: inputMinMax,
      outputMinMax: outputMinMax ?? [-1, 1],
      sets: { inputs: tf.tensor2d(inputs), outputs: tf.tensor1d(outputs) },
    };
  }

  public run(data: ChartData[]): number {
    const inputs = Tracy.valuesToSets(data, this.inputMinMax, this.outputMinMax, true).sets.inputs;
    const input = inputs.slice(inputs.shape[0] - 1);
    const output = this.net.predict(input) as tf.Tensor2D;
    return output.arraySync().slice(-1)[0][0];
  }

  public averageDiffNext(lastValue: ChartData, nextValues: ChartData[]): number {
    let diffSum = 0;
    for (let v of nextValues) {
      diffSum += (v.closePrice - lastValue.closePrice) / lastValue.closePrice;
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
        buy += priceDiff / nextValues.length;
      } else {
        buy = 0.0;
        break;
      }
    }
    for (let v of nextValues) {
      const priceDiff = (v.closePrice - lastValue.closePrice) / lastValue.closePrice;
      if (priceDiff < 0) {
        sell -= priceDiff / nextValues.length;
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

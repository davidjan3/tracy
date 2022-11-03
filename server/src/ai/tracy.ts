import { NeuralNetwork } from "brain.js";
import FileUtil from "util/FileUtil";
import MathUtil from "util/MathUtil";
import Indicators, { ChartData } from "./indicators";
import { Strategy } from "./runner";

export type Sets = {
  input: number[];
  output: number[];
}[];

export default class Tracy implements Strategy {
  public name = "Tracy";
  static readonly inputRange = 24; //input length in units of time
  static readonly indicatorCount = 8; //number of indicators used
  static readonly inputSize = this.indicatorCount * Tracy.inputRange; //8 indicators
  static readonly outputSize = 1; //-1: sell, +1: buy
  static readonly minTradeLen = 3; //minimum trade length in units of time
  static readonly decisionThreshold = 0.2; //minimum deviation from 0 where decision is made
  static readonly maxAmount = 20.0; //Max amount / leverage to buy&sell
  public net;
  public inputMinMax: [number, number][] | undefined;
  public outputMinMax: [number, number] | undefined;

  constructor(path?: string) {
    this.net = new NeuralNetwork({
      activation: "tanh",
      inputSize: Tracy.inputSize,
      outputSize: Tracy.outputSize,
      hiddenLayers: [32, 16],
    });
    if (path) this.net.fromJSON(FileUtil.loadJSON(path, false));
  }

  public async train(arr: ChartData[]) {
    const sets = Tracy.valuesToSets(arr);
    this.inputMinMax = sets.inputMinMax;
    this.outputMinMax = sets.outputMinMax;
    await this.net.trainAsync(sets.sets, {
      learningRate: 0.002,
      momentum: 0.6,
      iterations: 30,
      logPeriod: 1,
      log: true,
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
    if (arr.length < Tracy.inputRange + Tracy.minTradeLen)
      return {
        sets: [],
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
    const indicators = [closePrice, volume, sma20, ema20, tema20, bb.lower, bb.middle, bb.upper].slice(
      0,
      Tracy.indicatorCount
    ); //Array(6).fill(Indicators.random(arr)) as IndicatorData[];
    const indicatorDiffs = indicators.map((id) => Indicators.diff(id));
    inputMinMax ??= [...[...indicators, ...indicatorDiffs].map((id) => MathUtil.getMinMax(id.data.map((v) => v[1])))];
    const maxDelay = Math.max(...[...indicators, ...indicatorDiffs].map((id) => id.delay));
    for (let i = maxDelay + Tracy.inputRange - 1; i <= arr.length - (withoutOutputs ? 0 : Tracy.minTradeLen); i++) {
      let input: number[] = [];
      for (let id = 0; id < indicators.length; id++) {
        const lastValue = indicators[id].data[i - 1][1];
        const prevDiffs = indicatorDiffs[id].data.slice(i - Tracy.inputRange + 1, i).map((v) => v[1]);
        input.push(
          ...MathUtil.normalizeSplit(prevDiffs, 0, [-1, 1], inputMinMax[id + indicators.length]),
          MathUtil.normalize([lastValue], [-1, 1], inputMinMax[id])[0]
        );
      }
      inputs.push(input);

      let output: number = 0;
      output = withoutOutputs ? 0 : Tracy.makePrediction(arr[i - 1], arr.slice(i, i + Tracy.minTradeLen));
      outputs.push(output);
    }
    if (!withoutOutputs) {
      outputMinMax ??= MathUtil.getMinMax(outputs);
      outputs = MathUtil.normalizeSplit(outputs, 0, [-1, 1], outputMinMax).map((v) => MathUtil.saturation(v));
    }
    const sets = inputs.map((v, i) => ({ input: inputs[i], output: [outputs[i]] }));
    return {
      inputMinMax: inputMinMax,
      outputMinMax: outputMinMax ?? [-1, 1],
      sets: sets,
    };
  }

  public run(data: ChartData[]): number {
    const sets = Tracy.valuesToSets(data, this.inputMinMax, this.outputMinMax, true).sets;
    const input = sets[sets.length - 1].input;
    const output = this.net.run(input) as number[];
    return output[0];
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
}

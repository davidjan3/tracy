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
  static readonly inputRange = 8; //input length in units of time
  static readonly indicatorCount = 12; //number of indicators used
  static readonly inputSize = this.indicatorCount * Tracy.inputRange; //8 indicators
  static readonly outputSize = 1; //-1: sell, +1: buy
  static readonly outputLookahead = 24; //Length of Future ChartData used for output evaulation
  static readonly minTradeLen = 4; //Minimum number of Future ChartData heading to same direction for decision to be made
  static readonly decisionThreshold = 0.4; //minimum deviation from 0 where decision is made
  static readonly maxAmount = 20.0; //Max amount / leverage to buy&sell
  static readonly maxInidicatorDelay = 100;
  static readonly inputLookahead = Tracy.maxInidicatorDelay + Tracy.inputRange;
  public net;
  public inputMinMax: [number, number][] | undefined;
  public outputMinMax: [number, number] | undefined;

  constructor(path?: string) {
    this.net = new NeuralNetwork({
      inputSize: Tracy.inputSize,
      outputSize: Tracy.outputSize,
      hiddenLayers: [32, 16, 8],
    });
    if (path) this.net.fromJSON(FileUtil.loadJSON(path, false));
  }

  public async train(arr: ChartData[]) {
    const sets = Tracy.valuesToSets(arr);
    this.inputMinMax = sets.inputMinMax;
    this.outputMinMax = sets.outputMinMax;
    await this.net.trainAsync(sets.sets, {
      activation: "tanh",
      learningRate: 0.004,
      iterations: 100,
      logPeriod: 1,
      errorThresh: 0.2,
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
    if (arr.length < Tracy.inputRange + Tracy.outputLookahead)
      return {
        sets: [],
        inputMinMax: Array(Tracy.indicatorCount).fill([-1, 1]),
        outputMinMax: [-1, 1],
      };

    let inputs: number[][] = [];
    let outputs: number[] = [];
    const closePrice = Indicators.meta(arr, "closePrice");
    const volume = Indicators.meta(arr, "volume");
    const sma100 = Indicators.sma(arr, 100);
    const ema20 = Indicators.ema(arr, 20);
    const tema20 = Indicators.tema(arr, 20);
    const davg = Indicators.davg(arr);
    const bb = Indicators.bb(arr, 20);
    const macd = Indicators.macd(arr);
    const indicators = [
      closePrice,
      volume,
      sma100,
      ema20,
      tema20,
      davg,
      bb.lower,
      bb.middle,
      bb.upper,
      macd.number,
      macd.signal,
      macd.histogram,
    ].slice(0, Tracy.indicatorCount); //Array(6).fill(Indicators.random(arr)) as IndicatorData[];
    const indicatorDiffs = indicators.map((id) => Indicators.diff(id));
    inputMinMax ??= [
      ...[...indicators, ...indicatorDiffs].map((id) =>
        MathUtil.getMinMax(
          id.data.map((v) => v[1]),
          true
        )
      ),
    ];
    const maxDelay = Math.max(...[...indicators, ...indicatorDiffs].map((id) => id.delay));
    for (let i = maxDelay + Tracy.inputRange - 1; i <= arr.length - (withoutOutputs ? 0 : Tracy.outputLookahead); i++) {
      let input: number[] = [];
      for (let id = 0; id < indicators.length; id++) {
        const lastValue = indicators[id].data[i - 1][1];
        const prevDiffs = indicators[id].data.slice(i - Tracy.inputRange, i - 1).map((v) => v[1]);
        input.push(
          ...MathUtil.normalizeSplit(prevDiffs, 0, [-1, 1], inputMinMax[id]),
          MathUtil.normalize([lastValue], [-1, 1], inputMinMax[id])[0]
        );
      }
      inputs.push(input);

      let output: number = 0;
      output = withoutOutputs
        ? 0
        : Tracy.makeDecision(Tracy.makePrediction(arr[i - 1], arr.slice(i, i + Tracy.outputLookahead)));
      outputs.push(output);
    }
    if (!withoutOutputs) {
      outputMinMax ??= MathUtil.getMinMax(outputs, true);
      outputs = MathUtil.normalizeSplit(outputs, 0, [-1, 1], outputMinMax);
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

  public static makeDecision(prediction: number, thresholdOverride?: number): -1.0 | 0.0 | 1.0 {
    if (prediction > (thresholdOverride ?? Tracy.decisionThreshold)) return 1.0;
    if (prediction < -(thresholdOverride ?? Tracy.decisionThreshold)) return -1.0;
    return 0;
  }

  public static averageDiffNext(lastValue: ChartData, nextValues: ChartData[]): number {
    let diffSum = 0;
    for (let v of nextValues) {
      diffSum += (v.closePrice - lastValue.closePrice) / lastValue.closePrice;
    }
    return diffSum / nextValues.length > 0 ? 1.0 : -1.0;
  }

  public static makePrediction(lastValue: ChartData, nextValues: ChartData[]): number {
    let output = 0;
    const diffs = nextValues.map((v) => v.closePrice - lastValue.closePrice);
    const max = MathUtil.getMaxDeviation(diffs, 0);
    if (max == 0) return 0;
    for (let i = 0; i < diffs.length; i++) {
      const d = diffs[i];
      if (i != 0 && Math.sign(output) != Math.sign(d)) {
        if (i < Tracy.minTradeLen) output = 0;
        break;
      }
      output += (0.6 * Math.sign(d) + 0.4 * (d / max)) * Math.pow(0.85, i + 1);
    }
    return output / 6;
  }
}

import { NeuralNetwork } from "brain.js";
import { INeuralNetworkData } from "brain.js/dist/src/neural-network";

export type Set = {
  input: number[];
  output: number[];
};

export default class Tracy {
  static readonly inputLen = 10; //input length in units of time
  static readonly minTradeLen = 3; //minimum trade length in units of time
  static readonly optimalDeviation = 0.005; //expected relative deviation to currentValue where full decision is made
  static readonly decisionThreshold = 0.2; //minimum deviation from 0 where decision is made
  public net: NeuralNetwork<INeuralNetworkData, INeuralNetworkData>;

  constructor() {
    this.net = new NeuralNetwork({
      binaryThresh: 0.5,
      inputSize: Tracy.inputLen, //relative price deviation from previous price in chain, absolute last price in chain, lastVolume, indicator (1.0 if endPrice is closer to maxPrice than minPrice, otherwise -1,0)
      outputSize: 2,
      hiddenLayers: [10, 10, 2],
      activation: "sigmoid",
    });
  }

  public train(sets: Set[]) {
    return this.net.train(sets, {
      log: true,
      logPeriod: 10,
    });
  }

  public test(sets: Set[], log?: boolean) {
    let errorCount = 0;
    for (let set of sets) {
      const output = this.net.run(set.input) as [number, number];
      /*if (this.makeDecision(output) == this.makeDecision(set.output as [number, number])) {
        if (log) console.log(`${set.input[Tracy.inputLen]}   actual: ${output}   expected: ${set.output}`);
      } else {
        if (log) console.error(`${set.input[Tracy.inputLen]}   actual: ${output}   expected: ${set.output}`);
        errorCount++;
      }*/
    }
    if (log) console.log(`Errors: ${errorCount}/${sets.length} (${errorCount / sets.length})`);
    return errorCount;
  }

  public valuesToSets(arr: number[][]): Set[] {
    if (arr.length < Tracy.inputLen + Tracy.minTradeLen) return [];
    const sets: Set[] = [];
    for (let i = 1; i < arr.length - Tracy.inputLen - Tracy.minTradeLen; i++) {
      const set: Set = { input: [], output: [] };
      const lastValue = arr[i + Tracy.inputLen - 1];
      for (let j = 0; j < Tracy.inputLen; j++) {
        const priceDiff = (arr[i + j][0] - arr[i + j - 1][0]) / arr[i + j - 1][0];
        set.input.push(priceDiff);
      }
      set.input.push(lastValue[0], lastValue[3]);
      const indicator = lastValue[1] - lastValue[0] - (lastValue[0] - lastValue[2]);
      set.input.push(indicator);
      set.output = this.makeConfidences(
        lastValue,
        arr.slice(i + Tracy.inputLen, i + Tracy.inputLen + Tracy.minTradeLen)
      );
      sets.push(set);
    }
    return sets;
  }

  public averageDiffNext(lastValue: number[], nextValues: number[][]): number {
    let diffSum = 0;
    for (let v of nextValues) {
      diffSum += (v[0] - lastValue[0]) / lastValue[0];
    }
    return diffSum / nextValues.length > 0 ? 1.0 : -1.0;
  }

  public makeConfidences(lastValue: number[], nextValues: number[][]): [number, number] {
    let buy = 0.0;
    let sell = 0.0;
    for (let v of nextValues) {
      const priceDiff = (v[0] - lastValue[0]) / lastValue[0];
      if (priceDiff > 0) {
        buy += this.saturation(priceDiff, Tracy.optimalDeviation) / nextValues.length;
      } else {
        buy = 0.0;
        break;
      }
    }
    for (let v of nextValues) {
      let priceDiff = (v[0] - lastValue[0]) / lastValue[0];
      if (priceDiff < 0) {
        sell += this.saturation(-priceDiff, Tracy.optimalDeviation) / nextValues.length;
      } else {
        sell = 0.0;
        break;
      }
    }
    /*console.log(
      lastValue[0],
      nextValues.map((v) => v[0]),
      [long, short]
    );*/
    return [buy, sell];
  }

  /*public makeDecision(confidences: [number, number]): [number, number] {
    if (Math.abs(confidences[0] - confidences[1]) > Tracy.decisionThresholdDiff) {
      return [
        confidences[0] >= Tracy.decisionThresholdYes && confidences[1] <= Tracy.decisionThresholdNo ? 1.0 : 0.0,
        confidences[1] >= Tracy.decisionThresholdYes && confidences[0] <= Tracy.decisionThresholdNo ? 1.0 : 0.0,
      ];
    } else return [0.0, 0.0];
  }*/

  /** n == 0 => 0, n == limit => 1, everything between rises exponentially towards 1.0 */
  private saturation(n: number, limit: number) {
    if (n <= 0) return 0.0;
    if (n >= limit) return 1.0;
    const p = n / limit;
    return p * p;
  }
}

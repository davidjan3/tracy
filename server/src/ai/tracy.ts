import { NeuralNetwork } from "brain.js";
import { output } from "brain.js/dist/src/layer";
import { INeuralNetworkData } from "brain.js/dist/src/neural-network";
import MathUtil from "util/MathUtil";

export type Set = {
  input: number[];
  output: number[];
};

export default class Tracy {
  static readonly inputLen = 20; //input length in units of time
  static readonly minTradeLen = 5; //minimum trade length in units of time
  static readonly optimalDeviation = 0.01; //expected relative deviation to currentValue where full decision is made
  static readonly decisionThreshold = 0.2; //minimum deviation from 0 where decision is made
  public net: NeuralNetwork<INeuralNetworkData, INeuralNetworkData>;

  constructor() {
    this.net = new NeuralNetwork({
      binaryThresh: 0.5,
      inputSize: Tracy.inputLen + 1, //relative price deviation from previous price in chain, indicator
      outputSize: 1,
      hiddenLayers: [18, 9],
      activation: "tanh",
      learningRate: 0.001,
    });
  }

  public train(sets: Set[]) {
    return this.net.train(sets, {
      log: true,
      logPeriod: 10,
      errorThresh: 0.095,
    });
  }

  public test(sets: Set[], log?: boolean) {
    let buyMatchedCount = 0;
    let buyFailedCount = 0;
    let sellMatchedCount = 0;
    let sellFailedCount = 0;
    let chillMatchedCount = 0;
    let chillFailedCount = 0;
    for (let set of sets) {
      const output = this.net.run(set.input) as [number, number];
      let loggood = () => (log ? console.log(`actual: ${output}   expected: ${set.output}`) : 0);
      let logbad = () => (log ? console.error(`actual: ${output}   expected: ${set.output}`) : 0);
      if (this.makeDecision(set.output[0]) == 1.0) {
        if (this.makeDecision(output[0]) == 1.0) {
          loggood();
          buyMatchedCount++;
        } else {
          logbad();
          buyFailedCount++;
        }
      }
      if (this.makeDecision(set.output[0]) == -1.0) {
        if (this.makeDecision(output[0]) == -1.0) {
          loggood();
          sellMatchedCount++;
        } else {
          logbad();
          sellFailedCount++;
        }
      }
      if (this.makeDecision(set.output[0]) == 0.0) {
        if (this.makeDecision(output[0]) == 0.0) {
          loggood();
          chillMatchedCount++;
        } else {
          logbad();
          chillFailedCount++;
        }
      }
    }
    if (log)
      console.log(
        `Buy matched: ${buyMatchedCount}/${buyMatchedCount + buyFailedCount} (${
          buyMatchedCount / (buyMatchedCount + buyFailedCount)
        })`
      );
    if (log)
      console.log(
        `Sell matched: ${sellMatchedCount}/${sellMatchedCount + sellFailedCount} (${
          sellMatchedCount / (sellMatchedCount + sellFailedCount)
        })`
      );
    if (log)
      console.log(
        `Chill matched: ${chillMatchedCount}/${chillMatchedCount + chillFailedCount} (${
          chillMatchedCount / (chillMatchedCount + chillFailedCount)
        })`
      );
    return buyFailedCount + sellFailedCount + chillFailedCount;
  }

  public valuesToSets(arr: { endPrice: number; maxPrice: number; minPrice: number; volume: number }[]): {
    sets: Set[];
    scale: number;
  } {
    if (arr.length < Tracy.inputLen + Tracy.minTradeLen) return { sets: [], scale: 1.0 };
    let diffArr = new Array<number>(arr.length - 1);
    for (let i = 0; i < arr.length - 1; i++) {
      const priceDiff = (arr[i + 1].endPrice - arr[i].endPrice) / arr[i].endPrice;
      diffArr[i] = priceDiff;
      if (Number.isNaN(priceDiff)) debugger;
    }
    let scale = 1.0 / MathUtil.getStandardDeviation(diffArr, 0.0);
    diffArr = diffArr.map((v) => v * scale);

    let sets: Set[] = [];
    for (let i = 0; i < arr.length - Tracy.inputLen - Tracy.minTradeLen; i++) {
      const set: Set = { input: [], output: [] };
      const lastValue = arr[i + Tracy.inputLen - 1];
      for (let j = 0; j < Tracy.inputLen; j++) {
        set.input.push(diffArr[i + j]);
      }
      //set.input.push(lastValue[0], lastValue[3]);
      const priceRange = lastValue.maxPrice - lastValue.minPrice;
      const indicator = priceRange != 0 ? ((lastValue.endPrice - lastValue.minPrice) / priceRange) * 2 - 1.0 : 0.0;
      set.input.push(indicator);
      set.output = [
        this.makePrediction(lastValue, arr.slice(i + Tracy.inputLen, i + Tracy.inputLen + Tracy.minTradeLen)),
      ];
      sets.push(set);
    }
    let outputScale =
      1.0 /
      MathUtil.getMaxDeviation(
        sets.map((s) => s.output[0]),
        0.0
      );
    sets = sets.map((s) => ({
      input: s.input,
      output: [Math.sign(s.output[0]) * this.saturation(Math.abs(s.output[0] * outputScale), 1.0)],
    }));
    return { scale: scale, sets: sets };
  }

  public averageDiffNext(lastValue: number[], nextValues: number[][]): number {
    let diffSum = 0;
    for (let v of nextValues) {
      diffSum += (v[0] - lastValue[0]) / lastValue[0];
    }
    return diffSum / nextValues.length > 0 ? 1.0 : -1.0;
  }

  public makeDecision(prediction: number): number {
    if (prediction > Tracy.decisionThreshold) return 1.0;
    if (prediction < -Tracy.decisionThreshold) return -1.0;
    return 0;
  }

  public makePrediction(
    lastValue: { endPrice: number; maxPrice: number; minPrice: number; volume: number },
    nextValues: { endPrice: number; maxPrice: number; minPrice: number; volume: number }[]
  ): number {
    let buy = 0.0;
    let sell = 0.0;
    for (let v of nextValues) {
      const priceDiff = (v.endPrice - lastValue.endPrice) / lastValue.endPrice;
      if (priceDiff > 0) {
        buy += priceDiff / nextValues.length;
      } else {
        buy = 0.0;
        break;
      }
    }
    for (let v of nextValues) {
      const priceDiff = (v.endPrice - lastValue.endPrice) / lastValue.endPrice;
      if (priceDiff < 0) {
        sell -= priceDiff / nextValues.length;
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
    return buy - sell;
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
    return Math.pow(n, 1 / 10);
  }
}

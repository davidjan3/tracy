import { NeuralNetwork } from "brain.js";
import { output } from "brain.js/dist/src/layer";
import { INeuralNetworkData } from "brain.js/dist/src/neural-network";
import chalk from "chalk";
import MathUtil from "util/MathUtil";
import Account from "./account";

export type Set = {
  input: number[];
  output: number[];
};

export default class Tracy {
  static readonly inputLen = 30; //input length in units of time
  static readonly minTradeLen = 5; //minimum trade length in units of time
  static readonly optimalDeviation = 0.01; //expected relative deviation to currentValue where full decision is made
  static readonly decisionThreshold = 0.1; //minimum deviation from 0 where decision is made
  static readonly maxAmount = 20.0; //Max amount / leverage to buy&sell
  public net: NeuralNetwork<INeuralNetworkData, INeuralNetworkData>;
  public account: Account;
  public scale: number;

  constructor(account: Account) {
    this.net = new NeuralNetwork({
      binaryThresh: 0.5,
      inputSize: Tracy.inputLen + 1, //relative price deviation from previous price in chain, indicator
      outputSize: 1,
      hiddenLayers: [10, 10, 4, 2],
      activation: "tanh",
      learningRate: 0.001,
      momentum: 0.4,
    });
    this.account = account;
    this.scale = 1.0;
  }

  public train(arr: { endPrice: number; maxPrice: number; minPrice: number; volume: number }[]) {
    const sets = this.valuesToSets(arr);
    this.scale = sets.scale;
    return this.net.train(sets.sets, {
      log: true,
      logPeriod: 10,
      errorThresh: 0.225,
    });
  }

  public test(arr: { endPrice: number; maxPrice: number; minPrice: number; volume: number }[], log: boolean = true) {
    const oldAmount = this.account.amount;
    const sets = this.valuesToSets(arr, this.scale);
    const hits: { [index: string]: { hit: number; missed: number; hitInstead: number } } = {
      "-1": { hit: 0, missed: 0, hitInstead: 0 },
      "0": { hit: 0, missed: 0, hitInstead: 0 },
      "1": { hit: 0, missed: 0, hitInstead: 0 },
    };
    let error = 0;
    for (let i = 0; i < sets.sets.length; i++) {
      const output = (this.net.run(sets.sets[i].input) as number[])[0];
      const expectedDecision = this.makeDecision(sets.sets[i].output[0]);
      const actualDecision = this.makeDecision(output);
      const hit = actualDecision == expectedDecision;
      if (log) {
        const logF = hit ? chalk.green : chalk.red;
        console.log(
          `expected: ${chalk.blue(MathUtil.round(sets.sets[i].output[0], 2))} actual: ${logF(
            MathUtil.round(output, 2)
          )}`
        );
      }
      if (hit) {
        hits[expectedDecision].hit++;
      } else {
        hits[expectedDecision].missed;
        hits[actualDecision].hitInstead++;
      }
      error += Math.abs(output - sets.sets[i].output[0]);
      const price = arr[i + Tracy.inputLen - 1].endPrice;
      this.actOnPrediction(output, price);
    }
    error /= sets.sets.length;
    this.account.closeBuys(arr[arr.length - 1].endPrice);
    this.account.closeSells(arr[arr.length - 1].endPrice);
    this.account.logBalance();
    this.account.resetProfit();
    this.account.amount = oldAmount;
    console.table(hits);
    console.log("Average error: " + error);
  }

  public valuesToSets(
    arr: { endPrice: number; maxPrice: number; minPrice: number; volume: number }[],
    scale?: number,
    withoutOutputs: boolean = false
  ): {
    sets: Set[];
    scale: number;
  } {
    if (arr.length < Tracy.inputLen + Tracy.minTradeLen) return { sets: [], scale: 1.0 };
    let diffArr = new Array<number>(arr.length - 1);
    for (let i = 0; i < arr.length - 1; i++) {
      const priceDiff = (arr[i + 1].endPrice - arr[i].endPrice) / arr[i].endPrice;
      diffArr[i] = priceDiff;
    }
    scale ??= 1.0 / MathUtil.getStandardDeviation(diffArr, 0.0);
    diffArr = diffArr.map((v) => v * scale!);

    let sets: Set[] = [];
    for (let i = 1; i < arr.length - Tracy.inputLen - (withoutOutputs ? 0 : Tracy.minTradeLen); i++) {
      const set: Set = { input: [], output: [] };
      const lastValue = arr[i + Tracy.inputLen - 1];
      for (let j = 0; j < Tracy.inputLen; j++) {
        set.input.push(diffArr[i + j - 1]);
      }
      //set.input.push(lastValue[0], lastValue[3]);
      const priceRange = lastValue.maxPrice - lastValue.minPrice;
      const indicator = priceRange != 0 ? ((lastValue.endPrice - lastValue.minPrice) / priceRange) * 2 - 1.0 : 0.0;
      set.input.push(indicator);
      set.output = withoutOutputs
        ? []
        : [this.makePrediction(lastValue, arr.slice(i + Tracy.inputLen, i + Tracy.inputLen + Tracy.minTradeLen))];
      sets.push(set);
    }
    if (!withoutOutputs) {
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
    }
    return { scale: scale, sets: sets };
  }

  public averageDiffNext(lastValue: number[], nextValues: number[][]): number {
    let diffSum = 0;
    for (let v of nextValues) {
      diffSum += (v[0] - lastValue[0]) / lastValue[0];
    }
    return diffSum / nextValues.length > 0 ? 1.0 : -1.0;
  }

  public actOnPrediction(prediction: number, price: number) {
    const decision = this.makeDecision(prediction);
    const amount = Math.abs(prediction) * Math.min(this.account.amount * 0.01, Tracy.maxAmount);
    if (decision == 1.0) {
      this.account.closeSells(price);
      this.account.buy(price, amount);
    } else if (decision == -1.0) {
      this.account.closeBuys(price);
      this.account.sell(price, amount);
    }
  }

  public makeDecision(prediction: number): -1.0 | 0.0 | 1.0 {
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

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

export type Input = { endPrice: number; maxPrice: number; minPrice: number; volume: number };

export default class Tracy {
  static readonly inputLen = 8; //input length in units of time
  static readonly minTradeLen = 2; //minimum trade length in units of time
  static readonly decisionThreshold = 0.25; //minimum deviation from 0 where decision is made
  static readonly maxAmount = 20.0; //Max amount / leverage to buy&sell
  public net: NeuralNetwork<INeuralNetworkData, INeuralNetworkData>;
  public account: Account;
  public inputScale: number;

  constructor(account: Account, json?: any) {
    this.net = new NeuralNetwork({
      binaryThresh: 0.5,
      inputSize: Tracy.inputLen + 1, //relative price deviation from previous price in chain, indicator
      outputSize: 2, //0: certainty to buy, 1: certainty to sell
      hiddenLayers: [64, 32, 16],
      learningRate: 0.4,
      momentum: 0.4,
      activation: "sigmoid",
    });
    if (json) this.net.fromJSON(json);
    this.account = account;
    this.inputScale = json?.inputScale ?? 1.0;
  }

  public train(arr: Input[]) {
    const sets = this.valuesToSets(arr);
    this.inputScale = sets.scale;
    return this.net.train(sets.sets, {
      log: true,
      logPeriod: 1,
      errorThresh: 0.07,
      iterations: 300,
    });
  }

  public test(
    arr: Input[],
    options: { logTech?: boolean; logFinance?: boolean } = { logTech: false, logFinance: true }
  ) {
    const oldAmount = this.account.amount;
    const sets = this.valuesToSets(arr, this.inputScale);
    const map = (decision: 0 | 1 | -1) => (decision == 0 ? "Chill" : decision == 1 ? "Buy" : "Sell");
    const hits: { [index: string]: { [index: string]: number } } = {
      expectedChill: { actualChill: 0, actualBuy: 0, actualSell: 0 },
      expectedBuy: { actualChill: 0, actualBuy: 0, actualSell: 0 },
      expectedSell: { actualChill: 0, actualBuy: 0, actualSell: 0 },
    };
    let error = 0;
    for (let i = 0; i < sets.sets.length; i++) {
      const expectedOutput = Tracy.combOutput(sets.sets[i].output as [number, number]);
      const actualOutput = Tracy.combOutput(this.net.run(sets.sets[i].input) as [number, number]);
      const expectedDecision = this.makeDecision(expectedOutput, 0.001);
      const actualDecision = this.makeDecision(actualOutput);
      const hit = actualDecision == expectedDecision;
      if (options.logTech) {
        const logF = hit ? chalk.green : chalk.red;
        console.log(
          `expected: ${chalk.blue(MathUtil.round(expectedOutput, 2))} actual: ${logF(MathUtil.round(actualOutput, 2))}`
        );
      }
      hits["expected" + map(expectedDecision)]["actual" + map(actualDecision)]++;
      error += Math.abs(actualOutput - expectedOutput);
      const price = arr[i + Tracy.inputLen - 1].endPrice;
      this.actOnPrediction(actualOutput, price, options.logFinance);
    }
    error /= sets.sets.length;
    this.account.closeBuys(arr[arr.length - 1].endPrice, options.logFinance);
    this.account.closeSells(arr[arr.length - 1].endPrice, options.logFinance);
    this.account.logBalance();
    this.account.resetProfit();
    this.account.amount = oldAmount;
    console.table(hits);
    console.log("Average error: " + error);
  }

  public valuesToSets(
    arr: Input[],
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
        output: Tracy.splitOutput(Math.sign(s.output[0]) * this.saturation(Math.abs(s.output[0] * outputScale), 1.0)),
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

  public actOnPrediction(prediction: number, price: number, log: boolean = true) {
    const decision = this.makeDecision(prediction);
    const amount = Math.abs(prediction) * Math.min(this.account.amount * 0.01, Tracy.maxAmount);
    if (decision == 1.0) {
      this.account.closeSells(price, log);
      this.account.buy(price, amount);
    } else if (decision == -1.0) {
      this.account.closeBuys(price, log);
      this.account.sell(price, amount);
    }
  }

  public makeDecision(prediction: number, thresholdOverride?: number): -1.0 | 0.0 | 1.0 {
    if (prediction > (thresholdOverride ?? Tracy.decisionThreshold)) return 1.0;
    if (prediction < -(thresholdOverride ?? Tracy.decisionThreshold)) return -1.0;
    return 0;
  }

  public makePrediction(lastValue: Input, nextValues: Input[]): number {
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
    return buy - sell;
  }

  private saturation(n: number, limit: number) {
    if (n <= 0) return 0.0;
    if (n >= limit) return 1.0;
    const p = n / limit;
    return Math.pow(n, 1 / 10);
  }

  public static groupInterval(values: Input[], interval: number) {
    let newValues: Input[] = [];
    for (let i = 0; i < values.length - interval; i += interval) {
      const range = values.slice(i, i + interval);
      const endPrice = range[interval - 1].endPrice;
      const volume = range.map((v) => v.volume).reduce((a, b) => a + b, 0);
      const minPrice = MathUtil.min(range.map((v) => v.minPrice));
      const maxPrice = MathUtil.max(range.map((v) => v.maxPrice));
      newValues.push({ endPrice: endPrice, minPrice: minPrice, maxPrice: maxPrice, volume: volume });
    }
    return newValues;
  }

  public static splitOutput(output: number) {
    return [output >= 0 ? output : 0, output <= 0 ? -output : 0];
  }

  public static combOutput(output: [number, number]) {
    return output[0] - output[1];
  }
}

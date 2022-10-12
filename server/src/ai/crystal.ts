import * as brain from "brain.js";
import chalk from "chalk";
import MathUtil from "util/MathUtil";
import Account from "./account";

export type Set = number[];

export type Input = { endPrice: number; maxPrice: number; minPrice: number; volume: number };

export default class Crystal {
  static readonly inputLen = 48; //input length in units of time
  static readonly minTradeLen = 2; //minimum trade length in units of time
  static readonly decisionThreshold = 0.4; //minimum deviation from 0 where decision is made
  static readonly maxAmount = 20.0; //Max amount / leverage to buy&sell
  public net;
  public account: Account;
  public inputScales: Input;

  constructor(account: Account, json?: any) {
    this.net = new brain.recurrent.LSTMTimeStep({
      hiddenLayers: [20, 10, 10],
      learningRate: 0.000001,
      //decayRate: 1 / Crystal.inputLen,
      //clipval: 0.2,
    });
    if (json) this.net.fromJSON(json);
    this.account = account;
    this.inputScales = json?.inputScales ?? { endPrice: 1.0, maxPrice: 1.0, minPrice: 1.0, volume: 1.0 };
  }

  public train(arr: Input[]) {
    const sets = this.valuesToSet(arr);
    this.inputScales = sets.scales;
    return this.net.train([sets.set], {
      log: true,
      logPeriod: 1,
      errorThresh: 0.1,
      iterations: 50,
    });
  }

  public test(arr: Input[], options: { log?: boolean; longBrain?: boolean } = { log: true, longBrain: false }) {
    const oldAmount = this.account.amount;
    const sets = this.valuesToSet(arr, this.inputScales);
    const map = (decision: 0 | 1 | -1) => (decision == 0 ? "Chill" : decision == 1 ? "Buy" : "Sell");
    const hits: { [index: string]: { [index: string]: number } } = {
      expectedChill: { actualChill: 0, actualBuy: 0, actualSell: 0 },
      expectedBuy: { actualChill: 0, actualBuy: 0, actualSell: 0 },
      expectedSell: { actualChill: 0, actualBuy: 0, actualSell: 0 },
    };
    let error = 0;
    for (let i = 0; i < sets.set.length - Crystal.inputLen - Crystal.minTradeLen; i++) {
      const outputs = this.net.forecast(
        sets.set.slice(options.longBrain ? 0 : i, i + Crystal.inputLen),
        Crystal.minTradeLen
      ) as Set;
      const nextValues = sets.set.slice(i + Crystal.inputLen, i + Crystal.inputLen + Crystal.minTradeLen);
      const expectedPrediction = this.makePrediction(nextValues);
      const actualPrediction = this.makePrediction(outputs);
      const expectedDecision = this.makeDecision(expectedPrediction, 0.001);
      const actualDecision = this.makeDecision(actualPrediction);
      const hit = actualDecision == expectedDecision;
      if (options.log) {
        const logF = hit ? chalk.green : chalk.red;
        console.log(
          `expected: ${chalk.blue(MathUtil.round(expectedPrediction, 2))} actual: ${logF(
            MathUtil.round(actualPrediction, 2)
          )}`
        );
      }
      hits["expected" + map(expectedDecision)]["actual" + map(actualDecision)]++;
      error += Math.abs(expectedPrediction - actualPrediction);
      const price = arr[i + Crystal.inputLen - 1].endPrice;
      this.actOnPrediction(actualPrediction, price, options.log);
    }
    error /= sets.set.length;
    this.account.closeBuys(arr[arr.length - 1].endPrice, options.log);
    this.account.closeSells(arr[arr.length - 1].endPrice, options.log);
    this.account.logBalance();
    this.account.resetProfit();
    this.account.amount = oldAmount;
    console.table(hits);
    console.log("Average error: " + error);
  }

  public valuesToSet(
    arr: Input[],
    scales?: Input
  ): {
    set: Set;
    scales: Input;
  } {
    if (!arr || arr.length < 2)
      return { set: [], scales: { endPrice: 1.0, maxPrice: 1.0, minPrice: 1.0, volume: 1.0 } };
    let diffArr = new Array<Input>(arr.length - 1);
    for (let i = 0; i < arr.length - 1; i++) {
      diffArr[i] = {
        endPrice: (arr[i + 1].endPrice - arr[i].endPrice) / arr[i].endPrice,
        maxPrice: (arr[i + 1].maxPrice - arr[i].maxPrice) / arr[i].maxPrice,
        minPrice: (arr[i + 1].minPrice - arr[i].minPrice) / arr[i].minPrice,
        volume: (arr[i + 1].volume - arr[i].volume) / arr[i].volume,
      };
    }
    scales ??= {
      endPrice: 1.0 / MathUtil.getStandardDeviation(diffArr.map((v) => v.endPrice, 0.0)),
      maxPrice: 1.0 / MathUtil.getStandardDeviation(diffArr.map((v) => v.maxPrice, 0.0)),
      minPrice: 1.0 / MathUtil.getStandardDeviation(diffArr.map((v) => v.minPrice, 0.0)),
      volume: 1.0 / MathUtil.getStandardDeviation(diffArr.map((v) => v.volume, 0.0)),
    };
    diffArr = diffArr.map((v) => ({
      endPrice: v.endPrice * scales!.endPrice,
      maxPrice: v.maxPrice * scales!.maxPrice,
      minPrice: v.minPrice * scales!.minPrice,
      volume: v.volume * scales!.volume,
    }));
    const sets = diffArr.map((v) => v.endPrice) as Set;
    return { scales: scales, set: sets };
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
    const amount = Math.abs(prediction) * Math.min(this.account.amount * 0.01, Crystal.maxAmount);
    if (decision == 1.0) {
      this.account.closeSells(price, log);
      this.account.buy(price, amount);
    } else if (decision == -1.0) {
      this.account.closeBuys(price, log);
      this.account.sell(price, amount);
    }
  }

  public makeDecision(prediction: number, thresholdOverride?: number): -1.0 | 0.0 | 1.0 {
    if (prediction > (thresholdOverride ?? Crystal.decisionThreshold)) return 1.0;
    if (prediction < -(thresholdOverride ?? Crystal.decisionThreshold)) return -1.0;
    return 0;
  }

  public makePrediction(nextValues: number[]): number {
    let prediction = 0.0;
    for (let v of nextValues) {
      prediction += v / nextValues.length;
    }
    return prediction;
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
      const minPrice = Math.min(...range.map((v) => v.minPrice));
      const maxPrice = Math.max(...range.map((v) => v.maxPrice));
      newValues.push({ endPrice: endPrice, minPrice: minPrice, maxPrice: maxPrice, volume: volume });
    }
    return newValues;
  }
}

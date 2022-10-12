import * as tf from "@tensorflow/tfjs-node-gpu";
import chalk from "chalk";
import MathUtil from "util/MathUtil";
import Account from "./account";

export type Input = { endPrice: number; maxPrice: number; minPrice: number; volume: number };
export type Sets = {
  inputs: tf.Tensor2D;
  outputs: tf.Tensor2D;
};

export default class Tracy {
  static readonly inputLen = 8; //input length in units of time
  static readonly minTradeLen = 2; //minimum trade length in units of time
  static readonly decisionThreshold = 0.25; //minimum deviation from 0 where decision is made
  static readonly maxAmount = 20.0; //Max amount / leverage to buy&sell
  public net: tf.LayersModel;
  public account: Account;
  public inputScale: number;

  constructor(account: Account, model?: tf.LayersModel) {
    if (model) this.net = model;
    else
      this.net = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [Tracy.inputLen + 1], activation: "sigmoid", units: 18 }),
          tf.layers.dense({ activation: "sigmoid", units: 10 }),
          tf.layers.dense({ activation: "sigmoid", units: 2 }),
        ],
      });
    this.net.compile({ optimizer: tf.train.sgd(0.0004), loss: "meanSquaredError" });
    this.inputScale = 1.0;
    this.account = account;
  }

  public async train(arr: Input[]) {
    const sets = this.valuesToSets(arr);
    console.log(sets);
    this.inputScale = sets.scale;
    return await this.net.fit(sets.sets.inputs, sets.sets.outputs, {
      epochs: 1,
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
    const inputs = sets.sets.inputs.arraySync();
    const outputs = sets.sets.outputs.arraySync();
    for (let i = 0; i < inputs.length; i++) {
      const expectedOutput = Tracy.combOutput(outputs[i] as [number, number]);
      const actualOutput = Tracy.combOutput(
        (this.net.predict(tf.tensor2d([inputs[i]])) as tf.Tensor).arraySync() as [number, number]
      );
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
    error /= inputs.length;
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
    sets: Sets;
    scale: number;
  } {
    if (arr.length < Tracy.inputLen + Tracy.minTradeLen)
      return { sets: { inputs: tf.tensor2d([]), outputs: tf.tensor2d([]) }, scale: 1.0 };
    let diffArr = new Array<number>(arr.length - 1);
    for (let i = 0; i < arr.length - 1; i++) {
      const priceDiff = (arr[i + 1].endPrice - arr[i].endPrice) / arr[i].endPrice;
      diffArr[i] = priceDiff;
    }
    scale ??= 1.0 / MathUtil.getStandardDeviation(diffArr, 0.0);
    diffArr = diffArr.map((v) => v * scale!);

    let inputs: number[][] = [];
    let outputs: number[][] = [];
    for (let i = 1; i < arr.length - Tracy.inputLen - (withoutOutputs ? 0 : Tracy.minTradeLen); i++) {
      let input: number[] = [];
      const lastValue = arr[i + Tracy.inputLen - 1];
      for (let j = 0; j < Tracy.inputLen; j++) {
        input.push(diffArr[i + j - 1]);
      }
      //set.input.push(lastValue[0], lastValue[3]);
      const priceRange = lastValue.maxPrice - lastValue.minPrice;
      const indicator = priceRange != 0 ? ((lastValue.endPrice - lastValue.minPrice) / priceRange) * 2 - 1.0 : 0.0;
      input.push(indicator);
      inputs.push(input);

      let output: number[] = [];
      output = withoutOutputs
        ? []
        : [this.makePrediction(lastValue, arr.slice(i + Tracy.inputLen, i + Tracy.inputLen + Tracy.minTradeLen))];
      outputs.push(output);
    }
    if (!withoutOutputs) {
      let outputScale = 1.0 / MathUtil.getMaxDeviation(outputs.map((o) => o[0]));
      outputs = outputs.map((o) =>
        Tracy.splitOutput(Math.sign(o[0]) * this.saturation(Math.abs(o[0] * outputScale), 1.0))
      );
    }
    return { scale: scale, sets: { inputs: tf.tensor2d(inputs), outputs: tf.tensor2d(outputs) } };
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
      const minPrice = Math.min(...range.map((v) => v.minPrice));
      const maxPrice = Math.max(...range.map((v) => v.maxPrice));
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

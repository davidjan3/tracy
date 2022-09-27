import { NeuralNetwork } from "brain.js";
import { INeuralNetworkData } from "brain.js/dist/src/neural-network";

export type Set = {
  input: number[];
  output: number[];
};

export default class Tracy {
  static readonly inputLen = 10; //input length in units of time
  static readonly minTradeLen = 5; //minimum trade length in units of time
  static readonly optimalDeviation = 0.005; //expected relative deviation to currentValue where full decision is made
  static readonly decisionThresholdNo = 0.2; //maximum confidence where other value can be decided
  static readonly decisionThresholdYes = 0.6; //minimum confidence where this value can be decided
  static readonly decisionThresholdDiff = this.decisionThresholdYes - this.decisionThresholdNo; //minimum difference in confidence to decide
  public net: NeuralNetwork<INeuralNetworkData, INeuralNetworkData>;

  constructor() {
    this.net = new NeuralNetwork({
      binaryThresh: 0.5,
      inputSize: Tracy.inputLen * 2, //price and trade volume
      outputSize: 2,
      hiddenLayers: [10, 8, 6, 4],
      activation: "sigmoid",
    });
  }

  public valuesToSets(arr: [number, number][]): Set[] {
    if (arr.length < Tracy.inputLen + Tracy.minTradeLen) return [];
    const sets: Set[] = [];
    for (let i = 0; i < arr.length - Tracy.inputLen - Tracy.minTradeLen; i++) {
      const set: Set = { input: [], output: [] };
      for (let j = 0; j < Tracy.inputLen; j++) {
        set.input.push(arr[i + j][0], arr[i + j][1]);
      }
      set.output = this.makeDecision(
        this.makeConfidences(
          arr[i + Tracy.inputLen - 1],
          arr.slice(i + Tracy.inputLen, i + Tracy.inputLen + Tracy.minTradeLen)
        )
      );
      sets.push(set);
    }
    return sets;
  }

  public makeConfidences(lastValue: number[], nextValues: [number, number][]): [number, number] {
    let long = 0.0;
    let short = 0.0;
    for (let v of nextValues) {
      let priceDiff = (v[0] - lastValue[0]) / lastValue[0];
      if (priceDiff > 0) {
        long += 1 / nextValues.length; //this.saturation(priceDiff, Tracy.optimalDeviation) / nextValues.length;
      } else {
        long = 0.0;
        break;
      }
    }
    for (let v of nextValues) {
      let priceDiff = (v[0] - lastValue[0]) / lastValue[0];
      if (priceDiff < 0) {
        short += 1 / nextValues.length; //this.saturation(-priceDiff, Tracy.optimalDeviation) / nextValues.length;
      } else {
        short = 0.0;
        break;
      }
    }
    /*console.log(
      lastValue[0],
      nextValues.map((v) => v[0]),
      [long, short]
    );*/
    return [long, short];
  }

  public makeDecision(confidences: [number, number]): [number, number] {
    if (Math.abs(confidences[0] - confidences[1]) > Tracy.decisionThresholdDiff) {
      return [
        confidences[0] >= Tracy.decisionThresholdYes && confidences[1] <= Tracy.decisionThresholdNo ? 1.0 : 0.0,
        confidences[1] >= Tracy.decisionThresholdYes && confidences[0] <= Tracy.decisionThresholdNo ? 1.0 : 0.0,
      ];
    } else return [0.0, 0.0];
  }

  /** n == 0 => 0, n == limit => 1, everything between rises exponentially towards 1.0 */
  private saturation(n: number, limit: number) {
    if (n <= 0) return 0.0;
    if (n >= limit) return 1.0;
    const p = n / limit;
    return p * p;
  }
}

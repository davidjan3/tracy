import { arraysEqual } from "@tensorflow/tfjs-core/dist/util_base";

export default class MathUtil {
  public static getStandardDeviation(arr: number[], avg?: number): number {
    if (!arr || arr.length == 0) return 0;
    avg ??= this.avg(arr);
    return Math.sqrt(arr.map((x) => Math.pow(x - avg!, 2)).reduce((a, b) => a + b) / arr.length);
  }

  public static getMaxDeviation(arr: number[], avg?: number): number {
    if (!arr || arr.length == 0) return 0;
    avg ??= this.avg(arr);
    return arr.reduce((pv, cv) => {
      const diff = Math.abs(cv - avg!);
      return diff > pv ? diff : pv;
    }, 0);
  }

  public static sum(arr: number[]) {
    return arr.reduce((a, b) => a + b);
  }

  public static avg(arr: number[]) {
    return this.sum(arr) / arr.length;
  }

  public static round(val: number, n: number = 0) {
    return Math.round(val * 10 ** n) / 10 ** n;
  }
}

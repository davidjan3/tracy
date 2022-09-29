export default class MathUtil {
  public static getStandardDeviation(arr: number[], avg?: number): number {
    if (!arr || arr.length == 0) return 0;
    avg ??= arr.reduce((a, b) => a + b) / arr.length;
    return Math.sqrt(arr.map((x) => Math.pow(x - avg!, 2)).reduce((a, b) => a + b) / arr.length);
  }
}

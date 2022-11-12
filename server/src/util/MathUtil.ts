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

  public static min(arr: number[]): number {
    let min = arr[0];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] < min) min = arr[i];
    }
    return min;
  }

  public static max(arr: number[]): number {
    let min = arr[0];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] > min) min = arr[i];
    }
    return min;
  }

  public static getMinMax(arr: number[], cutOff: boolean = false): [number, number] {
    let min, max;
    if (cutOff) {
      const avg = MathUtil.avg(arr);
      const diff = MathUtil.getStandardDeviation(arr, avg) * 3;
      arr = arr.filter((v) => v > avg - diff && v < avg + diff);
    }
    min = MathUtil.min(arr);
    max = MathUtil.max(arr);
    return [min, max];
  }

  public static normalize(arr: number[], toRange: [number, number] = [0, 1], fromRange?: [number, number]) {
    fromRange ??= MathUtil.getMinMax(arr);
    const scale = (toRange[1] - toRange[0]) / (fromRange[1] - fromRange[0]);
    return arr.map((v) => Math.min(Math.max((v - fromRange![0]) * scale + toRange[0], toRange[0]), toRange[1]));
  }

  public static normalizeSplit(
    arr: number[],
    splitAt: number = 0,
    toRange: [number, number] = [0, 1],
    fromRange?: [number, number]
  ) {
    fromRange ??= MathUtil.getMinMax(arr);
    const scale0 = (toRange[1] - splitAt) / (fromRange[1] - splitAt);
    const scale1 = (splitAt - toRange[0]) / (splitAt - fromRange[0]);
    return arr.map((v) =>
      Math.min(Math.max((v - splitAt) * (v >= splitAt ? scale0 : scale1) + splitAt, toRange[0]), toRange[1])
    );
  }

  public static saturation(n: number, intensity: number = 5, limit: number = 1) {
    if (Math.abs(n) >= limit) return Math.sign(n) * 1.0;
    const p = n / limit;
    return Math.sign(p) * Math.pow(Math.abs(p), 1 / intensity);
  }

  public static nrtSign(val: number, n: number) {
    return Math.pow(Math.abs(val), 1 / n) * Math.sign(val);
  }

  public static money(n: number, currencyCode: string = "USD") {
    return n.toLocaleString("en-US", { currency: currencyCode, style: "currency" });
  }
}

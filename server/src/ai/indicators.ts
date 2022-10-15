import MathUtil from "util/MathUtil";
import * as ti from "technicalindicators";

export type ChartData = {
  ts: number;
  openPrice: number;
  closePrice: number;
  minPrice: number;
  maxPrice: number;
  volume: number;
};
export type IndicatorData = { type: string; config: string; data: number[]; startTs: number; delay: number };

export default class Indicators {
  public static meta(data: ChartData[], key: keyof ChartData): IndicatorData {
    return { type: "meta", config: key, data: data.map((d) => d[key]), startTs: data[0].ts, delay: 0 };
  }

  public static diff(id: IndicatorData): IndicatorData {
    let res = id.data.map((v, i) => (i == 0 ? 0 : id.data[i] - id.data[i - 1]));
    return { type: "diff", config: id.config + "Diff", data: res, startTs: id.startTs, delay: id.delay + 1 };
  }

  public static sma(data: ChartData[], period: number): IndicatorData {
    let res: number[] = ti.sma({ values: data.map((d) => d.closePrice), period: period }) ?? [];
    const delay = data.length - res.length;
    res = this.padArray(res, data.length);
    return { type: "sma", config: "sma" + period, data: res, startTs: data[0].ts, delay: delay };
  }

  public static ema(data: ChartData[], period: number): IndicatorData {
    let res: number[] = ti.ema({ values: data.map((d) => d.closePrice), period: period }) ?? [];
    const delay = data.length - res.length;
    res = this.padArray(res, data.length);
    return { type: "ema", config: "ema" + period, data: res, startTs: data[0].ts, delay: delay };
  }

  public static tema(data: ChartData[], period: number): IndicatorData {
    let ema1 = ti.ema({ values: data.map((d) => d.closePrice), period: period });
    let ema2 = ti.ema({ values: ema1, period: period });
    let ema3 = ti.ema({ values: ema2, period: period });
    let res: number[] = [];
    for (let i = 0; i < ema3.length; i++) {
      const ema1i = i + (ema1.length - ema3.length);
      const ema2i = i + (ema2.length - ema3.length);
      const tema = 3 * ema1[ema1i] - 3 * ema2[ema2i] + ema3[i];
      res.push(tema);
    }
    const delay = data.length - res.length;
    res = this.padArray(res, data.length);
    return { type: "tema", config: "tema" + period, data: res, startTs: data[0].ts, delay: delay };
  }

  public static davg(data: ChartData[]): IndicatorData {
    let res = data.map((v) => {
      const priceRange = v.maxPrice - v.minPrice;
      return priceRange != 0 ? ((v.closePrice - v.minPrice) / priceRange) * 2 - 1.0 : 0.0;
    });
    return { type: "davg", config: "davg", data: res, startTs: data[0].ts, delay: 0 };
  }

  public static padArray(arr: number[], length: number, where: "left" | "right" = "left"): number[] {
    const addLen = length - arr.length;
    if (addLen == 0) return arr;
    if (addLen < 0) return where == "left" ? arr.slice(-addLen) : arr.slice(0, arr.length + addLen);
    const addition = Array(addLen).fill(where == "left" ? arr[0] : arr[arr.length - 1]);
    return where == "left" ? [...addition, ...arr] : [...arr, ...addition];
  }

  public static cutDelays(ids: IndicatorData[]): IndicatorData[] {
    const maxDelay = Math.max(...ids.map((id) => id.delay));
    let res = ids.map((id) => ({
      type: id.type,
      config: id.config,
      delay: 0,
      startTs: id.startTs + maxDelay,
      data: id.data.slice(maxDelay),
    }));
    return res;
  }

  public static groupInterval(values: ChartData[], interval: number) {
    let newValues: ChartData[] = [];
    for (let i = 0; i < values.length - interval; i += interval) {
      const range = values.slice(i, i + interval);
      const openPrice = range[0].openPrice;
      const closePrice = range[range.length - 1].closePrice;
      const volume = MathUtil.sum(range.map((v) => v.volume));
      const minPrice = Math.min(...range.map((v) => v.minPrice));
      const maxPrice = Math.max(...range.map((v) => v.maxPrice));
      newValues.push({
        ts: range[range.length - 1].ts,
        openPrice: openPrice,
        closePrice: closePrice,
        minPrice: minPrice,
        maxPrice: maxPrice,
        volume: volume,
      });
    }
    return newValues;
  }
}

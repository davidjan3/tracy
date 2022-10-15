import MathUtil from "util/MathUtil";

export type ChartData = { ts: number; endPrice: number; maxPrice: number; minPrice: number; volume: number };
export type IndicatorData = { type: string; config: string; data: number[]; startTs: number; delay: number };

export default class Indicators {
  public static sma(data: ChartData[], range: number): IndicatorData {
    let res = [];
    for (let i = 0; i < data.length; i++) {
      res.push(MathUtil.avg(data.slice(Math.max(i - range, 0), i + 1).map((d) => d.endPrice)));
    }
    return { type: "sma", config: "sma" + range, data: res, startTs: data[0].ts, delay: range };
  }

  public static ema(data: ChartData[], range: number): IndicatorData {
    let res = [];
    res.push(...this.sma(data.slice(0, range), range).data);
    const sf = 2 / (range + 1);
    for (let i = range; i < data.length; i++) {
      const emaPrev = res[res.length - 1];
      const ema = sf * (data[i].endPrice - emaPrev) + emaPrev;
      res.push(MathUtil.avg(data.slice(Math.max(i - range, 0), i + 1).map((d) => d.endPrice)));
    }
    return { type: "ema", config: "ema" + range, data: res, startTs: data[0].ts, delay: range + 1 };
  }

  public static diff(data: number[]): IndicatorData {
    let res = data.map((v, i) => (i == 0 ? 0 : data[i] - data[i - 1]));
    return { type: "diff", config: "diff", data: res, startTs: data[0].ts, delay: 1 };
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
}

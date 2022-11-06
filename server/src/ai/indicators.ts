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

export type IndicatorData = {
  type: string;
  config: string;
  data: number[][];
  delay: number;
};

ti.setConfig("precision", 10);
export default class Indicators {
  public static random(data: ChartData[]): IndicatorData {
    return {
      type: "random",
      config: "random",
      data: data.map((d) => [d.ts, Math.random() * 1000]),
      delay: 0,
    };
  }

  public static meta(data: ChartData[], key: keyof ChartData): IndicatorData {
    return {
      type: "meta",
      config: key,
      data: data.map((d) => [d.ts, d[key]]),
      delay: 0,
    };
  }

  public static diff(id: IndicatorData): IndicatorData {
    let res = id.data.map((v, i) => [id.data[i][0], i == 0 ? 0 : id.data[i][1] - id.data[i - 1][1]]);
    return {
      type: "diff",
      config: id.config + "Diff",
      data: res,
      delay: id.delay + 1,
    };
  }

  public static sma(data: ChartData[], period: number): IndicatorData {
    let res: number[] = ti.sma({ values: data.map((d) => d.closePrice), period: period }) ?? [];
    const delay = data.length - res.length;
    res = this.padArray(res, data.length);
    return {
      type: "sma",
      config: "sma" + period,
      data: res.map((v, i) => [data[i].ts, v]),
      delay: delay,
    };
  }

  public static ema(data: ChartData[], period: number): IndicatorData {
    let res: number[] = ti.ema({ values: data.map((d) => d.closePrice), period: period }) ?? [];
    const delay = data.length - res.length;
    res = this.padArray(res, data.length);
    return {
      type: "ema",
      config: "ema" + period,
      data: res.map((v, i) => [data[i].ts, v]),
      delay: delay,
    };
  }

  public static bb(
    data: ChartData[],
    period: number,
    stdDev?: number
  ): { lower: IndicatorData; middle: IndicatorData; upper: IndicatorData } {
    const prices = data.map((d) => d.closePrice);
    if (!stdDev) stdDev = MathUtil.getStandardDeviation(prices);
    let res = ti.bollingerbands({ values: prices, period: period, stdDev: stdDev }) ?? [];
    const delay = data.length - res.length;
    res = this.padArray(res, data.length);
    return {
      lower: {
        type: "bbLower",
        config: "bbLower" + period,
        data: res.map((v, i) => [data[i].ts, v.lower]),
        delay: delay,
      },
      middle: {
        type: "bbMiddle",
        config: "bbMiddle" + period,
        data: res.map((v, i) => [data[i].ts, v.middle]),
        delay: delay,
      },
      upper: {
        type: "bbHigh",
        config: "bbHigh" + period,
        data: res.map((v, i) => [data[i].ts, v.upper]),
        delay: delay,
      },
    };
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
    return {
      type: "tema",
      config: "tema" + period,
      data: res.map((v, i) => [data[i].ts, v]),
      delay: delay,
    };
  }

  public static macd(
    data: ChartData[],
    fastPeriod: number = 24,
    slowPeriod: number = 52,
    signalPeriod: number = 18
  ): { number: IndicatorData; signal: IndicatorData; histogram: IndicatorData } {
    let res = ti.macd({
      values: data.map((d) => d.closePrice),
      fastPeriod: fastPeriod,
      slowPeriod: slowPeriod,
      signalPeriod: signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    res = res.filter((v) => v.MACD !== undefined && v.histogram !== undefined && v.signal !== undefined);
    const delay = data.length - res.length;
    res = this.padArray(res, data.length);
    const configSuffix = "FA" + fastPeriod + "SL" + slowPeriod + "SI" + signalPeriod;
    return {
      number: {
        type: "macdNumber",
        config: "macdNumber" + configSuffix,
        data: res.map((v, i) => [data[i].ts, v.MACD!]),
        delay: delay,
      },
      signal: {
        type: "macdSignal",
        config: "macdSignal" + configSuffix,
        data: res.map((v, i) => [data[i].ts, v.signal!]),
        delay: delay,
      },
      histogram: {
        type: "macdHistogram",
        config: "macdHistogram" + configSuffix,
        data: res.map((v, i) => [data[i].ts, v.histogram!]),
        delay: delay,
      },
    };
  }

  public static davg(data: ChartData[]): IndicatorData {
    let res = data.map((v) => {
      const priceRange = v.maxPrice - v.minPrice;
      return priceRange != 0 ? ((v.closePrice - v.minPrice) / priceRange) * 2 - 1.0 : 0.0;
    });
    return {
      type: "davg",
      config: "davg",
      data: res.map((v, i) => [data[i].ts, v]),
      delay: 0,
    };
  }

  public static cpr(data: ChartData[], period: number = 10): IndicatorData {
    let res = data.map((v, i) => {
      if (i < data.length - 1) return [v.ts, 0];
      const range = data.slice(Math.max(0, i - (period - 1)), i + 1);
      const rangeFormatted = {
        open: range.map((v) => v.openPrice),
        close: range.map((v) => v.closePrice),
        high: range.map((v) => v.maxPrice),
        low: range.map((v) => v.minPrice),
      };
      const bullish = ti.bullish(rangeFormatted) ? 1.0 : 0.0;
      const bearish = ti.bearish(rangeFormatted) ? 1.0 : 0.0;
      return [v.ts, bullish - bearish];
    });
    return {
      type: "cpr",
      config: "cpr",
      data: res,
      delay: 0,
    };
  }

  public static padArray<T>(arr: T[], length: number, where: "left" | "right" = "left"): T[] {
    const addLen = length - arr.length;
    if (addLen == 0) return arr;
    if (addLen < 0) return where == "left" ? arr.slice(-addLen) : arr.slice(0, arr.length + addLen);
    const addition = Array(addLen).fill(where == "left" ? arr[0] : arr[arr.length - 1]);
    return where == "left" ? [...addition, ...arr] : [...arr, ...addition];
  }

  public static cutDelays(ids: IndicatorData[]): IndicatorData[] {
    const maxDelay = MathUtil.max(ids.map((id) => id.delay));
    let res = ids.map((id) => ({
      type: id.type,
      config: id.config,
      delay: 0,
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
      const minPrice = MathUtil.min(range.map((v) => v.minPrice));
      const maxPrice = MathUtil.max(range.map((v) => v.maxPrice));
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

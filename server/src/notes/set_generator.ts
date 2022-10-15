import Indicators, { IndicatorData } from "./../ai/indicators";
import { ChartData } from "ai/indicators";
import FileUtil from "util/FileUtil";

let history = FileUtil.loadCSV(
  "data/minutely_btc.csv",
  { ts: 0, openPrice: 1, closePrice: 4, maxPrice: 2, minPrice: 3, volume: 5 },
  { skipHeaders: 2 }
) as ChartData[];
history.splice(0, history.length * 0.1);
history.forEach((v) => (v.ts *= 1000));
history = Indicators.groupInterval(history, 360);
FileUtil.saveJSON("data/360min_btc.json", history, false);

let ids: IndicatorData[] = [
  Indicators.meta(history, "closePrice"),
  Indicators.sma(history, 20),
  Indicators.ema(history, 20),
  Indicators.tema(history, 20),
];

ids = Indicators.cutDelays(ids);
FileUtil.saveJSON("data/360min_btc_indicators.json", ids, false);

import Indicators, { IndicatorData } from "./../ai/indicators";
import { ChartData } from "ai/indicators";
import FileUtil from "util/FileUtil";

const interval = 60;

let history = FileUtil.loadCSV(
  "data/minutely_btc.csv",
  { ts: 0, openPrice: 1, closePrice: 4, maxPrice: 2, minPrice: 3, volume: 5 },
  { skipHeaders: 2 }
) as ChartData[];
history.splice(0, history.length * 0.1);
history.forEach((v) => (v.ts *= 1000));
history = Indicators.groupInterval(history, interval);
FileUtil.saveJSON("data/" + interval + "min_btc.json", history, false);

debugger;

let ids: IndicatorData[] = [
  Indicators.meta(history, "closePrice"),
  Indicators.sma(history, 20),
  Indicators.ema(history, 20),
  Indicators.tema(history, 20),
];

ids = Indicators.cutDelays(ids);
FileUtil.saveJSON("data/" + interval + "min_btc_indicators.json", ids, false);

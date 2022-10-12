import Tracy from "ai/tracy";
import FileUtil from "util/FileUtil";

const history = FileUtil.loadCSV(
  "data/minutely_btc.csv",
  { endPrice: 4, maxPrice: 2, minPrice: 3, volume: 5 },
  { skipHeaders: 2 }
) as {
  endPrice: number;
  maxPrice: number;
  minPrice: number;
  volume: number;
}[];
history.splice(0, history.length * 0.1);
Tracy.groupInterval(history, 15);
FileUtil.saveJSON("data/15min_btc.json", history);

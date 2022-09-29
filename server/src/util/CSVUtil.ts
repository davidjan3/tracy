import { readFileSync } from "fs";

export default class CSVUtil {
  public static parse<T>(
    path: string,
    columns: { [colname: string]: number },
    skipHeaders?: number,
    log?: boolean
  ): { [index: string]: number }[] {
    const data = readFileSync(path, "utf8");
    const dataSplit = data.split("\n");
    let res: { [index: string]: number }[] = [];
    for (let i = skipHeaders ?? 0; i < dataSplit.length; i++) {
      if (!dataSplit[i]) continue;
      const rowSplit = dataSplit[i].split(",");
      const vals: { [index: string]: number } = {};
      for (let col in columns) {
        vals[col] = +rowSplit[columns[col]] ?? 0;
      }
      if (log && (i % 1000 == 0 || i == dataSplit.length - 1)) console.log(`Reading CSV: ${i} / ${dataSplit.length}`);
      res.push(vals);
    }
    return res;
  }
}

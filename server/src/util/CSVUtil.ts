import { readFileSync } from "fs";

export default class CSVUtil {
  public static parse<T>(path: string, indices: number[], skipHeaders?: number, log?: boolean): number[][] {
    const data = readFileSync(path, "utf8");
    const dataSplit = data.split("\n");
    let res: number[][] = [];
    for (let i = skipHeaders ?? 0; i < dataSplit.length; i++) {
      const rowSplit = dataSplit[i].split(",");
      const vals = new Array<number>(indices.length);
      for (let j = 0; j < indices.length; j++) {
        vals[j] = +rowSplit[indices[j]] ?? 0;
      }
      if (log && (i % 1000 == 0 || i == dataSplit.length - 1)) console.log(`Reading CSV: ${i} / ${dataSplit.length}`);
      res.push(vals);
    }
    return res;
  }
}

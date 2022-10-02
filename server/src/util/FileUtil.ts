import { existsSync, writeFileSync, readFileSync } from "fs";

export default class FileUtil {
  private static readonly basePath = "server/src/";

  private static completePath(path: string) {
    if (path.startsWith(".")) path = path.slice(1, path.length);
    if (path.startsWith("/")) path = path.slice(1, path.length);
    return this.basePath + path;
  }

  public static loadCSV(
    path: string,
    columns: { [colname: string]: number },
    skipHeaders?: number,
    log?: boolean
  ): { [index: string]: number }[] {
    path = this.completePath(path);
    const data = readFileSync(path, "utf8");
    const dataSplit = data.split("\n");
    let res: { [index: string]: number }[] = [];
    for (let i = skipHeaders ?? 0; i < dataSplit.length; i++) {
      if (!dataSplit[i]) continue;
      const rowSplit = dataSplit[i].split(",");
      const vals: { [index: string]: number } = {};
      let invalid = false;
      for (let col in columns) {
        vals[col] = +rowSplit[columns[col]] ?? NaN;
        if (Number.isNaN(vals[col])) invalid = true;
      }
      if (invalid) continue;
      if (log && (i % 1000 == 0 || i == dataSplit.length - 1)) console.log(`Reading CSV: ${i} / ${dataSplit.length}`);
      res.push(vals);
    }
    return res;
  }

  private static incrementPath(path: string, n: number) {
    if (n == 0) return path;
    const split = path.split(".");
    return split[0] + ` (${n})` + (split.length > 1 ? "." + split[1] : "");
  }

  public static saveJSON(path: string, content: any, increment: boolean = true) {
    path = this.completePath(path);
    if (!path.endsWith(".json")) path += ".json";
    let n = 0;
    if (increment) {
      while (existsSync(this.incrementPath(path, n))) {
        n++;
      }
    }
    const data = JSON.stringify(content);
    writeFileSync(this.incrementPath(path, n), data);
  }

  public static loadJSON(path: string, increment: boolean = true): any {
    path = this.completePath(path);
    if (!path.endsWith(".json")) path += ".json";
    let n = 0;
    if (increment) {
      while (existsSync(this.incrementPath(path, n))) {
        n++;
      }
      n--;
    }
    const data = readFileSync(this.incrementPath(path, n), "utf8");
    const content = JSON.parse(data ?? "");
    return content;
  }
}

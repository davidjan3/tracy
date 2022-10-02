import FileUtil from "util/FileUtil";
let c0 = ["c0", "test"];
let c1 = ["c1", "test"];
let c2 = ["c2", "test"];

FileUtil.saveJSON("data/example.json", c0);
FileUtil.saveJSON("data/example.json", c1);
FileUtil.saveJSON("data/example.json", c2);

console.log(FileUtil.loadJSON("data/example.json"));

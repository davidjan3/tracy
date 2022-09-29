"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
class CSVUtil {
    static parse(path, indices, skipHeaders, log) {
        var _a;
        const data = (0, fs_1.readFileSync)(path, "utf8");
        const dataSplit = data.split("\n");
        let res = [];
        for (let i = skipHeaders !== null && skipHeaders !== void 0 ? skipHeaders : 0; i < dataSplit.length; i++) {
            const rowSplit = dataSplit[i].split(",");
            const vals = new Array(indices.length);
            for (let j = 0; j < indices.length; j++) {
                vals[j] = (_a = +rowSplit[indices[j]]) !== null && _a !== void 0 ? _a : 0;
            }
            if (log && (i % 1000 == 0 || i == dataSplit.length - 1))
                console.log(`Reading CSV: ${i} / ${dataSplit.length}`);
            res.push(vals);
        }
        return res;
    }
}
exports.default = CSVUtil;
//# sourceMappingURL=CSVUtil.js.map
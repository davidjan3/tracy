"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const account_1 = __importDefault(require("ai/account"));
const tracy_1 = __importDefault(require("ai/tracy"));
const FileUtil_1 = __importDefault(require("util/FileUtil"));
const tf = __importStar(require("@tensorflow/tfjs-node"));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const NEW = true;
        const interval = "15min";
        const net = new tracy_1.default(new account_1.default(1000), NEW ? undefined : yield tf.loadLayersModel("file://" + FileUtil_1.default.incrementPath("data/tracyTF_" + interval)));
        console.log("Tracy created");
        /*const history = CSVUtil.parse(
        "./server/src/data/hourly_btc.csv",
        { endPrice: 6, maxPrice: 4, minPrice: 5, volume: 7 },
        2
      ) as { endPrice: number; maxPrice: number; minPrice: number; volume: number }[];*/
        /*const history = FileUtil.loadCSV("data/minutely_btc.csv", { endPrice: 4, maxPrice: 2, minPrice: 3, volume: 5 }, 2) as {
        endPrice: number;
        maxPrice: number;
        minPrice: number;
        volume: number;
      }[];
      history.splice(0, history.length / 3);
      FileUtil.saveJSON("data/minutely_btc.json", history);*/
        const history = FileUtil_1.default.loadJSON("data/" + interval + "_btc.json");
        console.log("History parsed");
        history.splice(0, history.length * 0.5);
        history.splice(history.length * 0.6, history.length);
        const trainTestDistribution = 0.7; //0.6 => Use 60% for training, 40% for testing
        const trainSize = history.length * trainTestDistribution;
        const trainSets = history.slice(0, trainSize);
        const testSets = history.slice(trainSize, history.length);
        console.log("History sliced");
        if (NEW) {
            yield net.train(trainSets);
            net.net.save("file://" + FileUtil_1.default.incrementPath("data/tracyTF_" + interval));
            console.log("Training done");
        }
        net.test(trainSets, { logTech: true });
        net.test(testSets, { logTech: true });
        /*const step = 30 * 24;
      for (let i = 0; i < testSets.length / step; i++) {
        const testSet = testSets.slice(i * step, (i + 1) * step);
        tracy.test(testSet);
      }*/
        console.log("Testing done");
        console.log("inputScale", net.inputScale);
    });
}
main();
//# sourceMappingURL=server.js.map
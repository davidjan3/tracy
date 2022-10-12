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
const tf = __importStar(require("@tensorflow/tfjs-node"));
const chalk_1 = __importDefault(require("chalk"));
const MathUtil_1 = __importDefault(require("util/MathUtil"));
class Tracy {
    constructor(account, model) {
        if (model)
            this.net = model;
        else
            this.net = tf.sequential({
                layers: [
                    tf.layers.dense({ inputShape: [Tracy.inputLen + 1], activation: "sigmoid", units: 18 }),
                    tf.layers.dense({ activation: "sigmoid", units: 10 }),
                    tf.layers.dense({ activation: "sigmoid", units: 2 }),
                ],
            });
        this.net.compile({ optimizer: tf.train.sgd(0.0004), loss: "meanSquaredError" });
        this.inputScale = 1.0;
        this.account = account;
    }
    train(arr) {
        return __awaiter(this, void 0, void 0, function* () {
            const sets = this.valuesToSets(arr);
            console.log(sets);
            this.inputScale = sets.scale;
            return yield this.net.fit(sets.sets.inputs, sets.sets.outputs, {
                epochs: 1,
            });
        });
    }
    test(arr, options = { logTech: false, logFinance: true }) {
        const oldAmount = this.account.amount;
        const sets = this.valuesToSets(arr, this.inputScale);
        const map = (decision) => (decision == 0 ? "Chill" : decision == 1 ? "Buy" : "Sell");
        const hits = {
            expectedChill: { actualChill: 0, actualBuy: 0, actualSell: 0 },
            expectedBuy: { actualChill: 0, actualBuy: 0, actualSell: 0 },
            expectedSell: { actualChill: 0, actualBuy: 0, actualSell: 0 },
        };
        let error = 0;
        const inputs = sets.sets.inputs.arraySync();
        const outputs = sets.sets.outputs.arraySync();
        for (let i = 0; i < inputs.length; i++) {
            const expectedOutput = Tracy.combOutput(outputs[i]);
            const actualOutput = Tracy.combOutput(this.net.predict(tf.tensor2d([inputs[i]])).arraySync());
            const expectedDecision = this.makeDecision(expectedOutput, 0.001);
            const actualDecision = this.makeDecision(actualOutput);
            const hit = actualDecision == expectedDecision;
            if (options.logTech) {
                const logF = hit ? chalk_1.default.green : chalk_1.default.red;
                console.log(`expected: ${chalk_1.default.blue(MathUtil_1.default.round(expectedOutput, 2))} actual: ${logF(MathUtil_1.default.round(actualOutput, 2))}`);
            }
            hits["expected" + map(expectedDecision)]["actual" + map(actualDecision)]++;
            error += Math.abs(actualOutput - expectedOutput);
            const price = arr[i + Tracy.inputLen - 1].endPrice;
            this.actOnPrediction(actualOutput, price, options.logFinance);
        }
        error /= inputs.length;
        this.account.closeBuys(arr[arr.length - 1].endPrice, options.logFinance);
        this.account.closeSells(arr[arr.length - 1].endPrice, options.logFinance);
        this.account.logBalance();
        this.account.resetProfit();
        this.account.amount = oldAmount;
        console.table(hits);
        console.log("Average error: " + error);
    }
    valuesToSets(arr, scale, withoutOutputs = false) {
        if (arr.length < Tracy.inputLen + Tracy.minTradeLen)
            return { sets: { inputs: tf.tensor2d([]), outputs: tf.tensor2d([]) }, scale: 1.0 };
        let diffArr = new Array(arr.length - 1);
        for (let i = 0; i < arr.length - 1; i++) {
            const priceDiff = (arr[i + 1].endPrice - arr[i].endPrice) / arr[i].endPrice;
            diffArr[i] = priceDiff;
        }
        scale !== null && scale !== void 0 ? scale : (scale = 1.0 / MathUtil_1.default.getStandardDeviation(diffArr, 0.0));
        diffArr = diffArr.map((v) => v * scale);
        let inputs = [];
        let outputs = [];
        for (let i = 1; i < arr.length - Tracy.inputLen - (withoutOutputs ? 0 : Tracy.minTradeLen); i++) {
            let input = [];
            const lastValue = arr[i + Tracy.inputLen - 1];
            for (let j = 0; j < Tracy.inputLen; j++) {
                input.push(diffArr[i + j - 1]);
            }
            //set.input.push(lastValue[0], lastValue[3]);
            const priceRange = lastValue.maxPrice - lastValue.minPrice;
            const indicator = priceRange != 0 ? ((lastValue.endPrice - lastValue.minPrice) / priceRange) * 2 - 1.0 : 0.0;
            input.push(indicator);
            inputs.push(input);
            let output = [];
            output = withoutOutputs
                ? []
                : [this.makePrediction(lastValue, arr.slice(i + Tracy.inputLen, i + Tracy.inputLen + Tracy.minTradeLen))];
            outputs.push(output);
        }
        if (!withoutOutputs) {
            let outputScale = 1.0 / MathUtil_1.default.getMaxDeviation(outputs.map((o) => o[0]));
            outputs = outputs.map((o) => Tracy.splitOutput(Math.sign(o[0]) * this.saturation(Math.abs(o[0] * outputScale), 1.0)));
        }
        return { scale: scale, sets: { inputs: tf.tensor2d(inputs), outputs: tf.tensor2d(outputs) } };
    }
    averageDiffNext(lastValue, nextValues) {
        let diffSum = 0;
        for (let v of nextValues) {
            diffSum += (v[0] - lastValue[0]) / lastValue[0];
        }
        return diffSum / nextValues.length > 0 ? 1.0 : -1.0;
    }
    actOnPrediction(prediction, price, log = true) {
        const decision = this.makeDecision(prediction);
        const amount = Math.abs(prediction) * Math.min(this.account.amount * 0.01, Tracy.maxAmount);
        if (decision == 1.0) {
            this.account.closeSells(price, log);
            this.account.buy(price, amount);
        }
        else if (decision == -1.0) {
            this.account.closeBuys(price, log);
            this.account.sell(price, amount);
        }
    }
    makeDecision(prediction, thresholdOverride) {
        if (prediction > (thresholdOverride !== null && thresholdOverride !== void 0 ? thresholdOverride : Tracy.decisionThreshold))
            return 1.0;
        if (prediction < -(thresholdOverride !== null && thresholdOverride !== void 0 ? thresholdOverride : Tracy.decisionThreshold))
            return -1.0;
        return 0;
    }
    makePrediction(lastValue, nextValues) {
        let buy = 0.0;
        let sell = 0.0;
        for (let v of nextValues) {
            const priceDiff = (v.endPrice - lastValue.endPrice) / lastValue.endPrice;
            if (priceDiff > 0) {
                buy += priceDiff / nextValues.length;
            }
            else {
                buy = 0.0;
                break;
            }
        }
        for (let v of nextValues) {
            const priceDiff = (v.endPrice - lastValue.endPrice) / lastValue.endPrice;
            if (priceDiff < 0) {
                sell -= priceDiff / nextValues.length;
            }
            else {
                sell = 0.0;
                break;
            }
        }
        return buy - sell;
    }
    saturation(n, limit) {
        if (n <= 0)
            return 0.0;
        if (n >= limit)
            return 1.0;
        const p = n / limit;
        return Math.pow(n, 1 / 10);
    }
    static groupInterval(values, interval) {
        let newValues = [];
        for (let i = 0; i < values.length - interval; i += interval) {
            const range = values.slice(i, i + interval);
            const endPrice = range[interval - 1].endPrice;
            const volume = range.map((v) => v.volume).reduce((a, b) => a + b, 0);
            const minPrice = Math.min(...range.map((v) => v.minPrice));
            const maxPrice = Math.max(...range.map((v) => v.maxPrice));
            newValues.push({ endPrice: endPrice, minPrice: minPrice, maxPrice: maxPrice, volume: volume });
        }
        return newValues;
    }
    static splitOutput(output) {
        return [output >= 0 ? output : 0, output <= 0 ? -output : 0];
    }
    static combOutput(output) {
        return output[0] - output[1];
    }
}
exports.default = Tracy;
Tracy.inputLen = 8; //input length in units of time
Tracy.minTradeLen = 2; //minimum trade length in units of time
Tracy.decisionThreshold = 0.25; //minimum deviation from 0 where decision is made
Tracy.maxAmount = 20.0; //Max amount / leverage to buy&sell
//# sourceMappingURL=tracy.js.map
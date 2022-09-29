"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const brain_js_1 = require("brain.js");
class Tracy {
    constructor() {
        this.net = new brain_js_1.NeuralNetworkGPU({
            binaryThresh: 0.5,
            inputSize: Tracy.inputLen * 2,
            outputSize: 2,
            hiddenLayers: [10, 8, 6],
        });
    }
    train(sets) {
        return this.net.train(sets, { log: true, logPeriod: 1 });
    }
    test(sets, log) {
        let errorCount = 0;
        for (let set of sets) {
            const output = this.net.run(set.input);
            if (this.makeDecision(output) == this.makeDecision(set.output)) {
                if (log)
                    console.log(`actual: ${output}   expected: ${set.output}`);
            }
            else {
                if (log)
                    console.error(`actual: ${output}   expected: ${set.output}`);
                errorCount++;
            }
        }
        if (log)
            console.log(`Errors: ${errorCount}/${sets.length} (${errorCount / sets.length})`);
        return errorCount;
    }
    valuesToSets(arr) {
        if (arr.length < Tracy.inputLen + Tracy.minTradeLen)
            return [];
        const sets = [];
        for (let i = 0; i < arr.length - Tracy.inputLen - Tracy.minTradeLen; i++) {
            const set = { input: [], output: [] };
            for (let j = 0; j < Tracy.inputLen; j++) {
                set.input.push(arr[i + j][0], arr[i + j][1]);
            }
            set.output = this.makeConfidences(arr[i + Tracy.inputLen - 1], arr.slice(i + Tracy.inputLen, i + Tracy.inputLen + Tracy.minTradeLen));
            sets.push(set);
        }
        return sets;
    }
    makeConfidences(lastValue, nextValues) {
        let long = 0.0;
        let short = 0.0;
        for (let v of nextValues) {
            let priceDiff = (v[0] - lastValue[0]) / lastValue[0];
            if (priceDiff > 0) {
                long += this.saturation(priceDiff, Tracy.optimalDeviation) / nextValues.length;
            }
            else {
                long = 0.0;
                break;
            }
        }
        for (let v of nextValues) {
            let priceDiff = (v[0] - lastValue[0]) / lastValue[0];
            if (priceDiff < 0) {
                short += this.saturation(-priceDiff, Tracy.optimalDeviation) / nextValues.length;
            }
            else {
                short = 0.0;
                break;
            }
        }
        /*console.log(
          lastValue[0],
          nextValues.map((v) => v[0]),
          [long, short]
        );*/
        return [long, short];
    }
    makeDecision(confidences) {
        if (Math.abs(confidences[0] - confidences[1]) > Tracy.decisionThresholdDiff) {
            return [
                confidences[0] >= Tracy.decisionThresholdYes && confidences[1] <= Tracy.decisionThresholdNo ? 1.0 : 0.0,
                confidences[1] >= Tracy.decisionThresholdYes && confidences[0] <= Tracy.decisionThresholdNo ? 1.0 : 0.0,
            ];
        }
        else
            return [0.0, 0.0];
    }
    /** n == 0 => 0, n == limit => 1, everything between rises exponentially towards 1.0 */
    saturation(n, limit) {
        if (n <= 0)
            return 0.0;
        if (n >= limit)
            return 1.0;
        const p = n / limit;
        return p * p;
    }
}
exports.default = Tracy;
_a = Tracy;
Tracy.inputLen = 10; //input length in units of time
Tracy.minTradeLen = 5; //minimum trade length in units of time
Tracy.optimalDeviation = 0.005; //expected relative deviation to currentValue where full decision is made
Tracy.decisionThresholdNo = 0.2; //maximum confidence where other value can be decided
Tracy.decisionThresholdYes = 0.6; //minimum confidence where this value can be decided
Tracy.decisionThresholdDiff = _a.decisionThresholdYes - _a.decisionThresholdNo; //minimum difference in confidence to decide
//# sourceMappingURL=tracy.js.map
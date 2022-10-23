import Indicators, { ChartData } from "./indicators";
import Account from "./account";
import Tracy from "./tracy";
import { crossDown, crossUp } from "technicalindicators";

export interface Strategy {
  name: string;
  run(data: ChartData[]): number;
}

export type Decision = 0 | 1 | -1;

export default class Runner {
  constructor(
    private strats: {
      strat: Strategy;
      account: Account;
      logMatrix?: { [index: string]: { [index: string]: number } };
    }[]
  ) {}

  public simulateChart(data: ChartData[], options: { logFinance?: boolean } = { logFinance: true }) {
    for (const strat of this.strats) {
      strat.logMatrix = Runner.createLogMatrix();
    }

    const runPeriod = 100;
    for (let i = runPeriod; i < data.length - Tracy.minTradeLen; i++) {
      this.run(data.slice(Math.max(i - runPeriod + 1, 0), i + 1), {
        logFinance: options?.logFinance,
        nextData: data.slice(i + 1, i + 1 + Tracy.minTradeLen),
      });
    }

    for (const strat of this.strats) {
      strat.account.closeBuys(
        data[data.length - Tracy.minTradeLen - 1].closePrice,
        options?.logFinance ? strat.strat.name : undefined
      );
      strat.account.closeSells(
        data[data.length - Tracy.minTradeLen - 1].closePrice,
        options?.logFinance ? strat.strat.name : undefined
      );
      strat.account.logBalance();
      strat.account.resetProfit();
      console.table(strat.logMatrix);
    }
  }

  public run(data: ChartData[], options?: { nextData?: ChartData[]; logFinance?: boolean }) {
    const period = 100;
    const range = data.length > period ? data.slice(-period) : data;
    const expectedDecision = Tracy.makeDecision(
      options?.nextData ? Tracy.makePrediction(data[data.length - 1], options.nextData) : 0.0
    );
    for (const strat of this.strats) {
      const output = strat.strat.run(range);
      const actualDecision = Tracy.makeDecision(output);
      if (strat.logMatrix && options?.nextData) Runner.logInMatrix(strat.logMatrix, expectedDecision, actualDecision);
      const price = data[data.length - 1].closePrice;
      if (strat.account.amount <= 0) {
        strat.account.closeBuys(price, options?.logFinance ? strat.strat.name : undefined);
        strat.account.closeSells(price, options?.logFinance ? strat.strat.name : undefined);
      } else Runner.actOnPrediction(strat.account, output, price, options?.logFinance ? strat.strat.name : undefined);
    }
  }

  private static createLogMatrix() {
    return {
      expectedChill: { actualChill: 0, actualBuy: 0, actualSell: 0 },
      expectedBuy: { actualChill: 0, actualBuy: 0, actualSell: 0 },
      expectedSell: { actualChill: 0, actualBuy: 0, actualSell: 0 },
    };
  }

  private static logInMatrix(
    mat: { [index: string]: { [index: string]: number } },
    expectedDecision: Decision,
    actualDecision: Decision
  ) {
    const map = (decision: 0 | 1 | -1) => (decision == 0 ? "Chill" : decision == 1 ? "Buy" : "Sell");
    mat["expected" + map(expectedDecision)]["actual" + map(actualDecision)]++;
  }

  private static actOnPrediction(account: Account, prediction: number, price: number, log?: string) {
    const decision = Tracy.makeDecision(prediction);
    const amount = Math.abs(prediction) * Math.min(account.amount * 0.01, Tracy.maxAmount);
    if (decision == 1.0) {
      account.closeSells(price, log);
      account.buy(price, amount);
    } else if (decision == -1.0) {
      account.closeBuys(price, log);
      account.sell(price, amount);
    }
  }
}

export class CPR implements Strategy {
  //Common pattern recognizer
  public name = "CPR";

  public run(data: ChartData[]): number {
    const period = 5;
    const id = Indicators.cpr(data.slice(-period));
    return id.data[id.data.length - 1][1];
  }
}

export class MA implements Strategy {
  public name = "MA";
  private lastChoice = 0;

  public run(data: ChartData[]): number {
    const len = 20;
    const smaSrc = Indicators.sma(data, 50);
    //const smaDir = smaSrc.data[Math.floor(smaSrc.data.length / 2)][1] - smaSrc.data[0][1] > 0 ? 1.0 : -1.0;
    const sma = smaSrc.data.slice(-2).map((v) => v[1]);
    const emaSrc = Indicators.ema(data, len * 1.2);
    const ema = emaSrc.data.slice(-2).map((v) => v[1]);
    const temaSrc = Indicators.tema(data, len);
    const tema = temaSrc.data.slice(-2).map((v) => v[1]);
    if (temaSrc.delay > data.length) return 0;
    if (
      ((tema[1] > sma[1] && tema[0] < ema[0] && tema[1] > ema[1]) ||
        (tema[1] > ema[1] && tema[0] < sma[0] && tema[1] > sma[1])) &&
      this.lastChoice <= 0
    ) {
      this.lastChoice = 1.0;
      return 1.0;
    }
    if (
      ((tema[1] < sma[1] && tema[0] > ema[0] && tema[1] < ema[1]) ||
        (tema[1] < ema[1] && tema[0] > sma[0] && tema[1] < sma[1])) &&
      this.lastChoice >= 0
    ) {
      this.lastChoice = -1.0;
      return -1.0;
    }
    return 0;
  }
}
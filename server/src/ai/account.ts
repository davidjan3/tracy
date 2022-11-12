import chalk from "chalk";
import MathUtil from "util/MathUtil";

export default class Account {
  public amount: number;
  private loss: number;
  private gain: number;
  public openPositions: { type: 1 | -1; amount: number; openingPrice: number }[];

  constructor(amount: number = 1000) {
    this.amount = amount;
    this.loss = 0;
    this.gain = 0;
    this.openPositions = [];
  }

  public buy(price: number, amount: number): number {
    return this.openPosition(price, amount, 1);
  }

  public sell(price: number, amount: number): number {
    return this.openPosition(price, amount, -1);
  }

  public openPosition(price: number, amount: number, type: 1 | -1) {
    this.amount -= amount;
    return this.openPositions.push({ type: type, amount: amount, openingPrice: price }) - 1;
  }

  public closeBuys(price: number, log?: string) {
    this.closePositions(price, 1, log);
  }

  public closeSells(price: number, log?: string) {
    this.closePositions(price, -1, log);
  }

  private closePosition(price: number, index: number, log?: string): number {
    const pos = this.openPositions[index];
    const profit = pos.amount * (price - pos.openingPrice) * pos.type;
    if (log) {
      let logF;
      if (profit >= 0) {
        logF = chalk.green;
      } else {
        logF = chalk.red;
      }
      console.log(
        `${log}: ` +
          chalk.dim(`Closed ${pos.type == 1 ? "B" : "S"} position ${index}: `) +
          `${pos.amount} x (${pos.openingPrice} -> ${price}) = ` +
          logF(`${(profit < 0 ? "" : "+") + profit}`)
      );
    }

    if (profit >= 0) {
      this.gain += profit;
    } else {
      this.loss -= profit;
    }
    this.amount += profit + pos.amount;
    this.openPositions.splice(index, 1);
    return profit;
  }

  private closePositions(price: number, type: 1 | -1, log?: string) {
    for (let i = this.openPositions.length - 1; i >= 0; i--) {
      if (this.openPositions[i].type == type) this.closePosition(price, i, log);
    }
  }

  public resetProfit() {
    this.gain = 0;
    this.loss = 0;
  }

  public logBalance() {
    const profit = this.gain - this.loss;
    const logF = profit < 0 ? chalk.red : chalk.green;
    console.log(
      chalk.bold(
        `Balance: ${this.amount}, Profit: ${chalk.green("+" + MathUtil.money(this.gain))} ${chalk.red(
          "-" + MathUtil.money(this.loss)
        )} (${chalk.blue(MathUtil.round((this.gain / (this.gain + this.loss)) * 100, 2) + "%")}) = ${logF(
          (profit < 0 ? "" : "+") + MathUtil.money(profit)
        )}`
      )
    );
  }
}

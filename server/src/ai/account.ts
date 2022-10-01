import chalk from "chalk";

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

  public closeBuys(price: number) {
    this.closePositions(price, 1);
  }

  public closeSells(price: number) {
    this.closePositions(price, -1);
  }

  private closePosition(price: number, index: number): number {
    const pos = this.openPositions[index];
    const profit = pos.amount * (price - pos.openingPrice) * pos.type;
    if (Number.isNaN(profit)) debugger;
    let logF;
    if (profit >= 0) {
      this.gain += profit;
      logF = chalk.green;
    } else {
      this.loss -= profit;
      logF = chalk.red;
    }
    console.log(
      chalk.dim(`Closed ${pos.type == 1 ? "B" : "S"} position ${index}: `) +
        `${pos.amount} x (${pos.openingPrice} -> ${price}) = ` +
        logF(`${(profit < 0 ? "" : "+") + profit}`)
    );
    this.amount += profit + pos.amount;
    this.openPositions.splice(index, 1);
    return profit;
  }

  private closePositions(price: number, type: 1 | -1) {
    for (let i = this.openPositions.length - 1; i >= 0; i--) {
      if (this.openPositions[i].type == type) this.closePosition(price, i);
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
        `Balance: ${this.amount}, Profit: ${chalk.green("+" + this.gain)} ${chalk.red("-" + this.loss)} = ${logF(
          (profit < 0 ? "" : "+") + profit
        )}`
      )
    );
  }
}

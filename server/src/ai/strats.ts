import Tracy from "ai/tracy";
import Indicators, { ChartData } from "./indicators";
import { Strategy } from "./runner";

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

export class Horoscope {
  public name = "Horoscope";

  run(data: ChartData[], nextData: ChartData[]): number {
    return Tracy.makePrediction(data[data.length - 1], nextData);
  }
}

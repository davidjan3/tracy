import Account from "ai/account";
import Tracy from "ai/tracy";
import FileUtil from "util/FileUtil";
import Runner from "ai/runner";
import { ChartData } from "ai/indicators";
import { Horoscope } from "ai/strats";

async function main() {
  const NEW = true;
  const interval = "15min";

  const net = new Tracy(NEW ? undefined : FileUtil.incrementPath("data/tracyTF_" + interval));
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
  const history = FileUtil.loadJSON("data/" + interval + "_btc.json") as ChartData[];
  console.log("History parsed");
  history.splice(0, history.length * 0.9);
  history.splice(history.length * 0.005, history.length);
  const trainTestDistribution = 0.7; //0.6 => Use 60% for training, 40% for testing
  const trainSize = history.length * trainTestDistribution;
  const trainSets = history.slice(0, trainSize);
  const testSets = history.slice(trainSize, history.length);
  const bla = Tracy.valuesToSets(history);
  console.log("History sliced");
  /*if (NEW) {
    await net.train(trainSets);
    net.net.save("file://" + FileUtil.incrementPath("data/tracyTF_" + interval));
    console.log("Training done");
  }
  net.test(trainSets, { logTech: true });
  net.test(testSets, { logTech: true });*/
  /*const step = 30 * 24;
for (let i = 0; i < testSets.length / step; i++) {
  const testSet = testSets.slice(i * step, (i + 1) * step);
  tracy.test(testSet);
}*/
  console.log("Testing done");
  console.log("inputScale", net.inputMinMax);
}

async function test() {
  const interval = "60min";
  const history = FileUtil.loadJSON("data/" + interval + "_btc.json") as {
    ts: number;
    openPrice: number;
    closePrice: number;
    maxPrice: number;
    minPrice: number;
    volume: number;
  }[];
  history.splice(0, history.length * 0.2);
  const trainData = history.splice(0, Math.floor(history.length * 0.5));
  console.log("History parsed");

  const tracy = new Tracy();
  await tracy.train(trainData);

  const strats = [
    { strat: tracy, account: new Account(1000) },
    //{ strat: new Horoscope(), account: new Account(1000) },
    //{ strat: new MA(), account: new Account(1000) },
  ];
  const runner = new Runner(strats);
  runner.simulateChart(trainData, { logTechnical: false, outputMinMax: tracy.outputMinMax });
  strats.forEach((s) => (s.account.amount = 1000));
  runner.simulateChart(history, { logTechnical: false, outputMinMax: tracy.outputMinMax });
}

test();

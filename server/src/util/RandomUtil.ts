export default class RandomUtil {
  static bool(): boolean {
    return RandomUtil.chance(2);
  }

  static chance(oneInN: number): boolean {
    return oneInN < 2 ? true : Math.random() < 1.0 / oneInN;
  }

  static number(from: number, to: number): number {
    return Math.round(Math.random() * (to - from)) + from;
  }

  static value<T>(...arr: T[]): T {
    return arr[this.number(0, arr.length - 1)];
  }

  static randomText(wordCount: number): string {
    let str = "";
    for (let n = 0; n < wordCount; n++) {
      let l = RandomUtil.number(0, 2);
      let word = RandomUtil.value(
        ...RandomUtil.value(l == 0 ? RandomUtil.nouns : l == 1 ? RandomUtil.verbs : RandomUtil.adjectives)
      );
      str += (n == 0 ? "" : " ") + (l == 0 ? word : word);
    }
    return str;
  }

  static pickRandoms<T>(arr: T[], n: number): T[] {
    let res = new Array<T>(Math.min(n, arr.length));
    let arr2: T[] = arr.map((x, i) => x);
    for (let i = 0; i < res.length; i++) {
      let x = Math.floor(Math.random() * arr2.length);
      res[i] = arr2[x];
      arr2.splice(x, 1);
    }
    return res;
  }

  static readonly LENGTH = 50;
  static readonly adjectives = [
    "unique",
    "sedate",
    "cloistered",
    "juicy",
    "hallowed",
    "heavenly",
    "squealing",
    "awful",
    "vacuous",
    "nonstop",
    "unaccountable",
    "funny",
    "cautious",
    "axiomatic",
    "bright",
    "youthful",
    "gigantic",
    "innate",
    "sharp",
    "whimsical",
    "wet",
    "aromatic",
    "upbeat",
    "rustic",
    "four",
    "boring",
    "thick",
    "dead",
    "upset",
    "wasteful",
    "incredible",
    "maddening",
    "third",
    "melted",
    "sticky",
    "thirsty",
    "bouncy",
    "acid",
    "grieving",
    "gabby",
    "fuzzy",
    "unused",
    "afraid",
    "ready",
    "temporary",
    "minor",
    "used",
    "unwritten",
    "frantic",
    "watery",
  ];
  static readonly nouns = [
    "soda",
    "hand",
    "party",
    "government",
    "sink",
    "attraction",
    "spade",
    "reason",
    "stick",
    "baby",
    "sofa",
    "back",
    "coast",
    "card",
    "engine",
    "minister",
    "parcel",
    "hate",
    "pest",
    "mist",
    "pocket",
    "scarf",
    "ship",
    "wren",
    "letters",
    "war",
    "lock",
    "trail",
    "top",
    "camp",
    "eye",
    "floor",
    "jam",
    "respect",
    "egg",
    "nation",
    "way",
    "insurance",
    "eyes",
    "activity",
    "toy",
    "wheel",
    "cough",
    "zephyr",
    "design",
    "expert",
    "beginner",
    "trouble",
    "laborer",
    "fire",
  ];
  static readonly verbs = [
    "stuff",
    "load",
    "chase",
    "settle",
    "strap",
    "instruct",
    "prepare",
    "consider",
    "polish",
    "plant",
    "join",
    "heap",
    "screw",
    "shiver",
    "bang",
    "clip",
    "wrestle",
    "bless",
    "request",
    "calculate",
    "depend",
    "correct",
    "knock",
    "desert",
    "work",
    "cover",
    "paint",
    "hurry",
    "slap",
    "encourage",
    "queue",
    "sip",
    "curve",
    "glue",
    "argue",
    "want",
    "wink",
    "signal",
    "accept",
    "drain",
    "handle",
    "hop",
    "pump",
    "zoom",
    "touch",
    "help",
    "rescue",
    "unlock",
    "play",
    "bake",
  ];
}

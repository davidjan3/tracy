"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RandomUtil {
    static bool() {
        return RandomUtil.chance(2);
    }
    static chance(oneInN) {
        return oneInN < 2 ? true : Math.random() < 1.0 / oneInN;
    }
    static number(from, to) {
        return Math.round(Math.random() * (to - from)) + from;
    }
    static value(...arr) {
        return arr[this.number(0, arr.length - 1)];
    }
    static randomText(wordCount) {
        let str = "";
        for (let n = 0; n < wordCount; n++) {
            let l = RandomUtil.number(0, 2);
            let word = RandomUtil.value(...RandomUtil.value(l == 0 ? RandomUtil.nouns : l == 1 ? RandomUtil.verbs : RandomUtil.adjectives));
            str += (n == 0 ? "" : " ") + (l == 0 ? word : word);
        }
        return str;
    }
    static pickRandoms(arr, n) {
        let res = new Array(Math.min(n, arr.length));
        let arr2 = arr.map((x, i) => x);
        for (let i = 0; i < res.length; i++) {
            let x = Math.floor(Math.random() * arr2.length);
            res[i] = arr2[x];
            arr2.splice(x, 1);
        }
        return res;
    }
}
exports.default = RandomUtil;
RandomUtil.LENGTH = 50;
RandomUtil.adjectives = [
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
RandomUtil.nouns = [
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
RandomUtil.verbs = [
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
//# sourceMappingURL=RandomUtil.js.map
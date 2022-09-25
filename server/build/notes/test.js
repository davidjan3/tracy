"use strict";
function cast(v, scheme) { }
const scheme = {
    name: "",
    age: 0,
    ids: [0],
    children: [{ name: "", age: 0 }],
};
const obj = {
    name: "Santa",
    age: "62",
    ids: ["1", "2", "3"],
    children: [
        { name: "Klaus", age: 5 },
        { name: "Harold", age: "7" },
    ],
};
try {
    const obj2 = cast(obj, scheme);
    console.log("Cast:", obj2);
}
catch (e) {
    console.error(e);
}
//# sourceMappingURL=test.js.map
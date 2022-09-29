const objs: { [index: number]: string } = { 1: "sauce", 5: "apple", 3: "young" };

for (let key in objs) {
  console.log(key);
  console.log(objs[key]);
}

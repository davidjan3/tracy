import MathUtil from "./MathUtil";

describe("MathUtil", () => {
  test("getStandardDeviation", () => {
    const data = [
      [[1, 1, -1, 1, -1, -1, 1, -1], 1],
      [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3.1622],
    ] as [number[], number][];
    for (const io of data) {
      expect(MathUtil.getStandardDeviation(io[0])).toBeCloseTo(io[1]);
    }
  });

  test("getMinMax", () => {
    const data = [
      [
        [[1, 1, -1, 1, -1, -1, 1, -1], true],
        [-1, 1],
      ],
      [
        [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], true],
        [0, 10],
      ],
      [
        [[0, 1, 2, 3, 4, 5, 69, 7, 8, 9, 10, 2, 3, 4, 8, 9, 7, 5], true],
        [0, 10],
      ],
    ] as [[number[], boolean], number[]][];
    for (const io of data) {
      expect(MathUtil.getMinMax(...io[0])).toStrictEqual(io[1]);
    }
  });
});

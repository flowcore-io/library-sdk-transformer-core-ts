import { hello } from "../src";

describe("Example Module", () => {
  it("should say hello", async () => {
    expect(hello()).toEqual("Hello World!");
  });
});

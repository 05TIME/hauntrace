import { describe, it, expect } from "vitest";
import { canonicalJson, GENESIS_HASH } from "../src/hash.js";

describe("canonicalJson", () => {
  it("sorts object keys", () => {
    const result = canonicalJson({ z: 1, a: 2, m: 3 });
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it("handles nested objects with sorted keys", () => {
    const result = canonicalJson({ b: { d: 4, c: 3 }, a: 1 });
    expect(result).toBe('{"a":1,"b":{"c":3,"d":4}}');
  });

  it("handles arrays", () => {
    const result = canonicalJson([3, 1, 2]);
    expect(result).toBe("[3,1,2]");
  });

  it("handles null", () => {
    expect(canonicalJson(null)).toBe("null");
  });

  it("handles booleans", () => {
    expect(canonicalJson(true)).toBe("true");
    expect(canonicalJson(false)).toBe("false");
  });

  it("converts -0 to 0", () => {
    expect(canonicalJson(-0)).toBe("0");
  });

  it("throws for NaN", () => {
    expect(() => canonicalJson(NaN)).toThrow("non-finite");
  });

  it("throws for Infinity", () => {
    expect(() => canonicalJson(Infinity)).toThrow("non-finite");
  });

  it("throws for unsupported types (function)", () => {
    expect(() => canonicalJson(() => {})).toThrow("unsupported value");
  });

  it("drops undefined values in objects", () => {
    const result = canonicalJson({ a: 1, b: undefined, c: 3 });
    expect(result).toBe('{"a":1,"c":3}');
  });
});

describe("GENESIS_HASH", () => {
  it("is 64 zeroes", () => {
    expect(GENESIS_HASH).toBe("0".repeat(64));
  });
});

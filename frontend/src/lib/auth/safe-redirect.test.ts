import { describe, it, expect } from "vitest";
import { getSafeRedirectPath } from "./safe-redirect";

describe("getSafeRedirectPath", () => {
  it("returns the default when null", () => {
    expect(getSafeRedirectPath(null)).toBe("/account");
  });

  it("returns the default for an empty string", () => {
    expect(getSafeRedirectPath("")).toBe("/account");
  });

  it("allows a same-origin path", () => {
    expect(getSafeRedirectPath("/account/orders")).toBe("/account/orders");
  });

  it("rejects a path missing the leading slash", () => {
    expect(getSafeRedirectPath("account/orders")).toBe("/account");
  });

  it("rejects a protocol-relative URL (//evil.com)", () => {
    expect(getSafeRedirectPath("//evil.com")).toBe("/account");
  });

  it("rejects an absolute URL to another origin", () => {
    expect(getSafeRedirectPath("https://evil.com/phish")).toBe("/account");
  });

  it("rejects a path containing an embedded scheme", () => {
    expect(getSafeRedirectPath("/redirect?to=javascript://evil")).toBe(
      "/account",
    );
  });
});

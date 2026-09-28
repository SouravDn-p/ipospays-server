import { describe, expect, it } from "vitest";
import { hostsFor } from "../../config/ipospays.config.js";
import { createTransactionReference, toMinorAmount } from "./ipospays.util.js";

describe("iPOSpays helpers", () => {
  it("selects sandbox hosts until production is chosen", () => {
    expect(hostsFor("sandbox").authUrl).toContain("auth.ipospays.tech");
    expect(hostsFor("production").authUrl).toContain("auth.ipospays.com");
    expect(hostsFor("sandbox").hostedPaymentUrl).toContain("/api/v3/");
  });

  it("converts USD to the minor units iPOSpays expects", () => {
    expect(toMinorAmount(10)).toBe("1000");
    expect(toMinorAmount(10.5)).toBe("1050");
  });

  it("builds an alphanumeric reference", () => {
    expect(createTransactionReference(1_700_000_000_000)).toMatch(
      /^[A-Z0-9]{1,20}$/,
    );
  });
});

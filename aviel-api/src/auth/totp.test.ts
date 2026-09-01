import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  base32Decode,
  base32Encode,
  currentCounter,
  generateCode,
  generateRecoveryCodes,
  generateSecret,
  otpauthUri,
  verifyCode,
} from "./totp";

// RFC 6238 Appendix B, SHA-1: the seed is the ASCII string
// "12345678901234567890", which is this in base32.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

describe("base32", () => {
  it("round-trips", () => {
    const buf = Buffer.from("12345678901234567890", "ascii");
    assert.deepEqual(base32Decode(base32Encode(buf)), buf);
  });

  it("matches the known encoding of the RFC seed", () => {
    assert.equal(RFC_SECRET, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("ignores padding, whitespace and case", () => {
    const buf = Buffer.from("aviel", "ascii");
    const encoded = base32Encode(buf);
    assert.deepEqual(base32Decode(`${encoded.toLowerCase()}  `), buf);
  });

  it("rejects characters outside the alphabet", () => {
    assert.throws(() => base32Decode("NOT-BASE32!"));
  });
});

describe("code generation", () => {
  // The RFC's published TOTP values are 8 digits; a 6-digit code is the last
  // six of the same number, which is what this implementation produces.
  const vectors: [number, string][] = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ];

  for (const [seconds, expected] of vectors) {
    it(`matches RFC 6238 at T=${seconds}`, () => {
      const counter = Math.floor(seconds / 30);
      assert.equal(generateCode(RFC_SECRET, counter), expected);
    });
  }

  it("always produces six digits", () => {
    const secret = generateSecret();
    for (let i = 0; i < 200; i++) {
      assert.match(generateCode(secret, i), /^\d{6}$/);
    }
  });
});

describe("verification", () => {
  const at = (seconds: number) => seconds * 1000;

  it("accepts the code for the current step", () => {
    assert.ok(verifyCode(RFC_SECRET, "287082", at(59)));
  });

  it("accepts one step either side, for clock drift", () => {
    // T=59 is counter 1; counter 0 and counter 2 are also accepted.
    assert.ok(verifyCode(RFC_SECRET, generateCode(RFC_SECRET, 0), at(59)));
    assert.ok(verifyCode(RFC_SECRET, generateCode(RFC_SECRET, 2), at(59)));
  });

  it("rejects a code two steps away", () => {
    assert.equal(
      verifyCode(RFC_SECRET, generateCode(RFC_SECRET, 4), at(59)),
      false
    );
  });

  it("rejects the wrong code, the wrong length, and nonsense", () => {
    assert.equal(verifyCode(RFC_SECRET, "000000", at(59)), false);
    assert.equal(verifyCode(RFC_SECRET, "28708", at(59)), false);
    assert.equal(verifyCode(RFC_SECRET, "2870820", at(59)), false);
    assert.equal(verifyCode(RFC_SECRET, "abcdef", at(59)), false);
    assert.equal(verifyCode(RFC_SECRET, "", at(59)), false);
  });

  it("rejects rather than throwing on a malformed secret", () => {
    assert.equal(verifyCode("!!!!", "287082", at(59)), false);
  });

  it("tolerates spaces, which is how apps display the code", () => {
    assert.ok(verifyCode(RFC_SECRET, "287 082", at(59)));
  });

  it("does not accept a code from a different secret", () => {
    const other = generateSecret();
    assert.equal(verifyCode(other, "287082", at(59)), false);
  });
});

describe("enrolment artefacts", () => {
  it("generates a 160-bit secret", () => {
    assert.equal(base32Decode(generateSecret()).length, 20);
  });

  it("generates distinct secrets", () => {
    const secrets = new Set(Array.from({ length: 50 }, generateSecret));
    assert.equal(secrets.size, 50);
  });

  it("builds an otpauth URI an authenticator can read", () => {
    const uri = otpauthUri({ secret: RFC_SECRET, account: "sam@example.com" });
    assert.ok(uri.startsWith("otpauth://totp/Aviel%20AI:sam%40example.com?"));
    assert.ok(uri.includes(`secret=${RFC_SECRET}`));
    assert.ok(uri.includes("digits=6"));
    assert.ok(uri.includes("period=30"));
  });

  it("generates unique recovery codes", () => {
    const codes = generateRecoveryCodes(8);
    assert.equal(codes.length, 8);
    assert.equal(new Set(codes).size, 8);
    // 5 random bytes as hex, grouped in fours for reading aloud.
    for (const code of codes) {
      assert.match(code, /^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{2}$/);
    }
  });

  it("advances the counter every 30 seconds", () => {
    assert.equal(currentCounter(0), 0);
    assert.equal(currentCounter(29_999), 0);
    assert.equal(currentCounter(30_000), 1);
    assert.equal(currentCounter(59_000), 1);
  });
});

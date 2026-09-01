// Aviel AI — TOTP (RFC 6238).
//
// Written against node:crypto rather than pulled in as a dependency: the whole
// algorithm is an HMAC, a truncation and a modulo, and it is worth being able
// to read the thing that guards an account.
//
// Compatible with Google Authenticator, 1Password, Authy and anything else that
// speaks otpauth:// — SHA-1, 6 digits, 30-second step, which is what those
// clients assume when the URI does not say otherwise.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const DIGITS = 6;
const STEP_SECONDS = 30;
/** Accept the neighbouring steps: phone clocks drift, and typing takes time. */
const WINDOW = 1;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("That is not a valid secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** A fresh 160-bit secret, the size RFC 4226 recommends for SHA-1. */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

function counterBuffer(counter: number): Buffer {
  const buf = Buffer.alloc(8);
  // A JS number cannot hold 64 bits, but a step counter will not exceed 2^53
  // for another few million years.
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  return buf;
}

/** The code for one time step. Exported so the tests can pin known vectors. */
export function generateCode(secret: string, counter: number): string {
  const hmac = createHmac("sha1", base32Decode(secret))
    .update(counterBuffer(counter))
    .digest();

  // Dynamic truncation, RFC 4226 §5.3.
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export function currentCounter(atMs: number = Date.now()): number {
  return Math.floor(atMs / 1000 / STEP_SECONDS);
}

/**
 * Whether a code is currently valid for this secret.
 *
 * Compared with `timingSafeEqual`, so the time taken to reject a code says
 * nothing about how many of its digits were right.
 */
export function verifyCode(
  secret: string,
  code: string,
  atMs: number = Date.now()
): boolean {
  const candidate = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(candidate)) return false;

  const counter = currentCounter(atMs);
  const supplied = Buffer.from(candidate, "utf8");

  let valid = false;
  for (let drift = -WINDOW; drift <= WINDOW; drift++) {
    let expected: Buffer;
    try {
      expected = Buffer.from(generateCode(secret, counter + drift), "utf8");
    } catch {
      return false;
    }
    // Deliberately not short-circuiting: every window is checked either way, so
    // the loop takes the same time whichever step matched.
    if (
      expected.length === supplied.length &&
      timingSafeEqual(expected, supplied)
    ) {
      valid = true;
    }
  }

  return valid;
}

/** The otpauth:// URI an authenticator app enrols from. */
export function otpauthUri(params: {
  secret: string;
  account: string;
  issuer?: string;
}): string {
  const issuer = params.issuer ?? "Aviel AI";
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(params.account)}`;
  const query = new URLSearchParams({
    secret: params.secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/**
 * Recovery codes.
 *
 * Returned once, at enrolment, and stored hashed — losing a phone must not mean
 * losing the account, and a database dump must not be a list of working bypass
 * codes.
 */
export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(5).toString("hex").replace(/(.{4})/g, "$1-").replace(/-$/, "")
  );
}

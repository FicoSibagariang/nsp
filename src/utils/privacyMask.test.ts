import { expect, test, describe } from "bun:test";
import {
  getMaskedIdentity,
  maskName,
  maskEmail,
  maskNip,
  maskNik,
  maskAccountNumber,
  FIRST_NAMES,
  LAST_NAMES,
} from "./privacyMask";

describe("Deterministic Pseudonymization Utility", () => {
  const sampleIdA = "11111111-2222-3333-4444-555555555555";
  const sampleIdB = "99999999-8888-7777-6666-555555555555";

  test("produces deterministic output for the same identifier", () => {
    const res1 = getMaskedIdentity(sampleIdA);
    const res2 = getMaskedIdentity(sampleIdA);

    expect(res1.name).toBe(res2.name);
    expect(res1.email).toBe(res2.email);
    expect(res1.nip).toBe(res2.nip);
    expect(res1.nik).toBe(res2.nik);
    expect(res1.accountNumber).toBe(res2.accountNumber);
  });

  test("produces different identities for different identifiers", () => {
    const resA = getMaskedIdentity(sampleIdA);
    const resB = getMaskedIdentity(sampleIdB);

    expect(resA.name).not.toBe(resB.name);
    expect(resA.email).not.toBe(resB.email);
    expect(resA.nip).not.toBe(resB.nip);
    expect(resA.nik).not.toBe(resB.nik);
  });

  test("composes natural Indonesian names from dictionary", () => {
    const identity = getMaskedIdentity("test-uuid-koperasi-123");
    const [first, last] = identity.name.split(" ");

    expect(FIRST_NAMES.includes(first)).toBe(true);
    expect(LAST_NAMES.includes(last)).toBe(true);
  });

  test("generates expected formats for email, NIP, NIK, and bank account", () => {
    const identity = getMaskedIdentity(sampleIdA);

    // Email format: firstname.lastname@demo.mail
    expect(identity.email).toMatch(/^[a-z]+\.[a-z]+@demo\.mail$/);

    // NIP format: EMP-xxxx
    expect(identity.nip).toMatch(/^EMP-\d{4}$/);

    // NIK format: 16 digits starting with 320101
    expect(identity.nik).toMatch(/^320101\d{10}$/);
    expect(identity.nik.length).toBe(16);

    // Account format: 10600xxxxxxxx
    expect(identity.accountNumber).toMatch(/^10600\d{8}$/);
  });

  test("respects isDemo flag in mask helper functions", () => {
    const originalName = "Budi Hartono";
    const originalEmail = "budi@perusahaan.co.id";
    const originalNip = "NIP-9901";
    const originalNik = "3171012345678901";
    const originalAcc = "1234567890";

    // When isDemo is false, return original values
    expect(maskName(sampleIdA, originalName, false)).toBe(originalName);
    expect(maskEmail(sampleIdA, originalEmail, false)).toBe(originalEmail);
    expect(maskNip(sampleIdA, originalNip, false)).toBe(originalNip);
    expect(maskNik(sampleIdA, originalNik, false)).toBe(originalNik);
    expect(maskAccountNumber(sampleIdA, originalAcc, false)).toBe(originalAcc);

    // When isDemo is true, return pseudonymized values
    expect(maskName(sampleIdA, originalName, true)).not.toBe(originalName);
    expect(maskEmail(sampleIdA, originalEmail, true)).not.toBe(originalEmail);
    expect(maskNip(sampleIdA, originalNip, true)).not.toBe(originalNip);
    expect(maskNik(sampleIdA, originalNik, true)).not.toBe(originalNik);
    expect(maskAccountNumber(sampleIdA, originalAcc, true)).not.toBe(originalAcc);
  });
});

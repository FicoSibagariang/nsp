import { expect, test, describe } from "bun:test";
import {
  getMaskedIdentity,
  maskName,
  maskEmail,
  maskNip,
  maskNik,
  maskAccountNumber,
  maskJournalDescription,
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

  describe("maskJournalDescription (Issue #312)", () => {
    test("masks EWA journal description pattern with masked name and EMP NIP", () => {
      const original = "Pencairan EWA Kasbon Karyawan: Irwan Pancariadi (0202549)";
      const masked = maskJournalDescription(original, true);

      expect(masked).not.toBe(original);
      expect(masked.startsWith("Pencairan EWA Kasbon Karyawan: ")).toBe(true);
      expect(masked).not.toContain("Irwan Pancariadi");
      expect(masked).not.toContain("0202549");
      expect(masked).toMatch(/Pencairan EWA Kasbon Karyawan: [A-Za-z]+ [A-Za-z]+ \(EMP-\d{4}\)/);

      // Deterministic
      expect(maskJournalDescription(original, true)).toBe(masked);

      // When demo is false, returns original
      expect(maskJournalDescription(original, false)).toBe(original);
    });

    test("masks member names in savings and loan journal descriptions with em-dash separator", () => {
      const desc1 = "Setoran Simpanan sukarela — Wardi";
      const masked1 = maskJournalDescription(desc1, true);
      expect(masked1).not.toBe(desc1);
      expect(masked1.startsWith("Setoran Simpanan sukarela — ")).toBe(true);
      expect(masked1).not.toContain("Wardi");
      expect(maskJournalDescription(desc1, false)).toBe(desc1);

      const desc2 = "Pembayaran Cicilan Pinjaman — Rosaliana Seftiani Devi";
      const masked2 = maskJournalDescription(desc2, true);
      expect(masked2).not.toBe(desc2);
      expect(masked2.startsWith("Pembayaran Cicilan Pinjaman — ")).toBe(true);
      expect(masked2).not.toContain("Rosaliana Seftiani Devi");
      expect(maskJournalDescription(desc2, false)).toBe(desc2);

      const desc3 = "Pencairan Pinjaman Anggota — Alfhyra Haya Aulia Pohan";
      const masked3 = maskJournalDescription(desc3, true);
      expect(masked3).not.toBe(desc3);
      expect(masked3.startsWith("Pencairan Pinjaman Anggota — ")).toBe(true);
      expect(masked3).not.toContain("Alfhyra Haya Aulia Pohan");
      expect(maskJournalDescription(desc3, false)).toBe(desc3);
    });

    test("masks officer name in parentheses while preserving operational context", () => {
      const original = "Pengisian Kas Kecil via transfer Bank Mandiri ke Bendahara (Ramadina)";
      const masked = maskJournalDescription(original, true);

      expect(masked).not.toBe(original);
      expect(masked.startsWith("Pengisian Kas Kecil via transfer Bank Mandiri ke Bendahara (")).toBe(true);
      expect(masked).not.toContain("Ramadina");
      expect(masked.endsWith(")")).toBe(true);

      // Returns original when demo is false
      expect(maskJournalDescription(original, false)).toBe(original);
    });

    test("leaves non-PII operational descriptions and aggregate counts intact", () => {
      const bankFee = "Biaya Administrasi Bank Mandiri Bulanan";
      expect(maskJournalDescription(bankFee, true)).toBe(bankFee);
      expect(maskJournalDescription(bankFee, false)).toBe(bankFee);

      const payrollAggregate = "Pelunasan Payroll Potong Gaji EWA (34 Karyawan)";
      expect(maskJournalDescription(payrollAggregate, true)).toBe(payrollAggregate);
      expect(maskJournalDescription(payrollAggregate, false)).toBe(payrollAggregate);

      const payrollPeriod = "Pelunasan Payroll Potong Gaji EWA Periode 2026-09 (34 Karyawan)";
      expect(maskJournalDescription(payrollPeriod, true)).toBe(payrollPeriod);
      expect(maskJournalDescription(payrollPeriod, false)).toBe(payrollPeriod);
    });

    test("safely handles empty or null descriptions", () => {
      expect(maskJournalDescription("", true)).toBe("");
      expect(maskJournalDescription(null as any, true)).toBe("");
      expect(maskJournalDescription(undefined as any, true)).toBe("");
    });
  });
});

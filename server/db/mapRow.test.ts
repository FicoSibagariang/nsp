import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { mapRow, registerSchema, CAMEL_CASE_FIELDS, COLUMN_KEY_MAP } from "./mapRow";

describe("Dynamic Column Mapping (Eliminasi Whitelist Manual)", () => {
  test("memetakan kolom Postgres lowercase default ke camelCase", () => {
    const raw = {
      id: "123",
      joindate: "2026-01-01",
      simpananpokok: 100000,
      totalsavings: 500000,
    };

    const mapped = mapRow<{
      id: string;
      joinDate: string;
      simpananPokok: number;
      totalSavings: number;
    }>(raw);

    expect(mapped).toEqual({
      id: "123",
      joinDate: "2026-01-01",
      simpananPokok: 100000,
      totalSavings: 500000,
    });
  });

  test("kolom baru di Zod schema langsung dipetakan tanpa registrasi manual di whitelist", () => {
    // Definisi skema baru oleh developer
    const customFeatureSchema = z.object({
      id: z.string(),
      brandNewCamelField: z.string(),
      anotherNewMetricValue: z.number(),
    });

    // Simulasi hasil query PostgreSQL (lowercase)
    const rawFromPg = {
      id: "custom-1",
      brandnewcamelfield: "Hello World",
      anothernewmetricvalue: 42,
    };

    // Saat dipetakan dengan skema (seperti pada Statement.getAs / allAs)
    const mapped = mapRow(rawFromPg, customFeatureSchema);

    expect(mapped).toEqual({
      id: "custom-1",
      brandNewCamelField: "Hello World",
      anotherNewMetricValue: 42,
    });

    // Pastikan schema.parse berhasil
    const parsed = customFeatureSchema.parse(mapped);
    expect(parsed.brandNewCamelField).toBe("Hello World");
    expect(parsed.anotherNewMetricValue).toBe(42);
  });

  test("kolom baru yang didaftarkan via registerSchema langsung tersedia secara global di mapRow", () => {
    const sampleSchema = z.object({
      globalDynamicColumn: z.string(),
    });

    registerSchema(sampleSchema);

    const raw = {
      globaldynamiccolumn: "test-value",
    };

    const mapped = mapRow<any>(raw);
    expect(mapped?.globalDynamicColumn).toBe("test-value");
  });

  test("otomatis menangani snake_case ke camelCase", () => {
    const raw = {
      rejection_reason: "Dokumen tidak lengkap",
      temporary_payroll_flag: true,
    };

    const mapped = mapRow<any>(raw);
    expect(mapped.rejectionReason).toBe("Dokumen tidak lengkap");
    expect(mapped.temporaryPayrollFlag).toBe(true);
  });

  test("kompatibilitas backward COLUMN_KEY_MAP dan CAMEL_CASE_FIELDS", () => {
    expect(COLUMN_KEY_MAP["joindate"]).toBe("joinDate");
    expect(COLUMN_KEY_MAP["simpananpokok"]).toBe("simpananPokok");
    expect(CAMEL_CASE_FIELDS.includes("joinDate")).toBe(true);
  });
});

import { expect, test, describe, beforeAll } from "bun:test";
import db from "../db";
import {
  applyAllMigrations,
  applySchemaMigrations,
  applyDataPatches,
  buildSchemaMigrations,
  buildDataPatches,
  listAppliedMigrations,
  runMigrations,
} from "./index";
import type { Migration } from "./types";

describe("formal migrations", () => {
  beforeAll(async () => {
    // Other suites may TRUNCATE schema_migrations; re-apply is idempotent for pending only.
    await applyAllMigrations(db);
  });

  test("baseline and data migrations are recorded", async () => {
    const applied = await listAppliedMigrations(db);
    expect(applied).toContain("001_baseline");
    expect(applied).toContain("0003_convert_currency_to_int");
    expect(applied).toContain("0004_hash_admin_passwords");
  });

  test("separates pure DDL schema migrations from incidental data hotfixes", async () => {
    const schemaMigs = buildSchemaMigrations(db);
    const dataPatches = buildDataPatches(db);

    // Schema migrations contain DDL tables
    const schemaNames = schemaMigs.map((m) => m.name);
    expect(schemaNames).toContain("001_baseline");
    expect(schemaNames).toContain("0022_add_accounting");
    expect(schemaNames).toContain("0025_add_ewa_service");

    // Data patches contain user/record hotfixes
    const patchNames = dataPatches.map((m) => m.name);
    expect(patchNames).toContain("0041_fix_didi_irawan_journal_date");
    expect(patchNames).toContain("0043_fix_ewa_september_payroll_journal_date");
    expect(patchNames).toContain("0040_set_ewa_journal_creator_system");

    // Pure schema migrations can run cleanly
    await applySchemaMigrations(db);
    await applyDataPatches(db);
  });

  test("core tables exist after baseline", async () => {
    // Smoke-check: simple selects must not throw
    await db.query("SELECT 1 FROM members LIMIT 1").all();
    await db.query("SELECT 1 FROM loans LIMIT 1").all();
    await db.query("SELECT 1 FROM loan_payments LIMIT 1").all();
    await db.query("SELECT 1 FROM transactions LIMIT 1").all();
    await db.query("SELECT 1 FROM admins LIMIT 1").all();
    await db.query("SELECT 1 FROM settings LIMIT 1").all();
  });

  test("failed migration is not recorded and error propagates", async () => {
    const name = `test_fail_${crypto.randomUUID()}`;
    const failing: Migration = {
      name,
      async up() {
        throw new Error("intentional migration failure");
      },
    };

    await expect(runMigrations(db, [failing])).rejects.toThrow("intentional migration failure");

    const applied = await listAppliedMigrations(db);
    expect(applied).not.toContain(name);
  });
});

import type { Migration } from "./types";

/**
 * Migration 0044: Backfill fee_percentage and total_payroll_deduction for withdrawal_requests where fee_percentage IS NULL.
 */
export function createFixEwaNullFeePercentageMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
}): Migration {
  return {
    name: "0044_fix_ewa_null_fee_percentage",
    async up() {
      await db.run(`
        UPDATE withdrawal_requests
        SET fee_percentage = ROUND((fee::numeric / amount::numeric) * 100, 2),
            total_payroll_deduction = amount + fee
        WHERE fee_percentage IS NULL AND amount > 0
      `);
    },
  };
}

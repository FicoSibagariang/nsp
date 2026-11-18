import type { Migration } from "./types";

/**
 * Migration 0047: Cleanup orphaned loan disbursement journal entries (#329)
 * Removes orphaned journal entries and journal lines for soft-deleted loans that have no payments,
 * specifically cleaning up journal #00c72292-50c3-409b-94a3-02aee1877b55 and restoring true
 * balances for accounts 11201 (Piutang Pinjaman Anggota) and 11102 (Bank Mandiri).
 */
export function createCleanupOrphanedLoanDisbursementJournalsMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
}): Migration {
  return {
    name: "0047_cleanup_orphaned_loan_disbursement_journals",
    async up() {
      // 1. Delete any reversal journal lines referencing the orphaned loan disbursement entries
      await db.run(`
        DELETE FROM journal_lines
        WHERE journal_entry_id IN (
          SELECT r.id
          FROM journal_entries r
          WHERE r.reference_type = 'reversal_of'
            AND (
              r.reference_id IN (
                SELECT j.id::text
                FROM journal_entries j
                JOIN loans l ON j.reference_id = l.id
                WHERE j.reference_type = 'loan_disbursement'
                  AND l.deletedAt IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1 FROM loan_payments p WHERE p.loanId = l.id
                  )
              )
              OR r.reference_id = '00c72292-50c3-409b-94a3-02aee1877b55'
            )
        )
      `);

      // 2. Delete any reversal journal entries referencing the orphaned loan disbursement entries
      await db.run(`
        DELETE FROM journal_entries
        WHERE reference_type = 'reversal_of'
          AND (
            reference_id IN (
              SELECT j.id::text
              FROM journal_entries j
              JOIN loans l ON j.reference_id = l.id
              WHERE j.reference_type = 'loan_disbursement'
                AND l.deletedAt IS NOT NULL
                AND NOT EXISTS (
                  SELECT 1 FROM loan_payments p WHERE p.loanId = l.id
                )
            )
            OR reference_id = '00c72292-50c3-409b-94a3-02aee1877b55'
          )
      `);

      // 3. Delete journal lines of orphaned loan disbursement entries
      await db.run(`
        DELETE FROM journal_lines
        WHERE journal_entry_id IN (
          SELECT j.id
          FROM journal_entries j
          JOIN loans l ON j.reference_id = l.id
          WHERE j.reference_type = 'loan_disbursement'
            AND l.deletedAt IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM loan_payments p WHERE p.loanId = l.id
            )
          UNION
          SELECT '00c72292-50c3-409b-94a3-02aee1877b55'::uuid
        )
      `);

      // 4. Delete the orphaned loan disbursement journal entries
      await db.run(`
        DELETE FROM journal_entries
        WHERE id IN (
          SELECT j.id
          FROM journal_entries j
          JOIN loans l ON j.reference_id = l.id
          WHERE j.reference_type = 'loan_disbursement'
            AND l.deletedAt IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM loan_payments p WHERE p.loanId = l.id
            )
          UNION
          SELECT '00c72292-50c3-409b-94a3-02aee1877b55'::uuid
        )
      `);
    },
  };
}

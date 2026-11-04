import type { Migration } from "./types";

/**
 * Migration 0046: Add loan_attachments table for multi-document support and supplemental documents.
 */
export function createAddLoanAttachmentsTableMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => {
    get: (...args: unknown[]) => Promise<unknown>;
    all: (...args: unknown[]) => Promise<unknown[]>;
  };
}): Migration {
  return {
    name: "0046_add_loan_attachments_table",
    async up() {
      await db.run(`
        CREATE TABLE IF NOT EXISTS loan_attachments (
          id TEXT PRIMARY KEY,
          loan_id VARCHAR NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
          file_name VARCHAR(255) NOT NULL,
          file_url TEXT NOT NULL,
          file_size BIGINT,
          is_supplemental BOOLEAN DEFAULT false,
          uploaded_by VARCHAR(100) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      await db.run(
        `CREATE INDEX IF NOT EXISTS idx_loan_attachments_loan_id ON loan_attachments(loan_id)`
      );

      // Data migration from legacy loans.attachmentUrl and loans.attachmentName
      const legacyLoans = (await db
        .query(
          `SELECT id, "attachmentUrl", "attachmentName", createdAt
           FROM loans
           WHERE "attachmentUrl" IS NOT NULL AND "attachmentUrl" != ''`
        )
        .all()) as Array<{
        id: string;
        attachmentUrl: string;
        attachmentName: string | null;
        createdAt: string | null;
      }>;

      for (const loan of legacyLoans) {
        const existing = (await db
          .query(
            `SELECT id FROM loan_attachments WHERE loan_id = ? AND file_url = ? LIMIT 1`
          )
          .get(loan.id, loan.attachmentUrl)) as { id: string } | null;

        if (!existing) {
          const attachmentId = crypto.randomUUID();
          const fileName = loan.attachmentName || "Dokumen Lampiran";
          const createdAt = loan.createdAt || new Date().toISOString();

          await db.run(
            `INSERT INTO loan_attachments (id, loan_id, file_name, file_url, file_size, is_supplemental, uploaded_by, created_at)
             VALUES (?, ?, ?, ?, NULL, false, 'migration', ?)`,
            [attachmentId, loan.id, fileName, loan.attachmentUrl, createdAt]
          );
        }
      }
    },
  };
}

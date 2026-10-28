import type { Db } from '../db';
import type { CashflowRow } from '../db/entities';

export type CashflowSummaryResult = {
  data: CashflowRow[];
  total: number;
  totalInflow: number;
  totalOutflow: number;
  netCash: number;
};

export async function getCashflowData(
  database: Db,
  limit: number,
  offset: number
): Promise<CashflowSummaryResult> {
  const totalsRes = (await database
    .query(`
      SELECT 
        SUM(jl.debit) as total_inflow,
        SUM(jl.credit) as total_outflow
      FROM journal_lines jl
      JOIN accounts a ON jl.account_id = a.id
      WHERE a.code IN ('11101', '11102')
    `)
    .get()) as { total_inflow: number | null; total_outflow: number | null } | null;

  const totalInflow = Number(totalsRes?.total_inflow ?? 0) || 0;
  const totalOutflow = Number(totalsRes?.total_outflow ?? 0) || 0;
  const netCash = totalInflow - totalOutflow;

  const queryStr = `
    SELECT 
      'journal' as source,
      jl.id as id,
      je.transaction_date as "date",
      'Koperasi' as "partyName",
      je.description as description,
      CASE WHEN jl.debit > 0 THEN jl.debit ELSE jl.credit END as amount,
      CASE WHEN jl.debit > 0 THEN 'inflow' ELSE 'outflow' END as "flowType"
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    JOIN accounts a ON jl.account_id = a.id
    WHERE a.code IN ('11101', '11102')
    ORDER BY je.transaction_date DESC, je.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const rows = await database.query(queryStr).all<CashflowRow>(limit, offset);

  const mappedRows = rows.map((r) => {
    let partyName = r.partyName;
    let description = r.description;

    if (description && description.includes(' — ')) {
      const parts = description.split(' — ');
      description = parts[0];
      partyName = parts[1];
    }

    return { ...r, partyName, description };
  });

  const countQuery = `
    SELECT COUNT(*) as count 
    FROM journal_lines jl
    JOIN accounts a ON jl.account_id = a.id
    WHERE a.code IN ('11101', '11102')
  `;
  const totalRes = (await database.query(countQuery).get()) as { count: number } | null;

  return {
    data: mappedRows,
    total: totalRes?.count ?? 0,
    totalInflow,
    totalOutflow,
    netCash,
  };
}

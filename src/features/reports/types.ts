export type ReportType =
  | 'cooperative_summary'
  | 'savings_summary'
  | 'loans_summary'
  | 'revenue_projection'
  | 'ar_summary'
  | 'savings_member'
  | 'cashflow_statement'
  | 'income_statement'
  | 'balance_sheet';

export interface RevenueProjectionSummary {
  totalRealizedInterest: number;
  totalRealizedOtherRevenue?: number;
  totalRealizedRevenue?: number;
  totalProjectedInterest: number;
  totalEstimatedFullYearInterest: number;
  totalProjectedRevenue?: number;
  totalRealizedExpense?: number;
  projectedNetIncome?: number;
  profitStatus?: 'profit' | 'loss' | 'even';
  totalProjectedPrincipal: number;
  totalProjectedCashInflow: number;
  totalProjectedInstallments: number;
}

export interface RevenueProjectionMonthly {
  monthKey: string;
  monthName: string;
  realizedInterest: number;
  projectedInterest: number;
  projectedPrincipal: number;
  projectedTotal: number;
  installmentsCount: number;
}

export interface RevenueProjectionData {
  year: string;
  summary: RevenueProjectionSummary;
  revenueBreakdown?: Array<{ code: string; name: string; total: number }>;
  expenseBreakdown?: Array<{ code: string; name: string; total: number }>;
  monthlyBreakdown: RevenueProjectionMonthly[];
}

export interface ArReportRow {
  memberName: string;
  principal: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
}

export interface SavingsMemberRow {
  memberName: string;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  totalSavings: number;
}

export interface CashflowRow {
  category: string;
  subcategory: string;
  accountCode?: string;
  accountName?: string;
  label: string;
  total: number;
}

export interface StatementAccountRow {
  code: string;
  name: string;
  balance: number;
}

export interface IncomeStatementData {
  revenues: StatementAccountRow[];
  expenses: StatementAccountRow[];
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
}

export interface BalanceSheetData {
  assets: StatementAccountRow[];
  liabilities: StatementAccountRow[];
  equity: StatementAccountRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

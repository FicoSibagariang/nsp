import { getEwaPaycycleDates, exportEwaPayrollToExcel } from '../../utils/exportUtils';
import { maskName, maskNip, maskNik } from '../../utils/privacyMask';
import type { PayrollRecapData } from './types';

/**
 * Returns the current EWA payroll cycle date range up to today.
 * The payroll cycle runs from the 26th to the 25th:
 * - If today is 1-25: startDate is the 26th of the previous month.
 * - If today is 26-31: startDate is the 26th of the current month.
 * - endDate is today (local time YYYY-MM-DD).
 */
export function getCurrentEwaCycleRange(now: Date = new Date()): { startDate: string; endDate: string } {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed (0 = Jan, 11 = Dec)
  const day = now.getDate(); // 1-31

  const endYear = year;
  const endMonth = String(month + 1).padStart(2, '0');
  const endDay = String(day).padStart(2, '0');
  const endDate = `${endYear}-${endMonth}-${endDay}`;

  let startDate: string;
  if (day >= 26) {
    const startYear = year;
    const startMonth = String(month + 1).padStart(2, '0');
    startDate = `${startYear}-${startMonth}-26`;
  } else {
    const prevDate = new Date(year, month - 1, 26);
    const startYear = prevDate.getFullYear();
    const startMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
    startDate = `${startYear}-${startMonth}-26`;
  }

  return { startDate, endDate };
}

export function getDefaultSettleDate(periodMonth: string): string {
  if (!periodMonth) return new Date().toISOString().split('T')[0];
  const parts = periodMonth.split('-');
  if (parts.length < 2) return new Date().toISOString().split('T')[0];
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return new Date().toISOString().split('T')[0];
  const lastDay = new Date(year, month, 0).getDate();
  return `${periodMonth}-${String(lastDay).padStart(2, '0')}`;
}

export function exportPayrollXlsx(
  payrollRecap: PayrollRecapData | null,
  payrollMonth: string,
  isDemoMode: boolean
): void {
  if (!payrollRecap?.items || payrollRecap.items.length === 0) return;
  const { startDate, endDate, label } = getEwaPaycycleDates(payrollMonth);
  const exportItems = payrollRecap.items.map((it: any) => ({
    ...it,
    nip: isDemoMode ? maskNip(it.employeeId, it.nip) : it.nip,
    nik: isDemoMode ? maskNik(it.employeeId, it.nik || '') : (it.nik || ''),
    name: isDemoMode ? maskName(it.employeeId, it.name) : it.name,
  }));

  exportEwaPayrollToExcel(exportItems, {
    companyName: 'PT Media Antar Nusa',
    paycycleLabel: label,
    filename: `ewa-repayment-${startDate}-sd-${endDate}.xlsx`,
  });
}

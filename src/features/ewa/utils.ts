import { getEwaPaycycleDates, exportEwaPayrollToExcel } from '../../utils/exportUtils';
import { maskName, maskNip, maskNik } from '../../utils/privacyMask';
import type { PayrollRecapData } from './types';

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

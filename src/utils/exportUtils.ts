import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRp } from './format';

interface ExportColumn<T> {
  header: string;
  key: keyof T | string;
  render?: (item: T) => string | number;
}

export function exportToExcel<T>(data: T[], columns: ExportColumn<T>[], filename: string) {
  const rowData = data.map((item) => {
    const row: Record<string, any> = {};
    columns.forEach((col) => {
      row[col.header] = col.render ? col.render(item) : item[col.key as keyof T];
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rowData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportToPDF<T>(data: T[], columns: ExportColumn<T>[], filename: string, title: string) {
  const doc = new jsPDF('landscape');
  
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Periode: ${new Date().toLocaleDateString('id-ID')}`, 14, 22);

  const head = [columns.map(c => c.header)];
  const body = data.map(item => 
    columns.map(col => col.render ? col.render(item) : String(item[col.key as keyof T] ?? ''))
  );

  autoTable(doc, {
    startY: 28,
    head,
    body,
    theme: 'grid',
    headStyles: { fillColor: [1, 113, 227] }, // primary color #0171E3
  });

  doc.save(`${filename}.pdf`);
}

/**
 * Calculates EWA paycycle dates based on the payroll month (YYYY-MM).
 * Nusanet paycycle runs from the 26th of the previous month to the 25th of the current month.
 */
export function getEwaPaycycleDates(periodMonth: string): { startDate: string; endDate: string; label: string } {
  const [yearStr, monthStr] = periodMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12
  
  // End date is 25th of the current periodMonth
  const endDate = `${year}-${String(month).padStart(2, '0')}-25`;
  
  // Start date is 26th of the previous month
  const prevDate = new Date(year, month - 2, 26);
  const prevYear = prevDate.getFullYear();
  const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
  const startDate = `${prevYear}-${prevMonth}-26`;
  
  return {
    startDate,
    endDate,
    label: `${startDate} s/d ${endDate}`,
  };
}

export interface EwaPayrollExportItem {
  employeeId?: string;
  nip: string;
  nik?: string | null;
  name: string;
  totalAdvances: number;
  txCount?: number;
  totalFee: number;
  totalDeduction: number;
}

export interface EwaPayrollExportOptions {
  companyName?: string;
  paycycleLabel?: string;
  filename?: string;
}

/**
 * Exports EWA payroll deduction recap to an XLSX file in standard HRIS/Wagely Repayment Summary Report format.
 */
export function exportEwaPayrollToExcel(
  items: EwaPayrollExportItem[],
  options?: EwaPayrollExportOptions
) {
  const companyName = options?.companyName || 'PT Media Antar Nusa';
  const paycycleLabel = options?.paycycleLabel || '';
  const filename = options?.filename || `Rekap_Potongan_Payroll_EWA.xlsx`;

  const rows: (string | number | null | undefined)[][] = [
    [companyName],
    ['Repayment Summary Report'],
    ['Paycycle Date', paycycleLabel],
    [
      'Employee ID',
      'KTP ID',
      'First Name',
      'Last Name',
      'EWA Amount',
      '#EWA',
      'Membership Fee (Employee)',
      'Membership Fee Discount',
      'Employer Contribution Fee',
      'Membership Fee Total',
      'VAT Total',
      'Total Deduction Amount',
      'Total Repayment',
      'EWA',
      'GB',
      'Arisan',
    ],
  ];

  let sumEwaAmount = 0;
  let sumMembershipFee = 0;
  let sumTotalDeduction = 0;

  for (const it of items) {
    const ewaAmount = Number(it.totalAdvances || 0);
    const txCount = Number(it.txCount || 1);
    const fee = Number(it.totalFee || 0);
    const totalDeduction = Number(it.totalDeduction || ewaAmount + fee);

    sumEwaAmount += ewaAmount;
    sumMembershipFee += fee;
    sumTotalDeduction += totalDeduction;

    rows.push([
      String(it.nip || ''),
      it.nik ? String(it.nik) : '',
      it.name || '',
      null,
      ewaAmount,
      txCount,
      fee,
      0,
      0,
      fee,
      0,
      totalDeduction,
      totalDeduction,
      totalDeduction,
      null,
      null,
    ]);
  }

  // Summary row at the bottom matching template format
  rows.push([
    null,
    null,
    null,
    'Total',
    sumEwaAmount,
    null,
    sumMembershipFee,
    0,
    0,
    sumMembershipFee,
    0,
    sumTotalDeduction,
    sumTotalDeduction,
    sumTotalDeduction,
    null,
    null,
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Repayment Summary Report');

  const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, finalFilename);
}

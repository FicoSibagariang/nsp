import { maskName } from '../../../utils/privacyMask';
import type { ReportData } from '@shared/types';
import type {
  ReportType,
  RevenueProjectionData,
  ArReportRow,
  SavingsMemberRow,
  CashflowRow,
  IncomeStatementData,
  BalanceSheetData,
} from '../types';

interface ExportCsvParams {
  selectedReport: ReportType;
  reportResponse?: ReportData | null;
  projectionRes?: RevenueProjectionData | null;
  arRes?: ArReportRow[] | null;
  savingsMemberRes?: SavingsMemberRow[] | null;
  cashflowRes?: CashflowRow[] | null;
  incomeRes?: IncomeStatementData | null;
  balanceRes?: BalanceSheetData | null;
  isDemoMode: boolean;
  hideZeroBalance: boolean;
}

export function exportReportCsv({
  selectedReport,
  reportResponse,
  projectionRes,
  arRes,
  savingsMemberRes,
  cashflowRes,
  incomeRes,
  balanceRes,
  isDemoMode,
  hideZeroBalance,
}: ExportCsvParams) {
  let csvContent = '';
  let filename = '';

  if (selectedReport === 'cooperative_summary' && reportResponse) {
    filename = 'laporan_ringkasan_koperasi.csv';
    csvContent += 'Parameter Keuangan & Operasional,Nilai/Jumlah\r\n';
    csvContent += `Total Anggota Terdaftar,${reportResponse.members.totalMembers}\r\n`;
    csvContent += `Anggota Berstatus Aktif,${reportResponse.members.activeMembers}\r\n`;
    csvContent += `Total Dana Simpanan Anggota,${reportResponse.members.totalSavings}\r\n`;
    csvContent += `Total Pinjaman Tersalurkan (Kredit Aktif),${reportResponse.loans.totalLoansAmount}\r\n`;
    csvContent += `Total Penerimaan Angsuran Pinjaman,${reportResponse.loans.totalPaymentsReceived}\r\n`;
  } else if (selectedReport === 'savings_summary' && reportResponse) {
    filename = 'laporan_portfolio_simpanan.csv';
    csvContent += 'Jenis Simpanan,Total Akumulasi\r\n';
    csvContent += `Simpanan Pokok (Modal Awal),${reportResponse.members.totalPokok}\r\n`;
    csvContent += `Simpanan Wajib (Bulanan),${reportResponse.members.totalWajib}\r\n`;
    csvContent += `Simpanan Sukarela (Tabungan Bebas),${reportResponse.members.totalSukarela}\r\n`;
    csvContent += `Total Seluruh Simpanan,${reportResponse.members.totalSavings}\r\n`;
  } else if (selectedReport === 'loans_summary' && reportResponse) {
    filename = 'laporan_portfolio_pinjaman.csv';
    csvContent += 'Status Portofolio Kredit,Total Nominal\r\n';
    csvContent += `Kredit Lancar Aktif (Disetujui),${reportResponse.loans.activeLoansAmount}\r\n`;
    csvContent += `Kredit Lunas (Telah Diselesaikan),${reportResponse.loans.paidLoansAmount}\r\n`;
    csvContent += `Kredit Bermasalah (Macet / NPL),${reportResponse.loans.badLoansAmount}\r\n`;
    csvContent += `Total Kumulatif Penyaluran Pinjaman,${reportResponse.loans.totalLoansAmount}\r\n`;
  } else if (selectedReport === 'revenue_projection' && projectionRes) {
    filename = `laporan_proyeksi_pendapatan_${projectionRes.year}.csv`;
    csvContent += `Laporan Proyeksi Pendapatan & Kas Masuk Tahun ${projectionRes.year}\r\n\r\n`;
    csvContent += 'RINGKASAN TAHUNAN,NOMINAL\r\n';
    csvContent += `Realisasi Pendapatan Masuk (s/d Saat Ini),${projectionRes.summary.totalRealizedRevenue ?? projectionRes.summary.totalRealizedInterest}\r\n`;
    csvContent += `Proyeksi Pendapatan Bunga (Sisa Tahun),${projectionRes.summary.totalProjectedInterest}\r\n`;
    csvContent += `Estimasi Total Pendapatan 1 Tahun,${projectionRes.summary.totalProjectedRevenue ?? projectionRes.summary.totalEstimatedFullYearInterest}\r\n`;
    csvContent += `Pengeluaran / Beban Tercatat (s/d Saat Ini),${projectionRes.summary.totalRealizedExpense ?? 0}\r\n`;
    csvContent += `Estimasi Laba / Rugi Akhir Tahun,${projectionRes.summary.projectedNetIncome ?? 0}\r\n`;
    csvContent += `Status Proyeksi Akhir Tahun,"${(projectionRes.summary.projectedNetIncome ?? 0) > 0 ? 'UNTUNG (Surplus)' : (projectionRes.summary.projectedNetIncome ?? 0) < 0 ? 'RUGI (Defisit)' : 'IMPAS'}"\r\n`;
    csvContent += `Proyeksi Pengembalian Pokok (Sisa Tahun),${projectionRes.summary.totalProjectedPrincipal}\r\n`;
    csvContent += `Total Proyeksi Kas Masuk Angsuran (Sisa Tahun),${projectionRes.summary.totalProjectedCashInflow}\r\n`;
    csvContent += `Jumlah Tagihan Angsuran Terjadwal,${projectionRes.summary.totalProjectedInstallments}\r\n\r\n`;

    csvContent += 'REKAPITULASI BULANAN\r\n';
    csvContent += 'Bulan,Realisasi Bunga,Jml Angsuran,Proyeksi Bunga,Proyeksi Pokok,Total Proyeksi Masuk\r\n';
    for (const m of projectionRes.monthlyBreakdown) {
      csvContent += `"${m.monthName}",${m.realizedInterest},${m.installmentsCount},${m.projectedInterest},${m.projectedPrincipal},${m.projectedTotal}\r\n`;
    }
  } else if (selectedReport === 'ar_summary' && arRes) {
    filename = 'laporan_piutang_pinjaman.csv';
    csvContent += 'Nama Anggota,Pokok Pinjaman,Total Tagihan,Telah Dibayar,Sisa Piutang,Status\r\n';
    for (const item of arRes) {
      const memberName = isDemoMode ? maskName(item.memberName, item.memberName) : item.memberName;
      csvContent += `${memberName},${item.principal},${item.totalAmount},${item.paidAmount},${item.remainingAmount},${item.status}\r\n`;
    }
  } else if (selectedReport === 'savings_member' && savingsMemberRes) {
    filename = 'laporan_rekap_simpanan_anggota.csv';
    csvContent += 'Nama Anggota,Simpanan Pokok,Simpanan Wajib,Simpanan Sukarela,Total Simpanan\r\n';
    for (const item of savingsMemberRes) {
      const memberName = isDemoMode ? maskName(item.memberName, item.memberName) : item.memberName;
      csvContent += `${memberName},${item.simpananPokok},${item.simpananWajib},${item.simpananSukarela},${item.totalSavings}\r\n`;
    }
  } else if (selectedReport === 'cashflow_statement' && cashflowRes) {
    filename = 'laporan_arus_kas.csv';
    csvContent += 'Kategori,Pos Transaksi Arus Kas,Total Nominal\r\n';
    for (const item of cashflowRes) {
      csvContent += `"${item.category === 'inflow' ? 'Arus Kas Masuk' : 'Arus Kas Keluar'}","${item.label || item.subcategory}","${item.total}"\r\n`;
    }
  } else if (selectedReport === 'income_statement' && incomeRes) {
    filename = 'laporan_laba_rugi.csv';
    csvContent += 'Kode Akun,Nama Akun,Saldo\r\n';
    const revs = hideZeroBalance ? incomeRes.revenues.filter((r) => Number(r.balance) !== 0) : incomeRes.revenues;
    const exps = hideZeroBalance ? incomeRes.expenses.filter((r) => Number(r.balance) !== 0) : incomeRes.expenses;
    csvContent += '--- PENDAPATAN ---\r\n';
    revs.forEach((r) => (csvContent += `"${r.code}","${r.name}",${r.balance}\r\n`));
    csvContent += `Total Pendapatan,,${incomeRes.totalRevenue}\r\n`;
    csvContent += '--- BEBAN ---\r\n';
    exps.forEach((r) => (csvContent += `"${r.code}","${r.name}",${r.balance}\r\n`));
    csvContent += `Total Beban,,${incomeRes.totalExpense}\r\n`;
    csvContent += `Laba/Rugi Bersih,,${incomeRes.netIncome}\r\n`;
  } else if (selectedReport === 'balance_sheet' && balanceRes) {
    filename = 'laporan_neraca.csv';
    csvContent += 'Kode Akun,Nama Akun,Saldo\r\n';
    const ass = hideZeroBalance ? balanceRes.assets.filter((r) => Number(r.balance) !== 0) : balanceRes.assets;
    const lia = hideZeroBalance ? balanceRes.liabilities.filter((r) => Number(r.balance) !== 0) : balanceRes.liabilities;
    const equ = hideZeroBalance ? balanceRes.equity.filter((r) => Number(r.balance) !== 0) : balanceRes.equity;
    csvContent += '--- ASET ---\r\n';
    ass.forEach((r) => (csvContent += `"${r.code}","${r.name}",${r.balance}\r\n`));
    csvContent += `Total Aset,,${balanceRes.totalAssets}\r\n`;
    csvContent += '--- KEWAJIBAN ---\r\n';
    lia.forEach((r) => (csvContent += `"${r.code}","${r.name}",${r.balance}\r\n`));
    csvContent += `Total Kewajiban,,${balanceRes.totalLiabilities}\r\n`;
    csvContent += '--- EKUITAS ---\r\n';
    equ.forEach((r) => (csvContent += `"${r.code}","${r.name}",${r.balance}\r\n`));
    csvContent += `Total Ekuitas,,${balanceRes.totalEquity}\r\n`;
    csvContent += `Total Kewajiban & Ekuitas,,${balanceRes.totalLiabilities + balanceRes.totalEquity}\r\n`;
  }

  if (!csvContent || !filename) return;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

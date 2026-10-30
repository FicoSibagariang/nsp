import { VStack } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { CooperativeSummaryReport } from './CooperativeSummaryReport';
import { RevenueProjectionReport } from './RevenueProjectionReport';
import { MemberAccountsReport } from './MemberAccountsReport';
import { FinancialStatementsReport } from './FinancialStatementsReport';
import type {
  ReportType,
  RevenueProjectionData,
  ArReportRow,
  SavingsMemberRow,
  CashflowRow,
  IncomeStatementData,
  BalanceSheetData,
} from '../types';
import type { ReportData } from '@shared/types';

interface ReportPrintableAreaProps {
  koperasiName: string;
  selectedReport: ReportType;
  projectionYear: string;
  formattedDate: string;
  startDate: string;
  endDate: string;
  hideZeroBalance: boolean;
  reportResponse?: ReportData | null;
  projectionRes?: RevenueProjectionData | null;
  arRes?: ArReportRow[] | null;
  savingsMemberRes?: SavingsMemberRow[] | null;
  cashflowRes?: CashflowRow[] | null;
  incomeRes?: IncomeStatementData | null;
  balanceRes?: BalanceSheetData | null;
  isDemoMode: boolean;
}

export function ReportPrintableArea({
  koperasiName,
  selectedReport,
  projectionYear,
  formattedDate,
  startDate,
  endDate,
  hideZeroBalance,
  reportResponse,
  projectionRes,
  arRes,
  savingsMemberRes,
  cashflowRes,
  incomeRes,
  balanceRes,
  isDemoMode,
}: ReportPrintableAreaProps) {
  return (
    <Card
      id="printable-report-area"
      style={{
        padding: '28px 32px',
        backgroundColor: 'var(--color-background-primary)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}
    >
      <VStack gap={4}>
        {/* Document Header */}
        <div
          style={{
            borderBottom: '3px double var(--color-border)',
            paddingBottom: '12px',
            textAlign: 'center',
            marginBottom: '12px',
          }}
        >
          <Heading
            level={2}
            style={{
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: 'var(--color-text-primary)',
            }}
          >
            {koperasiName}
          </Heading>
        </div>

        {/* Report Title */}
        <div style={{ textAlign: 'center' }}>
          <Heading
            level={3}
            style={{
              textDecoration: 'underline',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            {selectedReport === 'cooperative_summary' && 'LAPORAN RINGKASAN PERKEMBANGAN KOPERASI'}
            {selectedReport === 'savings_summary' && 'LAPORAN PORTFOLIO SIMPANAN ANGGOTA'}
            {selectedReport === 'loans_summary' && 'LAPORAN KINERJA DAN PORTOFOLIO PINJAMAN'}
            {selectedReport === 'revenue_projection' &&
              `LAPORAN PROYEKSI PENDAPATAN & KAS MASUK TAHUN ${projectionYear}`}
            {selectedReport === 'ar_summary' && 'LAPORAN PIUTANG PINJAMAN'}
            {selectedReport === 'savings_member' && 'LAPORAN SIMPANAN ANGGOTA'}
            {selectedReport === 'cashflow_statement' && 'LAPORAN ARUS KAS PERIODE'}
            {selectedReport === 'income_statement' && 'LAPORAN LABA RUGI'}
            {selectedReport === 'balance_sheet' && 'NERACA (POSISI KEUANGAN)'}
          </Heading>
          <Text type="supporting" color="secondary" style={{ marginTop: '4px' }}>
            {selectedReport === 'revenue_projection'
              ? `Tahun Anggaran: ${projectionYear} (Dicetak: ${formattedDate})`
              : selectedReport === 'balance_sheet'
              ? `Posisi Keuangan Per: ${endDate || formattedDate}`
              : (selectedReport === 'income_statement' ||
                  selectedReport === 'cashflow_statement') &&
                (startDate || endDate)
              ? `Periode: ${startDate || 'Awal'} s.d ${endDate || 'Sekarang'} (Dicetak: ${formattedDate})`
              : `Per Tanggal: ${formattedDate}`}
            {['income_statement', 'balance_sheet'].includes(selectedReport) && (
              <span> • {hideZeroBalance ? 'Hanya Akun Bersaldo' : 'Seluruh Bagan Akun'}</span>
            )}
          </Text>
        </div>

        {/* Dynamic Report Content */}
        {(selectedReport === 'cooperative_summary' ||
          selectedReport === 'savings_summary' ||
          selectedReport === 'loans_summary') &&
          reportResponse && (
            <CooperativeSummaryReport selectedReport={selectedReport} data={reportResponse} />
          )}

        {selectedReport === 'revenue_projection' && projectionRes && (
          <RevenueProjectionReport data={projectionRes} />
        )}

        {(selectedReport === 'ar_summary' || selectedReport === 'savings_member') && (
          <MemberAccountsReport
            selectedReport={selectedReport}
            arData={arRes}
            savingsMemberData={savingsMemberRes}
            isDemoMode={isDemoMode}
          />
        )}

        {(selectedReport === 'cashflow_statement' ||
          selectedReport === 'income_statement' ||
          selectedReport === 'balance_sheet') && (
          <FinancialStatementsReport
            selectedReport={selectedReport}
            cashflowData={cashflowRes}
            incomeData={incomeRes}
            balanceData={balanceRes}
            hideZeroBalance={hideZeroBalance}
          />
        )}

        {/* Signature block */}
        <div
          className="signature-block"
          style={{
            marginTop: '32px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '20px',
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
          }}
        >
          <div style={{ textAlign: 'center', flex: 1 }}>
            <Text type="body" style={{ fontSize: '13px' }}>
              Disiapkan oleh,
            </Text>
            <div style={{ height: '48px' }} />
            <Text
              type="body"
              style={{
                fontWeight: 600,
                fontSize: '13px',
                textDecoration: 'underline',
              }}
            >
              Bendahara Koperasi
            </Text>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <Text type="body" style={{ fontSize: '13px' }}>
              Disetujui oleh,
            </Text>
            <div style={{ height: '48px' }} />
            <Text
              type="body"
              style={{
                fontWeight: 600,
                fontSize: '13px',
                textDecoration: 'underline',
              }}
            >
              Ketua Koperasi
            </Text>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <Text type="body" style={{ fontSize: '13px' }}>
              Diketahui oleh,
            </Text>
            <div style={{ height: '48px' }} />
            <Text
              type="body"
              style={{
                fontWeight: 600,
                fontSize: '13px',
                textDecoration: 'underline',
              }}
            >
              Pengawas Koperasi
            </Text>
          </div>
        </div>
      </VStack>
    </Card>
  );
}

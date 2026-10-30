'use client';

import { useState } from 'react';
import {
  HStack,
  StackItem,
  Layout,
  LayoutContent,
  LayoutHeader,
} from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { useApiQuery } from '../hooks/useApiQuery';
import { useAuth } from '../hooks/useAuth';
import { DataStateView } from '../components/DataStateView';
import { useDemoMode } from '../contexts/DemoModeContext';
import {
  ReportsSidebar,
  ReportPrintableArea,
  exportReportCsv,
} from '../features/reports';
import type {
  ReportType,
  RevenueProjectionData,
  ArReportRow,
  SavingsMemberRow,
  CashflowRow,
  IncomeStatementData,
  BalanceSheetData,
} from '../features/reports';
import type { ReportData, SettingsData } from '@shared/types';

export default function ReportsTemplate() {
  const { hasPermission } = useAuth();
  const { isDemoMode } = useDemoMode();
  const canExportReports = hasPermission('export:reports');

  const [selectedReport, setSelectedReport] = useState<ReportType>('cooperative_summary');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectionYear, setProjectionYear] = useState(new Date().getFullYear().toString());
  const [hideZeroBalance, setHideZeroBalance] = useState(true);

  // API Queries
  const {
    data: reportResponse,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: fetchSummary,
  } = useApiQuery<ReportData>('/api/reports/summary');

  const {
    data: arRes,
    isLoading: isArLoading,
    error: arError,
    refetch: fetchAr,
  } = useApiQuery<ArReportRow[]>('/api/reports/ar');

  const {
    data: savingsMemberRes,
    isLoading: isSavingsMemberLoading,
    error: savingsMemberError,
    refetch: fetchSavingsMember,
  } = useApiQuery<SavingsMemberRow[]>('/api/reports/savings-member');

  const cashflowPath = `/api/reports/cashflow-statement?startDate=${startDate}&endDate=${endDate}`;
  const {
    data: cashflowRes,
    isLoading: isCashflowLoading,
    error: cashflowError,
    refetch: fetchCashflow,
  } = useApiQuery<CashflowRow[]>(cashflowPath);

  const incomePath = `/api/reports/income-statement?startDate=${startDate}&endDate=${endDate}`;
  const {
    data: incomeRes,
    isLoading: isIncomeLoading,
    error: incomeError,
    refetch: fetchIncome,
  } = useApiQuery<IncomeStatementData>(incomePath);

  const balancePath = `/api/reports/balance-sheet?endDate=${endDate}`;
  const {
    data: balanceRes,
    isLoading: isBalanceLoading,
    error: balanceError,
    refetch: fetchBalance,
  } = useApiQuery<BalanceSheetData>(balancePath);

  const projectionPath = `/api/reports/revenue-projection?year=${projectionYear}`;
  const {
    data: projectionRes,
    isLoading: isProjectionLoading,
    error: projectionError,
    refetch: fetchProjection,
  } = useApiQuery<RevenueProjectionData>(projectionPath);

  const { data: settings } = useApiQuery<SettingsData>('/api/settings');
  const koperasiName = settings?.koperasiName?.trim() || 'Koperasi';

  let isLoading = false;
  let error: string | null = null;
  let refetch = () => {};

  if (selectedReport === 'revenue_projection') {
    isLoading = isProjectionLoading;
    error = projectionError;
    refetch = fetchProjection;
  } else if (selectedReport === 'ar_summary') {
    isLoading = isArLoading;
    error = arError;
    refetch = fetchAr;
  } else if (selectedReport === 'savings_member') {
    isLoading = isSavingsMemberLoading;
    error = savingsMemberError;
    refetch = fetchSavingsMember;
  } else if (selectedReport === 'cashflow_statement') {
    isLoading = isCashflowLoading;
    error = cashflowError;
    refetch = fetchCashflow;
  } else if (selectedReport === 'income_statement') {
    isLoading = isIncomeLoading;
    error = incomeError;
    refetch = fetchIncome;
  } else if (selectedReport === 'balance_sheet') {
    isLoading = isBalanceLoading;
    error = balanceError;
    refetch = fetchBalance;
  } else {
    isLoading = isSummaryLoading;
    error = summaryError;
    refetch = fetchSummary;
  }

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    exportReportCsv({
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
    });
  };

  const formattedDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const summaryReady = !!(reportResponse && reportResponse.members && reportResponse.loans);
  const hasSelectedData =
    selectedReport === 'cooperative_summary' ||
    selectedReport === 'savings_summary' ||
    selectedReport === 'loans_summary'
      ? summaryReady
      : selectedReport === 'revenue_projection'
      ? !!projectionRes
      : selectedReport === 'ar_summary'
      ? Array.isArray(arRes)
      : selectedReport === 'savings_member'
      ? Array.isArray(savingsMemberRes)
      : selectedReport === 'cashflow_statement'
      ? Array.isArray(cashflowRes)
      : selectedReport === 'income_statement'
      ? !!incomeRes
      : selectedReport === 'balance_sheet'
      ? !!balanceRes
      : false;

  return (
    <Layout
      height="auto"
      header={
        <LayoutHeader hasDivider padding={3} className="no-print">
          <HStack gap={2} vAlign="center" style={{ width: '100%' }}>
            <StackItem size="fill">
              <HStack gap={3} vAlign="center">
                <Heading level={1}>Laporan Koperasi</Heading>
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: '1px solid var(--color-border-primary)',
                    backgroundColor: isSidebarCollapsed
                      ? 'var(--color-primary-500)'
                      : 'var(--color-background-primary)',
                    color: isSidebarCollapsed ? '#ffffff' : 'var(--color-text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title={
                    isSidebarCollapsed
                      ? 'Tampilkan panel menu laporan & filter'
                      : 'Sembunyikan panel untuk memperluas tampilan laporan'
                  }
                >
                  <span>{isSidebarCollapsed ? '📑 Buka Menu Laporan' : '◀ Sembunyikan Menu'}</span>
                </button>
              </HStack>
            </StackItem>
            <StackItem>
              {canExportReports && (
                <HStack gap={2}>
                  <button
                    onClick={handleExportCSV}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--color-success-500)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    📥 Ekspor CSV
                  </button>
                  <button
                    onClick={handlePrint}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--color-primary-500)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    🖨️ Cetak Laporan
                  </button>
                </HStack>
              )}
            </StackItem>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={3}>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #printable-report-area, #printable-report-area * { visibility: visible; }
              #printable-report-area {
                position: fixed; left: 0; top: 0; right: 0; bottom: auto;
                width: 100%; max-width: 100%; margin: 0 !important;
                padding: 16px 24px !important; border: none !important;
                box-shadow: none !important; border-radius: 0 !important;
                background: white !important; color: black !important;
                box-sizing: border-box;
              }
              .no-print { display: none !important; }
              table { width: 100% !important; page-break-inside: auto; }
              tr { page-break-inside: avoid; }
              .signature-block { page-break-inside: avoid !important; break-inside: avoid !important; }
            }
          `}</style>

          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', width: '100%' }}>
            {!isSidebarCollapsed && (
              <ReportsSidebar
                selectedReport={selectedReport}
                onSelectReport={setSelectedReport}
                onCollapse={() => setIsSidebarCollapsed(true)}
                startDate={startDate}
                onStartDateChange={setStartDate}
                endDate={endDate}
                onEndDateChange={setEndDate}
                hideZeroBalance={hideZeroBalance}
                onHideZeroBalanceChange={setHideZeroBalance}
                projectionYear={projectionYear}
                onProjectionYearChange={setProjectionYear}
              />
            )}

            <div style={{ flex: '1 1 0', minWidth: 0, width: '100%' }}>
              {isSidebarCollapsed && (
                <div className="no-print" style={{ marginBottom: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setIsSidebarCollapsed(false)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      fontSize: '13px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid var(--color-border-primary)',
                      backgroundColor: 'var(--color-background-primary)',
                      color: 'var(--color-text-primary)',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                      cursor: 'pointer',
                    }}
                  >
                    <span>📑 Buka Pilihan Laporan & Filter</span>
                  </button>
                </div>
              )}

              <DataStateView
                isLoading={isLoading}
                error={error}
                onRetry={refetch}
                errorTitle="Gagal Memuat Laporan"
              >
                {!hasSelectedData ? (
                  <Text type="supporting" color="secondary">
                    {isLoading ? 'Memuat data laporan…' : 'Belum ada data untuk laporan ini.'}
                  </Text>
                ) : (
                  <ReportPrintableArea
                    koperasiName={koperasiName}
                    selectedReport={selectedReport}
                    projectionYear={projectionYear}
                    formattedDate={formattedDate}
                    startDate={startDate}
                    endDate={endDate}
                    hideZeroBalance={hideZeroBalance}
                    reportResponse={reportResponse}
                    projectionRes={projectionRes}
                    arRes={arRes}
                    savingsMemberRes={savingsMemberRes}
                    cashflowRes={cashflowRes}
                    incomeRes={incomeRes}
                    balanceRes={balanceRes}
                    isDemoMode={isDemoMode}
                  />
                )}
              </DataStateView>
            </div>
          </div>
        </LayoutContent>
      }
    />
  );
}

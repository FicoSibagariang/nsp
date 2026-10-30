import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import type { ReportType } from '../types';

interface ReportsSidebarProps {
  selectedReport: ReportType;
  onSelectReport: (report: ReportType) => void;
  onCollapse: () => void;
  startDate: string;
  onStartDateChange: (val: string) => void;
  endDate: string;
  onEndDateChange: (val: string) => void;
  hideZeroBalance: boolean;
  onHideZeroBalanceChange: (val: boolean) => void;
  projectionYear: string;
  onProjectionYearChange: (val: string) => void;
}

const REPORT_MENU_ITEMS: Array<{ id: ReportType; label: string; icon: string }> = [
  { id: 'cooperative_summary', label: 'Laporan Ringkasan Koperasi', icon: '📊' },
  { id: 'savings_summary', label: 'Laporan Mutasi & Simpanan', icon: '💰' },
  { id: 'loans_summary', label: 'Laporan Portofolio Pinjaman', icon: '📈' },
  { id: 'revenue_projection', label: 'Proyeksi Pendapatan & Kas Masuk', icon: '🎯' },
  { id: 'ar_summary', label: 'Daftar Piutang Pinjaman', icon: '📋' },
  { id: 'savings_member', label: 'Rekap Simpanan Anggota', icon: '🗂️' },
  { id: 'cashflow_statement', label: 'Laporan Arus Kas', icon: '💵' },
  { id: 'income_statement', label: 'Laporan Laba Rugi', icon: '📈' },
  { id: 'balance_sheet', label: 'Neraca Koperasi', icon: '⚖️' },
];

export function ReportsSidebar({
  selectedReport,
  onSelectReport,
  onCollapse,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  hideZeroBalance,
  onHideZeroBalanceChange,
  projectionYear,
  onProjectionYearChange,
}: ReportsSidebarProps) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="no-print" style={{ width: '280px', flexShrink: 0 }}>
      <Card style={{ padding: '16px' }}>
        <VStack gap={3}>
          <HStack vAlign="center" style={{ justifyContent: 'space-between', width: '100%' }}>
            <Heading level={3}>Pilih Laporan</Heading>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCollapse}
              label="◀ Ciutkan"
              tooltip="Sembunyikan panel ini"
            />
          </HStack>

          <VStack gap={2}>
            {REPORT_MENU_ITEMS.map((item) => {
              const isSelected = selectedReport === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectReport(item.id)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: isSelected ? 'var(--color-primary-500)' : 'transparent',
                    color: isSelected ? '#ffffff' : 'var(--color-text-primary)',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 500,
                    fontSize: '14px',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.15)' : 'none',
                  }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </VStack>

          {['cashflow_statement', 'income_statement', 'balance_sheet'].includes(selectedReport) && (
            <VStack
              gap={2}
              style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--color-border-primary)',
              }}
            >
              <Heading level={4}>
                {selectedReport === 'balance_sheet' ? 'Filter Posisi Neraca' : 'Filter Periode Tanggal'}
              </Heading>

              {selectedReport !== 'balance_sheet' && (
                <div>
                  <Text type="supporting">Mulai Tanggal</Text>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md, 6px)',
                      border: '1px solid var(--color-border-primary)',
                      backgroundColor: 'var(--color-background-primary)',
                      color: 'var(--color-text-primary)',
                      marginTop: '4px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <div>
                <Text type="supporting">
                  {selectedReport === 'balance_sheet' ? 'Posisi Per Tanggal' : 'Sampai Tanggal'}
                </Text>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md, 6px)',
                    border: '1px solid var(--color-border-primary)',
                    backgroundColor: 'var(--color-background-primary)',
                    color: 'var(--color-text-primary)',
                    marginTop: '4px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    onStartDateChange('');
                    onEndDateChange('');
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    background: 'transparent',
                    border: '1px dashed var(--color-border-primary)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginTop: '4px',
                  }}
                >
                  🔄 Reset Filter
                </button>
              )}

              {['income_statement', 'balance_sheet'].includes(selectedReport) && (
                <div
                  style={{
                    marginTop: '8px',
                    paddingTop: '10px',
                    borderTop: '1px dashed var(--color-border-primary)',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={hideZeroBalance}
                      onChange={(e) => onHideZeroBalanceChange(e.target.checked)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <span style={{ fontWeight: 500 }}>Sembunyikan Saldo Nol</span>
                  </label>
                  <Text
                    type="supporting"
                    color="secondary"
                    style={{ fontSize: '11px', marginTop: '3px', display: 'block' }}
                  >
                    {hideZeroBalance ? '✓ Akun Rp 0 disembunyikan' : 'Seluruh bagan akun ditampilkan'}
                  </Text>
                </div>
              )}
            </VStack>
          )}

          {selectedReport === 'revenue_projection' && (
            <VStack
              gap={2}
              style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--color-border-primary)',
              }}
            >
              <Heading level={4}>Filter Tahun Proyeksi</Heading>
              <Selector
                label="Pilih Tahun Anggaran"
                size="sm"
                value={projectionYear}
                onChange={onProjectionYearChange}
                options={[-1, 0, 1, 2].map((offset) => {
                  const yr = (currentYear + offset).toString();
                  return { value: yr, label: yr };
                })}
              />
            </VStack>
          )}
        </VStack>
      </Card>
    </div>
  );
}

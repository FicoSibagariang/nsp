'use client';

import { useState, useEffect, useCallback } from 'react';
import { DialogHeader } from '@astryxdesign/core/Dialog';
import {
  Layout,
  LayoutContent,
  LayoutFooter,
  HStack,
  VStack,
} from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Icon } from '@astryxdesign/core/Icon';
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import { apiFetch } from '../config';
import { formatRp } from '../utils/format';
import {
  getIndonesianMonthName,
  exportLoanPayrollDeductionsToExcel,
  type LoanPayrollDeductionExportItem,
} from '../utils/exportUtils';
import { useDemoMode } from '../contexts/DemoModeContext';
import { maskName, maskNip } from '../utils/privacyMask';

interface DeductionItem {
  employeeId: string;
  name: string;
  memberId: string;
  loanCount: number;
  amount: number;
  principalAmount: number;
  interestAmount: number;
  currentAmount: number;
  newAmount: number;
  note: string;
}

interface DeductionResponse {
  month: string;
  startDate: string;
  endDate: string;
  totalEmployees: number;
  totalAmount: number;
  items: DeductionItem[];
}

interface Props {
  onClose: () => void;
}

export function LoanPayrollDeductionDialogContent({ onClose }: Props) {
  const { isDemoMode } = useDemoMode();
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [data, setData] = useState<DeductionResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeductions = useCallback(async (selectedMonth: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/loans/payroll-deductions?month=${encodeURIComponent(selectedMonth)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.message || 'Gagal memuat data potongan payroll');
      }
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat memuat data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeductions(month);
  }, [month, fetchDeductions]);

  const handleDownload = () => {
    if (!data || data.items.length === 0) return;

    const [yearStr, monthStr] = month.split('-');
    const monthNum = parseInt(monthStr, 10);
    const monthName = getIndonesianMonthName(monthNum);
    const filename = `potong_gaji_angsuran_${monthName}_${yearStr}.xlsx`;

    const exportItems: LoanPayrollDeductionExportItem[] = data.items.map((it) => ({
      employeeId: isDemoMode ? maskNip(it.memberId || it.employeeId, it.employeeId) : it.employeeId,
      name: isDemoMode ? maskName(it.memberId || it.employeeId, it.name) : it.name,
      currentAmount: 0,
      newAmount: it.newAmount,
      note: it.note || '',
    }));

    exportLoanPayrollDeductionsToExcel(exportItems, filename);
  };

  const totalEmployees = data?.totalEmployees || 0;
  const totalAmount = data?.totalAmount || 0;

  return (
    <Layout
      header={
        <DialogHeader
          title="Ekspor Potong Gaji Angsuran (HRIS)"
          subtitle="Unduh berkas rekap potongan gaji angsuran pinjaman koperasi untuk diimpor ke sistem HRIS / Payroll."
          onOpenChange={() => onClose()}
        />
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={4}>
            {/* Filter Periode Bulan */}
            <HStack justify="space-between" vAlign="center" wrap="wrap" gap={2}>
              <HStack gap={2} vAlign="center">
                <Text type="supporting" weight="medium">
                  Periode Jatuh Tempo:
                </Text>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--color-border-primary)',
                    backgroundColor: 'var(--color-background-primary)',
                    color: 'var(--color-text-primary)',
                    fontSize: 13,
                  }}
                />
              </HStack>
              {data && (
                <Text type="supporting" color="secondary">
                  Rentang: {data.startDate} s/d {data.endDate}
                </Text>
              )}
            </HStack>

            {/* Summary Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
              }}
            >
              <Card style={{ padding: 14 }}>
                <VStack gap={1}>
                  <Text type="supporting" color="secondary">
                    Total Karyawan / Peminjam
                  </Text>
                  <Heading level={3}>{totalEmployees} Orang</Heading>
                </VStack>
              </Card>
              <Card style={{ padding: 14, backgroundColor: 'var(--color-background-secondary)' }}>
                <VStack gap={1}>
                  <Text type="supporting" color="secondary">
                    Total Potongan Angsuran
                  </Text>
                  <Heading level={3} color="primary">
                    {formatRp(totalAmount)}
                  </Heading>
                </VStack>
              </Card>
            </div>

            {/* Content Area */}
            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '36px 0' }}>
                <Spinner size="md" />
              </div>
            ) : error ? (
              <Card style={{ padding: 16, backgroundColor: 'var(--color-critical-50, #fef2f2)' }}>
                <Text color="critical">{error}</Text>
              </Card>
            ) : totalEmployees === 0 ? (
              <Card style={{ padding: 24, textAlign: 'center' }}>
                <Text type="supporting" color="secondary">
                  Tidak ada jadwal angsuran pinjaman yang jatuh tempo pada periode bulan yang dipilih.
                </Text>
              </Card>
            ) : (
              <VStack gap={2}>
                <HStack justify="space-between" vAlign="center">
                  <Text type="supporting" weight="semibold">
                    Pratinjau Data Template HRIS ({totalEmployees} baris)
                  </Text>
                  <Text type="supporting" color="secondary">
                    Format: Employee ID | Name | Current Amount | New Amount | Note
                  </Text>
                </HStack>

                <div
                  style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    border: '1px solid var(--color-border-primary)',
                    borderRadius: 8,
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 13,
                      textAlign: 'left',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: 'var(--color-background-subtle, #f9fafb)',
                          borderBottom: '1px solid var(--color-border-primary)',
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Employee ID</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Name</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Pinjaman</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>New Amount (Rp)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.items.map((it) => {
                        const displayName = isDemoMode
                          ? maskName(it.memberId || it.employeeId, it.name)
                          : it.name;
                        const displayNip = isDemoMode
                          ? maskNip(it.memberId || it.employeeId, it.employeeId)
                          : it.employeeId;

                        return (
                          <tr
                            key={it.memberId || it.employeeId}
                            style={{ borderBottom: '1px solid var(--color-border-primary)' }}
                          >
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                              {displayNip || '-'}
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                              {displayName}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                              {it.loanCount} pinjaman
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                              {formatRp(it.newAmount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </VStack>
            )}
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <HStack gap={2} hAlign="end">
            <Button label="Tutup" variant="secondary" onClick={onClose} />
            <Button
              label="Unduh Berkas XLSX"
              variant="primary"
              icon={<Icon icon={DocumentArrowDownIcon} size="sm" />}
              disabled={isLoading || totalEmployees === 0}
              onClick={handleDownload}
            />
          </HStack>
        </LayoutFooter>
      }
    />
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { api } from '../services/api';
import { formatRp } from '../utils/format';
import {
  getIndonesianMonthName,
  exportLoanPayrollDeductionsToExcel,
  type LoanPayrollDeductionExportItem,
} from '../utils/exportUtils';
import { useDemoMode } from '../contexts/DemoModeContextDef';
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
  totalPrincipal?: number;
  totalInterest?: number;
  totalSchedules?: number;
  paidCount?: number;
  unpaidCount?: number;
  isSettled?: boolean;
  settledAt?: string | null;
  items: DeductionItem[];
}

interface Props {
  onClose: () => void;
}

export function LoanPayrollDeductionDialogContent({ onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDemoMode } = useDemoMode();
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [data, setData] = useState<DeductionResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [transactionDate, setTransactionDate] = useState<string>('');
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleSuccessMsg, setSettleSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const [yearStr, monthStr] = month.split('-');
    if (yearStr && monthStr) {
      const lastDay = new Date(Number(yearStr), Number(monthStr), 0).getDate();
      setTransactionDate(`${month}-${String(lastDay).padStart(2, '0')}`);
    }
    setSettleSuccessMsg(null);
    setSettleError(null);
  }, [month]);

  const fetchDeductions = useCallback(async (selectedMonth: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<DeductionResponse>(
        `/api/loans/payroll-deductions?month=${encodeURIComponent(selectedMonth)}`
      );
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data potongan payroll');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeductions(month);
  }, [month, fetchDeductions]);

  const handleSettle = async () => {
    setIsSettling(true);
    setSettleError(null);
    try {
      const res: any = await api.post('/api/loans/payroll/settle', {
        periodMonth: month,
        transactionDate: transactionDate || undefined,
      });
      setIsConfirmOpen(false);
      setSettleSuccessMsg(res?.message || `Pelunasan payroll periode ${month} berhasil dibukukan!`);
      await fetchDeductions(month);
    } catch (err: any) {
      setSettleError(err?.message || 'Gagal memproses pelunasan payroll pinjaman');
    } finally {
      setIsSettling(false);
    }
  };

  // Synchronous download matching /ewa export mechanism directly in user click gesture
  const handleDownload = (e?: React.MouseEvent) => {
    if (!data?.items || data.items.length === 0) return;

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

    const target = (e?.currentTarget as HTMLElement) || containerRef.current || undefined;
    exportLoanPayrollDeductionsToExcel(exportItems, filename, target);
  };

  const totalEmployees = data?.totalEmployees || 0;
  const totalAmount = data?.totalAmount || 0;
  const calculatedPrincipal =
    data?.totalPrincipal ??
    data?.items.reduce((sum, it) => sum + (it.principalAmount || 0), 0) ??
    0;
  const calculatedInterest =
    data?.totalInterest ??
    data?.items.reduce((sum, it) => sum + (it.interestAmount || 0), 0) ??
    0;

  return (
    <div ref={containerRef} style={{ display: 'contents' }}>
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
            {/* Status Lunas Badge */}
            {data?.isSettled && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  backgroundColor: 'var(--color-background-success-subtle, #ecfdf5)',
                  border: '1px solid var(--color-success-500, #10b981)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <Text weight="semibold" style={{ color: 'var(--color-success-700, #047857)' }}>
                  ✅ Angsuran Payroll Periode Ini Sudah Lunas Dibukukan
                </Text>
                {data.settledAt && (
                  <Text type="supporting" style={{ color: 'var(--color-success-700, #047857)', fontSize: 12 }}>
                    Dibukukan: {new Date(data.settledAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                )}
              </div>
            )}

            {/* Notification message */}
            {settleSuccessMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 6,
                  backgroundColor: 'var(--color-background-success-subtle, #ecfdf5)',
                  border: '1px solid var(--color-success-500, #10b981)',
                  color: 'var(--color-success-700, #047857)',
                  fontSize: 13,
                }}
              >
                {settleSuccessMsg}
              </div>
            )}

            {/* Filter Periode Bulan */}
            <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
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
              <Card style={{ padding: 16, backgroundColor: 'var(--color-critical-50)' }}>
                <VStack gap={2}>
                  <Text style={{ color: 'var(--color-text-error)' }} weight="medium">
                    Gagal memuat pratinjau potongan payroll
                  </Text>
                  <Text type="supporting" style={{ color: 'var(--color-text-error)' }}>
                    {error}
                  </Text>
                  <HStack justify="end">
                    <Button
                      size="sm"
                      label="Coba Lagi"
                      variant="secondary"
                      onClick={() => fetchDeductions(month)}
                    />
                  </HStack>
                </VStack>
              </Card>
            ) : totalEmployees === 0 ? (
              <Card style={{ padding: 24, textAlign: 'center' }}>
                <Text type="supporting" color="secondary">
                  Tidak ada jadwal angsuran pinjaman yang jatuh tempo pada periode bulan yang dipilih.
                </Text>
              </Card>
            ) : (
              <VStack gap={2}>
                <HStack justify="between" vAlign="center">
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
                          backgroundColor: 'var(--color-background-subtle)',
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
              variant="secondary"
              icon={<Icon icon={DocumentArrowDownIcon} size="sm" />}
              isDisabled={isLoading || !data || data.items.length === 0}
              onClick={(e) => handleDownload(e)}
            />
            {!data?.isSettled && totalEmployees > 0 && (
              <Button
                label="Bukukan Pelunasan Angsuran Payroll Dari Perusahaan"
                variant="primary"
                isDisabled={isLoading || isSettling}
                onClick={() => {
                  setSettleError(null);
                  setIsConfirmOpen(true);
                }}
              />
            )}
          </HStack>
        </LayoutFooter>
      }
    />

    {/* Confirmation Modal */}
    {isConfirmOpen && (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <Card
          style={{
            width: '100%',
            maxWidth: 520,
            backgroundColor: 'var(--color-background-primary, #ffffff)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            borderRadius: 12,
            padding: 24,
          }}
        >
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={3}>Konfirmasi Pelunasan Angsuran Payroll</Heading>
              <Text type="supporting" color="secondary">
                Sistem akan membukukan pelunasan seluruh jadwal angsuran pinjaman periode {month} ke rekening Bank Mandiri dan mencatat jurnal akuntansi secara otomatis.
              </Text>
            </VStack>

            {settleError && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  backgroundColor: 'var(--color-background-danger-subtle, #fef2f2)',
                  border: '1px solid var(--color-critical-500, #ef4444)',
                  color: 'var(--color-text-error, #dc2626)',
                  fontSize: 13,
                }}
              >
                {settleError}
              </div>
            )}

            {/* Tanggal Transaksi Jurnal */}
            <VStack gap={1}>
              <Text weight="medium" style={{ fontSize: 13 }}>
                Tanggal Transaksi Pembukuan / Jurnal:
              </Text>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--color-border-primary)',
                  backgroundColor: 'var(--color-background-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 13,
                }}
              />
            </VStack>

            {/* Ringkasan Nominal */}
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                backgroundColor: 'var(--color-background-secondary, #f8fafc)',
                border: '1px solid var(--color-border-primary, #e2e8f0)',
              }}
            >
              <VStack gap={2}>
                <HStack justify="between">
                  <Text type="supporting" color="secondary">Total Peminjam:</Text>
                  <Text weight="medium">{totalEmployees} Orang</Text>
                </HStack>
                <HStack justify="between">
                  <Text type="supporting" color="secondary">Akumulasi Pokok Pinjaman:</Text>
                  <Text weight="medium">{formatRp(calculatedPrincipal)}</Text>
                </HStack>
                <HStack justify="between">
                  <Text type="supporting" color="secondary">Akumulasi Jasa / Bunga Pinjaman:</Text>
                  <Text weight="medium">{formatRp(calculatedInterest)}</Text>
                </HStack>
                <div style={{ height: 1, backgroundColor: 'var(--color-border-primary, #e2e8f0)', margin: '4px 0' }} />
                <HStack justify="between">
                  <Text weight="semibold">Grand Total Pembukuan (Debit Bank):</Text>
                  <Heading level={3} color="primary">{formatRp(totalAmount)}</Heading>
                </HStack>
              </VStack>
            </div>

            <HStack gap={2} justify="end">
              <Button
                label="Batal"
                variant="secondary"
                isDisabled={isSettling}
                onClick={() => setIsConfirmOpen(false)}
              />
              <Button
                label={isSettling ? "Memproses..." : "Konfirmasi & Bukukan Pelunasan"}
                variant="primary"
                isDisabled={isSettling || totalEmployees === 0}
                onClick={handleSettle}
              />
            </HStack>
          </VStack>
        </Card>
      </div>
    )}
  </div>
);
}

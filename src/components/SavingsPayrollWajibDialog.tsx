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
import { Table, proportional } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { api } from '../services/api';
import { formatRp } from '../utils/format';
import { useDemoMode } from '../contexts/DemoModeContextDef';
import { maskName } from '../utils/privacyMask';

export interface PendingSavingsMember extends Record<string, unknown> {
  id: string;
  name: string;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  totalSavings: number;
}

export interface SavingsPayrollWajibRecap {
  periodMonth: string;
  totalActiveMembers: number;
  defaultAmountPerMember: number;
  alreadyPaidCount: number;
  pendingCount: number;
  totalPendingAmount: number;
  isSettled: boolean;
  settledAt: string | null;
  pendingMembers: PendingSavingsMember[];
}

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

export function SavingsPayrollWajibDialogContent({ onClose, onSuccess }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDemoMode } = useDemoMode();
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [data, setData] = useState<SavingsPayrollWajibRecap | null>(null);
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
    setIsConfirmOpen(false);
  }, [month]);

  const fetchRecap = useCallback(async (selectedMonth: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<SavingsPayrollWajibRecap>(
        `/api/v1/savings/payroll/recap-wajib?month=${encodeURIComponent(selectedMonth)}`
      );
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat rekap simpanan wajib payroll');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecap(month);
  }, [month, fetchRecap]);

  const handleSettle = async () => {
    setIsSettling(true);
    setSettleError(null);
    try {
      const res: any = await api.post('/api/v1/savings/payroll/settle-wajib', {
        periodMonth: month,
        transactionDate: transactionDate || undefined,
      });
      setIsConfirmOpen(false);
      setSettleSuccessMsg(
        res?.message ||
          `Setoran simpanan wajib payroll periode ${month} berhasil dibukukan!`
      );
      await fetchRecap(month);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setSettleError(err?.message || 'Gagal membukukan simpanan wajib payroll');
    } finally {
      setIsSettling(false);
    }
  };

  const pendingMembers = data?.pendingMembers || [];
  const defaultAmount = data?.defaultAmountPerMember || 50000;

  const columns: TableColumn<PendingSavingsMember>[] = [
    {
      key: 'id',
      header: 'ID / NIK',
      width: proportional(2),
      renderCell: (m: PendingSavingsMember) => <Text type="supporting" weight="medium">{m.id.substring(0, 8)}</Text>,
    },
    {
      key: 'name',
      header: 'Nama Anggota',
      width: proportional(4),
      renderCell: (m: PendingSavingsMember) => (
        <Text weight="medium">
          {isDemoMode ? maskName(m.id, m.name) : m.name}
        </Text>
      ),
    },
    {
      key: 'simpananWajib',
      header: 'Simpanan Wajib Saat Ini',
      width: proportional(3),
      renderCell: (m: PendingSavingsMember) => <Text>{formatRp(m.simpananWajib)}</Text>,
    },
    {
      key: 'setoranPeriodeIni',
      header: 'Setoran Periode Ini',
      width: proportional(3),
      renderCell: () => (
        <Text weight="semibold" style={{ color: 'var(--color-primary-600, #2563eb)' }}>
          + {formatRp(defaultAmount)}
        </Text>
      ),
    },
    {
      key: 'totalSavings',
      header: 'Total Simpanan Setelahnya',
      width: proportional(3),
      renderCell: (m: PendingSavingsMember) => <Text weight="semibold">{formatRp(m.totalSavings + defaultAmount)}</Text>,
    },
  ];

  return (
    <div ref={containerRef} style={{ display: 'contents' }}>
      <Layout
        header={
          <DialogHeader
            title="Rekap & Pembukuan Simpanan Wajib Payroll"
            subtitle="Pola 1-Klik pembukuan setoran simpanan wajib rutin bulanan anggota dari pemotongan payroll ke kas dan jurnal akuntansi."
            onOpenChange={() => onClose()}
          />
        }
        content={
          <LayoutContent padding={4}>
            <VStack gap={4}>
              {/* Settled indicator */}
              {data?.isSettled && (
                <div
                  data-testid="settled-indicator"
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
                    ✅ Simpanan Wajib Periode Ini Sudah Lengkap Dibukukan
                  </Text>
                  {data.settledAt && (
                    <Text type="supporting" style={{ color: 'var(--color-success-700, #047857)', fontSize: 12 }}>
                      Dibukukan: {new Date(data.settledAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  )}
                </div>
              )}

              {/* Success notification */}
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

              {/* Month selector */}
              <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                <HStack gap={2} vAlign="center">
                  <Text type="supporting" weight="medium">
                    Periode Bulan:
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
                    Nominal Wajib: {formatRp(data.defaultAmountPerMember)} / anggota
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
                    <Text type="supporting" color="secondary">Total Anggota Aktif</Text>
                    <Heading level={3}>{data ? data.totalActiveMembers : '-'}</Heading>
                  </VStack>
                </Card>
                <Card style={{ padding: 14 }}>
                  <VStack gap={1}>
                    <Text type="supporting" color="secondary">Sudah Setor</Text>
                    <Heading level={3} style={{ color: 'var(--color-success-600, #16a34a)' }}>
                      {data ? `${data.alreadyPaidCount} orang` : '-'}
                    </Heading>
                  </VStack>
                </Card>
                <Card style={{ padding: 14 }}>
                  <VStack gap={1}>
                    <Text type="supporting" color="secondary">Belum Dibukukan</Text>
                    <Heading
                      level={3}
                      style={{
                        color: (data?.pendingCount || 0) > 0 ? 'var(--color-warning-600, #d97706)' : undefined,
                      }}
                    >
                      {data ? `${data.pendingCount} orang` : '-'}
                    </Heading>
                  </VStack>
                </Card>
                <Card style={{ padding: 14 }}>
                  <VStack gap={1}>
                    <Text type="supporting" color="secondary">Total Tagihan Belum Setor</Text>
                    <Heading level={3} style={{ color: 'var(--color-primary-600, #2563eb)' }}>
                      {data ? formatRp(data.totalPendingAmount) : '-'}
                    </Heading>
                  </VStack>
                </Card>
              </div>

              {/* Settlement Card / Actions */}
              {data && !data.isSettled && data.pendingCount > 0 && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    backgroundColor: 'var(--color-background-secondary, #f8fafc)',
                    border: '1px solid var(--color-border-primary, #e2e8f0)',
                  }}
                >
                  {!isConfirmOpen ? (
                    <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
                      <VStack gap={1}>
                        <Text weight="semibold">Siap Bukukan Simpanan Wajib Payroll Periode {month}</Text>
                        <Text type="supporting" color="secondary">
                          Terdapat {data.pendingCount} anggota aktif yang belum dibukukan simpanan wajibnya ({formatRp(data.totalPendingAmount)}).
                        </Text>
                      </VStack>
                      <Button
                        variant="primary"
                        label={`Bukukan Setoran Simpanan Wajib (${formatRp(data.totalPendingAmount)})`}
                        onClick={() => setIsConfirmOpen(true)}
                      />
                    </HStack>
                  ) : (
                    <VStack gap={3}>
                      <Heading level={4}>Konfirmasi Pembukuan Simpanan Wajib Payroll</Heading>
                      <Text type="supporting">
                        Sistem akan memproses <strong>{data.pendingCount} anggota</strong> aktif, menambahkan saldo simpanan wajib sebesar <strong>{formatRp(data.defaultAmountPerMember)}</strong> per anggota, mencatat mutasi <code>setor_wajib</code>, dan mencatat jurnal akuntansi seimbang otomatis:
                      </Text>
                      <div
                        style={{
                          padding: '10px 14px',
                          backgroundColor: 'var(--color-background-primary, #ffffff)',
                          borderRadius: 6,
                          border: '1px solid var(--color-border-secondary, #cbd5e1)',
                          fontSize: 13,
                        }}
                      >
                        <div>• [DEBIT] 11102 - Bank Mandiri: <strong>{formatRp(data.totalPendingAmount)}</strong></div>
                        <div>• [KREDIT] 31102 - Simpanan Wajib: <strong>{formatRp(data.totalPendingAmount)}</strong></div>
                      </div>

                      <HStack gap={3} vAlign="center" wrap="wrap">
                        <HStack gap={2} vAlign="center">
                          <Text type="supporting" weight="medium">
                            Tanggal Efektif Pembukuan:
                          </Text>
                          <input
                            type="date"
                            value={transactionDate}
                            onChange={(e) => setTransactionDate(e.target.value)}
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
                      </HStack>

                      {settleError && (
                        <div
                          style={{
                            padding: '8px 12px',
                            borderRadius: 6,
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            fontSize: 13,
                          }}
                        >
                          {settleError}
                        </div>
                      )}

                      <HStack gap={2}>
                        <Button
                          variant="primary"
                          label={isSettling ? 'Sedang Memproses...' : `Ya, Konfirmasi & Bukukan (${formatRp(data.totalPendingAmount)})`}
                          isDisabled={isSettling}
                          onClick={handleSettle}
                        />
                        <Button
                          variant="ghost"
                          label="Batal"
                          isDisabled={isSettling}
                          onClick={() => setIsConfirmOpen(false)}
                        />
                      </HStack>
                    </VStack>
                  )}
                </div>
              )}

              {/* Pending members table */}
              <VStack gap={2}>
                <Heading level={4}>
                  Daftar Anggota Belum Menyetor ({pendingMembers.length})
                </Heading>
                {isLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                    <Spinner size="lg" />
                  </div>
                ) : error ? (
                  <div style={{ color: '#ef4444', padding: 16 }}>{error}</div>
                ) : pendingMembers.length === 0 ? (
                  <div
                    style={{
                      padding: 24,
                      textAlign: 'center',
                      borderRadius: 8,
                      border: '1px dashed var(--color-border-primary)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Tidak ada anggota yang tertunggak untuk periode ini. Semua anggota aktif sudah melunasi simpanan wajib.
                  </div>
                ) : (
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    <Table<PendingSavingsMember>
                      columns={columns}
                      data={pendingMembers}
                      idKey="id"
                    />
                  </div>
                )}
              </VStack>
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider padding={4}>
            <HStack justify="end">
              <Button variant="ghost" label="Tutup" onClick={onClose} />
            </HStack>
          </LayoutFooter>
        }
      />
    </div>
  );
}

import React, { useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Heading, Text } from '@astryxdesign/core/Text';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Spinner } from '@astryxdesign/core/Spinner';
import { getEwaPaycycleDates } from '../../../utils/exportUtils';
import { getDefaultSettleDate } from '../utils';
import { apiFetch } from '../../../config';
import type { PayrollRecapData } from '../types';

interface PayrollTabProps {
  payrollMonth: string;
  handlePayrollMonthChange: (month: string) => void;
  payrollRecap: PayrollRecapData | null;
  payrollLoading: boolean;
  formatRp: (val: number) => string;
  isDemoMode: boolean;
  maskNip: (id: string, nip: string) => string;
  maskName: (id: string, name: string) => string;
  onPayrollSettled: (message: string) => void;
  onError: (message: string) => void;
}

export function PayrollTab({
  payrollMonth,
  handlePayrollMonthChange,
  payrollRecap,
  payrollLoading,
  formatRp,
  isDemoMode,
  maskNip,
  maskName,
  onPayrollSettled,
  onError,
}: PayrollTabProps) {
  const [settleDate, setSettleDate] = useState<string>(() => getDefaultSettleDate(payrollMonth));
  const [settleLoading, setSettleLoading] = useState(false);

  const onMonthChange = (newMonth: string) => {
    handlePayrollMonthChange(newMonth);
    setSettleDate(getDefaultSettleDate(newMonth));
  };

  const handleSettlePayroll = async () => {
    if (!payrollRecap || payrollRecap.totalEmployees === 0) return;
    const effectiveDate = settleDate || getDefaultSettleDate(payrollMonth);
    if (
      !confirm(
        `Konfirmasi pembukuan pelunasan payroll periode ${payrollMonth} sebesar ${formatRp(
          payrollRecap.totalDeduction
        )} dengan tanggal transaksi jurnal ${effectiveDate}? Seluruh tagihan piutang EWA periode ini akan ditutup lunas.`
      )
    ) {
      return;
    }
    setSettleLoading(true);
    try {
      const res = await apiFetch('/api/v1/ewa/payroll/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodMonth: payrollMonth,
          transactionDate: effectiveDate,
        }),
      });
      const data = await res.json();

      if (data.success) {
        onPayrollSettled(data.message || 'Pelunasan payroll berhasil dibukukan!');
      } else {
        onError(data.message || 'Gagal memproses pelunasan payroll');
      }
    } catch (err: any) {
      onError(err?.message || 'Terjadi kesalahan jaringan');
    } finally {
      setSettleLoading(false);
    }
  };

  return (
    <VStack gap={4}>
      <Card>
        <VStack gap={4}>
          <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
            <VStack gap={1}>
              <Heading level={4}>Rekap Tagihan Potongan Gaji ke HRD</Heading>
              <Text type="supporting" color="secondary">
                Rekapitulasi total dana kasbon & fee yang wajib dipotong dari slip gaji karyawan periode ini (Siklus Cut-off: {getEwaPaycycleDates(payrollMonth).label})
              </Text>
            </VStack>

            <HStack gap={3} vAlign="center">
              <Text type="supporting">Pilih Periode:</Text>
              <input
                type="month"
                value={payrollMonth}
                onChange={(e) => onMonthChange(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--color-border-primary)',
                  backgroundColor: 'var(--color-background-primary)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </HStack>
          </HStack>

          {/* Summary Metric Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            <Card style={{ padding: 16 }}>
              <VStack gap={1}>
                <Text type="supporting">Total Karyawan Menggunakan EWA</Text>
                <Heading level={3}>{payrollRecap?.totalEmployees || 0} Orang</Heading>
              </VStack>
            </Card>
            <Card style={{ padding: 16 }}>
              <VStack gap={1}>
                <Text type="supporting">Total Pokok Kasbon EWA</Text>
                <Heading level={3}>{formatRp(payrollRecap?.totalDisbursed || 0)}</Heading>
              </VStack>
            </Card>
            <Card style={{ padding: 16 }}>
              <VStack gap={1}>
                <Text type="supporting">Total Fee Administrasi EWA</Text>
                <Heading level={3} color="primary">{formatRp(payrollRecap?.totalFee || 0)}</Heading>
              </VStack>
            </Card>
            <Card style={{ padding: 16, backgroundColor: 'var(--color-background-secondary)' }}>
              <VStack gap={1}>
                <Text type="supporting">Total Tagihan Potong Payroll</Text>
                <Heading level={3} color="primary">{formatRp(payrollRecap?.totalDeduction || 0)}</Heading>
              </VStack>
            </Card>
          </div>

          {payrollLoading ? (
            <Spinner size="md" />
          ) : payrollRecap?.items && payrollRecap.items.length > 0 ? (
            <VStack gap={4}>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '14px',
                    textAlign: 'left',
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border-primary)' }}>
                      <th style={{ padding: '10px 12px' }}>NIP</th>
                      <th style={{ padding: '10px 12px' }}>Nama Karyawan</th>
                      <th style={{ padding: '10px 12px' }}>Status Anggota</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Kasbon EWA</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Transaksi</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Fee Layanan</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Potong Gaji</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollRecap.items.map((it: any) => (
                      <tr key={it.employeeId} style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                        <td style={{ padding: '10px 12px' }}>{isDemoMode ? maskNip(it.employeeId, it.nip) : it.nip}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{isDemoMode ? maskName(it.employeeId, it.name) : it.name}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge variant={it.isMember ? 'success' : 'neutral'} label={it.isMember ? 'Anggota' : 'Non-Anggota'} />
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatRp(it.totalAdvances)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>{it.txCount ? `${it.txCount}x` : '1x'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatRp(it.totalFee)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold' }}>
                          {formatRp(it.totalDeduction)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <HStack justify="end" gap={3} vAlign="center" wrap="wrap">
                {payrollRecap.isSettled || (payrollRecap as any).isFullySettled ? (
                  <Badge variant="success" label="✅ Periode Ini Sudah Lunas Payroll" />
                ) : (
                  <>
                    <HStack gap={2} vAlign="center">
                      <Text type="supporting" weight="medium">
                        Tanggal Transaksi:
                      </Text>
                      <input
                        type="date"
                        value={settleDate}
                        onChange={(e) => setSettleDate(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--color-border-primary)',
                          backgroundColor: 'var(--color-background-primary)',
                          color: 'var(--color-text-primary)',
                          fontSize: '13px',
                        }}
                      />
                    </HStack>
                    <Button
                      label={settleLoading ? 'Memproses...' : 'Bukukan Pelunasan Payroll Dari Perusahaan'}
                      variant="primary"
                      isDisabled={settleLoading || !settleDate}
                      onClick={handleSettlePayroll}
                    />
                  </>
                )}
              </HStack>
            </VStack>
          ) : (
            <Text type="supporting" color="secondary">
              Tidak ada tagihan penarikan EWA untuk periode {payrollMonth}.
            </Text>
          )}
        </VStack>
      </Card>
    </VStack>
  );
}

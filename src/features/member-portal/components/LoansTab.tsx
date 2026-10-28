import React, { useMemo } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { formatRp } from '../../../utils/format';
import type { PortalLoan, ScheduleRow, PaymentRow } from '../types';

interface LoansTabProps {
  loans: PortalLoan[];
  selectedLoan: PortalLoan | null;
  setSelectedLoan: (loan: PortalLoan | null) => void;
  schedule: ScheduleRow[];
  scheduleLoading: boolean;
  payments: PaymentRow[];
  paymentsLoading: boolean;
  loadSchedule: (loan: PortalLoan) => void;
  setSchedule: (sched: ScheduleRow[]) => void;
}

export const LoansTab: React.FC<LoansTabProps> = ({
  loans,
  selectedLoan,
  setSelectedLoan,
  schedule,
  scheduleLoading,
  payments,
  paymentsLoading,
  loadSchedule,
  setSchedule,
}) => {
  const remainingOnSchedule = useMemo(() => {
    return schedule.reduce((sum, row) => {
      const due =
        Number(row.principalAmount || 0) +
        Number(row.interestAmount || 0) +
        Number(row.lateFee || 0);
      const paid = Number(row.paidAmount || 0);
      return sum + Math.max(0, due - paid);
    }, 0);
  }, [schedule]);

  const scheduleCols: TableColumn<ScheduleRow>[] = useMemo(
    () => [
      {
        key: 'installmentNo',
        header: 'Cicilan',
        width: pixel(80),
        renderCell: (i) => <Text type="body">#{i.installmentNo}</Text>,
      },
      {
        key: 'dueDate',
        header: 'Jatuh Tempo',
        width: pixel(120),
        renderCell: (i) => (
          <Text type="body">{new Date(i.dueDate).toLocaleDateString('id-ID')}</Text>
        ),
      },
      {
        key: 'principalAmount',
        header: 'Pokok',
        width: pixel(110),
        renderCell: (i) => formatRp(i.principalAmount),
      },
      {
        key: 'interestAmount',
        header: 'Biaya Admin',
        width: pixel(110),
        renderCell: (i) => formatRp(i.interestAmount),
      },
      {
        key: 'paidAmount',
        header: 'Sudah Bayar',
        width: pixel(120),
        renderCell: (i) => formatRp(i.paidAmount || 0),
      },
      {
        key: 'status',
        header: 'Status',
        width: pixel(100),
        renderCell: (i) => {
          const variant =
            i.status === 'Paid' ? 'success' : i.status === 'Late' ? 'error' : 'neutral';
          const label =
            i.status === 'Paid' ? 'Lunas' : i.status === 'Late' ? 'Terlambat' : 'Belum';
          return <Badge variant={variant} label={label} />;
        },
      },
    ],
    []
  );

  const paymentCols: TableColumn<PaymentRow>[] = useMemo(
    () => [
      {
        key: 'paymentDate',
        header: 'Tanggal Bayar',
        width: pixel(160),
        renderCell: (p) => (
          <Text type="body">
            {p.paymentDate
              ? new Date(p.paymentDate).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })
              : '—'}
          </Text>
        ),
      },
      {
        key: 'amount',
        header: 'Jumlah Bayar',
        width: pixel(160),
        renderCell: (p) => (
          <Text type="body" weight="semibold" style={{ color: 'var(--color-text-success)' }}>
            {formatRp(p.amount)}
          </Text>
        ),
      },
      {
        key: 'method',
        header: 'Metode Pembayaran',
        width: pixel(140),
        renderCell: (p) => <Badge variant="neutral" label={p.method || 'Transfer'} />,
      },
    ],
    []
  );

  const loanCols: TableColumn<PortalLoan>[] = [
    {
      key: 'createdAt',
      header: 'Tgl Pengajuan',
      width: pixel(120),
      renderCell: (i) => new Date(i.createdAt).toLocaleDateString('id-ID'),
    },
    { key: 'purpose', header: 'Keperluan', width: proportional(1) },
    {
      key: 'amount',
      header: 'Pokok',
      width: pixel(120),
      renderCell: (i) => formatRp(i.amount),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(140),
      renderCell: (i) => {
        const statusMap: Record<string, { variant: 'success' | 'warning' | 'error' | 'neutral'; label: string }> = {
          Disetujui: { variant: 'success', label: 'Disetujui' },
          Lunas: { variant: 'success', label: 'Lunas' },
          Menunggu: { variant: 'warning', label: 'Menunggu' },
          Ditolak: { variant: 'error', label: 'Ditolak' },
          Macet: { variant: 'error', label: 'Macet' },
        };
        const s = statusMap[i.status] || { variant: 'neutral', label: i.status };
        return (
          <VStack gap={1}>
            <Badge variant={s.variant} label={s.label} />
            {i.status === 'Ditolak' && i.rejectionReason && (
              <Text
                type="supporting"
                style={{ color: 'var(--color-text-error)', fontSize: 11, wordBreak: 'break-word', maxWidth: 160 }}
              >
                Alasan: {i.rejectionReason}
              </Text>
            )}
          </VStack>
        );
      },
    },
    {
      key: 'attachment',
      header: 'Lampiran',
      width: pixel(110),
      renderCell: (i) =>
        i.attachmentUrl ? (
          <Button
            label="📎 Buka"
            size="sm"
            variant="secondary"
            onClick={() => window.open(i.attachmentUrl!, '_blank')}
          />
        ) : (
          <Text type="supporting" color="secondary">—</Text>
        ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      width: pixel(120),
      renderCell: (i) =>
        i.status === 'Disetujui' || i.status === 'Lunas' ? (
          <Button
            label={selectedLoan?.id === i.id ? 'Tutup' : 'Jadwal'}
            size="sm"
            variant={selectedLoan?.id === i.id ? 'secondary' : 'primary'}
            onClick={() => {
              if (selectedLoan?.id === i.id) {
                setSelectedLoan(null);
                setSchedule([]);
              } else {
                loadSchedule(i);
              }
            }}
          />
        ) : (
          <Text type="supporting" color="secondary">—</Text>
        ),
    },
  ];

  if (loans.length === 0) {
    return <Text type="supporting">Belum ada pinjaman</Text>;
  }

  return (
    <VStack gap={4}>
      <Table data={loans} columns={loanCols} idKey="id" density="balanced" />

      {selectedLoan && (
        <VStack gap={4}>
          <VStack gap={2}>
            <Heading level={4}>
              Detail Pinjaman — {selectedLoan.purpose || 'Pinjaman'}
            </Heading>
            <HStack gap={4} wrap="wrap">
              <Text type="supporting">
                Pokok: <Text type="body" weight="semibold">{formatRp(selectedLoan.amount)}</Text>
              </Text>
              <Text type="supporting">
                Total tagihan:{' '}
                <Text type="body" weight="semibold">
                  {formatRp(selectedLoan.totalAmount || selectedLoan.amount)}
                </Text>
              </Text>
              {selectedLoan.monthlyPayment != null && (
                <Text type="supporting">
                  Angsuran/bulan:{' '}
                  <Text type="body" weight="semibold">
                    {formatRp(selectedLoan.monthlyPayment)}
                  </Text>
                </Text>
              )}
              <Text type="supporting">
                Sisa dari jadwal:{' '}
                <Text type="body" weight="semibold">
                  {formatRp(remainingOnSchedule)}
                </Text>
              </Text>
            </HStack>
          </VStack>

          {/* Riwayat Pembayaran Masuk */}
          <VStack gap={2}>
            <HStack justify="between" vAlign="center">
              <Heading level={5}>Riwayat Pembayaran Masuk</Heading>
              {payments.length > 0 && (
                <Text type="supporting" color="secondary">
                  {payments.length} kali pembayaran (Total: {formatRp(payments.reduce((s, p) => s + Number(p.amount || 0), 0))})
                </Text>
              )}
            </HStack>
            {paymentsLoading ? (
              <Spinner size="md" />
            ) : payments.length > 0 ? (
              <Table data={payments} columns={paymentCols} idKey="id" density="balanced" />
            ) : (
              <Text type="supporting" color="secondary">
                Belum ada riwayat pembayaran yang tercatat.
              </Text>
            )}
          </VStack>

          {/* Jadwal Angsuran */}
          <VStack gap={2}>
            <Heading level={5}>Jadwal Angsuran</Heading>
            {scheduleLoading ? (
              <Spinner size="md" />
            ) : schedule.length > 0 ? (
              <Table data={schedule} columns={scheduleCols} idKey="id" density="balanced" />
            ) : (
              <Text type="supporting">
                Jadwal angsuran belum tersedia (pinjaman mungkin belum disetujui).
              </Text>
            )}
          </VStack>
        </VStack>
      )}
    </VStack>
  );
};

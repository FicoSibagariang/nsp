import React from 'react';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { formatRp } from '../../../utils/format';
import { Grid } from './Grid';
import type { MemberProfile, SavingsTransaction, SavingsWithdrawal, SavingsDeposit } from '../types';

interface SavingsTabProps {
  profile: MemberProfile | null;
  transactions: SavingsTransaction[];
  savingsWithdrawals: SavingsWithdrawal[];
  savingsDeposits: SavingsDeposit[];
  onOpenWithdrawForm: () => void;
}

export const SavingsTab: React.FC<SavingsTabProps> = ({
  profile,
  transactions,
  savingsWithdrawals,
  savingsDeposits,
  onOpenWithdrawForm,
}) => {
  const txCols: TableColumn<SavingsTransaction>[] = [
    {
      key: 'createdAt',
      header: 'Tanggal',
      width: pixel(120),
      renderCell: (i) => new Date(i.createdAt).toLocaleDateString('id-ID'),
    },
    {
      key: 'type',
      header: 'Jenis',
      width: pixel(160),
      renderCell: (i) => {
        const labels: Record<string, string> = {
          setor_pokok: 'Setor Simpanan Pokok',
          setor_wajib: 'Setor Simpanan Wajib',
          setor_sukarela: 'Setor Simpanan Sukarela',
          tarik_sukarela: 'Tarik Simpanan Sukarela',
          bunga: 'Jasa Simpanan',
        };
        return labels[i.type] ?? i.type?.replace(/_/g, ' ');
      },
    },
    {
      key: 'amount',
      header: 'Jumlah',
      width: pixel(150),
      renderCell: (i) => formatRp(i.amount),
    },
    {
      key: 'balanceAfter',
      header: 'Saldo Akhir',
      width: proportional(1),
      renderCell: (i) => formatRp(i.balanceAfter),
    },
  ];

  const withdrawalCols: TableColumn<SavingsWithdrawal>[] = [
    {
      key: 'createdAt',
      header: 'Tgl Pengajuan',
      width: pixel(130),
      renderCell: (i) =>
        new Date(i.createdAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      key: 'amount',
      header: 'Nominal Penarikan',
      width: pixel(160),
      renderCell: (i) => (
        <Text type="body" weight="bold" style={{ color: 'var(--color-critical-500, #ef4444)' }}>
          {formatRp(i.amount)}
        </Text>
      ),
    },
    {
      key: 'destinationBank',
      header: 'Rekening Tujuan',
      width: proportional(1.5),
      renderCell: (i) => (
        <VStack gap={0}>
          <Text type="body" weight="medium">
            {i.destinationBank} - {i.destinationAccount}
          </Text>
          <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
            a.n. {i.destinationName}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(120),
      renderCell: (i) => {
        let variant: 'success' | 'warning' | 'error' | 'neutral' = 'neutral';
        if (i.status === 'Menunggu') variant = 'warning';
        else if (i.status === 'Disetujui') variant = 'success';
        else if (i.status === 'Ditolak') variant = 'error';
        return <Badge variant={variant} label={i.status} />;
      },
    },
    {
      key: 'notes',
      header: 'Keterangan',
      width: proportional(1.5),
      renderCell: (i) => {
        if (i.status === 'Ditolak' && i.rejectionReason) {
          return (
            <Text type="supporting" style={{ color: 'var(--color-text-error)' }}>
              Alasan ditolak: {i.rejectionReason}
            </Text>
          );
        }
        if (i.status === 'Disetujui' && i.approvedAt) {
          return (
            <Text type="supporting" style={{ color: 'var(--color-text-success)' }}>
              Dicairkan pada {new Date(i.approvedAt).toLocaleDateString('id-ID')}
            </Text>
          );
        }
        return <Text type="supporting" color="secondary">{i.notes || '-'}</Text>;
      },
    },
  ];

  const depositCols: TableColumn<SavingsDeposit>[] = [
    {
      key: 'transferDate',
      header: 'Tgl Transfer',
      width: pixel(120),
      renderCell: (i) => i.transferDate || '-',
    },
    {
      key: 'savingsType',
      header: 'Jenis Simpanan',
      width: pixel(150),
      renderCell: (i) => {
        let label = 'Simpanan Sukarela';
        let variant: 'info' | 'neutral' | 'success' = 'neutral';
        if (i.savingsType === 'pokok') {
          label = 'Simpanan Pokok';
          variant = 'info';
        } else if (i.savingsType === 'wajib') {
          label = 'Simpanan Wajib';
          variant = 'success';
        }
        return <Badge variant={variant} label={label} />;
      },
    },
    {
      key: 'amount',
      header: 'Nominal Setoran',
      width: pixel(150),
      renderCell: (i) => (
        <Text type="body" weight="bold" color="primary">
          {formatRp(i.amount)}
        </Text>
      ),
    },
    {
      key: 'senderBank',
      header: 'Rekening Pengirim',
      width: proportional(1.5),
      renderCell: (i) => (
        <VStack gap={0}>
          <Text type="body" weight="medium">
            {i.senderBank || '-'} {i.senderAccount ? `(${i.senderAccount})` : ''}
          </Text>
          {i.senderName && (
            <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
              a.n. {i.senderName}
            </Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'proofUrl',
      header: 'Bukti Transfer',
      width: pixel(130),
      renderCell: (i) => {
        if (!i.proofUrl) {
          return <Text type="supporting" color="secondary">Tanpa bukti</Text>;
        }
        return (
          <a
            href={i.proofUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              color: 'var(--color-primary-600, #2563eb)',
              textDecoration: 'underline',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Lihat Bukti ↗
          </a>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(120),
      renderCell: (i) => {
        let variant: 'success' | 'warning' | 'error' | 'neutral' = 'neutral';
        if (i.status === 'Menunggu') variant = 'warning';
        else if (i.status === 'Diverifikasi') variant = 'success';
        else if (i.status === 'Ditolak') variant = 'error';
        return <Badge variant={variant} label={i.status} />;
      },
    },
    {
      key: 'notes',
      header: 'Keterangan',
      width: proportional(1.5),
      renderCell: (i) => {
        if (i.status === 'Ditolak' && i.rejectionReason) {
          return (
            <Text type="supporting" style={{ color: 'var(--color-text-error)' }}>
              Alasan ditolak: {i.rejectionReason}
            </Text>
          );
        }
        if (i.status === 'Diverifikasi' && i.verifiedAt) {
          return (
            <Text type="supporting" style={{ color: 'var(--color-text-success)' }}>
              Diverifikasi pada {new Date(i.verifiedAt).toLocaleDateString('id-ID')}
            </Text>
          );
        }
        return <Text type="supporting" color="secondary">{i.notes || '-'}</Text>;
      },
    },
  ];

  return (
    <VStack gap={5}>
      {/* Metric Cards */}
      <Grid gap={4}>
        <Card>
          <VStack gap={2}>
            <Text type="supporting">Total Simpanan</Text>
            <Heading level={2} color="primary">
              {formatRp(profile?.totalSavings || 0)}
            </Heading>
          </VStack>
        </Card>
        <Card>
          <VStack gap={2}>
            <Text type="supporting">Pokok</Text>
            <Heading level={3}>{formatRp(profile?.simpananPokok || 0)}</Heading>
          </VStack>
        </Card>
        <Card>
          <VStack gap={2}>
            <Text type="supporting">Wajib</Text>
            <Heading level={3}>{formatRp(profile?.simpananWajib || 0)}</Heading>
          </VStack>
        </Card>
        <Card>
          <VStack gap={2}>
            <HStack justify="between" vAlign="center">
              <Text type="supporting">Sukarela</Text>
              {(profile?.simpananSukarela || 0) > 0 && (
                <button
                  type="button"
                  onClick={onOpenWithdrawForm}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--color-primary-600, #2563eb)',
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    border: 'none',
                    borderRadius: 4,
                    padding: '2px 8px',
                    cursor: 'pointer',
                  }}
                >
                  + Tarik Dana
                </button>
              )}
            </HStack>
            <Heading level={3}>{formatRp(profile?.simpananSukarela || 0)}</Heading>
          </VStack>
        </Card>
      </Grid>

      {/* Status Konfirmasi Setoran Simpanan (Transfer Masuk) */}
      {savingsDeposits.length > 0 && (
        <VStack gap={2}>
          <HStack justify="between" vAlign="center">
            <Text type="body" weight="bold">
              Riwayat Konfirmasi Setoran Simpanan (Transfer Bank)
            </Text>
            <Badge
              variant={savingsDeposits.some((d) => d.status === 'Menunggu') ? 'warning' : 'neutral'}
              label={`${savingsDeposits.filter((d) => d.status === 'Menunggu').length} Menunggu`}
            />
          </HStack>
          <Table data={savingsDeposits} columns={depositCols} idKey="id" density="balanced" />
        </VStack>
      )}

      {/* Status Permohonan Penarikan Sukarela */}
      {savingsWithdrawals.length > 0 && (
        <VStack gap={2}>
          <HStack justify="between" vAlign="center">
            <Text type="body" weight="bold">
              Riwayat Pengajuan Penarikan Simpanan Sukarela
            </Text>
            <Badge
              variant={savingsWithdrawals.some((w) => w.status === 'Menunggu') ? 'warning' : 'neutral'}
              label={`${savingsWithdrawals.filter((w) => w.status === 'Menunggu').length} Menunggu`}
            />
          </HStack>
          <Table data={savingsWithdrawals} columns={withdrawalCols} idKey="id" density="balanced" />
        </VStack>
      )}

      {/* Mutasi Simpanan */}
      <VStack gap={2}>
        <Text type="body" weight="bold">
          Buku Mutasi Simpanan
        </Text>
        {transactions.length > 0 ? (
          <Table data={transactions} columns={txCols} idKey="id" density="balanced" />
        ) : (
          <Text type="supporting">Belum ada transaksi</Text>
        )}
      </VStack>
    </VStack>
  );
};

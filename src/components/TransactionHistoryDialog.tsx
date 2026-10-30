'use client';

import {DialogHeader} from '@astryxdesign/core/Dialog';
import { useMemo } from 'react';
import {
  Layout,
  LayoutContent,
  VStack,
} from '@astryxdesign/core/Layout';
import {Text} from '@astryxdesign/core/Text';
import {formatRp} from '../utils/format';
import {Table, proportional, pixel} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {StatusBadge} from './common/StatusBadge';
import {useApiQuery} from '../hooks/useApiQuery';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Center} from '@astryxdesign/core/Center';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {ExclamationCircleIcon, ClockIcon} from '@heroicons/react/24/outline';
import type {MemberRow} from '@shared/types';
import {useDemoMode} from '../contexts/DemoModeContextDef';
import {maskName} from '../utils/privacyMask';

interface Transaction extends Record<string, unknown> {
  id: string;
  memberId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
  createdBy: string;
}

export function TransactionHistoryDialogContent({
  onClose,
  member,
}: {
  onClose: () => void;
  member: MemberRow;
}) {
  const { isDemoMode } = useDemoMode();
  const memberName = isDemoMode ? maskName(member.id, member.name) : member.name;
  const { data: transactions, isLoading, error } = useApiQuery<Transaction[]>(`/api/members/${member.id}/transactions`);

  const columns: TableColumn<Transaction>[] = useMemo(() => [
    {
      key: 'createdAt',
      header: 'Waktu',
      width: proportional(1.5),
      renderCell: (item: Transaction) => (
        <Text type="body">
          {new Date(item.createdAt).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })}
        </Text>
      ),
    },
    {
      key: 'type',
      header: 'Jenis',
      width: pixel(190),
      renderCell: (item: Transaction) => (
        <StatusBadge status={item.type as string} />
      ),
    },
    {
      key: 'amount',
      header: 'Nominal',
      width: proportional(1),
      renderCell: (item: Transaction) => {
        const isDebit = item.type.startsWith('tarik');
        return (
          <Text type="body" style={!isDebit ? { color: 'var(--color-text-success)' } : undefined}>
            {isDebit ? '-' : '+'} {formatRp(item.amount)}
          </Text>
        );
      },
    },
    {
      key: 'balanceAfter',
      header: 'Saldo Akhir',
      width: proportional(1),
      renderCell: (item: Transaction) => (
        <Text type="body">{formatRp(item.balanceAfter)}</Text>
      ),
    },
  ], []);

  return (
    <Layout
      header={
        <DialogHeader
          title="Riwayat Transaksi"
          subtitle={`Rekam jejak transaksi simpanan untuk ${memberName}`}
          onOpenChange={() => onClose()}
        />
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={4}>
            {isLoading ? (
              <Center style={{height: 200}}>
                <Spinner size="lg" />
              </Center>
            ) : error ? (
              <EmptyState
                icon={<ExclamationCircleIcon width={48} height={48} />}
                title="Gagal Memuat"
                description="Terjadi kesalahan saat mengambil riwayat transaksi."
              />
            ) : !transactions || transactions.length === 0 ? (
              <EmptyState
                icon={<ClockIcon width={48} height={48} />}
                title="Belum Ada Transaksi"
                description="Anggota ini belum memiliki riwayat transaksi simpanan."
              />
            ) : (
              <Table<Transaction>
                data={transactions}
                columns={columns}
                idKey="id"
                density="balanced"
                dividers="rows"
                hasHover
              />
            )}
          </VStack>
        </LayoutContent>
      }
    />
  );
}

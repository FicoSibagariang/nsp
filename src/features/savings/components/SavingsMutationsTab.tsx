'use client';

import { useState, useMemo, useEffect } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { PowerSearch, usePowerSearchConfig } from '@astryxdesign/core/PowerSearch';
import type { PowerSearchFilter } from '@astryxdesign/core/PowerSearch';
import { Table, proportional } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { apiFetch } from '../../../config';
import { formatRp } from '../../../utils/format';
import { Pagination } from '../../../components/Pagination';
import { DataStateView } from '../../../components/DataStateView';
import { useA11yDialog } from '../../../hooks/useA11yDialog';
import { ImportSavingsDialogContent } from '../../../components/ImportSavingsDialog';
import { useAuth } from '../../../hooks/useAuth';
import { useDemoMode } from '../../../contexts/DemoModeContext';
import { maskName } from '../../../utils/privacyMask';
import type { SavingsTransactionRow, PaginatedResponse } from '@shared/types';

const transactionTypeValues = [
  { value: 'setor_pokok', label: 'Setor Pokok' },
  { value: 'setor_wajib', label: 'Setor Wajib' },
  { value: 'setor_sukarela', label: 'Setor Sukarela' },
  { value: 'tarik_pokok', label: 'Tarik Pokok' },
  { value: 'tarik_wajib', label: 'Tarik Wajib' },
  { value: 'tarik_sukarela', label: 'Tarik Sukarela' },
];

const fieldDefs = [
  { key: 'memberName', type: 'string', label: 'Nama Anggota' },
  { key: 'type', type: 'enum', label: 'Tipe Transaksi', enumValues: transactionTypeValues },
] as const;

export function SavingsMutationsTab() {
  const dialog = useA11yDialog({ purpose: 'form', width: 600 });
  const { hasPermission } = useAuth();
  const { isDemoMode } = useDemoMode();

  const [filters, setFilters] = useState<PowerSearchFilter[]>([]);
  const { config, applyFilters } = usePowerSearchConfig(fieldDefs, 'Simpanan');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const {
    data: transactionsResponse,
    isLoading,
    error,
    refetch: fetchTransactions,
  } = useApiQuery<PaginatedResponse<SavingsTransactionRow>>(
    `/api/savings/transactions?page=${page}&limit=${limit}`
  );
  const [localTransactions, setLocalTransactions] = useState<SavingsTransactionRow[]>([]);

  useEffect(() => {
    if (transactionsResponse?.data) {
      setLocalTransactions(transactionsResponse.data);
    }
  }, [transactionsResponse]);

  const filtered = useMemo(() => {
    return (applyFilters as any)(filters, localTransactions) as SavingsTransactionRow[];
  }, [filters, applyFilters, localTransactions]);

  const handleExportCsv = async () => {
    try {
      const res = await apiFetch('/api/v1/savings/transactions?limit=10000');
      const json: PaginatedResponse<SavingsTransactionRow> = await res.json();
      const allTx = json.data || [];

      const headers = ['ID', 'Waktu', 'Nama Anggota', 'Tipe', 'Nominal', 'Saldo Sebelum', 'Saldo Sesudah', 'Petugas'];
      const rows = allTx.map((tx) => [
        tx.id,
        new Date(tx.createdAt).toLocaleString('id-ID'),
        isDemoMode ? maskName(tx.memberId || tx.memberName, tx.memberName) : tx.memberName || '',
        transactionTypeValues.find((t) => t.value === tx.type)?.label || tx.type,
        tx.amount,
        tx.balanceBefore,
        tx.balanceAfter,
        tx.createdBy,
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `transaksi_simpanan_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert('Gagal mengekspor data transaksi.');
    }
  };

  const handleDownloadTemplate = () => {
    window.location.href = '/api/v1/savings/template/csv';
  };

  const transactionColumns: TableColumn<SavingsTransactionRow>[] = useMemo(() => [
    {
      key: 'memberName',
      header: 'Nama Anggota',
      width: proportional(2),
      renderCell: (item: SavingsTransactionRow) => {
        const displayName = isDemoMode
          ? maskName(item.memberId || item.memberName, item.memberName)
          : (item.memberName || 'Anggota Koperasi');
        return <Text type="body">{displayName}</Text>;
      },
    },
    {
      key: 'type',
      header: 'Tipe Transaksi',
      width: proportional(2),
      renderCell: (item: SavingsTransactionRow) => {
        let label = item.type;
        let variant: 'success' | 'warning' | 'error' | 'neutral' = 'neutral';

        const match = transactionTypeValues.find((t) => t.value === item.type);
        if (match) {
          label = match.label;
        }

        if (item.type.startsWith('setor_')) {
          variant = 'success';
        } else if (item.type.startsWith('tarik_')) {
          variant = 'error';
        }

        return <Badge variant={variant} label={label} />;
      },
    },
    {
      key: 'amount',
      header: 'Nominal',
      width: proportional(1.5),
      renderCell: (item: SavingsTransactionRow) => (
        <Text
          type="body"
          style={{
            fontWeight: 500,
            color: item.type.startsWith('setor_') ? 'var(--color-success-500)' : 'var(--color-critical-500)',
          }}
        >
          {item.type.startsWith('setor_') ? '+' : '-'} {formatRp(item.amount)}
        </Text>
      ),
    },
    {
      key: 'balanceBefore',
      header: 'Saldo Sebelum',
      width: proportional(1.5),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="body" color="secondary">{formatRp(item.balanceBefore)}</Text>
      ),
    },
    {
      key: 'balanceAfter',
      header: 'Saldo Sesudah',
      width: proportional(1.5),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="body" style={{ fontWeight: 500 }}>{formatRp(item.balanceAfter)}</Text>
      ),
    },
    {
      key: 'createdAt',
      header: 'Waktu',
      width: proportional(2),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="supporting" color="secondary">
          {new Date(item.createdAt).toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </Text>
      ),
    },
    {
      key: 'createdBy',
      header: 'Petugas',
      width: proportional(1.5),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="supporting" color="secondary">{item.createdBy}</Text>
      ),
    },
  ], [isDemoMode]);

  return (
    <DataStateView
      isLoading={isLoading}
      error={error}
      onRetry={fetchTransactions}
      errorTitle="Gagal Memuat Riwayat Transaksi"
    >
      <VStack gap={4}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <PowerSearch
              config={config}
              filters={filters}
              onChange={(newFilters) => {
                setFilters([...newFilters]);
              }}
              placeholder="Cari transaksi..."
              resultCount={filtered.length}
            />
          </div>
          <HStack gap={2}>
            {hasPermission('update:savings') && (
              <>
                <Button
                  label="Unduh Format CSV"
                  variant="ghost"
                  onClick={handleDownloadTemplate}
                />
                <Button
                  label="Import Batch (CSV)"
                  variant="secondary"
                  onClick={() => {
                    dialog.show(
                      <ImportSavingsDialogContent
                        onClose={() => dialog.hide()}
                        onSuccess={() => {
                          fetchTransactions();
                        }}
                      />
                    );
                  }}
                />
              </>
            )}
            {hasPermission('export:reports') && (
              <Button
                label="Ekspor CSV"
                variant="secondary"
                icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                onClick={handleExportCsv}
              />
            )}
          </HStack>
        </HStack>

        <Table<SavingsTransactionRow>
          data={filtered}
          columns={transactionColumns}
          idKey="id"
          density="balanced"
          dividers="rows"
          hasHover
        />

        <Pagination
          page={transactionsResponse?.page || page}
          limit={transactionsResponse?.limit || limit}
          total={transactionsResponse?.total || 0}
          onPageChange={setPage}
        />
      </VStack>
    </DataStateView>
  );
}

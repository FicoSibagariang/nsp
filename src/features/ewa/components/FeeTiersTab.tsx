import React, { useMemo } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Heading, Text } from '@astryxdesign/core/Text';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Button } from '@astryxdesign/core/Button';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Icon } from '@astryxdesign/core/Icon';
import { PlusIcon } from '@heroicons/react/24/outline';
import { formatRp } from '../../../utils/format';
import { apiFetch } from '../../../config';
import type { EwaFeeTier } from '../types';

interface FeeTiersTabProps {
  openAddTier: () => void;
  feeTiersLoading: boolean;
  feeTiers: EwaFeeTier[];
  onEditTier: (tier: EwaFeeTier) => void;
  onTiersUpdated: (tiers: EwaFeeTier[], message: string) => void;
}

export function FeeTiersTab({
  openAddTier,
  feeTiersLoading,
  feeTiers,
  onEditTier,
  onTiersUpdated,
}: FeeTiersTabProps) {
  const handleDeleteTier = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus rentang tarif ini?')) return;
    try {
      let remaining = feeTiers.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        alert('Minimal harus ada 1 rentang tarif dalam tabel.');
        return;
      }
      remaining.sort((a, b) => a.minAmount - b.minAmount);
      remaining = remaining.map((t, idx) => ({ ...t, tierOrder: idx + 1 }));

      const res = await apiFetch('/api/v1/ewa/fee-tiers', {
        method: 'PUT',
        body: JSON.stringify({ tiers: remaining }),
      });
      const data = await res.json();
      if (data.success) {
        onTiersUpdated(data.data || [], 'Rentang tarif berhasil dihapus!');
      }
    } catch (err: any) {
      alert(err?.message || 'Gagal menghapus tarif');
    }
  };

  const feeTierColumns: TableColumn<EwaFeeTier>[] = useMemo(
    () => [
      {
        key: 'order',
        header: 'Tingkat / Tier',
        width: pixel(130),
        renderCell: (t: EwaFeeTier) => (
          <Text type="body" weight="semibold">
            Tier {t.tierOrder}
          </Text>
        ),
      },
      {
        key: 'range',
        header: 'Rentang Nominal Penarikan',
        width: proportional(1.5),
        renderCell: (t: EwaFeeTier) => (
          <VStack gap={0}>
            <Text type="body" weight="semibold">
              {formatRp(t.minAmount)} s/d {t.maxAmount != null ? formatRp(t.maxAmount) : 'Tanpa Batas (Diatasnya)'}
            </Text>
            <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
              {t.maxAmount != null
                ? `Untuk nominal penarikan ${formatRp(t.minAmount)} – ${formatRp(t.maxAmount)}`
                : `Untuk semua nominal penarikan di atas ${formatRp(t.minAmount)}`}
            </Text>
          </VStack>
        ),
      },
      {
        key: 'memberFee',
        header: 'Biaya Admin (Anggota Koperasi)',
        width: proportional(1.2),
        renderCell: (t: EwaFeeTier) => (
          <VStack gap={0}>
            <Text type="body" weight="bold" style={{ color: 'var(--color-text-success)' }}>
              {formatRp(t.memberFee)}
            </Text>
            <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
              Tarif flat per penarikan
            </Text>
          </VStack>
        ),
      },
      {
        key: 'nonMemberFee',
        header: 'Biaya Admin (Non-Anggota)',
        width: proportional(1.2),
        renderCell: (t: EwaFeeTier) => (
          <VStack gap={0}>
            <Text type="body" weight="bold" color="primary">
              {formatRp(t.nonMemberFee)}
            </Text>
            <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
              Tarif flat per penarikan
            </Text>
          </VStack>
        ),
      },
      {
        key: 'actions',
        header: 'Aksi',
        width: pixel(160),
        renderCell: (t: EwaFeeTier) => (
          <HStack gap={2}>
            <Button
              label="Edit"
              variant="secondary"
              size="sm"
              onClick={() => onEditTier(t)}
            />
            <Button
              label="Hapus"
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteTier(t.id)}
            />
          </HStack>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onEditTier, feeTiers]
  );

  return (
    <Card>
      <VStack gap={4}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
          <VStack gap={1}>
            <Heading level={4}>Skema Tabel Tarif Biaya Admin EWA</Heading>
            <Text type="supporting" color="secondary">
              Biaya admin flat per transaksi penarikan berdasarkan kelompok rentang nominal. Karyawan yang terdaftar sebagai anggota koperasi mendapatkan tarif khusus lebih hemat.
            </Text>
          </VStack>
          <Button
            label="Tambah Rentang Tarif"
            variant="primary"
            icon={<Icon icon={PlusIcon} size="sm" />}
            onClick={openAddTier}
          />
        </HStack>

        {feeTiersLoading ? (
          <HStack justify="center" style={{ padding: 40 }}>
            <Spinner size="md" />
          </HStack>
        ) : (
          <Table<EwaFeeTier>
            data={feeTiers}
            columns={feeTierColumns}
          />
        )}
      </VStack>
    </Card>
  );
}

import React from 'react';
import { VStack } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Grid } from '@astryxdesign/core/Grid';

interface LetterStatsCardsProps {
  stats?: {
    total: number;
    byCategory: Record<string, number>;
  };
}

export function LetterStatsCards({ stats }: LetterStatsCardsProps) {
  return (
    <Grid columns={{ minWidth: 220, repeat: 'fit' }} gap={4}>
      <Card style={{ padding: 16 }}>
        <VStack gap={1}>
          <Text type="supporting" color="secondary">Total Surat Terdaftar</Text>
          <Heading level={2}>{stats?.total || 0}</Heading>
        </VStack>
      </Card>
      <Card style={{ padding: 16 }}>
        <VStack gap={1}>
          <Text type="supporting" color="secondary">Perjanjian Pinjaman Anggota (SPP-ANG)</Text>
          <Heading level={2} color="primary">{stats?.byCategory?.['PINJAMAN_ANGGOTA'] || 0}</Heading>
        </VStack>
      </Card>
      <Card style={{ padding: 16 }}>
        <VStack gap={1}>
          <Text type="supporting" color="secondary">Perjanjian Pinjaman Modal (SPH-MODAL)</Text>
          <Heading level={2} style={{ color: 'var(--color-warning-600, #d97706)' }}>
            {stats?.byCategory?.['PINJAMAN_MODAL'] || 0}
          </Heading>
        </VStack>
      </Card>
      <Card style={{ padding: 16 }}>
        <VStack gap={1}>
          <Text type="supporting" color="secondary">Surat Keluar &amp; SK Lainnya</Text>
          <Heading level={2}>
            {(stats?.byCategory?.['SURAT_KELUAR'] || 0) +
              (stats?.byCategory?.['SURAT_KEPUTUSAN'] || 0) +
              (stats?.byCategory?.['PERJANJIAN_KERJASAMA'] || 0)}
          </Heading>
        </VStack>
      </Card>
    </Grid>
  );
}

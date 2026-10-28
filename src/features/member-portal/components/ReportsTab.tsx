import React from 'react';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Spinner } from '@astryxdesign/core/Spinner';
import { formatRp } from '../../../utils/format';
import { Grid } from './Grid';
import type { IncomeData, BalanceData, CashflowData } from '../types';

interface ReportsTabProps {
  incomeData: IncomeData | null;
  balanceData: BalanceData | null;
  cashflowData: CashflowData | null;
  reportsLoading: boolean;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  incomeData,
  balanceData,
  cashflowData,
  reportsLoading,
}) => {
  if (reportsLoading) {
    return <Spinner size="md" />;
  }

  return (
    <VStack gap={6}>
      {/* Laporan Laba Rugi */}
      <VStack gap={3}>
        <Heading level={4}>1. Laporan Laba Rugi (Income Statement)</Heading>
        <Grid gap={4}>
          <Card style={{ padding: 16 }}>
            <VStack gap={1}>
              <Text type="supporting">Total Pendapatan</Text>
              <Heading level={3} color="primary">{formatRp(incomeData?.totalRevenue || 0)}</Heading>
            </VStack>
          </Card>
          <Card style={{ padding: 16 }}>
            <VStack gap={1}>
              <Text type="supporting">Total Beban Operasional</Text>
              <Heading level={3}>{formatRp(incomeData?.totalExpense || 0)}</Heading>
            </VStack>
          </Card>
          <Card style={{ padding: 16 }}>
            <VStack gap={1}>
              <Text type="supporting">SHU / Laba Bersih Tahun Berjalan</Text>
              <Heading level={3} color="primary">{formatRp(incomeData?.netIncome || 0)}</Heading>
            </VStack>
          </Card>
        </Grid>
      </VStack>

      {/* Laporan Neraca */}
      <VStack gap={3}>
        <Heading level={4}>2. Laporan Neraca Koperasi (Balance Sheet)</Heading>
        <Grid gap={4}>
          <Card style={{ padding: 16 }}>
            <VStack gap={1}>
              <Text type="supporting">Total Aset Koperasi</Text>
              <Heading level={3} color="primary">{formatRp(balanceData?.totalAssets || 0)}</Heading>
            </VStack>
          </Card>
          <Card style={{ padding: 16 }}>
            <VStack gap={1}>
              <Text type="supporting">Total Kewajiban / Liabilitas</Text>
              <Heading level={3}>{formatRp(balanceData?.totalLiabilities || 0)}</Heading>
            </VStack>
          </Card>
          <Card style={{ padding: 16 }}>
            <VStack gap={1}>
              <Text type="supporting">Total Ekuitas / Modal</Text>
              <Heading level={3}>{formatRp(balanceData?.totalEquity || 0)}</Heading>
            </VStack>
          </Card>
        </Grid>

        {/* Ringkasan Neraca */}
        <Card style={{ padding: 16, backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-border-primary)' }}>
          <VStack gap={2}>
            <Text type="body" weight="bold">Keseimbangan Neraca (Aset = Kewajiban + Ekuitas)</Text>
            <HStack justify="between" wrap="wrap" gap={2}>
              <Text type="supporting">Total Aset: {formatRp(balanceData?.totalAssets || 0)}</Text>
              <Text type="body" weight="semibold">
                Total Pasiva: {formatRp((balanceData?.totalLiabilities || 0) + (balanceData?.totalEquity || 0))}
              </Text>
            </HStack>
          </VStack>
        </Card>
      </VStack>

      {/* Laporan Arus Kas */}
      <VStack gap={3}>
        <Heading level={4}>3. Laporan Arus Kas Periode (Cash Flow Statement)</Heading>
        <Grid gap={4}>
          <Card style={{ padding: 16 }}>
            <VStack gap={1}>
              <Text type="supporting">Total Kas Masuk (Inflow)</Text>
              <Heading level={3} style={{ color: 'var(--color-text-success)' }}>{formatRp(cashflowData?.totalInflow || 0)}</Heading>
            </VStack>
          </Card>
          <Card style={{ padding: 16 }}>
            <VStack gap={1}>
              <Text type="supporting">Total Kas Keluar (Outflow)</Text>
              <Heading level={3} style={{ color: 'var(--color-text-error)' }}>{formatRp(cashflowData?.totalOutflow || 0)}</Heading>
            </VStack>
          </Card>
          <Card style={{ padding: 16 }}>
            <VStack gap={1}>
              <Text type="supporting">Arus Kas Bersih (Net Cash)</Text>
              <Heading level={3} style={{ color: (cashflowData?.netCashFlow || 0) >= 0 ? 'var(--color-text-success)' : 'var(--color-text-error)' }}>
                {formatRp(cashflowData?.netCashFlow || 0)}
              </Heading>
            </VStack>
          </Card>
          <Card style={{ padding: 16 }}>
            <VStack gap={1}>
              <Text type="supporting">Saldo Kas & Bank Akhir</Text>
              <Heading level={3} color="primary">{formatRp(cashflowData?.totalCashBalance || 0)}</Heading>
            </VStack>
          </Card>
        </Grid>

        {/* Rincian Arus Kas */}
        <Card style={{ padding: 16, border: '1px solid var(--color-border-primary)' }}>
          <VStack gap={3}>
            <Text type="body" weight="bold">Rincian Arus Kas Riil</Text>
            <Grid gap={4}>
              {/* Inflow List */}
              <VStack gap={2}>
                <Text type="supporting" weight="semibold" style={{ color: 'var(--color-text-success)' }}>Penerimaan Kas (Inflow):</Text>
                {cashflowData?.inflows && cashflowData.inflows.length > 0 ? (
                  cashflowData.inflows.map((item: any, idx: number) => (
                    <HStack key={idx} justify="between" style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border-primary)' }}>
                      <Text type="supporting">{item.label}</Text>
                      <Text type="body" weight="medium" style={{ color: 'var(--color-text-success)' }}>+{formatRp(item.total)}</Text>
                    </HStack>
                  ))
                ) : (
                  <Text type="supporting" color="secondary">Tidak ada kas masuk</Text>
                )}
              </VStack>

              {/* Outflow List */}
              <VStack gap={2}>
                <Text type="supporting" weight="semibold" style={{ color: 'var(--color-text-error)' }}>Pengeluaran Kas (Outflow):</Text>
                {cashflowData?.outflows && cashflowData.outflows.length > 0 ? (
                  cashflowData.outflows.map((item: any, idx: number) => (
                    <HStack key={idx} justify="between" style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border-primary)' }}>
                      <Text type="supporting">{item.label}</Text>
                      <Text type="body" weight="medium" style={{ color: 'var(--color-text-error)' }}>-{formatRp(item.total)}</Text>
                    </HStack>
                  ))
                ) : (
                  <Text type="supporting" color="secondary">Tidak ada kas keluar</Text>
                )}
              </VStack>
            </Grid>
          </VStack>
        </Card>
      </VStack>
    </VStack>
  );
};

import React from 'react';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { formatRp } from '../../../utils/format';
import { Grid } from './Grid';
import type { ShuData, MemberProfile } from '../types';

interface ShuTabProps {
  shuData: ShuData | null;
  shuLoading: boolean;
  shuError: string;
  profile: MemberProfile | null;
}

export const ShuTab: React.FC<ShuTabProps> = ({
  shuData,
  shuLoading,
  shuError,
  profile,
}) => {
  const shuHistoricalCols: TableColumn<any>[] = [
    {
      key: 'year',
      header: 'Tahun Buku',
      width: pixel(110),
      renderCell: (i) => <Text weight="bold">Tahun {i.year}</Text>,
    },
    {
      key: 'savingsShare',
      header: 'Jasa Modal (Simpanan)',
      width: proportional(1),
      renderCell: (i) => <Text>{formatRp(i.savingsShare)}</Text>,
    },
    {
      key: 'loansShare',
      header: 'Jasa Usaha (Pinjaman)',
      width: proportional(1),
      renderCell: (i) => <Text>{formatRp(i.loansShare)}</Text>,
    },
    {
      key: 'totalSHU',
      header: 'Total SHU Diterima',
      width: proportional(1.2),
      renderCell: (i) => (
        <Text type="body" weight="bold" color="primary">
          {formatRp(i.totalSHU)}
        </Text>
      ),
    },
    {
      key: 'closedAt',
      header: 'Tanggal Pengesahan RAT',
      width: pixel(180),
      renderCell: (i) => (
        <Text type="supporting" color="secondary">
          {i.closedAt
            ? new Date(i.closedAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '-'}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(130),
      renderCell: () => <Badge variant="success" label="Disahkan RAT" />,
    },
  ];

  if (shuLoading) {
    return <Spinner size="md" />;
  }

  if (shuError) {
    return (
      <Card style={{ padding: 16, borderColor: 'var(--color-danger-500)' }}>
        <Text style={{ color: 'var(--color-text-error)' }}>{shuError}</Text>
      </Card>
    );
  }

  return (
    <VStack gap={6}>
      {/* 1. Header Banner */}
      <Card style={{ padding: 16, backgroundColor: 'var(--color-background-secondary)' }}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
          <HStack gap={3} vAlign="center">
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary-500)',
                flexShrink: 0,
              }}
            >
              <SparklesIcon style={{ width: 24, height: 24 }} />
            </div>
            <VStack gap={1}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Heading level={4}>SHU Anggota Tahun Buku {shuData?.year}</Heading>
                {shuData?.isClosed ? (
                  <Badge variant="success" label="Tutup Buku / Disahkan RAT" />
                ) : (
                  <Badge variant="warning" label="Tahun Berjalan (Proyeksi s/d 31 Des)" />
                )}
              </HStack>
              <Text type="supporting" color="secondary">
                {shuData?.isClosed
                  ? `Tahun buku telah resmi ditutup pada ${
                      shuData.closedAt
                        ? new Date(shuData.closedAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        : '-'
                    }. Angka berikut merupakan pembagian resmi hasil ketetapan RAT.`
                  : 'Proyeksi dihitung dari realisasi berjalan ditambah simulasi pendapatan bunga dari komitmen angsuran pinjaman aktif Anda sampai 31 Desember.'}
              </Text>
            </VStack>
          </HStack>
        </HStack>
      </Card>

      {/* 2. Tiga Kartu Metrik Utama */}
      <Grid gap={4}>
        {/* Kartu Realisasi Berjalan */}
        <Card style={{ padding: 20 }}>
          <VStack gap={3}>
            <HStack justify="between" vAlign="center">
              <Text type="supporting" weight="bold">Realisasi Berjalan (YTD)</Text>
              <Badge variant="neutral" label="s/d Hari Ini" />
            </HStack>
            <Heading level={2} color="primary">
              {formatRp(shuData?.realization?.member?.shu || 0)}
            </Heading>
            <Text type="supporting" color="secondary">
              Akumulasi hak SHU dari bunga yang sudah terbayar dan saldo simpanan berjalan s/d hari ini.
            </Text>

            <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--color-border-primary)' }}>
              <VStack gap={2}>
                <HStack justify="between">
                  <Text type="supporting">Jasa Modal (Simpanan):</Text>
                  <Text type="body" weight="semibold">
                    {formatRp(shuData?.realization?.member?.savingsShare || 0)}
                  </Text>
                </HStack>
                <HStack justify="between">
                  <Text type="supporting">Jasa Usaha (Pinjaman):</Text>
                  <Text type="body" weight="semibold">
                    {formatRp(shuData?.realization?.member?.loansShare || 0)}
                  </Text>
                </HStack>
              </VStack>
            </div>
          </VStack>
        </Card>

        {/* Kartu Proyeksi Akhir Tahun */}
        <Card
          style={{
            padding: 20,
            border: '2px solid var(--color-primary-500)',
            backgroundColor: 'rgba(59, 130, 246, 0.03)',
          }}
        >
          <VStack gap={3}>
            <HStack justify="between" vAlign="center">
              <HStack gap={1} vAlign="center">
                <SparklesIcon style={{ width: 16, height: 16, color: 'var(--color-primary-500)' }} />
                <Text type="supporting" weight="bold" color="primary">
                  Proyeksi Akhir Tahun (s/d 31 Des)
                </Text>
              </HStack>
              <Badge variant="info" label="Estimasi RAT" />
            </HStack>
            <Heading level={2} color="primary">
              {formatRp(shuData?.projection?.member?.shu || 0)}
            </Heading>
            <Text type="supporting" color="secondary">
              {shuData?.isClosed
                ? 'Hak definitif hasil penetapan penutupan buku tahunan.'
                : `Estimasi penuh jika angsuran lancar (+${formatRp(
                    Math.max(
                      0,
                      (shuData?.projection?.member?.shu || 0) -
                        (shuData?.realization?.member?.shu || 0)
                    )
                  )} potensi tambahan).`}
            </Text>

            <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--color-border-primary)' }}>
              <VStack gap={2}>
                <HStack justify="between">
                  <Text type="supporting">Estimasi Jasa Modal (Simpanan):</Text>
                  <Text type="body" weight="semibold">
                    {formatRp(shuData?.projection?.member?.savingsShare || 0)}
                  </Text>
                </HStack>
                <HStack justify="between">
                  <Text type="supporting">Estimasi Jasa Usaha (Pinjaman):</Text>
                  <Text type="body" weight="semibold">
                    {formatRp(shuData?.projection?.member?.loansShare || 0)}
                  </Text>
                </HStack>
              </VStack>
            </div>
          </VStack>
        </Card>

        {/* Kartu Portofolio & Kontribusi Anggota */}
        <Card style={{ padding: 20 }}>
          <VStack gap={3}>
            <Text type="supporting" weight="bold">Portofolio Kontribusi Anda</Text>
            <VStack gap={2}>
              <VStack gap={1}>
                <Text type="supporting">Saldo Rata-Rata Tertimbang (ADB):</Text>
                <Heading level={3}>
                  {formatRp(shuData?.projection?.member?.averageSavings || profile?.totalSavings || 0)}
                </Heading>
                <Text type="supporting" color="secondary">
                  Basis pembagian Jasa Modal (Simpanan).
                </Text>
              </VStack>
              <div style={{ paddingTop: 8, borderTop: '1px solid var(--color-border-primary)' }}>
                <VStack gap={1}>
                  <Text type="supporting">Porsi Simpanan Anda:</Text>
                  <Text type="body" weight="bold" color="primary">
                    {shuData?.projection?.totalCoopSavings && shuData.projection.totalCoopSavings > 0
                      ? `${(
                          ((shuData?.projection?.member?.averageSavings || 0) /
                            shuData.projection.totalCoopSavings) *
                          100
                        ).toFixed(3)}%`
                      : '0%'}
                    {' '}
                    <Text type="supporting" color="secondary" style={{ display: 'inline', fontWeight: 'normal' }}>
                      dari total simpanan koperasi
                    </Text>
                  </Text>
                </VStack>
              </div>
            </VStack>
          </VStack>
        </Card>
      </Grid>

      {/* 3. Breakdown Transparansi Rumus & Pilar Pembagian */}
      <VStack gap={3}>
        <Heading level={4}>Transparansi Alokasi & Rumus Pembagian SHU</Heading>
        <Grid gap={4}>
          {/* Pilar Jasa Simpanan */}
          <Card style={{ padding: 18 }}>
            <VStack gap={3}>
              <HStack justify="between" vAlign="center">
                <Text type="body" weight="bold">1. Jasa Modal / Simpanan</Text>
                <Badge variant="neutral" label={`Alokasi ${shuData?.config?.jasaSimpananPct ?? 50}% Bagian Anggota`} />
              </HStack>
              <Text type="supporting" color="secondary">
                Dihitung berdasarkan perbandingan saldo harian rata-rata (*Average Daily Balance*) simpanan Anda terhadap seluruh simpanan anggota koperasi.
              </Text>
              <div style={{ backgroundColor: 'var(--color-background-secondary)', padding: 14, borderRadius: 8 }}>
                <VStack gap={2}>
                  <HStack justify="between">
                    <Text type="supporting">Rata-rata Simpanan Anda:</Text>
                    <Text type="body" weight="medium">{formatRp(shuData?.projection?.member?.averageSavings || 0)}</Text>
                  </HStack>
                  <HStack justify="between">
                    <Text type="supporting">Total Simpanan Koperasi:</Text>
                    <Text type="body" weight="medium">{formatRp(shuData?.projection?.totalCoopSavings || 0)}</Text>
                  </HStack>
                  <HStack justify="between">
                    <Text type="supporting">Proporsi Kontribusi:</Text>
                    <Text type="body" weight="bold" color="primary">
                      {shuData?.projection?.totalCoopSavings && shuData.projection.totalCoopSavings > 0
                        ? `${(
                            ((shuData?.projection?.member?.averageSavings || 0) /
                              shuData.projection.totalCoopSavings) *
                            100
                          ).toFixed(3)}%`
                        : '0%'}
                    </Text>
                  </HStack>
                  <HStack justify="between">
                    <Text type="supporting">Dana Pool Jasa Simpanan (Proyeksi):</Text>
                    <Text type="body" weight="semibold">{formatRp(shuData?.projection?.jasaSimpananPool || 0)}</Text>
                  </HStack>
                  <div style={{ borderTop: '1px dashed var(--color-border-primary)', paddingTop: 6 }}>
                    <HStack justify="between">
                      <Text type="body" weight="bold">Estimasi Jasa Modal Anda:</Text>
                      <Text type="body" weight="bold" color="primary">
                        {formatRp(shuData?.projection?.member?.savingsShare || 0)}
                      </Text>
                    </HStack>
                  </div>
                </VStack>
              </div>
            </VStack>
          </Card>

          {/* Pilar Jasa Pinjaman */}
          <Card style={{ padding: 18 }}>
            <VStack gap={3}>
              <HStack justify="between" vAlign="center">
                <Text type="body" weight="bold">2. Jasa Usaha / Pinjaman</Text>
                <Badge variant="neutral" label={`Alokasi ${shuData?.config?.jasaPinjamanPct ?? 50}% Bagian Anggota`} />
              </HStack>
              <Text type="supporting" color="secondary">
                {(shuData?.config?.jasaPinjamanPct ?? 50) === 0
                  ? 'Koperasi menetapkan 0% alokasi untuk pilar jasa pinjaman (100% dialokasikan ke simpanan anggota).'
                  : 'Dihitung berdasarkan partisipasi bunga pinjaman yang Anda bayarkan ke koperasi sepanjang tahun buku berjalan.'}
              </Text>
              <div style={{ backgroundColor: 'var(--color-background-secondary)', padding: 14, borderRadius: 8 }}>
                <VStack gap={2}>
                  <HStack justify="between">
                    <Text type="supporting">Realisasi Bunga Terbayar YTD:</Text>
                    <Text type="body" weight="medium">
                      {formatRp(shuData?.realization?.member?.loansShare || 0)} (Alokasi YTD)
                    </Text>
                  </HStack>
                  <HStack justify="between">
                    <Text type="supporting">Proyeksi Angsuran s/d 31 Des:</Text>
                    <Text type="body" weight="medium">Termasuk sisa jadwal aktif</Text>
                  </HStack>
                  <HStack justify="between">
                    <Text type="supporting">Dana Pool Jasa Pinjaman (Proyeksi):</Text>
                    <Text type="body" weight="semibold">{formatRp(shuData?.projection?.jasaPinjamanPool || 0)}</Text>
                  </HStack>
                  <div style={{ borderTop: '1px dashed var(--color-border-primary)', paddingTop: 6 }}>
                    <HStack justify="between">
                      <Text type="body" weight="bold">Estimasi Jasa Pinjaman Anda:</Text>
                      <Text type="body" weight="bold" color="primary">
                        {formatRp(shuData?.projection?.member?.loansShare || 0)}
                      </Text>
                    </HStack>
                  </div>
                </VStack>
              </div>
            </VStack>
          </Card>
        </Grid>
      </VStack>

      {/* 4. Riwayat SHU Tahun Lalu (Telah Disahkan RAT) */}
      {shuData?.historical && shuData.historical.length > 0 && (
        <VStack gap={3}>
          <Heading level={4}>Riwayat Realisasi SHU Tahun-Tahun Sebelumnya</Heading>
          <Table data={shuData.historical} columns={shuHistoricalCols} idKey="year" density="balanced" />
        </VStack>
      )}

      {/* 5. Catatan & Disclaimer RAT */}
      <Card
        style={{
          padding: 18,
          backgroundColor: 'var(--color-background-secondary)',
          borderLeft: '4px solid var(--color-warning-500)',
        }}
      >
        <VStack gap={2}>
          <HStack gap={2} vAlign="center">
            <Text type="body" weight="bold">💡 Catatan Ketentuan Pembagian SHU & RAT</Text>
          </HStack>
          <Text type="supporting" color="secondary">
            1. <strong>Proyeksi Akhir Tahun</strong> dihitung secara matematis berdasarkan pendapatan berjalan ditambah simulasi kelancaran seluruh jadwal pembayaran angsuran aktif Anda sampai tanggal 31 Desember.
          </Text>
          <Text type="supporting" color="secondary">
            2. Angka final pembagian SHU definitif dan persetujuan pencairannya sah diputuskan dalam <strong>Rapat Anggota Tahunan (RAT)</strong> sesuai ketentuan Anggaran Dasar dan Anggaran Rumah Tangga (AD/ART) koperasi.
          </Text>
          <Text type="supporting" color="secondary">
            3. Anda dapat mengoptimalkan perolehan SHU dengan mempertahankan atau menambah saldo simpanan serta disiplin membayar angsuran tepat waktu.
          </Text>
        </VStack>
      </Card>
    </VStack>
  );
};

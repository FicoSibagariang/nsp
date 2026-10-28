'use client';

import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Button } from '@astryxdesign/core/Button';
import { Grid } from '@astryxdesign/core/Grid';

interface ParameterSettingsProps {
  bungaPinjaman: string;
  bungaSimpanan: string;
  denda: string;
  canUpdate: boolean;
  onBungaPinjamanChange: (v: string) => void;
  onBungaSimpananChange: (v: string) => void;
  onDendaChange: (v: string) => void;
  onSave: () => void;
}

/**
 * Interest rate parameters: loan rate, savings rate, late penalty.
 * Controlled component — all state lives in parent (Settings.tsx).
 */
export function ParameterSettings({
  bungaPinjaman,
  bungaSimpanan,
  denda,
  canUpdate,
  onBungaPinjamanChange,
  onBungaSimpananChange,
  onDendaChange,
  onSave,
}: ParameterSettingsProps) {
  return (
    <Grid columns={{ minWidth: 320 }} gap={10}>
      <VStack gap={1}>
        <Heading level={3}>Parameter Bunga</Heading>
        <Text type="supporting" color="secondary">
          Atur besaran persentase bunga untuk pinjaman, simpanan, dan denda.
        </Text>
      </VStack>
      <VStack gap={4}>
        <Grid columns={3} gap={4}>
          <TextInput
            label="Bunga Pinjaman (% per Tahun)"
            value={bungaPinjaman}
            onChange={onBungaPinjamanChange}
            isDisabled={!canUpdate}
          />
          <TextInput
            label="Bunga Simpanan (%)"
            value={bungaSimpanan}
            onChange={onBungaSimpananChange}
            isDisabled={!canUpdate}
          />
          <TextInput
            label="Denda Keterlambatan (%)"
            value={denda}
            onChange={onDendaChange}
            isDisabled={!canUpdate}
          />
        </Grid>
        {canUpdate && (
          <HStack>
            <Button label="Simpan Parameter" variant="primary" onClick={onSave} />
          </HStack>
        )}
      </VStack>
    </Grid>
  );
}

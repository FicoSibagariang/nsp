import React from 'react';
import { HStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import type { LetterCategory } from '../types';

interface LetterFilterBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedCategory: string;
  onCategoryChange: (val: string) => void;
  selectedYear: string;
  onYearChange: (val: string) => void;
  categories: LetterCategory[];
  totalFound: number;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid var(--color-border-primary)',
  backgroundColor: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  fontSize: '14px',
  boxSizing: 'border-box',
};

export function LetterFilterBar({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedYear,
  onYearChange,
  categories,
  totalFound,
}: LetterFilterBarProps) {
  return (
    <Card style={{ padding: 16 }}>
      <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <div style={{ minWidth: 240 }}>
            <input
              type="text"
              placeholder="Cari Nomor Surat / Nama Pihak / Perihal..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={inputStyle}
            />
          </div>

          <Selector
            label="Kategori Surat"
            isLabelHidden
            size="sm"
            value={selectedCategory}
            onChange={onCategoryChange}
            options={[
              { value: 'ALL', label: 'Semua Jenis Surat' },
              ...categories.map((c) => ({ value: c.id, label: `${c.label} (${c.code})` })),
            ]}
            width={220}
          />

          <Selector
            label="Tahun Surat"
            isLabelHidden
            size="sm"
            value={selectedYear}
            onChange={onYearChange}
            options={[2024, 2025, 2026, 2027].map((y) => ({ value: String(y), label: `Tahun ${y}` }))}
            width={130}
          />
        </HStack>

        <Text type="supporting" color="secondary">
          Ditemukan: {totalFound} surat
        </Text>
      </HStack>
    </Card>
  );
}

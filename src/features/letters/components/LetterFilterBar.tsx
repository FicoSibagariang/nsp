import React from 'react';
import { HStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
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

          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            style={{ ...inputStyle, width: 'auto' }}
          >
            <option value="ALL">Semua Jenis Surat</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.code})
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => onYearChange(e.target.value)}
            style={{ ...inputStyle, width: 'auto' }}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={String(y)}>
                Tahun {y}
              </option>
            ))}
          </select>
        </HStack>

        <Text type="supporting" color="secondary">
          Ditemukan: {totalFound} surat
        </Text>
      </HStack>
    </Card>
  );
}

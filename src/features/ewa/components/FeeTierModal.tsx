import React, { useState, useEffect } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { apiFetch } from '../../../config';
import type { EwaFeeTier } from '../types';

interface FeeTierModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTier: EwaFeeTier | null;
  feeTiers: EwaFeeTier[];
  onSuccess: (updatedTiers: EwaFeeTier[]) => void;
}

export function FeeTierModal({
  isOpen,
  onClose,
  editingTier,
  feeTiers,
  onSuccess,
}: FeeTierModalProps) {
  const [tierMinInput, setTierMinInput] = useState('');
  const [tierMaxInput, setTierMaxInput] = useState('');
  const [tierNoMax, setTierNoMax] = useState(false);
  const [tierMemberFeeInput, setTierMemberFeeInput] = useState('');
  const [tierNonMemberFeeInput, setTierNonMemberFeeInput] = useState('');
  const [saveTierLoading, setSaveTierLoading] = useState(false);
  const [tierError, setTierError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTierError('');
    if (editingTier) {
      setTierMinInput(editingTier.minAmount.toLocaleString('id-ID'));
      setTierMaxInput(editingTier.maxAmount != null ? editingTier.maxAmount.toLocaleString('id-ID') : '');
      setTierNoMax(editingTier.maxAmount == null);
      setTierMemberFeeInput(editingTier.memberFee.toLocaleString('id-ID'));
      setTierNonMemberFeeInput(editingTier.nonMemberFee.toLocaleString('id-ID'));
    } else {
      const lastTier = feeTiers[feeTiers.length - 1];
      const defaultMin = lastTier && lastTier.maxAmount != null ? lastTier.maxAmount + 1 : 0;
      setTierMinInput(defaultMin > 0 ? defaultMin.toLocaleString('id-ID') : '0');
      setTierMaxInput('');
      setTierNoMax(false);
      setTierMemberFeeInput('');
      setTierNonMemberFeeInput('');
    }
  }, [isOpen, editingTier, feeTiers]);

  if (!isOpen) return null;

  const handleSaveTierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTierError('');

    const minAmount = Number(tierMinInput.replace(/\D/g, '') || 0);
    const maxAmount = tierNoMax ? null : Number(tierMaxInput.replace(/\D/g, '') || 0);
    const memberFee = Number(tierMemberFeeInput.replace(/\D/g, '') || 0);
    const nonMemberFee = Number(tierNonMemberFeeInput.replace(/\D/g, '') || 0);

    if (!tierNoMax && (maxAmount == null || maxAmount <= minAmount)) {
      setTierError('Batas atas nominal harus lebih besar dari batas bawah nominal');
      return;
    }

    setSaveTierLoading(true);
    try {
      let updatedList = [...feeTiers];
      if (editingTier && editingTier.id) {
        updatedList = updatedList.map((t) =>
          t.id === editingTier.id
            ? { ...t, minAmount, maxAmount, memberFee, nonMemberFee }
            : t
        );
      } else {
        updatedList.push({
          id: crypto.randomUUID(),
          minAmount,
          maxAmount,
          memberFee,
          nonMemberFee,
          tierOrder: updatedList.length + 1,
        });
      }

      updatedList.sort((a, b) => a.minAmount - b.minAmount);
      updatedList = updatedList.map((t, idx) => ({ ...t, tierOrder: idx + 1 }));

      const res = await apiFetch('/api/v1/ewa/fee-tiers', {
        method: 'PUT',
        body: JSON.stringify({ tiers: updatedList }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Gagal menyimpan tabel tarif');
      }

      onSuccess(data.data || []);
      onClose();
    } catch (err: any) {
      setTierError(err?.message || 'Terjadi kesalahan saat menyimpan tarif');
    } finally {
      setSaveTierLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Atur Rentang Biaya Admin EWA"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <Card style={{ width: 500, padding: 24, maxWidth: '90%' }}>
        <form onSubmit={handleSaveTierSubmit}>
          <VStack gap={4}>
            <Heading level={4}>{editingTier ? 'Edit Rentang Tarif Biaya Admin' : 'Tambah Rentang Tarif Biaya Admin'}</Heading>
            <Text type="supporting" color="secondary">
              Atur batas nominal penarikan serta besaran biaya admin flat untuk anggota dan non-anggota.
            </Text>

            {tierError && (
              <Text type="supporting" style={{ color: 'var(--color-text-error)' }}>
                ⚠️ {tierError}
              </Text>
            )}

            <VStack gap={3}>
              <VStack gap={1}>
                <Text type="supporting" style={{ fontWeight: 500 }}>Batas Bawah Nominal (Rp):</Text>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={tierMinInput}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setTierMinInput(digits !== '' ? Number(digits).toLocaleString('id-ID') : '');
                  }}
                  placeholder="Contoh: 100.000"
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 6,
                    border: '1px solid var(--color-border-primary)',
                    backgroundColor: 'var(--color-background-primary)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
              </VStack>

              <VStack gap={1}>
                <HStack justify="between" vAlign="center">
                  <Text type="supporting" style={{ fontWeight: 500 }}>Batas Atas Nominal (Rp):</Text>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={tierNoMax}
                      onChange={(e) => {
                        setTierNoMax(e.target.checked);
                        if (e.target.checked) setTierMaxInput('');
                      }}
                    />
                    <span>Tanpa Batas Atas (Tier Tertinggi)</span>
                  </label>
                </HStack>
                {!tierNoMax && (
                  <input
                    type="text"
                    inputMode="numeric"
                    required={!tierNoMax}
                    value={tierMaxInput}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setTierMaxInput(digits !== '' ? Number(digits).toLocaleString('id-ID') : '');
                    }}
                    placeholder="Contoh: 500.000"
                    style={{
                      width: '100%',
                      padding: 10,
                      borderRadius: 6,
                      border: '1px solid var(--color-border-primary)',
                      backgroundColor: 'var(--color-background-primary)',
                      color: 'var(--color-text-primary)',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </VStack>

              <VStack gap={1}>
                <Text type="supporting" style={{ fontWeight: 500 }}>Biaya Admin - Anggota Koperasi (Rp):</Text>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={tierMemberFeeInput}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setTierMemberFeeInput(digits !== '' ? Number(digits).toLocaleString('id-ID') : '');
                  }}
                  placeholder="Contoh: 10.000"
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 6,
                    border: '1px solid var(--color-border-primary)',
                    backgroundColor: 'var(--color-background-primary)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
              </VStack>

              <VStack gap={1}>
                <Text type="supporting" style={{ fontWeight: 500 }}>Biaya Admin - Bukan Anggota (Rp):</Text>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={tierNonMemberFeeInput}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setTierNonMemberFeeInput(digits !== '' ? Number(digits).toLocaleString('id-ID') : '');
                  }}
                  placeholder="Contoh: 15.000"
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 6,
                    border: '1px solid var(--color-border-primary)',
                    backgroundColor: 'var(--color-background-primary)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
              </VStack>
            </VStack>

            <HStack justify="end" gap={2}>
              <Button
                label="Batal"
                variant="ghost"
                type="button"
                onClick={onClose}
              />
              <Button
                label={saveTierLoading ? 'Menyimpan...' : 'Simpan Tarif'}
                variant="primary"
                type="submit"
                isDisabled={saveTierLoading}
              />
            </HStack>
          </VStack>
        </form>
      </Card>
    </div>
  );
}

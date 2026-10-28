import React from 'react';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useThemeMode } from '../../../contexts/ThemeContext';

interface PortalLoginProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  loading: boolean;
  error: string;
  googleBtnRef: React.RefObject<HTMLDivElement | null>;
  hasGoogleClientId: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--color-border-primary)',
  borderRadius: 'var(--radius-md, 6px)',
  backgroundColor: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  fontFamily: 'inherit',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
};

export const PortalLogin: React.FC<PortalLoginProps> = ({
  email,
  setEmail,
  password,
  setPassword,
  loading,
  error,
  googleBtnRef,
  hasGoogleClientId,
  onSubmit,
}) => {
  const { mode, setMode } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-background-subtle)',
        padding: 16,
      }}
    >
      <Card style={{ width: '100%', maxWidth: 400, padding: 32, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <IconButton
            label={isDark ? 'Mode Terang' : 'Mode Gelap'}
            icon={<Icon icon={isDark ? SunIcon : MoonIcon} size="sm" />}
            variant="ghost"
            onClick={() => setMode(isDark ? 'light' : 'dark')}
          />
        </div>
        <VStack gap={6}>
          <Heading level={2} justify="center">
            Portal Anggota
          </Heading>
          <Text type="body" color="secondary" justify="center">
            Masuk untuk melihat simpanan, pinjaman, dan jadwal angsuran Anda.
          </Text>
          {error ? (
            <Text type="supporting" style={{ color: 'var(--color-text-error)' }}>
              {error}
            </Text>
          ) : null}

          {hasGoogleClientId ? (
            <VStack gap={3}>
              <div
                ref={googleBtnRef}
                style={{
                  width: '100%',
                  minHeight: 44,
                  display: 'flex',
                  justifyContent: 'center',
                  opacity: loading ? 0.6 : 1,
                  pointerEvents: loading ? 'none' : 'auto',
                }}
              />
              <Text type="supporting" color="secondary" justify="center">
                Email Google harus sama dengan email portal yang didaftarkan pengurus.
              </Text>
              <HStack gap={2} vAlign="center" style={{ width: '100%' }}>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: 'var(--color-border-primary)',
                  }}
                />
                <Text type="supporting" color="secondary">
                  atau
                </Text>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: 'var(--color-border-primary)',
                  }}
                />
              </HStack>
            </VStack>
          ) : null}

          <form
            onSubmit={onSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <VStack gap={2}>
              <Text type="supporting">ID Anggota / Email</Text>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                required
              />
            </VStack>
            <VStack gap={2}>
              <Text type="supporting">Kata Sandi</Text>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                required
              />
            </VStack>
            <Button
              label={loading ? 'Memproses...' : 'Masuk'}
              type="submit"
              variant="primary"
              isDisabled={loading}
            />
          </form>

          <Text type="supporting" color="secondary" justify="center">
            Pengurus koperasi?{' '}
            <a
              href="/login"
              style={{
                color: 'var(--color-primary-500, #0171E3)',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              Login pengurus
            </a>
          </Text>
        </VStack>
      </Card>
    </div>
  );
};

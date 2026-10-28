import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export const PREVIEW_TOKEN_KEY = 'memberPreviewToken';
export const PREVIEW_NAME_KEY = 'memberPreviewName';
export const PREVIEW_RETURN_KEY = 'memberPreviewReturn';
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export function readPortalToken(): string | null {
  return sessionStorage.getItem(PREVIEW_TOKEN_KEY) || localStorage.getItem('memberToken');
}

export function usePortalAuth() {
  const navigate = useNavigate();
  const [isPreview] = useState(() => !!sessionStorage.getItem(PREVIEW_TOKEN_KEY));
  const [previewName] = useState(() => sessionStorage.getItem(PREVIEW_NAME_KEY) || '');
  const [memberToken, setMemberToken] = useState<string | null>(() => readPortalToken());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const clearPreviewSession = useCallback(() => {
    sessionStorage.removeItem(PREVIEW_TOKEN_KEY);
    sessionStorage.removeItem(PREVIEW_NAME_KEY);
    sessionStorage.removeItem(PREVIEW_RETURN_KEY);
  }, []);

  const exitPreview = useCallback(() => {
    const returnTo = sessionStorage.getItem(PREVIEW_RETURN_KEY) || '/members';
    clearPreviewSession();
    setMemberToken(null);
    navigate(returnTo);
  }, [clearPreviewSession, navigate]);

  const completeMemberLogin = useCallback(
    (token: string) => {
      clearPreviewSession();
      localStorage.setItem('memberToken', token);
      setMemberToken(token);
      setError('');
    },
    [clearPreviewSession]
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      clearPreviewSession();
      const res = await fetch('/api/v1/member-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }).then((r) => r.json());

      if (res.success) {
        completeMemberLogin(res.data.token);
      } else {
        setError(res.message || 'Login gagal');
      }
    } catch {
      setError('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (response: { credential: string }) => {
      setLoading(true);
      setError('');
      try {
        clearPreviewSession();
        const res = await fetch('/api/v1/member-auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ credential: response.credential }),
        }).then((r) => r.json());

        if (res.success && res.data?.token) {
          completeMemberLogin(res.data.token);
        } else {
          setError(
            res.message ||
              'Email Google tidak terdaftar sebagai akses portal. Hubungi pengurus.'
          );
        }
      } catch {
        setError('Terjadi kesalahan jaringan');
      } finally {
        setLoading(false);
      }
    },
    [clearPreviewSession, completeMemberLogin]
  );

  useEffect(() => {
    if (memberToken || !GOOGLE_CLIENT_ID) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40;

    const tryRender = () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id || !googleBtnRef.current) {
        attempts += 1;
        if (attempts < maxAttempts) {
          window.setTimeout(tryRender, 100);
        }
        return;
      }

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: '100%',
        text: 'signin_with',
        shape: 'rectangular',
        locale: 'id',
      });
    };

    tryRender();
    return () => {
      cancelled = true;
    };
  }, [memberToken, handleGoogleCredential]);

  const handleLogout = useCallback(() => {
    if (isPreview || sessionStorage.getItem(PREVIEW_TOKEN_KEY)) {
      exitPreview();
      return;
    }
    fetch('/api/v1/member-auth/logout', { method: 'POST' });
    localStorage.removeItem('memberToken');
    setMemberToken(null);
  }, [exitPreview, isPreview]);

  return {
    isPreview,
    previewName,
    memberToken,
    setMemberToken,
    email,
    setEmail,
    password,
    setPassword,
    loading,
    error,
    setError,
    googleBtnRef,
    hasGoogleClientId: Boolean(GOOGLE_CLIENT_ID),
    handleLogin,
    handleLogout,
    exitPreview,
    clearPreviewSession,
  };
}

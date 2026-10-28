import { hc } from 'hono/client';
import type { AppType } from '../../server/index';
import { apiFetch } from '../config';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options);
  
  let data;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  }
  
  if (!res.ok) {
    throw new ApiError(res.status, data?.message || res.statusText || 'Failed to fetch', data);
  }

  if (data && typeof data === 'object' && 'success' in data) {
    if (!data.success) {
      throw new ApiError(res.status, data.message || 'Operation failed', data);
    }
    return ('data' in data ? data.data : data) as T;
  }
  
  return data as T;
}

/**
 * Type-Safe Hono RPC Client.
 * Provides end-to-end type safety, autocompletion on endpoints,
 * and typed payloads/responses synchronized with backend route declarations.
 */
const rpcBaseUrl = typeof window !== 'undefined'
  ? (import.meta.env.VITE_API_URL || window.location.origin)
  : 'http://localhost:3000';

const createRpcClient = () => hc<AppType>('');
export type RpcClient = ReturnType<typeof createRpcClient>;

export const rpc: RpcClient = hc<AppType>(`${rpcBaseUrl}/api/v1`, {
  fetch: (input: string | URL | Request, init?: RequestInit) => {
    return apiFetch(input.toString(), init);
  },
});

export const api = {
  get: <T = unknown>(path: string, options?: RequestInit) => 
    request<T>(path, { ...options, method: 'GET' }),
    
  post: <T = unknown>(path: string, body?: unknown, options?: RequestInit) => 
    request<T>(path, { 
      ...options, 
      method: 'POST', 
      ...(body ? { body: JSON.stringify(body) } : {}),
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    }),
    
  put: <T = unknown>(path: string, body?: unknown, options?: RequestInit) => 
    request<T>(path, { 
      ...options, 
      method: 'PUT', 
      ...(body ? { body: JSON.stringify(body) } : {}),
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    }),
    
  delete: <T = unknown>(path: string, options?: RequestInit) => 
    request<T>(path, { ...options, method: 'DELETE' }),

  /** Direct reference to typed RPC Client */
  rpc,
};

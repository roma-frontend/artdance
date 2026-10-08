'use client';

import { useState } from 'react';

import { apiRoutes } from '@/config/routes';

export interface UseUploadOptions {
  endpoint?: string;
}

export interface UseUploadReturn {
  upload: (file: File, extra?: Record<string, string>) => Promise<string | null>;
  uploading: boolean;
  error: string | null;
}

export function useUpload(options: UseUploadOptions = {}): UseUploadReturn {
  const endpoint = options.endpoint ?? apiRoutes.mediaUpload();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File, extra?: Record<string, string>): Promise<string | null> => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (extra) {
        for (const [k, v] of Object.entries(extra)) fd.set(k, v);
      }
      const res = await fetch(endpoint, { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Upload failed' }));
        const msg = (body.error as string) ?? `HTTP ${res.status}`;
        setError(msg);
        return null;
      }
      const data = (await res.json()) as { url?: string; publicUrl?: string };
      const url = data.url ?? data.publicUrl ?? null;
      if (!url) {
        setError('No url in response');
        return null;
      }
      return url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, error };
}

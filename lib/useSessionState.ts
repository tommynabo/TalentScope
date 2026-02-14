/**
 * useSessionState - Hook para persistir estado en sessionStorage
 * 
 * Permite que el estado de la app sobreviva a recargas accidentales
 * o recargas por HMR de Vite. Estado se mantiene durante la sesión
 * del navegador (se pierde al cerrar la pestaña).
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export function useSessionState<T>(
  key: string,
  initialValue: T,
  options?: {
    /** Serialize only specific fields (for large objects) */
    pick?: (keyof T)[];
    /** Debounce writes in ms (default: 300) */
    debounce?: number;
  }
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const debounceMs = options?.debounce ?? 300;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullKey = `ts_session_${key}`;

  // Initialize from sessionStorage or use default
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(fullKey);
      if (stored) {
        const parsed = JSON.parse(stored) as T;
        return parsed;
      }
    } catch (e) {
      console.warn(`[useSessionState] Failed to restore "${key}":`, e);
    }
    return initialValue;
  });

  // Persist to sessionStorage on change (debounced)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      try {
        let toStore = value;
        if (options?.pick && typeof value === 'object' && value !== null) {
          const picked: any = {};
          for (const k of options.pick) {
            picked[k] = (value as any)[k];
          }
          toStore = picked;
        }
        sessionStorage.setItem(fullKey, JSON.stringify(toStore));
      } catch (e) {
        console.warn(`[useSessionState] Failed to persist "${key}":`, e);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, fullKey, debounceMs]);

  // Clear this key
  const clear = useCallback(() => {
    sessionStorage.removeItem(fullKey);
  }, [fullKey]);

  return [value, setValue, clear];
}

/**
 * Guarda un snapshot del estado actual de búsqueda para recuperarlo
 * si ocurre una recarga inesperada.
 */
export function saveSearchSnapshot(campaignId: string, data: {
  candidates: any[];
  logs: string[];
  searching: boolean;
  leadCount: number;
}) {
  try {
    sessionStorage.setItem(`ts_search_${campaignId}`, JSON.stringify({
      ...data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('[saveSearchSnapshot] Failed:', e);
  }
}

export function loadSearchSnapshot(campaignId: string): {
  candidates: any[];
  logs: string[];
  searching: boolean;
  leadCount: number;
  timestamp: number;
} | null {
  try {
    const stored = sessionStorage.getItem(`ts_search_${campaignId}`);
    if (!stored) return null;
    const data = JSON.parse(stored);
    // Only restore if less than 30 minutes old
    if (Date.now() - data.timestamp > 30 * 60 * 1000) {
      sessionStorage.removeItem(`ts_search_${campaignId}`);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSearchSnapshot(campaignId: string) {
  sessionStorage.removeItem(`ts_search_${campaignId}`);
}

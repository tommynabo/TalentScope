/**
 * useStableData - Hook para datos estables que NO se refrescan al cambiar de pestaña
 * 
 * Almacena datos en cache con un TTL configurable. Cuando el usuario vuelve
 * a la pestaña, los datos se sirven del cache si siguen siendo frescos,
 * evitando re-renders y flashes visuales innecesarios.
 * 
 * Si los datos son "stale" (antigüedad > staleTTL), se refrescan silenciosamente
 * en background sin mostrar loading state.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseStableDataOptions {
    /** TTL in ms before data is considered stale (default: 5 min) */
    staleTTL?: number;
    /** Whether to fetch on mount (default: true) */
    fetchOnMount?: boolean;
    /** Whether to silently refresh stale data on tab focus (default: true) */
    refreshOnFocus?: boolean;
}

interface UseStableDataResult<T> {
    data: T;
    loading: boolean;
    refresh: () => Promise<void>;
    lastFetchedAt: number | null;
}

// Global in-memory cache to survive component re-mounts within the same session
const dataCache = new Map<string, { data: any; fetchedAt: number }>();

export function useStableData<T>(
    key: string,
    fetchFn: () => Promise<T>,
    initialValue: T,
    options: UseStableDataOptions = {}
): UseStableDataResult<T> {
    const {
        staleTTL = 5 * 60 * 1000, // 5 minutes default
        fetchOnMount = true,
        refreshOnFocus = true,
    } = options;

    const isMounted = useRef(true);
    const isFetching = useRef(false);

    // Initialize from cache if available
    const [data, setData] = useState<T>(() => {
        const cached = dataCache.get(key);
        if (cached) return cached.data as T;
        return initialValue;
    });
    const [loading, setLoading] = useState(() => {
        // Only show loading if we have no cached data
        return !dataCache.has(key);
    });
    const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(() => {
        return dataCache.get(key)?.fetchedAt ?? null;
    });

    const fetchData = useCallback(async (showLoading = false) => {
        if (isFetching.current) return;
        isFetching.current = true;

        if (showLoading) setLoading(true);

        try {
            const result = await fetchFn();
            if (isMounted.current) {
                const now = Date.now();
                setData(result);
                setLastFetchedAt(now);
                setLoading(false);
                // Update global cache
                dataCache.set(key, { data: result, fetchedAt: now });
            }
        } catch (error) {
            console.error(`[useStableData] Error fetching "${key}":`, error);
            if (isMounted.current) setLoading(false);
        } finally {
            isFetching.current = false;
        }
    }, [key, fetchFn]);

    // Fetch on mount (only if no fresh cache)
    useEffect(() => {
        if (!fetchOnMount) return;

        const cached = dataCache.get(key);
        if (cached && (Date.now() - cached.fetchedAt) < staleTTL) {
            // Cache is fresh, use it
            setData(cached.data as T);
            setLastFetchedAt(cached.fetchedAt);
            setLoading(false);
            return;
        }

        // No cache or stale — fetch with loading state only if no data at all
        fetchData(!cached);
    }, [key]); // Only on mount / key change

    // Silently refresh on tab focus ONLY if data is stale
    useEffect(() => {
        if (!refreshOnFocus) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;

            const cached = dataCache.get(key);
            if (!cached) return;

            const age = Date.now() - cached.fetchedAt;
            if (age >= staleTTL) {
                // Data is stale — refresh silently (no loading spinner)
                console.log(`[useStableData] "${key}" is stale (${Math.round(age / 1000)}s old), refreshing silently...`);
                fetchData(false);
            }
            // If data is fresh, do nothing — no re-render, no flash
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [key, staleTTL, refreshOnFocus, fetchData]);

    // Cleanup
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    // Manual refresh (always fetches, shows loading)
    const refresh = useCallback(async () => {
        await fetchData(true);
    }, [fetchData]);

    return { data, loading, refresh, lastFetchedAt };
}

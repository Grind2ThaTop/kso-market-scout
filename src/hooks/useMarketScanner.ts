import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchScanSnapshot, ScanSnapshot } from '@/data/liveApi';

const QUERY_KEY = ['live-market-scan-v2'] as const;
const CACHE_KEY = 'kso-scan-cache-v2';
const CACHE_DB_NAME = 'kso-market-cache';
const CACHE_STORE_NAME = 'snapshots';
const CACHE_MAX_AGE_MS = 1000 * 60 * 30; // 30 minutes

type CachedSnapshotRecord = {
  data: ScanSnapshot;
  savedAt: number;
};

function isFresh(savedAt: number) {
  return Date.now() - savedAt <= CACHE_MAX_AGE_MS;
}

function loadCachedSnapshot(): CachedSnapshotRecord | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CachedSnapshotRecord;
    if (!parsed?.data || !parsed?.savedAt || !isFresh(parsed.savedAt)) {
      window.localStorage.removeItem(CACHE_KEY);
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function saveCachedSnapshot(record: CachedSnapshotRecord) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(record));
  } catch {
    // ignore storage quota issues; IndexedDB is the durable fallback
  }
}

function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(CACHE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadCachedSnapshotFromIndexedDb(): Promise<CachedSnapshotRecord | undefined> {
  const db = await openCacheDb();
  if (!db) return undefined;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE_NAME, 'readonly');
    const store = tx.objectStore(CACHE_STORE_NAME);
    const request = store.get(CACHE_KEY);

    request.onsuccess = () => {
      const record = request.result as CachedSnapshotRecord | undefined;
      db.close();
      if (!record?.data || !record?.savedAt || !isFresh(record.savedAt)) {
        resolve(undefined);
        return;
      }
      resolve(record);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function saveCachedSnapshotToIndexedDb(record: CachedSnapshotRecord) {
  const db = await openCacheDb();
  if (!db) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
    tx.objectStore(CACHE_STORE_NAME).put(record, CACHE_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export function useMarketScanner() {
  const queryClient = useQueryClient();
  const [isRestoringCache, setIsRestoringCache] = useState(() => !queryClient.getQueryData(QUERY_KEY));

  useEffect(() => {
    let cancelled = false;
    const localRecord = loadCachedSnapshot();

    if (localRecord?.data) {
      queryClient.setQueryData(QUERY_KEY, localRecord.data);
      setIsRestoringCache(false);
    }

    const restoreCachedSnapshot = async () => {
      try {
        const indexedDbRecord = await loadCachedSnapshotFromIndexedDb();
        if (cancelled || !indexedDbRecord?.data) return;

        if (!localRecord || indexedDbRecord.savedAt > localRecord.savedAt) {
          saveCachedSnapshot(indexedDbRecord);
          queryClient.setQueryData(QUERY_KEY, indexedDbRecord.data);
        }
      } catch {
        // ignore IndexedDB restore issues
      } finally {
        if (!cancelled) setIsRestoringCache(false);
      }
    };

    void restoreCachedSnapshot();

    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const snapshot = await fetchScanSnapshot();
      const record = { data: snapshot, savedAt: Date.now() };
      saveCachedSnapshot(record);
      void saveCachedSnapshotToIndexedDb(record);
      return snapshot;
    },
    initialData: () => queryClient.getQueryData<ScanSnapshot>(QUERY_KEY) ?? loadCachedSnapshot()?.data,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
    enabled: false,
  });

  return {
    ...query,
    isLoading: query.isLoading || (isRestoringCache && !query.data),
    isRestoringCache,
  };
}

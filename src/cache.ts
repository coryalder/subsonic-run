// @ts-ignore
import { createCache } from 'cache-manager';
// @ts-ignore
import fsStore from 'cache-manager-fs-hash';

// Memory cache for metadata using cache-manager's default in-memory store
const memoryCache = createCache({
  ttl: 600 * 1000, // 10 minutes (cache-manager uses milliseconds for default store)
});

let diskCacheOptions = {
  path: 'data/cache',
  ttl: 3600 * 24 * 7,
  maxsize: 1000 * 1000 * 1000,
  store: fsStore,
}

const diskCache = createCache(diskCacheOptions);


export async function getCached<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
  const cached = await memoryCache.get(key);
  if (cached !== undefined && cached !== null) {
    return cached as T;
  }
  const fresh = await fetcher();
  if (fresh !== null) {
    await memoryCache.set(key, fresh, ttl);
  }
  return fresh;
}

export async function getCachedDisk<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = await diskCache.get(key);
  if (cached !== undefined && cached !== null) {
    return cached as T;
  }
  const fresh = await fetcher();
  if (fresh !== null) {
    await diskCache.set(key, fresh);
  }
  return fresh;
}

export default memoryCache;

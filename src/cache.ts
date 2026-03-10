import NodeCache from 'node-cache';
// @ts-ignore
import { createCache } from 'cache-manager';
// @ts-ignore
import fsStore from 'cache-manager-fs-hash';

// Memory cache for metadata
const memoryCache = new NodeCache({ stdTTL: 600 });

// Disk cache for images
let diskCache: any;

function getDiskCache() {
  if (!diskCache) {
    const options = {
      path: 'cache',
      ttl: 3600 * 24 * 7,
      maxsize: 1000 * 1000 * 1000,
    };
    
    // In ESM, the CJS default export might be on the 'default' property
    const actualFsStore = (fsStore as any).default || fsStore;
    const store = (typeof actualFsStore.create === 'function') 
      ? actualFsStore.create(options) 
      : actualFsStore(options);

    diskCache = createCache(store);
  }
  return diskCache;
}

export async function getCached<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
  const cached = memoryCache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }
  const fresh = await fetcher();
  if (ttl !== undefined) {
    memoryCache.set(key, fresh, ttl);
  } else {
    memoryCache.set(key, fresh);
  }
  return fresh;
}

export async function getCachedDisk<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const store = getDiskCache();
  const cached = await store.get(key);
  if (cached !== undefined && cached !== null) {
    return cached as T;
  }
  const fresh = await fetcher();
  if (fresh !== null) {
    await store.set(key, fresh);
  }
  return fresh;
}

export default memoryCache;

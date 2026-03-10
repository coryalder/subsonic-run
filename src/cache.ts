import NodeCache from 'node-cache';
import SubsonicAPI from 'subsonic-api';

const cache = new NodeCache({ stdTTL: 600 }); // Default 10 minutes

export async function getCached<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }
  const fresh = await fetcher();
  if (ttl !== undefined) {
    cache.set(key, fresh, ttl);
  } else {
    cache.set(key, fresh);
  }
  return fresh;
}

export default cache;

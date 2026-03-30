export const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export async function getCachedData<T>(
	platform: App.Platform | undefined,
	key: string
): Promise<T | null> {
	const kv = platform?.env?.KV;
	if (!kv) return null;

	try {
		const cached = await kv.get(key, 'text');
		if (cached) {
			return JSON.parse(cached) as T;
		}
	} catch (e) {
		console.error('Cache read error:', e);
	}

	return null;
}

export function setCachedData(
	platform: App.Platform | undefined,
	key: string,
	data: any,
	ttlSeconds: number = CACHE_TTL_SECONDS
) {
	const kv = platform?.env?.KV;
	if (!kv) return;

	const put = async () => {
		try {
			const value = typeof data === 'string' ? data : JSON.stringify(data);
			await kv.put(key, value, { expirationTtl: ttlSeconds });
		} catch (e) {
			console.error('Cache write error:', e);
		}
	};

	if (platform?.ctx?.waitUntil) {
		platform.ctx.waitUntil(put());
	} else {
		put();
	}
}

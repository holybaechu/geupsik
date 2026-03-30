export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getCachedData<T>(platform: App.Platform | undefined, key: string): Promise<T | null> {
    const db = platform?.env?.DB;
    if (!db) return null;

    try {
        const cached = await db.prepare(
            "SELECT response_data, created_at FROM api_cache WHERE cache_key = ?"
        ).bind(key).first();

        if (cached) {
            const createdAt = new Date((cached.created_at as string).replace(' ', 'T') + 'Z');
            const ageMs = Date.now() - createdAt.getTime();
            
            if (ageMs < CACHE_TTL_MS) {
                return JSON.parse(cached.response_data as string) as T;
            }
        }
    } catch (e) {
        console.error("Cache read error:", e);
    }
    
    return null;
}

export function setCachedData(platform: App.Platform | undefined, key: string, data: any) {
    const db = platform?.env?.DB;
    if (!db) return;

    const query = async () => {
        try {
            const responseData = typeof data === 'string' ? data : JSON.stringify(data);
            await db.prepare(
                "INSERT INTO api_cache (cache_key, response_data, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(cache_key) DO UPDATE SET response_data=excluded.response_data, created_at=CURRENT_TIMESTAMP"
            ).bind(key, responseData).run();
        } catch (e) {
            console.error("Cache write error:", e);
        }
    };

    if (platform?.ctx?.waitUntil) {
        platform.ctx.waitUntil(query());
    } else {
        query();
    }
}

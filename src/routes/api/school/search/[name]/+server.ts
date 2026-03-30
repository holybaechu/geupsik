import { API_BASE_URL, API_TYPE } from "$lib/constants";

export async function GET({ params, platform }) {
    const { name } = params;
    
    const apiUrl = `${API_BASE_URL}/schoolInfo?Type=${API_TYPE}&SCHUL_NM=${encodeURIComponent(name)}`;
    const db = platform?.env?.DB;

    if (db) {
        try {
            const cached = await db.prepare(
                "SELECT response_data, created_at FROM api_cache WHERE cache_key = ?"
            ).bind(apiUrl).first();

            if (cached) {
                const createdAt = new Date((cached.created_at as string).replace(' ', 'T') + 'Z');
                const ageMs = Date.now() - createdAt.getTime();
                
                if (ageMs < 24 * 60 * 60 * 1000) {
                    return new Response(cached.response_data as string, {
                        headers: { "Content-Type": "application/json" }
                    });
                }
            }
        } catch (e) {
            console.error("Cache read error:", e);
        }
    }

    const res = await fetch(apiUrl, { method: "GET" });
    const data = await res.text();

    if (db) {
        try {
            await db.prepare(
                "INSERT INTO api_cache (cache_key, response_data, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(cache_key) DO UPDATE SET response_data=excluded.response_data, created_at=CURRENT_TIMESTAMP"
            ).bind(apiUrl, data).run();
        } catch (e) {
            console.error("Cache write error:", e);
        }
    }

    return new Response(data, {
        headers: {
            "Content-Type": "application/json",
        },
    });
}
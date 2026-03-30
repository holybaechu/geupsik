import { API_BASE_URL, API_TYPE } from "$lib/constants";

export async function GET({ params, url, platform }) {
    const { schoolCode } = params;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const officeCode = url.searchParams.get("officeCode");

    if (!officeCode) {
        return new Response(JSON.stringify({ error: "Office code (ATPT_OFCDC_SC_CODE) is required" }), {
            status: 400,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    let apiUrl = `${API_BASE_URL}/mealServiceDietInfo?Type=${API_TYPE}&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}`;
    if (from) apiUrl += `&MLSV_FROM_YMD=${from}`;
    if (to) apiUrl += `&MLSV_TO_YMD=${to}`;

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

    const res = await fetch(apiUrl);
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
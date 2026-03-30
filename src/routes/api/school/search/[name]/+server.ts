import { API_BASE_URL, API_TYPE } from "$lib/constants";

export async function GET({ params, platform }) {
    const { name } = params;
    
    const apiUrl = `${API_BASE_URL}/schoolInfo?Type=${API_TYPE}&SCHUL_NM=${encodeURIComponent(name)}`;
    const db = platform?.env?.DB;
    let neisData: any = null;
    let responseData = "";
    const cacheKey = `school:search:${encodeURIComponent(name)}`;

    if (db) {
        try {
            const cached = await db.prepare(
                "SELECT response_data, created_at FROM api_cache WHERE cache_key = ?"
            ).bind(cacheKey).first();

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
            // Ignore cache read errors
        }
    }

    const res = await fetch(apiUrl, { method: "GET" });
    const rawNeisData = await res.text();
    
    try {
        neisData = JSON.parse(rawNeisData);
    } catch (e) {
        return new Response(rawNeisData, {
            headers: { "Content-Type": "application/json" }
        });
    }

    let shouldCache = true;

    if (!neisData.schoolInfo) {
        responseData = JSON.stringify(neisData);
        // Do not cache transient errors from NEIS API
        if (neisData.RESULT && neisData.RESULT.CODE && neisData.RESULT.CODE.startsWith('ERROR')) {
            shouldCache = false;
        }
    } else {
        const rawSchools = neisData.schoolInfo[1].row;
        const optimizedSchools = rawSchools.map((s: any) => ({
            officeCode: s.ATPT_OFCDC_SC_CODE,
            schoolCode: s.SD_SCHUL_CODE,
            schoolName: s.SCHUL_NM
        }));
        responseData = JSON.stringify({ schools: optimizedSchools });
    }

    if (shouldCache) {
        if (db && platform?.ctx?.waitUntil) {
            platform.ctx.waitUntil((async () => {
                try {
                    await db.prepare(
                        "INSERT INTO api_cache (cache_key, response_data, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(cache_key) DO UPDATE SET response_data=excluded.response_data, created_at=CURRENT_TIMESTAMP"
                    ).bind(cacheKey, responseData).run();
                } catch (e) {
                    // Ignore cache write errors
                }
            })());
        } else if (db) {
            try {
                await db.prepare(
                    "INSERT INTO api_cache (cache_key, response_data, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(cache_key) DO UPDATE SET response_data=excluded.response_data, created_at=CURRENT_TIMESTAMP"
                ).bind(cacheKey, responseData).run();
            } catch (e) {
                // Ignore cache write errors
            }
        }
    }

    return new Response(responseData, {
        headers: {
            "Content-Type": "application/json",
        },
    });
}
import { API_BASE_URL, API_ATPT_OFCDC_SC_CODE, API_TYPE, CACHE_TTL } from "$lib/constants";

export async function GET({ params, platform }) {
    const { name } = params;
    const cacheKey = `school_search:${name}`;

    if (platform?.env?.KV) {
        const cached = await platform.env.KV.get(cacheKey);
        if (cached) {
            return new Response(cached, {
                headers: { "Content-Type": "application/json", "X-Cache": "HIT" },
            });
        }
    }
    
    const res = await fetch(`${API_BASE_URL}/schoolInfo?Type=${API_TYPE}&ATPT_OFCDC_SC_CODE=${API_ATPT_OFCDC_SC_CODE}&SCHUL_NM=${encodeURIComponent(name)}`, {
        method: "GET",
    })

    const data = await res.text();

    if (platform?.env?.KV && res.ok) {
        await platform.env.KV.put(cacheKey, data, { expirationTtl: CACHE_TTL });
    }

    return new Response(data, {
        headers: {
            "Content-Type": "application/json",
            "X-Cache": "MISS"
        },
    })
}
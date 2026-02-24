import { API_BASE_URL, API_ATPT_OFCDC_SC_CODE, API_TYPE, CACHE_TTL } from "$lib/constants";

export async function GET({ params, url, platform }) {
    const { schoolCode } = params;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    
    const cacheKey = `meal:${schoolCode}:${from}:${to}`;

    if (platform?.env?.KV) {
        const cached = await platform.env.KV.get(cacheKey);
        if (cached) {
            return new Response(cached, {
                headers: { "Content-Type": "application/json", "X-Cache": "HIT" },
            });
        }
    }

    let apiUrl = `${API_BASE_URL}/mealServiceDietInfo?Type=${API_TYPE}&ATPT_OFCDC_SC_CODE=${API_ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${schoolCode}`;
    if (from) apiUrl += `&MLSV_FROM_YMD=${from}`;
    if (to) apiUrl += `&MLSV_TO_YMD=${to}`;

    const res = await fetch(apiUrl)
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
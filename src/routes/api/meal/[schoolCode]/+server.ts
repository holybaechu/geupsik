import { API_BASE_URL, API_ATPT_OFCDC_SC_CODE, API_TYPE } from "$lib/constants";

export async function GET({ params, url }) {
    const { schoolCode } = params;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    
    let apiUrl = `${API_BASE_URL}/mealServiceDietInfo?Type=${API_TYPE}&ATPT_OFCDC_SC_CODE=${API_ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${schoolCode}`;
    if (from) apiUrl += `&MLSV_FROM_YMD=${from}`;
    if (to) apiUrl += `&MLSV_TO_YMD=${to}`;

    const res = await fetch(apiUrl)
    return new Response(res.body, {
        headers: {
            "Content-Type": "application/json",
        },
    })
}
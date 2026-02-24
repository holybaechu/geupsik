import { API_BASE_URL, API_ATPT_OFCDC_SC_CODE, API_TYPE } from "$lib/constants";

export async function GET({ params }) {
    const { name } = params;
    
    const res = await fetch(`${API_BASE_URL}/schoolInfo?Type=${API_TYPE}&ATPT_OFCDC_SC_CODE=${API_ATPT_OFCDC_SC_CODE}&SCHUL_NM=${encodeURIComponent(name)}`, {
        method: "GET",
    })

    return new Response(res.body, {
        headers: {
            "Content-Type": "application/json",
        },
    })
}
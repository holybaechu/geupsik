import { API_BASE_URL, API_TYPE } from '$lib/constants';
import { getCachedData, setCachedData } from '$lib/server/cache';

export async function GET({ params, platform }) {
	const { name } = params;

	const apiUrl = `${API_BASE_URL}/schoolInfo?Type=${API_TYPE}&SCHUL_NM=${encodeURIComponent(name)}`;
	let neisData: any = null;
	let responseData = '';
	const cacheKey = `school:search:${encodeURIComponent(name)}`;

	const cachedData = await getCachedData<any>(platform, cacheKey);
	if (cachedData) {
		return new Response(JSON.stringify(cachedData), {
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' }
		});
	}

	const res = await fetch(apiUrl, { method: 'GET' });
	const rawNeisData = await res.text();

	try {
		neisData = JSON.parse(rawNeisData);
	} catch (e) {
		return new Response(rawNeisData, {
			headers: { 'Content-Type': 'application/json' }
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
		setCachedData(platform, cacheKey, responseData);
	}

	return new Response(responseData, {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': shouldCache ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'no-store'
		}
	});
}

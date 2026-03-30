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
    let neisData: any = null;
    let optimizedMeals: any[] = [];
    const cacheKey = `meal:search:${officeCode}:${schoolCode}:${from || 'none'}:${to || 'none'}`;

    if (db) {
        try {
            const cached = await db.prepare(
                "SELECT response_data, created_at FROM api_cache WHERE cache_key = ?"
            ).bind(cacheKey).first();

            if (cached) {
                const createdAt = new Date((cached.created_at as string).replace(' ', 'T') + 'Z');
                const ageMs = Date.now() - createdAt.getTime();
                
                if (ageMs < 24 * 60 * 60 * 1000) {
                    try {
                        const parsed = JSON.parse(cached.response_data as string);
                        if (parsed.meals) {
                            optimizedMeals = parsed.meals;
                        } else {
                            return new Response(cached.response_data as string, {
                                headers: { "Content-Type": "application/json" }
                            });
                        }
                    } catch (e) {
                        // Ignore parse error
                    }
                }
            }
        } catch (e) {
            // Ignore cache read errors
        }
    }

    if (optimizedMeals.length === 0) {
        const res = await fetch(apiUrl);
        const rawNeisData = await res.text();
        
        try {
            neisData = JSON.parse(rawNeisData);
        } catch (e) {
            return new Response(rawNeisData, {
                headers: { "Content-Type": "application/json" },
            });
        }

        if (!neisData.mealServiceDietInfo) {
            const errorData = JSON.stringify(neisData);
            
            let shouldCache = true;
            if (neisData.RESULT && neisData.RESULT.CODE && neisData.RESULT.CODE.startsWith('ERROR')) {
                shouldCache = false;
            }

            if (shouldCache && db && platform?.ctx?.waitUntil) {
                platform.ctx.waitUntil((async () => {
                    try {
                        await db.prepare(
                            "INSERT INTO api_cache (cache_key, response_data, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(cache_key) DO UPDATE SET response_data=excluded.response_data, created_at=CURRENT_TIMESTAMP"
                        ).bind(cacheKey, errorData).run();
                    } catch (e) {
                        // Ignore cache write errors
                    }
                })());
            } else if (shouldCache && db) {
                try {
                    await db.prepare(
                        "INSERT INTO api_cache (cache_key, response_data, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(cache_key) DO UPDATE SET response_data=excluded.response_data, created_at=CURRENT_TIMESTAMP"
                    ).bind(cacheKey, errorData).run();
                } catch (e) {
                    console.error("Cache write error:", e);
                }
            }
            
            return new Response(errorData, {
                headers: { "Content-Type": "application/json" },
            });
        }

        const rawMeals = neisData.mealServiceDietInfo[1].row;
        optimizedMeals = rawMeals.map((m: any) => ({
            id: `${m.ATPT_OFCDC_SC_CODE}-${m.SD_SCHUL_CODE}-${m.MLSV_YMD}-${m.MMEAL_SC_NM}`,
            schoolName: m.SCHUL_NM,
            date: m.MLSV_YMD,
            type: m.MMEAL_SC_NM,
            dishes: m.DDISH_NM,
            calories: m.CAL_INFO,
            nutrients: m.NTR_INFO
        }));

        const cacheData = JSON.stringify({ meals: optimizedMeals });

        if (db && platform?.ctx?.waitUntil) {
            platform.ctx.waitUntil((async () => {
                try {
                    await db.prepare(
                        "INSERT INTO api_cache (cache_key, response_data, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(cache_key) DO UPDATE SET response_data=excluded.response_data, created_at=CURRENT_TIMESTAMP"
                    ).bind(cacheKey, cacheData).run();
                } catch (e) {
                    console.error("Cache write error:", e);
                }
            })());
        } else if (db) {
            try {
                await db.prepare(
                    "INSERT INTO api_cache (cache_key, response_data, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(cache_key) DO UPDATE SET response_data=excluded.response_data, created_at=CURRENT_TIMESTAMP"
                ).bind(cacheKey, cacheData).run();
            } catch (e) {
                // Ignore cache write errors
            }
        }
    }

    const mealIds = optimizedMeals.map(m => m.id);

    let counts: Record<string, { votes: number; comments: number }> = {};

    if (db && mealIds.length > 0) {
        try {
            const placeholders = mealIds.map(() => '?').join(',');
            
            const [votesResult, commentsResult] = await Promise.all([
                db.prepare(`SELECT meal_id, COUNT(*) as count FROM votes WHERE meal_id IN (${placeholders}) GROUP BY meal_id`).bind(...mealIds).all(),
                db.prepare(`SELECT meal_id, COUNT(*) as count FROM comments WHERE meal_id IN (${placeholders}) GROUP BY meal_id`).bind(...mealIds).all()
            ]);

            for (const mealId of mealIds) {
                counts[mealId] = { votes: 0, comments: 0 };
            }

            for (const row of votesResult.results || []) {
                const r = row as { meal_id: string; count: number };
                if (counts[r.meal_id]) counts[r.meal_id].votes = r.count;
            }

            for (const row of commentsResult.results || []) {
                const r = row as { meal_id: string; count: number };
                if (counts[r.meal_id]) counts[r.meal_id].comments = r.count;
            }
        } catch (e) {
            // Ignore fetch count errors
        }
    }

    for (const meal of optimizedMeals) {
        meal.votes = counts[meal.id]?.votes || 0;
        meal.comments = counts[meal.id]?.comments || 0;
    }

    return new Response(JSON.stringify({ meals: optimizedMeals }), {
        headers: {
            "Content-Type": "application/json",
        },
    });
}
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ platform, request }) => {
    const db = platform?.env?.DB;
    if (!db) {
        return new Response(JSON.stringify({ error: 'Database not available' }), { status: 500 });
    }

    const { mealIds } = await request.json();

    if (!mealIds || !Array.isArray(mealIds) || mealIds.length === 0) {
        return new Response(JSON.stringify({ error: 'mealIds array required' }), { status: 400 });
    }

    try {
        const placeholders = mealIds.map(() => '?').join(',');

        const votesResult = await db.prepare(
            `SELECT meal_id, COUNT(*) as count FROM votes WHERE meal_id IN (${placeholders}) GROUP BY meal_id`
        ).bind(...mealIds).all();

        const commentsResult = await db.prepare(
            `SELECT meal_id, COUNT(*) as count FROM comments WHERE meal_id IN (${placeholders}) GROUP BY meal_id`
        ).bind(...mealIds).all();

        const counts: Record<string, { votes: number; comments: number }> = {};
        
        for (const mealId of mealIds) {
            counts[mealId] = { votes: 0, comments: 0 };
        }

        for (const row of votesResult.results || []) {
            const mealId = (row as { meal_id: string; count: number }).meal_id;
            if (counts[mealId]) {
                counts[mealId].votes = (row as { count: number }).count;
            }
        }

        for (const row of commentsResult.results || []) {
            const mealId = (row as { meal_id: string; count: number }).meal_id;
            if (counts[mealId]) {
                counts[mealId].comments = (row as { count: number }).count;
            }
        }

        return new Response(JSON.stringify({ counts }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Batch counts error:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch counts' }), { status: 500 });
    }
};

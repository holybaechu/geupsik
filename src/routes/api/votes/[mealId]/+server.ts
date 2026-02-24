import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ platform, params }) => {
    const db = platform?.env?.DB;
    if (!db) {
        return new Response(JSON.stringify({ error: 'Database not available' }), { status: 500 });
    }

    const { mealId } = params;

    try {
        const result = await db.prepare(
            'SELECT COUNT(*) as count FROM votes WHERE meal_id = ?'
        ).bind(mealId).first();

        return new Response(JSON.stringify({ count: result?.count || 0 }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch votes' }), { status: 500 });
    }
};

export const POST: RequestHandler = async ({ platform, params, request }) => {
    const db = platform?.env?.DB;
    if (!db) {
        return new Response(JSON.stringify({ error: 'Database not available' }), { status: 500 });
    }

    const { mealId } = params;
    const { fingerprint } = await request.json();

    if (!fingerprint) {
        return new Response(JSON.stringify({ error: 'Fingerprint required' }), { status: 400 });
    }

    try {
        await db.prepare(
            'INSERT OR IGNORE INTO votes (meal_id, user_fingerprint) VALUES (?, ?)'
        ).bind(mealId, fingerprint).run();

        const result = await db.prepare(
            'SELECT COUNT(*) as count FROM votes WHERE meal_id = ?'
        ).bind(mealId).first();

        return new Response(JSON.stringify({ count: result?.count || 0, voted: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to add vote' }), { status: 500 });
    }
};

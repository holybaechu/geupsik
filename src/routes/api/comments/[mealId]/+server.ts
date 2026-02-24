import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ platform, params }) => {
    const db = platform?.env?.DB;
    if (!db) {
        return new Response(JSON.stringify({ error: 'Database not available' }), { status: 500 });
    }

    const { mealId } = params;

    try {
        const result = await db.prepare(
            'SELECT id, text, created_at FROM comments WHERE meal_id = ? ORDER BY created_at DESC'
        ).bind(mealId).all();

        return new Response(JSON.stringify({ comments: result.results || [] }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch comments' }), { status: 500 });
    }
};

export const POST: RequestHandler = async ({ platform, params, request }) => {
    const db = platform?.env?.DB;
    if (!db) {
        return new Response(JSON.stringify({ error: 'Database not available' }), { status: 500 });
    }

    const { mealId } = params;
    const { text } = await request.json();

    if (!text || !text.trim()) {
        return new Response(JSON.stringify({ error: 'Text required' }), { status: 400 });
    }

    try {
        const result = await db.prepare(
            'INSERT INTO comments (meal_id, text) VALUES (?, ?) RETURNING id, text, created_at'
        ).bind(mealId, text.trim()).first();

        return new Response(JSON.stringify({ comment: result }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to add comment' }), { status: 500 });
    }
};

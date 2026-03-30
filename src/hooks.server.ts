import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};

export const scheduled = async (
	_event: any,
	env: App.Platform['env'],
	_ctx: any
) => {
	const db = env?.DB;
	if (!db) {
		console.error("D1 Database not found in scheduled function");
		return;
	}

	try {
		const result = await db.prepare(
			"DELETE FROM api_cache WHERE created_at < datetime('now', '-1 day')"
		).run();
		
		console.log(`Cache cleanup completed. Success: ${result.success}`);
	} catch (error) {
		console.error("Failed to clean up cache:", error);
	}
};

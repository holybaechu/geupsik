import { type Plugin } from 'vite';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export default function plugin(): Plugin {
	return {
		name: 'vite-append-trigger',

		closeBundle() {
			const workerPath = resolve(__dirname, '../.svelte-kit/cloudflare/_worker.js');

			if (!existsSync(workerPath)) return;

			let content = readFileSync(workerPath, 'utf-8');

			content += `
import { scheduled } from "../output/server/entries/hooks.server.js"
worker_default.scheduled = scheduled;
`;

			writeFileSync(workerPath, content, 'utf-8');
		}
	};
}
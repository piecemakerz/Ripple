import { once } from 'node:events';
import { createApp } from '../../server/app.js';
import type { RippleStore } from '../../server/store.js';

export async function openApi(store: RippleStore) {
  const server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected loopback TCP address');
  const base = `http://127.0.0.1:${address.port}`;
  return {
    async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
      const response = await fetch(base + path, {
        method,
        signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data: unknown = await response.json();
      if (!response.ok)
        throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
      return data as T;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections();
      }),
  };
}
export type EvaluationApi = Awaited<ReturnType<typeof openApi>>;

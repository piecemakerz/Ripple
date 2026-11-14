import express, { type ErrorRequestHandler } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from './errors.js';
import type { RippleStore } from './store.js';
import { Ingestion } from './ingestion.js';

const id = z.string().min(1).max(150);
export const changeInput = z
  .object({
    requestId: z.uuid(),
    itemId: id,
    expectedRevision: z.number().int().positive(),
    after: z.string().trim().min(1).max(10000),
    evidenceId: id,
  })
  .strict();
const reviewInput = z
  .object({
    status: z.enum(['keep', 'revise', 'defer']),
    reason: z.string().trim().min(1, 'Add a reason for your decision.').max(4000),
  })
  .strict();

export function createApp(store: RippleStore) {
  const app = express();
  const ingestion = new Ingestion(store);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    // Loopback binding plus Host/Origin checks prevent arbitrary sites from writing to the local app.
    const host = req.headers.host ?? '';
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))
      return res.status(403).json({ error: 'This app is available on localhost only.' });
    if (req.headers.origin && req.headers.origin !== `http://${host}`)
      return res.status(403).json({ error: 'Cross-origin requests are not allowed.' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.get('/api/health', (_req, res) => {
    store.query('RETURN 1 AS ok');
    res.json({ ok: true, engine: 'Relate', version: '1.0.1' });
  });
  app.get('/api/workspace', (_req, res) => res.json(store.workspace()));
  app.get('/api/items/:id/impact', (req, res) => res.json(store.impact(req.params.id)));
  app.get('/api/evidence/:id', (req, res) => res.json(store.getEvidence(req.params.id)));
  app.get('/api/changes/:id', (req, res) => res.json(store.getChange(req.params.id)));
  // All store calls are synchronous; no await may interleave a transaction on this connection.
  app.post('/api/sources', (req, res) => res.status(201).json(ingestion.source(req.body)));
  app.post('/api/items', (req, res) => res.status(201).json(ingestion.item(req.body)));
  app.post('/api/candidates', (req, res) => res.status(201).json(ingestion.candidate(req.body)));
  app.put('/api/candidates/:id', (req, res) => res.json(ingestion.decide(req.params.id, req.body)));
  app.post('/api/dependencies/:id/replacements', (req, res) =>
    res.status(201).json(ingestion.replace(req.params.id, req.body)),
  );
  app.post('/api/proposals', (req, res) => res.status(201).json(ingestion.proposal(req.body)));
  app.post('/api/changes', (req, res) =>
    res.status(201).json(store.applyChange(changeInput.parse(req.body))),
  );
  app.put('/api/changes/:changeId/reviews/:itemId', (req, res) => {
    const input = reviewInput.parse(req.body);
    res.json(store.saveReview(req.params.changeId, req.params.itemId, input.status, input.reason));
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof ZodError)
      return void res.status(400).json({ error: error.issues[0].message, code: 'INVALID_INPUT' });
    if (error instanceof AppError)
      return void res.status(error.status).json({ error: error.message, code: error.code });
    if (error instanceof SyntaxError && 'body' in error)
      return void res.status(400).json({ error: 'Invalid JSON request.' });
    if (typeof error === 'object' && error && 'status' in error && error.status === 413)
      return void res.status(413).json({ error: 'Request is too large.' });
    console.error(error);
    res.status(500).json({
      error: 'The operation could not be saved. Your input is preserved; try again.',
      code: 'STORE_ERROR',
    });
  };
  app.use(errors);
  return app;
}

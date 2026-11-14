import express, { type ErrorRequestHandler } from 'express';
import { caseNames, type CaseName } from './case.js';
import { emptyReview, reviewPacket, type SemanticReview } from './review.js';
import { readReview, ReviewConflict, saveReview } from './review-files.js';
import { escapeHtml, reviewPage } from './review-page.js';

export function createReviewApp(directory: string) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const host = `127.0.0.1:${req.socket.localPort}`;
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      // Native form POSTs can send Origin: null under no-referrer. Preserve same-origin
      // form provenance while withholding the referrer from external source links.
      'Referrer-Policy': 'same-origin',
    });
    if (
      req.headers.host !== host ||
      (req.method !== 'GET' && req.headers.origin !== `http://${host}`)
    ) {
      res.status(403).send('Use this review server from its own loopback origin.');
      return;
    }
    next();
  });
  // Up to 21 reasons of 2,000 UTF-16 units, including URL-encoded non-Latin text.
  app.use(express.urlencoded({ extended: false, limit: '512kb', parameterLimit: 100 }));
  app.get('/', (_req, res) => res.redirect('/case/async-owner'));
  app.param('caseName', (req, res, next, name: string) => {
    if (!caseNames.includes(name as CaseName)) res.status(404).send('Unknown evaluation case.');
    else next();
  });
  app.get('/case/:caseName', (req, res) => {
    const packet = reviewPacket(req.params.caseName as CaseName);
    res.type('html').send(reviewPage(packet, readReview(directory, packet)));
  });
  app.get('/case/:caseName/records/:revision', (req, res) => {
    const packet = reviewPacket(req.params.caseName as CaseName);
    if (!/^[1-9]\d{0,5}$/.test(req.params.revision)) {
      res.status(400).send('Invalid review revision.');
      return;
    }
    const review = readReview(directory, packet, Number(req.params.revision));
    res.attachment(`${packet.caseName}-review-${review.revision}.json`).json(review);
  });
  app.post('/case/:caseName', (req, res) => {
    const packet = reviewPacket(req.params.caseName as CaseName);
    const review = emptyReview(packet);
    const body: Record<string, unknown> = req.body ?? {};
    const allowed = new Set([
      'revision',
      'fixtureSha256',
      'checklistSha256',
      'reviewerKind',
      'reviewerName',
      'attested',
      ...packet.subjects.flatMap((_s, i) => [`decision-${i}`, `reason-${i}`]),
    ]);
    if (
      Object.keys(body).some((key) => !allowed.has(key) || typeof body[key] !== 'string') ||
      !/^\d{1,6}$/.test(String(body.revision)) ||
      (body.attested !== undefined && body.attested !== 'yes')
    ) {
      res.status(400).send('Invalid, duplicate or unknown form fields.');
      return;
    }
    const field = (key: string) => (typeof body[key] === 'string' ? (body[key] as string) : '');
    review.revision = Number(body.revision);
    review.fixtureSha256 = field('fixtureSha256');
    review.checklistSha256 = field('checklistSha256');
    review.reviewer = {
      kind: field('reviewerKind') as SemanticReview['reviewer']['kind'],
      name: field('reviewerName'),
      attested: body.attested === 'yes',
    };
    review.entries = packet.subjects.map((s, i) => ({
      id: s.id,
      decision: field(`decision-${i}`) as SemanticReview['entries'][number]['decision'],
      reason: field(`reason-${i}`),
    }));
    try {
      saveReview(directory, packet, review);
      res.redirect(303, `/case/${packet.caseName}`);
    } catch (error) {
      res
        .status(error instanceof ReviewConflict ? 409 : 400)
        .type('html')
        .send(reviewPage(packet, review, (error as Error).message));
    }
  });
  app.use((_req, res) => res.status(404).send('Not found.'));
  const onError: ErrorRequestHandler = (
    error: NodeJS.ErrnoException & { status?: number },
    _req,
    res,
    _next,
  ) => {
    const status = error.code === 'ENOENT' ? 404 : error.status === 413 ? 413 : 500;
    res
      .status(status)
      .type('html')
      .send(
        `<h1>Review unavailable</h1><p>${escapeHtml(status === 500 ? 'Could not read a valid review artifact. Inspect the terminal; existing files were not replaced.' : status === 404 ? 'Review snapshot not found.' : 'Review input exceeds the request limit.')}</p>`,
      );
    if (status === 500) console.error(error);
  };
  app.use(onError);
  return app;
}

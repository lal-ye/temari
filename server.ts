import express, { Request, Response } from 'express';
import path from 'node:path';
import 'dotenv/config';
import { createApiApp } from './server/app.ts';

// Render always uses public BYOK safeguards, even if TEMARI_HOSTED is omitted.
const hosted = process.env.RENDER === 'true' || process.env.TEMARI_HOSTED === 'true';
const app = createApiApp({ hosted });
if (hosted) {
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    next();
  });
}
const PORT = Number(process.env.PORT || 3000);

// Vite middleware / production serving
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : PORT;
    console.log(`StudySmart server running on http://0.0.0.0:${port}`);
  });
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10000).unref();
    });
  }
}

setupViteOrStatic().catch(error => {
  console.error('Server startup failed:', error);
  process.exit(1);
});


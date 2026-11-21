import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { fetchNewsArticle, fetchProxiedImage } from './src/utils/newsFetchService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/fetch-news', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const result = await fetchNewsArticle(rawUrl);
    return res.status(result.status).json(result.body);
  });

  app.get('/api/proxy-image', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const result = await fetchProxiedImage(rawUrl);

    if (result.status !== 200 || !result.buffer || !result.contentType) {
      return res.status(result.status).send(result.errorText ?? 'Could not proxy image');
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(result.buffer);
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`NS-Photocard server listening on http://localhost:${port}`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

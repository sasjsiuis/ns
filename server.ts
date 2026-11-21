import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { validateOutboundUrl } from './src/utils/urlSecurity';
import { parseNewsArticleHtml, stripNatunSylhetBannerPath } from './src/utils/newsParser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const MAX_REDIRECTS = 4;
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

async function safeOutboundFetch(
  rawUrl: string,
  options: { accept: string; method?: 'GET' | 'HEAD' }
): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const validated = await validateOutboundUrl(currentUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(validated.toString(), {
        method: options.method ?? 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          Accept: options.accept,
          'Accept-Language': 'bn-BD,bn;q=0.9,en-US;q=0.8,en;q=0.7',
          Referer: `${validated.origin}/`,
        },
      });

      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get('location')
      ) {
        const location = response.headers.get('location')!;
        currentUrl = new URL(location, validated).toString();
        continue;
      }

      return { response, finalUrl: validated.toString() };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('অতিরিক্ত রিডাইরেক্ট পাওয়া গেছে');
}

async function readBoundedBuffer(response: Response, maxBytes: number): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    const ab = await response.arrayBuffer();
    if (ab.byteLength > maxBytes) {
      throw new Error('ফাইলের আকার অনুমোদিত সীমার চেয়ে বড়');
    }
    return Buffer.from(ab);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('ফাইলের আকার অনুমোদিত সীমার চেয়ে বড়');
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

async function verifyImageReachable(urlStr: string): Promise<boolean> {
  try {
    const { response } = await safeOutboundFetch(urlStr, {
      accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      method: 'HEAD',
    });
    const ct = response.headers.get('content-type') || '';
    if (response.ok && ct.toLowerCase().startsWith('image/')) {
      return true;
    }
    // Some servers disallow HEAD; retry lightweight GET check
    if (response.status === 405 || response.status === 403) {
      const getCheck = await safeOutboundFetch(urlStr, {
        accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        method: 'GET',
      });
      const getCt = getCheck.response.headers.get('content-type') || '';
      await getCheck.response.body?.cancel();
      return getCheck.response.ok && getCt.toLowerCase().startsWith('image/');
    }
    return false;
  } catch {
    return false;
  }
}

async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  // 1. News extraction API: fetches article HTML, extracts headline + clean original photo (no /share/ banner)
  app.get('/api/fetch-news', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    if (!rawUrl.trim()) {
      return res.status(400).json({ error: 'অনুগ্রহ করে একটি নিউজ লিংক দিন।' });
    }

    try {
      const { response, finalUrl } = await safeOutboundFetch(rawUrl, {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      });

      if (!response.ok) {
        return res.status(502).json({
          error: `নিউজ পাতাটি লোড করা যায়নি (স্ট্যাটাস ${response.status})।`,
        });
      }

      const buf = await readBoundedBuffer(response, MAX_HTML_BYTES);
      const html = buf.toString('utf-8');
      const extracted = parseNewsArticleHtml(html, finalUrl);

      let finalImageUrl = extracted.imageUrl;
      let bannerStripped = extracted.bannerStripped;

      // Double-check only when the clean URL was synthetically derived by stripping /share/ from og:image
      if (finalImageUrl && extracted.needsImageVerification) {
        const cleanOk = await verifyImageReachable(finalImageUrl);
        if (!cleanOk) {
          const shareCheck = stripNatunSylhetBannerPath(finalImageUrl);
          // Try alternate full image from page if available
          const fallbackAlt = extracted.alternateImages[0];
          if (fallbackAlt && (await verifyImageReachable(fallbackAlt))) {
            finalImageUrl = fallbackAlt;
          } else {
            finalImageUrl = shareCheck.cleanUrl;
            bannerStripped = false;
          }
        }
      }

      const proxiedImageUrl = finalImageUrl
        ? `/api/proxy-image?url=${encodeURIComponent(finalImageUrl)}`
        : '';

      return res.json({
        headline: extracted.headline,
        category: extracted.category,
        dateText: extracted.dateText,
        imageUrl: proxiedImageUrl,
        originalImageUrl: finalImageUrl,
        bannerStripped,
        sourceUrl: finalUrl,
        sourceDomain: extracted.sourceDomain,
      });
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'ওয়েবসাইট থেকে সাড়া পেতে বেশি সময় লাগছে। আবার চেষ্টা করুন অথবা ম্যানুয়ালি যোগ করুন।'
          : err instanceof Error
            ? err.message
            : 'তথ্য সংগ্রহ করা যায়নি।';
      return res.status(422).json({ error: message });
    }
  });

  // 2. Same-origin image proxy so Canvas 2D exports high-res PNG cleanly without CORS taint
  app.get('/api/proxy-image', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    if (!rawUrl.trim()) {
      return res.status(400).send('Missing url');
    }

    try {
      const { response } = await safeOutboundFetch(rawUrl, {
        accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      });

      if (!response.ok) {
        return res.status(502).send('Failed to fetch upstream image');
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/') || contentType.includes('svg')) {
        return res.status(415).send('Unsupported image content type');
      }

      const buffer = await readBoundedBuffer(response, MAX_IMAGE_BYTES);
      res.setHeader('Content-Type', contentType.split(';')[0]);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(buffer);
    } catch {
      return res.status(502).send('Could not proxy image');
    }
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

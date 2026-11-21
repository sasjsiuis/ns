import type { IncomingMessage, ServerResponse } from 'node:http';
import { fetchProxiedImage } from '../src/utils/newsFetchService.js';

type VercelRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

function getQueryUrl(req: VercelRequest): string {
  const fromQuery = req.query?.url;
  if (typeof fromQuery === 'string') return fromQuery;
  if (Array.isArray(fromQuery) && typeof fromQuery[0] === 'string') return fromQuery[0];
  try {
    const parsed = new URL(req.url ?? '/', 'http://localhost');
    return parsed.searchParams.get('url') ?? '';
  } catch {
    return '';
  }
}

export default async function handler(req: VercelRequest, res: ServerResponse) {
  try {
    const rawUrl = getQueryUrl(req);
    const result = await fetchProxiedImage(rawUrl);

    if (result.status !== 200 || !result.buffer || !result.contentType) {
      res.statusCode = result.status;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(result.errorText ?? 'Could not proxy image');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.end(result.buffer);
  } catch {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Could not proxy image');
  }
}

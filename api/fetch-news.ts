import type { IncomingMessage, ServerResponse } from 'node:http';
import { fetchNewsArticle } from '../src/utils/newsFetchService';

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
  const rawUrl = getQueryUrl(req);
  const result = await fetchNewsArticle(rawUrl);

  res.statusCode = result.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(result.body));
}

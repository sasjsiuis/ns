import { validateOutboundUrl } from './urlSecurity.js';
import { parseNewsArticleHtml, stripNatunSylhetBannerPath } from './newsParser.js';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const MAX_REDIRECTS = 4;
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export interface FetchNewsResult {
  status: number;
  body: Record<string, unknown>;
}

export interface ProxyImageResult {
  status: number;
  contentType?: string;
  buffer?: Buffer;
  errorText?: string;
}

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

export async function fetchNewsArticle(rawUrl: string): Promise<FetchNewsResult> {
  if (!rawUrl.trim()) {
    return { status: 400, body: { error: 'অনুগ্রহ করে একটি নিউজ লিংক দিন।' } };
  }

  try {
    const { response, finalUrl } = await safeOutboundFetch(rawUrl, {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });

    if (!response.ok) {
      return {
        status: 502,
        body: {
          error: `নিউজ পাতাটি লোড করা যায়নি (স্ট্যাটাস ${response.status})।`,
        },
      };
    }

    const buf = await readBoundedBuffer(response, MAX_HTML_BYTES);
    const html = buf.toString('utf-8');
    const extracted = parseNewsArticleHtml(html, finalUrl);

    let finalImageUrl = extracted.imageUrl;
    let bannerStripped = extracted.bannerStripped;

    if (finalImageUrl && extracted.needsImageVerification) {
      const cleanOk = await verifyImageReachable(finalImageUrl);
      if (!cleanOk) {
        const shareCheck = stripNatunSylhetBannerPath(finalImageUrl);
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

    return {
      status: 200,
      body: {
        headline: extracted.headline,
        category: extracted.category,
        dateText: extracted.dateText,
        imageUrl: proxiedImageUrl,
        originalImageUrl: finalImageUrl,
        bannerStripped,
        sourceUrl: finalUrl,
        sourceDomain: extracted.sourceDomain,
      },
    };
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'ওয়েবসাইট থেকে সাড়া পেতে বেশি সময় লাগছে। আবার চেষ্টা করুন অথবা ম্যানুয়ালি যোগ করুন।'
        : err instanceof Error
          ? err.message
          : 'তথ্য সংগ্রহ করা যায়নি।';
    return { status: 422, body: { error: message } };
  }
}

export async function fetchProxiedImage(rawUrl: string): Promise<ProxyImageResult> {
  if (!rawUrl.trim()) {
    return { status: 400, errorText: 'Missing url' };
  }

  try {
    const { response } = await safeOutboundFetch(rawUrl, {
      accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    });

    if (!response.ok) {
      return { status: 502, errorText: 'Failed to fetch upstream image' };
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/') || contentType.includes('svg')) {
      return { status: 415, errorText: 'Unsupported image content type' };
    }

    const buffer = await readBoundedBuffer(response, MAX_IMAGE_BYTES);
    return {
      status: 200,
      contentType: contentType.split(';')[0],
      buffer,
    };
  } catch {
    return { status: 502, errorText: 'Could not proxy image' };
  }
}

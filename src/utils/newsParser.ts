export interface ExtractedNewsMetadata {
  headline: string;
  category: string;
  dateText: string;
  imageUrl: string;
  alternateImages: string[];
  bannerStripped: boolean;
  needsImageVerification: boolean;
  sourceDomain: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  copy: '©',
};

export function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  return input
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripHtmlTags(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]*>/g, ' '));
}

/**
 * Extracts article numeric ID from natunsylhet24.com URLs like
 * https://www.natunsylhet24.com/details/62238 or /news/62238
 */
export function extractNatunSylhetArticleId(urlStr: string): string | null {
  try {
    const parsed = new URL(urlStr);
    if (!parsed.hostname.toLowerCase().includes('natunsylhet24.com')) {
      return null;
    }
    const match = parsed.pathname.match(/\/(?:details|news)\/(\d+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Converts a natunsylhet24.com share/banner image URL into the clean original full-resolution URL.
 * Example:
 *   https://www.natunsylhet24.com/images/news/63/share/62238.jpg
 * -> https://www.natunsylhet24.com/images/news/63/62238.jpg
 */
export function stripNatunSylhetBannerPath(imageUrl: string): {
  cleanUrl: string;
  stripped: boolean;
} {
  if (!imageUrl) return { cleanUrl: '', stripped: false };
  const cleaned = imageUrl.replace(
    /(\/images\/news\/\d+)\/(?:share|small|thumb)\/([^/?#]+(?:\.[a-z0-9]+))/i,
    '$1/$2'
  );
  return {
    cleanUrl: cleaned,
    stripped: cleaned !== imageUrl,
  };
}

function resolveAbsoluteUrl(candidate: string, baseUrl: string): string {
  const cleaned = decodeHtmlEntities(candidate).trim();
  if (!cleaned || cleaned.startsWith('data:') || cleaned.startsWith('javascript:')) {
    return '';
  }
  try {
    return new URL(cleaned, baseUrl).toString();
  } catch {
    return '';
  }
}

function getMetaContent(html: string, attrName: 'property' | 'name', attrValue: string): string {
  const escaped = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patternA = new RegExp(
    `<meta[^>]+${attrName}=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i'
  );
  const patternB = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attrName}=["']${escaped}["'][^>]*>`,
    'i'
  );
  const match = html.match(patternA) || html.match(patternB);
  return match ? decodeHtmlEntities(match[1]) : '';
}

function isIgnoredImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('/images/ad/') ||
    lower.includes('/images/portal/') ||
    lower.includes('/images/writer/') ||
    lower.includes('/images/flag/') ||
    lower.includes('google news') ||
    lower.includes('itlabsolutions') ||
    lower.includes('logo') ||
    lower.includes('favicon') ||
    lower.includes('avatar') ||
    lower.includes('banner-ad') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.svg')
  );
}

/**
 * Formats scraped Bangla publish timestamp into a crisp editorial date string.
 * Example: "প্রকাশ: ২১ নভেম্বর ২০২৬ ১০:৪৪" -> "২১ নভেম্বর ২০২৬"
 */
export function cleanBanglaDate(raw: string): string {
  const text = stripHtmlTags(raw)
    .replace(/^(?:প্রকাশিত|প্রকাশ|আপডেট)\s*[:：]?\s*/i, '')
    .trim();

  // Extract Bangla day + month + year if time follows
  const bnDateMatch = text.match(/([০-৯]{1,2}\s+[\u0980-\u09FF]+\s+[০-৯]{4})/);
  if (bnDateMatch) {
    return bnDateMatch[1].trim();
  }

  return text.slice(0, 40);
}

/**
 * Formats today's date in Bangla as fallback when an article has no parseable date.
 */
export function getTodayBanglaDate(now: Date = new Date()): string {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const bnMonths = [
    'জানুয়ারি',
    'ফেব্রুয়ারি',
    'মার্চ',
    'এপ্রিল',
    'মে',
    'জুন',
    'জুলাই',
    'আগস্ট',
    'সেপ্টেম্বর',
    'অক্টোবর',
    'নভেম্বর',
    'ডিসেম্বর',
  ];
  const toBn = (n: number) =>
    String(n)
      .split('')
      .map((ch) => bnDigits[Number(ch)] ?? ch)
      .join('');
  return `${toBn(now.getDate())} ${bnMonths[now.getMonth()]} ${toBn(now.getFullYear())}`;
}

/**
 * Extracts headline, clean full-quality main photo (without share banners),
 * category, and date from article HTML.
 */
export function parseNewsArticleHtml(html: string, pageUrl: string): ExtractedNewsMetadata {
  const parsedPageUrl = new URL(pageUrl);
  const sourceDomain = parsedPageUrl.hostname.replace(/^www\./i, '');
  const isNatunSylhet = sourceDomain.toLowerCase().includes('natunsylhet24.com');
  const articleId = extractNatunSylhetArticleId(pageUrl);

  // 1. Headline extraction (prefer article H1 on natunsylhet24, then og:title, then <title>)
  let headline = '';
  const newsTitleMatch = html.match(
    /<div[^>]+class=["'][^"']*news-title[^"']*["'][^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i
  );
  if (newsTitleMatch) {
    headline = stripHtmlTags(newsTitleMatch[1]);
  }
  if (!headline) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      headline = stripHtmlTags(h1Match[1]);
    }
  }
  if (!headline) {
    headline =
      getMetaContent(html, 'property', 'og:title') ||
      getMetaContent(html, 'name', 'twitter:title');
  }
  if (!headline) {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      headline = stripHtmlTags(titleMatch[1])
        .replace(/\s*[|–—-]\s*নতুন সিলেট.*$/i, '')
        .replace(/\s*[|–—-]\s*natunsylhet.*$/i, '')
        .trim();
    }
  }

  // 2. Category extraction
  let category = '';
  const catMatch = html.match(
    /<p[^>]+class=["'][^"']*category[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
  );
  if (catMatch) {
    category = stripHtmlTags(catMatch[1]);
  }
  if (!category) {
    category = getMetaContent(html, 'property', 'article:section') || 'সিলেট';
  }

  // 3. Date extraction
  let dateText = '';
  const dateMatch = html.match(
    /<div[^>]+class=["'][^"']*news-time[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  );
  if (dateMatch) {
    dateText = cleanBanglaDate(dateMatch[1]);
  }
  if (!dateText) {
    const timeTag = html.match(/<time[^>]*>([\s\S]*?)<\/time>/i);
    if (timeTag) {
      dateText = cleanBanglaDate(timeTag[1]);
    }
  }
  if (!dateText) {
    dateText = getTodayBanglaDate();
  }

  // 4. Clean Original Image extraction (CRITICAL: avoid /share/ watermarked banner!)
  const candidates: string[] = [];
  let bannerStripped = false;

  // Gather all <img> src and data-src attributes
  const imgTagRegex = /<img\b[^>]*>/gi;
  let imgTagMatch: RegExpExecArray | null;
  while ((imgTagMatch = imgTagRegex.exec(html)) !== null) {
    const tag = imgTagMatch[0];
    const srcMatch =
      tag.match(/\bsrc=["']([^"']+)["']/i) || tag.match(/\bdata-src=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const absUrl = resolveAbsoluteUrl(srcMatch[1], pageUrl);
    if (!absUrl || isIgnoredImageUrl(absUrl)) continue;
    candidates.push(absUrl);
  }

  let selectedImage = '';
  let needsImageVerification = false;

  if (isNatunSylhet) {
    // Priority A: Exact article ID full-size image WITHOUT /share/ or /small/
    if (articleId) {
      const exactFull = candidates.find(
        (u) =>
          new RegExp(`/images/news/\\d+/${articleId}\\.(?:jpg|jpeg|png|webp)`, 'i').test(u) &&
          !/\/(?:share|small|thumb)\//i.test(u)
      );
      if (exactFull) {
        selectedImage = exactFull;
        bannerStripped = true;
      }
    }

    // Priority B: Any non-share, non-small /images/news/<folder>/<id>.<ext> inside the main details
    if (!selectedImage) {
      const firstFull = candidates.find(
        (u) =>
          /\/images\/news\/\d+\/\d+\.(?:jpg|jpeg|png|webp)/i.test(u) &&
          !/\/(?:share|small|thumb)\//i.test(u)
      );
      if (firstFull) {
        selectedImage = firstFull;
        bannerStripped = true;
      }
    }

    // Priority C: Transform og:image by stripping /share/ -> original full quality photo
    if (!selectedImage) {
      const ogImg = resolveAbsoluteUrl(
        getMetaContent(html, 'property', 'og:image') ||
          getMetaContent(html, 'name', 'twitter:image'),
        pageUrl
      );
      if (ogImg) {
        const transformed = stripNatunSylhetBannerPath(ogImg);
        selectedImage = transformed.cleanUrl;
        bannerStripped = transformed.stripped;
        needsImageVerification = transformed.stripped;
      }
    }
  } else {
    // General news portals: prefer JSON-LD NewsArticle image or clean og:image or first large article image
    const ogImg = resolveAbsoluteUrl(
      getMetaContent(html, 'property', 'og:image') ||
        getMetaContent(html, 'name', 'twitter:image'),
      pageUrl
    );
    if (ogImg) {
      const transformed = stripNatunSylhetBannerPath(ogImg);
      selectedImage = transformed.cleanUrl;
      bannerStripped = transformed.stripped;
      needsImageVerification = transformed.stripped;
    } else if (candidates.length > 0) {
      selectedImage = candidates[0];
    }
  }

  const alternateImages = Array.from(
    new Set(
      candidates
        .filter((u) => !/\/(?:small|thumb|share)\//i.test(u))
        .filter((u) => u !== selectedImage)
    )
  ).slice(0, 6);

  return {
    headline,
    category,
    dateText,
    imageUrl: selectedImage,
    alternateImages,
    bannerStripped,
    needsImageVerification,
    sourceDomain,
  };
}

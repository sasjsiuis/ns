import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanBanglaDate,
  decodeHtmlEntities,
  extractNatunSylhetArticleId,
  parseNewsArticleHtml,
  stripNatunSylhetBannerPath,
} from './newsParser';
import { isPrivateOrReservedIp, normalizeUserUrl } from './urlSecurity';

test('stripNatunSylhetBannerPath removes /share/ and /small/ segments to yield clean full-res image', () => {
  const shareUrl = 'https://www.natunsylhet24.com/images/news/63/share/62238.jpg';
  const result = stripNatunSylhetBannerPath(shareUrl);
  assert.equal(result.stripped, true);
  assert.equal(result.cleanUrl, 'https://www.natunsylhet24.com/images/news/63/62238.jpg');

  const alreadyClean = 'https://www.natunsylhet24.com/images/news/63/62238.jpg?newst=1795238820';
  const res2 = stripNatunSylhetBannerPath(alreadyClean);
  assert.equal(res2.stripped, false);
  assert.equal(res2.cleanUrl, alreadyClean);
});

test('parseNewsArticleHtml extracts natunsylhet24 clean photo instead of og:image /share/ banner or sidebar /small/ thumbnails', () => {
  const sampleHtml = `
    <html>
      <head>
        <meta property="og:image" content="https://www.natunsylhet24.com/images/news/63/share/62238.jpg" />
      </head>
      <body>
        <section class="news-details">
          <p class="category"><a href="https://www.natunsylhet24.com/sylhet">সিলেট</a></p>
          <div class="news-title"><h1> পলাতক আসামিদের ফেরাতে পাসপোর্টের প্রয়োজন নেই: পররাষ্ট্র প্রতিমন্ত্রী </h1></div>
          <div class="news-time"><p>প্রকাশ: ২১ নভেম্বর ২০২৬ ১০:৪৪ </p></div>
          <img src="https://www.natunsylhet24.com/images/portal/natunsylhet.png" alt="natunsylhet">
          <img src="https://www.natunsylhet24.com/images/writer/writer.jpg" alt="writer">
          <img src="https://www.natunsylhet24.com/images/news/63/62238.jpg?newst=1795238820" width="100%">
          <img class="lazy" data-src="https://www.natunsylhet24.com/images/news/63/small/62272.jpg">
        </section>
      </body>
    </html>
  `;

  const parsed = parseNewsArticleHtml(sampleHtml, 'https://www.natunsylhet24.com/details/62238');
  assert.equal(
    parsed.headline,
    'পলাতক আসামিদের ফেরাতে পাসপোর্টের প্রয়োজন নেই: পররাষ্ট্র প্রতিমন্ত্রী'
  );
  assert.equal(parsed.category, 'সিলেট');
  assert.equal(parsed.dateText, '২১ নভেম্বর ২০২৬');
  assert.equal(
    parsed.imageUrl,
    'https://www.natunsylhet24.com/images/news/63/62238.jpg?newst=1795238820'
  );
  assert.equal(parsed.bannerStripped, true);
});

test('parseNewsArticleHtml falls back to stripping /share/ from og:image when article img is absent', () => {
  const sampleHtml = `
    <html>
      <head>
        <meta property="og:image" content="https://www.natunsylhet24.com/images/news/63/share/62273.jpg" />
      </head>
      <body>
        <h1>সিলেটে রাতে মোটরসাইকেল চলাচলে বিধিনিষেধ এসএমপি&#39;র</h1>
        <img class="lazy" data-src="https://www.natunsylhet24.com/images/news/63/small/62272.jpg">
      </body>
    </html>
  `;
  const parsed = parseNewsArticleHtml(sampleHtml, 'https://www.natunsylhet24.com/details/62273');
  assert.equal(parsed.headline, "সিলেটে রাতে মোটরসাইকেল চলাচলে বিধিনিষেধ এসএমপি'র");
  assert.equal(parsed.imageUrl, 'https://www.natunsylhet24.com/images/news/63/62273.jpg');
  assert.equal(parsed.bannerStripped, true);
});

test('extractNatunSylhetArticleId parses both /details/ and /news/ paths', () => {
  assert.equal(
    extractNatunSylhetArticleId('https://www.natunsylhet24.com/details/62238'),
    '62238'
  );
  assert.equal(extractNatunSylhetArticleId('https://natunsylhet24.com/news/99123/'), '99123');
  assert.equal(extractNatunSylhetArticleId('https://example.com/details/123'), null);
});

test('cleanBanglaDate and decodeHtmlEntities normalize Bengali text cleanly', () => {
  assert.equal(cleanBanglaDate('প্রকাশ: ২১ নভেম্বর ২০২৬ ১০:৪৪ '), '২১ নভেম্বর ২০২৬');
  assert.equal(decodeHtmlEntities('&lsquo;জয় বাংলা&rsquo; &amp; সিলেট'), '‘জয় বাংলা’ & সিলেট');
});

test('normalizeUserUrl handles protocol-less links and rejects unsafe schemes', () => {
  assert.equal(
    normalizeUserUrl('natunsylhet24.com/details/62238'),
    'https://natunsylhet24.com/details/62238'
  );
  assert.equal(normalizeUserUrl('javascript:alert(1)'), null);
  assert.equal(normalizeUserUrl('file:///etc/passwd'), null);
  assert.equal(normalizeUserUrl('not a link'), null);
});

test('isPrivateOrReservedIp blocks loopback, RFC1918, and cloud metadata IPs while allowing public IPs', () => {
  assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true);
  assert.equal(isPrivateOrReservedIp('10.0.0.5'), true);
  assert.equal(isPrivateOrReservedIp('172.16.4.1'), true);
  assert.equal(isPrivateOrReservedIp('192.168.1.10'), true);
  assert.equal(isPrivateOrReservedIp('::1'), true);
  assert.equal(isPrivateOrReservedIp('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('104.21.12.55'), false);
});

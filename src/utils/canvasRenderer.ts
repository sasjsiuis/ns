import {
  HEADLINE_FONTS,
  type CardAspectRatio,
  type CardStyleId,
  type CardTypographyOptions,
  type NewsArticleData,
  type PhotoEditState,
  type PhotoTonePreset,
} from '../types/photocard';
import {
  computeCroppedSourceRect,
  computePhotoDrawRect,
  solveHeadlineLayout,
  type Rect,
} from './headlineLayout';

export const NATUN_SYLHET_LOGO_PATH =
  '/assets/aistudio/natunsylhet.png.pagespeed.ce.v3LHfP6lHG_f9fbf741.png';

export function getCanvasDimensions(aspect: CardAspectRatio): { width: number; height: number } {
  return aspect === '4:5' ? { width: 1080, height: 1350 } : { width: 1080, height: 1080 };
}

export function getPhotoFrameRect(style: CardStyleId, aspect: CardAspectRatio): Rect {
  const isTall = aspect === '4:5';
  if (style === 'editorial-classic') {
    return { x: 56, y: 148, w: 968, h: isTall ? 714 : 526 };
  }
  if (style === 'editorial-midnight') {
    return { x: 44, y: 44, w: 992, h: isTall ? 780 : 582 };
  }
  // editorial-gallery (headline top, photo bottom inside symmetrical archival mat)
  return { x: 66, y: isTall ? 412 : 378, w: 948, h: isTall ? 786 : 552 };
}

function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (radius <= 0.5) {
    ctx.rect(x, y, w, h);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
  }
  ctx.closePath();
}

function buildPhotoFilterString(edit: PhotoEditState): string {
  const presetAdjustments: Record<
    PhotoTonePreset,
    { b: number; c: number; s: number; sepia: number; grayscale: number }
  > = {
    normal: { b: 1, c: 1, s: 1, sepia: 0, grayscale: 0 },
    crisp: { b: 1.03, c: 1.12, s: 1.08, sepia: 0, grayscale: 0 },
    warm: { b: 1.02, c: 1.04, s: 1.06, sepia: 0.16, grayscale: 0 },
    mono: { b: 1.02, c: 1.15, s: 0, sepia: 0.04, grayscale: 1 },
  };
  const p = presetAdjustments[edit.tonePreset] ?? presetAdjustments.normal;
  const brightness = Math.round(edit.brightness * p.b);
  const contrast = Math.round(edit.contrast * p.c);
  const saturate = Math.round(edit.saturation * p.s);

  const parts = [
    `brightness(${brightness}%)`,
    `contrast(${contrast}%)`,
    `saturate(${saturate}%)`,
  ];
  if (p.sepia > 0) parts.push(`sepia(${Math.round(p.sepia * 100)}%)`);
  if (p.grayscale > 0) parts.push(`grayscale(${Math.round(p.grayscale * 100)}%)`);
  return parts.join(' ');
}

function drawPhotoStage(
  ctx: CanvasRenderingContext2D,
  frame: Rect,
  photo: HTMLImageElement | null,
  edit: PhotoEditState,
  isDarkTheme: boolean
) {
  ctx.save();
  // Outer photo stage bounds
  traceRoundedRect(ctx, frame.x, frame.y, frame.w, frame.h, 4);
  ctx.clip();

  // 1. Backdrop fill (Blur or Custom Color)
  if (edit.backdropMode === 'blur' && photo && photo.naturalWidth > 0) {
    const src = computeCroppedSourceRect(photo.naturalWidth, photo.naturalHeight, edit.crop);
    const coverScale = Math.max(frame.w / src.w, frame.h / src.h);
    const blurPad = Math.max(36, edit.blurAmount * 1.8);
    const bw = src.w * coverScale + blurPad * 2;
    const bh = src.h * coverScale + blurPad * 2;
    const bx = frame.x + frame.w / 2 - bw / 2;
    const by = frame.y + frame.h / 2 - bh / 2;

    ctx.save();
    ctx.fillStyle = isDarkTheme ? '#111316' : '#E7E2D8';
    ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
    ctx.filter = `blur(${edit.blurAmount}px) brightness(0.76) saturate(1.12)`;
    ctx.drawImage(photo, src.x, src.y, src.w, src.h, bx, by, bw, bh);
    ctx.restore();

    // Subtle tonal veil so the foreground photo separates cleanly from blurred backdrop
    ctx.fillStyle = isDarkTheme ? 'rgba(10, 12, 15, 0.22)' : 'rgba(20, 18, 15, 0.12)';
    ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
  } else {
    ctx.fillStyle = edit.backdropColor || (isDarkTheme ? '#18181B' : '#E5E0D5');
    ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
  }

  // 2. Main foreground photo (or clean placeholder)
  if (photo && photo.naturalWidth > 0) {
    const src = computeCroppedSourceRect(photo.naturalWidth, photo.naturalHeight, edit.crop);
    const drawRect = computePhotoDrawRect(src.w, src.h, frame, edit);

    // Visible intersection with frame (so rounding corners is ALWAYS visible even at 100%+ zoom!)
    const visLeft = Math.max(frame.x, drawRect.x);
    const visTop = Math.max(frame.y, drawRect.y);
    const visRight = Math.min(frame.x + frame.w, drawRect.x + drawRect.w);
    const visBottom = Math.min(frame.y + frame.h, drawRect.y + drawRect.h);
    const visW = Math.max(1, visRight - visLeft);
    const visH = Math.max(1, visBottom - visTop);

    // If user rounds corners or zooms out, add a subtle gallery elevation shadow behind photo
    if (edit.zoom < 0.99 || edit.borderRadius > 2) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.34)';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      traceRoundedRect(ctx, visLeft, visTop, visW, visH, edit.borderRadius);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    traceRoundedRect(ctx, visLeft, visTop, visW, visH, edit.borderRadius);
    ctx.clip();

    ctx.filter = buildPhotoFilterString(edit);
    if (edit.flipX) {
      const cx = drawRect.x + drawRect.w / 2;
      ctx.translate(cx, 0);
      ctx.scale(-1, 1);
      ctx.translate(-cx, 0);
    }

    ctx.drawImage(
      photo,
      src.x,
      src.y,
      src.w,
      src.h,
      drawRect.x,
      drawRect.y,
      drawRect.w,
      drawRect.h
    );
    ctx.restore();

    // Subtle crisp inner hairline around floated/rounded photo
    if (edit.zoom < 0.99 || edit.borderRadius > 2) {
      ctx.save();
      traceRoundedRect(ctx, visLeft + 0.5, visTop + 0.5, visW - 1, visH - 1, edit.borderRadius);
      ctx.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  } else {
    // Graceful archival empty placeholder
    ctx.fillStyle = isDarkTheme ? '#1A1D22' : '#EBE6DC';
    ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
    ctx.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.12)' : 'rgba(20,19,17,0.14)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(frame.x + 28, frame.y + 28, frame.w - 56, frame.h - 56);
    ctx.setLineDash([]);

    ctx.fillStyle = isDarkTheme ? '#9CA3AF' : '#57534E';
    ctx.font = '600 28px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'নিউজ লিংক পেস্ট করুন অথবা ছবি আপলোড করুন',
      frame.x + frame.w / 2,
      frame.y + frame.h / 2
    );
  }

  ctx.restore();
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  mode: 'multiply-paper' | 'ivory-plaque'
) {
  if (!logo || logo.naturalWidth === 0) {
    // Clean typographic fallback if logo is still loading
    ctx.save();
    ctx.font = '700 34px "Hind Siliguri", sans-serif';
    ctx.fillStyle = '#B91C1C';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('নতুন', x, y + h / 2);
    const w1 = ctx.measureText('নতুন ').width;
    ctx.fillStyle = '#047857';
    ctx.fillText('সিলেট', x + w1, y + h / 2);
    ctx.restore();
    return;
  }

  ctx.save();
  if (mode === 'ivory-plaque') {
    const padX = 16;
    const padY = 10;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#FFFFFF';
    traceRoundedRect(ctx, x, y, w + padX * 2, h + padY * 2, 10);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.drawImage(logo, x + padX, y + padY, w, h);
  } else {
    // Multiply blend makes the logo's pure white ground invisible on warm editorial paper
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(logo, x, y, w, h);
  }
  ctx.restore();
}

function drawCommentNoteDivider(
  ctx: CanvasRenderingContext2D,
  options: {
    centerX: number;
    centerY: number;
    lineLeftX: number;
    lineRightX: number;
    text: string;
    lineColor: string;
    badgeBg: string;
    badgeBorder: string;
    iconColor: string;
    textColor: string;
  }
) {
  const {
    centerX,
    centerY,
    lineLeftX,
    lineRightX,
    text,
    lineColor,
    badgeBg,
    badgeBorder,
    iconColor,
    textColor,
  } = options;

  ctx.save();
  let fontSize = 20;
  ctx.font = `700 ${fontSize}px "Hind Siliguri", sans-serif`;
  let textW = ctx.measureText(text).width;

  const iconW = 20;
  const iconH = 15;
  const gap = 9;
  const padX = 18;
  const maxBadgeW = Math.max(160, lineRightX - lineLeftX - 32);
  while (padX * 2 + iconW + gap + textW > maxBadgeW && fontSize > 14) {
    fontSize -= 1;
    ctx.font = `700 ${fontSize}px "Hind Siliguri", sans-serif`;
    textW = ctx.measureText(text).width;
  }

  const badgeH = 38;
  const badgeW = Math.min(maxBadgeW, padX * 2 + iconW + gap + textW);
  const badgeX = centerX - badgeW / 2;
  const badgeY = centerY - badgeH / 2;

  // Flanking editorial hairlines
  const ruleGap = 16;
  ctx.fillStyle = lineColor;
  const leftRuleW = badgeX - ruleGap - lineLeftX;
  if (leftRuleW > 8) {
    ctx.fillRect(lineLeftX, centerY - 0.75, leftRuleW, 1.5);
  }
  const rightRuleStart = badgeX + badgeW + ruleGap;
  const rightRuleW = lineRightX - rightRuleStart;
  if (rightRuleW > 8) {
    ctx.fillRect(rightRuleStart, centerY - 0.75, rightRuleW, 1.5);
  }

  // Crisp centered plaque
  ctx.fillStyle = badgeBg;
  traceRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.strokeStyle = badgeBorder;
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // Vector speech-bubble comment icon
  const ix = badgeX + padX;
  const iy = centerY - iconH / 2 - 1;
  ctx.fillStyle = iconColor;
  traceRoundedRect(ctx, ix, iy, iconW, iconH, 4.5);
  ctx.fill();

  // Speech bubble tail
  ctx.beginPath();
  ctx.moveTo(ix + 4, iy + iconH - 1);
  ctx.lineTo(ix + 3, iy + iconH + 4.5);
  ctx.lineTo(ix + 10, iy + iconH - 1);
  ctx.closePath();
  ctx.fill();

  // Three subtle dots inside bubble
  ctx.fillStyle = badgeBg;
  for (let d = 0; d < 3; d += 1) {
    ctx.beginPath();
    ctx.arc(ix + 5.5 + d * 4.5, iy + iconH / 2, 1.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // Centered Bengali label
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, ix + iconW + gap, centerY + 1);
  ctx.restore();
}

function getHeadlineFontMeta(fontId: CardTypographyOptions['headlineFont']) {
  return HEADLINE_FONTS.find((f) => f.id === fontId) ?? HEADLINE_FONTS[0];
}

export interface RenderPhotocardParams {
  canvas: HTMLCanvasElement;
  style: CardStyleId;
  aspect: CardAspectRatio;
  article: NewsArticleData;
  edit: PhotoEditState;
  typography: CardTypographyOptions;
  photo: HTMLImageElement | null;
  logo: HTMLImageElement | null;
}

export function renderPhotocard(params: RenderPhotocardParams): void {
  const { canvas, style, aspect, article, edit, typography, photo, logo } = params;
  const { width, height } = getCanvasDimensions(aspect);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  const fontMeta = getHeadlineFontMeta(typography.headlineFont);
  const fontFamily = fontMeta.cssFamily;
  const headlineWeight = fontMeta.canvasWeight;

  const measureHeadline = (text: string, fontSize: number) => {
    ctx.font = `${headlineWeight} ${fontSize}px ${fontFamily}`;
    return ctx.measureText(text).width;
  };

  const headlineText =
    article.headline.trim() || 'নতুন সিলেটের সর্বশেষ সংবাদ শিরোনাম এখানে দেখাবে';
  const showMetaParts: string[] = [];
  if (typography.showCategory && article.category.trim()) {
    showMetaParts.push(article.category.trim());
  }
  if (typography.showDate && article.dateText.trim()) {
    showMetaParts.push(article.dateText.trim());
  }

  const commentNote = typography.showCommentNote
    ? (typography.commentNoteText || '').trim()
    : '';

  const frame = getPhotoFrameRect(style, aspect);

  // =========================================================================
  // STYLE 1: EDITORIAL CLASSIC ("সম্পাদকীয় ক্লাসিক" — Archival Broadsheet)
  // =========================================================================
  if (style === 'editorial-classic') {
    // Warm archival newsprint paper ground
    ctx.fillStyle = '#FAF8F3';
    ctx.fillRect(0, 0, width, height);

    // Top 7px dual editorial brand rule (Crimson + Emerald)
    ctx.fillStyle = '#B91C1C';
    ctx.fillRect(0, 0, Math.round(width * 0.64), 7);
    ctx.fillStyle = '#047857';
    ctx.fillRect(Math.round(width * 0.64), 0, width - Math.round(width * 0.64), 7);

    // Subtle inner archival page frame
    ctx.strokeStyle = '#E5DFD3';
    ctx.lineWidth = 1;
    ctx.strokeRect(20.5, 24.5, width - 41, height - 45);

    // Masthead Left: Official Natun Sylhet Logo
    drawLogo(ctx, logo, 56, 38, 210, 70, 'multiply-paper');

    // Masthead Right: Clean unboxed typographic metadata (Category · Date)
    if (showMetaParts.length > 0) {
      ctx.save();
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      const rightX = width - 56;
      const midY = 75;

      if (typography.showCategory && typography.showDate && article.category && article.dateText) {
        ctx.font = '500 22px "Hind Siliguri", sans-serif';
        ctx.fillStyle = '#57534E';
        const dateStr = article.dateText.trim();
        ctx.fillText(dateStr, rightX, midY);
        const dateW = ctx.measureText(dateStr).width;

        ctx.fillStyle = '#B4ABA0';
        const sep = '  ·  ';
        ctx.fillText(sep, rightX - dateW, midY);
        const sepW = ctx.measureText(sep).width;

        ctx.font = '700 23px "Hind Siliguri", sans-serif';
        ctx.fillStyle = '#B91C1C';
        ctx.fillText(article.category.trim(), rightX - dateW - sepW, midY);
      } else {
        ctx.font = '600 23px "Hind Siliguri", sans-serif';
        ctx.fillStyle = typography.showCategory ? '#B91C1C' : '#57534E';
        ctx.fillText(showMetaParts.join('  ·  '), rightX, midY);
      }
      ctx.restore();
    }

    // Broadsheet double hairline rule under masthead
    ctx.fillStyle = '#181715';
    ctx.fillRect(56, 122, width - 112, 2.5);
    ctx.fillStyle = '#C9C1B4';
    ctx.fillRect(56, 128, width - 112, 1);

    // Photo Stage
    drawPhotoStage(ctx, frame, photo, edit, false);
    ctx.strokeStyle = '#DDD6C9';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(frame.x, frame.y, frame.w, frame.h);

    // Headline Block below photo
    const headlineTopY = frame.y + frame.h + 30;
    const commentRowY = height - 96;
    const footerY = height - 76;
    const availableH = (commentNote ? commentRowY - 30 : footerY - 28) - headlineTopY;

    // Short crimson + emerald editorial accent bar
    ctx.fillStyle = '#B91C1C';
    ctx.fillRect(56, headlineTopY, 52, 4);
    ctx.fillStyle = '#047857';
    ctx.fillRect(114, headlineTopY, 18, 4);

    const layout = solveHeadlineLayout({
      text: headlineText,
      maxWidth: width - 112,
      maxHeight: availableH - 22,
      minFontSize: 32,
      maxFontSize: aspect === '4:5' ? 60 : 54,
      maxLines: aspect === '4:5' ? 4 : 3,
      lineHeightRatio: fontMeta.lineHeightRatio,
      scaleMultiplier: typography.headlineScale,
      lineMode: typography.headlineLineMode,
      measureWidth: measureHeadline,
    });

    const textBlockStartY =
      headlineTopY + 22 + Math.max(0, (availableH - 22 - layout.totalHeight) / 2);

    ctx.save();
    ctx.font = `${headlineWeight} ${layout.fontSize}px ${fontFamily}`;
    ctx.fillStyle = '#141311';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    layout.lines.forEach((line, idx) => {
      ctx.fillText(line, 56, textBlockStartY + idx * layout.lineHeight);
    });
    ctx.restore();

    // Bottom-center comment callout + clean editorial colophon
    if (commentNote) {
      drawCommentNoteDivider(ctx, {
        centerX: width / 2,
        centerY: commentRowY,
        lineLeftX: 56,
        lineRightX: width - 56,
        text: commentNote,
        lineColor: '#D8D1C4',
        badgeBg: '#FFFFFF',
        badgeBorder: '#D4CCC0',
        iconColor: '#B91C1C',
        textColor: '#141311',
      });
    } else {
      ctx.fillStyle = '#D8D1C4';
      ctx.fillRect(56, footerY, width - 112, 1.5);
    }

    ctx.save();
    ctx.textBaseline = 'middle';
    const footTextY = commentNote ? height - 46 : footerY + 34;

    ctx.font = '700 21px "Hind Siliguri", sans-serif';
    ctx.fillStyle = '#B91C1C';
    ctx.textAlign = 'left';
    ctx.fillText('natunsylhet24.com', 56, footTextY);

    ctx.font = '500 19px "Hind Siliguri", sans-serif';
    ctx.fillStyle = '#57534E';
    ctx.textAlign = 'right';
    ctx.fillText('সিলেটের প্রথম মাল্টিমিডিয়া নিউজ পোর্টাল', width - 56, footTextY);
    ctx.restore();
    return;
  }

  // =========================================================================
  // STYLE 2: EDITORIAL MIDNIGHT ("আধুনিক নাইট" — Contemporary Dark Broadsheet)
  // =========================================================================
  if (style === 'editorial-midnight') {
    // Deep Obsidian Editorial Ground
    ctx.fillStyle = '#0F1115';
    ctx.fillRect(0, 0, width, height);

    // Subtle dark architectural inner frame
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(20.5, 20.5, width - 41, height - 41);

    // Photo Stage
    drawPhotoStage(ctx, frame, photo, edit, true);

    // Subtle seamless bottom gradient scrim ONLY when photo fills frame (zoom >= 0.96 & flat corners)
    if (edit.zoom >= 0.96 && edit.borderRadius <= 4) {
      const scrim = ctx.createLinearGradient(0, frame.y + frame.h - 150, 0, frame.y + frame.h);
      scrim.addColorStop(0, 'rgba(15, 17, 21, 0)');
      scrim.addColorStop(1, 'rgba(15, 17, 21, 0.68)');
      ctx.fillStyle = scrim;
      ctx.fillRect(frame.x, frame.y + frame.h - 150, frame.w, 150);
    }

    // Crisp frame hairline around photo window
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(frame.x, frame.y, frame.w, frame.h);

    // Top-left Ivory Masthead Plaque (keeps red/green logo crisp on dark theme!)
    drawLogo(ctx, logo, frame.x + 22, frame.y + 22, 174, 58, 'ivory-plaque');

    // Top-right clean translucent dark editorial metadata strip
    if (showMetaParts.length > 0) {
      const metaLabel = showMetaParts.join('  ·  ');
      ctx.save();
      ctx.font = '600 21px "Hind Siliguri", sans-serif';
      const metaW = ctx.measureText(metaLabel).width;
      const boxW = metaW + 32;
      const boxH = 44;
      const boxX = frame.x + frame.w - 22 - boxW;
      const boxY = frame.y + 28;

      ctx.fillStyle = 'rgba(15, 17, 21, 0.82)';
      traceRoundedRect(ctx, boxX, boxY, boxW, boxH, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#F5F4F0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(metaLabel, boxX + boxW / 2, boxY + boxH / 2 + 1);
      ctx.restore();
    }

    // Lower Dark Editorial Plinth
    const plinthTopY = frame.y + frame.h + 32;
    const commentRowY = height - 98;
    const footerY = height - 76;
    const availableH = (commentNote ? commentRowY - 30 : footerY - 26) - plinthTopY;

    // Dual-tone editorial rule (Crimson + Emerald)
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(56, plinthTopY, 54, 4);
    ctx.fillStyle = '#10B981';
    ctx.fillRect(118, plinthTopY, 20, 4);

    const layout = solveHeadlineLayout({
      text: headlineText,
      maxWidth: width - 112,
      maxHeight: availableH - 22,
      minFontSize: 32,
      maxFontSize: aspect === '4:5' ? 60 : 54,
      maxLines: aspect === '4:5' ? 4 : 3,
      lineHeightRatio: fontMeta.lineHeightRatio,
      scaleMultiplier: typography.headlineScale,
      lineMode: typography.headlineLineMode,
      measureWidth: measureHeadline,
    });

    const textStartY =
      plinthTopY + 22 + Math.max(0, (availableH - 22 - layout.totalHeight) / 2);

    ctx.save();
    ctx.font = `${headlineWeight} ${layout.fontSize}px ${fontFamily}`;
    ctx.fillStyle = '#FAF9F6';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    layout.lines.forEach((line, idx) => {
      ctx.fillText(line, 56, textStartY + idx * layout.lineHeight);
    });
    ctx.restore();

    // Bottom-center comment callout + minimal dark editorial footer
    if (commentNote) {
      drawCommentNoteDivider(ctx, {
        centerX: width / 2,
        centerY: commentRowY,
        lineLeftX: 56,
        lineRightX: width - 56,
        text: commentNote,
        lineColor: 'rgba(255, 255, 255, 0.16)',
        badgeBg: '#191D24',
        badgeBorder: 'rgba(255, 255, 255, 0.22)',
        iconColor: '#F87171',
        textColor: '#FAF9F6',
      });
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fillRect(56, footerY, width - 112, 1);
    }

    ctx.save();
    ctx.textBaseline = 'middle';
    const footY = commentNote ? height - 47 : footerY + 34;
    ctx.font = '700 21px "Hind Siliguri", sans-serif';
    ctx.fillStyle = '#F87171';
    ctx.textAlign = 'left';
    ctx.fillText('natunsylhet24.com', 56, footY);

    ctx.font = '500 19px "Hind Siliguri", sans-serif';
    ctx.fillStyle = '#A1A1AA';
    ctx.textAlign = 'right';
    ctx.fillText('সিলেটের প্রথম মাল্টিমিডিয়া নিউজ পোর্টাল', width - 56, footY);
    ctx.restore();

    // Bottom subtle accent bar
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(0, height - 6, Math.round(width * 0.5), 6);
    ctx.fillStyle = '#059669';
    ctx.fillRect(Math.round(width * 0.5), height - 6, width - Math.round(width * 0.5), 6);
    return;
  }

  // =========================================================================
  // STYLE 3: EDITORIAL GALLERY ("গ্যালারি ফ্রেম" — Headline-First Magazine)
  // =========================================================================
  // Crisp Gallery White ground
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Top Emerald Prestige Stripe
  ctx.fillStyle = '#047857';
  ctx.fillRect(0, 0, width, 7);

  // Symmetrical Newspaper Masthead (Category Left | Centered Logo | Date Right)
  const logoW = 198;
  const logoH = 66;
  drawLogo(ctx, logo, (width - logoW) / 2, 28, logoW, logoH, 'multiply-paper');

  ctx.save();
  ctx.textBaseline = 'middle';
  const mastMidY = 63;
  if (typography.showCategory && article.category.trim()) {
    ctx.font = '700 23px "Hind Siliguri", sans-serif';
    ctx.fillStyle = '#047857';
    ctx.textAlign = 'left';
    ctx.fillText(article.category.trim(), 56, mastMidY);
  }
  if (typography.showDate && article.dateText.trim()) {
    ctx.font = '500 21px "Hind Siliguri", sans-serif';
    ctx.fillStyle = '#52525B';
    ctx.textAlign = 'right';
    ctx.fillText(article.dateText.trim(), width - 56, mastMidY);
  }
  ctx.restore();

  // Masthead hairline divider
  ctx.fillStyle = '#E4E4E7';
  ctx.fillRect(56, 108, width - 112, 1.5);
  ctx.fillStyle = '#B91C1C';
  ctx.fillRect((width - 84) / 2, 107, 84, 3.5);

  // Top Headline Zone (Editorial centered typography above the framed photograph!)
  const headTopY = 128;
  const headAvailableH = frame.y - 26 - headTopY;

  const layout = solveHeadlineLayout({
    text: headlineText,
    maxWidth: width - 120,
    maxHeight: headAvailableH,
    minFontSize: 30,
    maxFontSize: aspect === '4:5' ? 54 : 50,
    maxLines: 3,
    lineHeightRatio: fontMeta.lineHeightRatio,
    scaleMultiplier: typography.headlineScale,
    lineMode: typography.headlineLineMode,
    measureWidth: measureHeadline,
  });

  const headStartY = headTopY + Math.max(0, (headAvailableH - layout.totalHeight) / 2);

  ctx.save();
  ctx.font = `${headlineWeight} ${layout.fontSize}px ${fontFamily}`;
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  layout.lines.forEach((line, idx) => {
    ctx.fillText(line, width / 2, headStartY + idx * layout.lineHeight);
  });
  ctx.restore();

  // Warm Archival Gallery Mat around Photo Frame
  const matPad = 14;
  ctx.fillStyle = '#F3EFE6';
  ctx.fillRect(
    frame.x - matPad,
    frame.y - matPad,
    frame.w + matPad * 2,
    frame.h + matPad * 2
  );
  ctx.strokeStyle = '#DFD8CA';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    frame.x - matPad,
    frame.y - matPad,
    frame.w + matPad * 2,
    frame.h + matPad * 2
  );

  // Photo Stage inside mat
  drawPhotoStage(ctx, frame, photo, edit, false);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(frame.x, frame.y, frame.w, frame.h);

  // Institutional Deep Sylhet Emerald Footer Band
  const bandH = 66;
  const bandY = height - bandH;
  const matBottom = frame.y + frame.h + matPad;

  // Centered Comment Callout cleanly nestled between framed photo mat and emerald footer band
  if (commentNote) {
    drawCommentNoteDivider(ctx, {
      centerX: width / 2,
      centerY: Math.round((matBottom + bandY) / 2),
      lineLeftX: 66,
      lineRightX: width - 66,
      text: commentNote,
      lineColor: '#DFD8CA',
      badgeBg: '#FAF8F4',
      badgeBorder: '#D5CCB9',
      iconColor: '#047857',
      textColor: '#111827',
    });
  }

  ctx.fillStyle = '#064E3B';
  ctx.fillRect(0, bandY, width, bandH);

  // Crimson accent notch on left of footer band
  ctx.fillStyle = '#B91C1C';
  ctx.fillRect(0, bandY, 14, bandH);

  ctx.save();
  ctx.textBaseline = 'middle';
  const bandMidY = bandY + bandH / 2 + 1;

  ctx.font = '700 22px "Hind Siliguri", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText('natunsylhet24.com', 56, bandMidY);

  ctx.font = '500 19px "Hind Siliguri", sans-serif';
  ctx.fillStyle = '#D1FAE5';
  ctx.textAlign = 'right';
  ctx.fillText('নতুন সিলেট · সিলেটের প্রথম মাল্টিমিডিয়া নিউজ পোর্টাল', width - 56, bandMidY);
  ctx.restore();
}

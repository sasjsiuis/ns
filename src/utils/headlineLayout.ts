import type { CropInsets, HeadlineLineMode, PhotoEditState } from '../types/photocard';

export interface TextMeasureFn {
  (text: string, fontSize: number): number;
}

export interface HeadlineLayoutResult {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  totalHeight: number;
}

/**
 * Splits a headline into balanced lines that respect maxWidth without leaving
 * awkward 1-word trailing orphans whenever possible.
 * Preserves explicit user newlines if present.
 */
export function wrapBalancedLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  measureWidth: TextMeasureFn
): string[] {
  const paragraphs = text
    .split(/\r?\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return [];

  const allLines: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(' ');
    const greedyLines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measureWidth(candidate, fontSize) <= maxWidth || !current) {
        current = candidate;
      } else {
        greedyLines.push(current);
        current = word;
      }
    }
    if (current) {
      greedyLines.push(current);
    }

    // Re-balance if the last line is a single short orphan word and we have >= 2 lines
    if (greedyLines.length >= 2) {
      const lastIdx = greedyLines.length - 1;
      const lastWords = greedyLines[lastIdx].split(' ');
      const prevWords = greedyLines[lastIdx - 1].split(' ');
      if (lastWords.length === 1 && prevWords.length >= 3) {
        const movedWord = prevWords[prevWords.length - 1];
        const newPrev = prevWords.slice(0, -1).join(' ');
        const newLast = `${movedWord} ${lastWords[0]}`;
        if (measureWidth(newLast, fontSize) <= maxWidth) {
          greedyLines[lastIdx - 1] = newPrev;
          greedyLines[lastIdx] = newLast;
        }
      }
    }

    allLines.push(...greedyLines);
  }

  return allLines;
}

/**
 * Splits text into 2 optically balanced lines by finding the word boundary
 * that minimizes the wider of the two lines.
 */
export function splitIntoTwoBalancedLines(
  text: string,
  fontSize: number,
  measureWidth: TextMeasureFn
): string[] {
  const manualLines = text
    .split(/\r?\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (manualLines.length === 2) {
    return manualLines;
  }

  const single = text.replace(/\s+/g, ' ').trim();
  const words = single.split(' ').filter(Boolean);
  if (words.length <= 1) return words;

  let bestSplit = 1;
  let bestMaxWidth = Number.POSITIVE_INFINITY;

  for (let i = 1; i < words.length; i++) {
    const line1 = words.slice(0, i).join(' ');
    const line2 = words.slice(i).join(' ');
    const widest = Math.max(measureWidth(line1, fontSize), measureWidth(line2, fontSize));
    if (widest < bestMaxWidth) {
      bestMaxWidth = widest;
      bestSplit = i;
    }
  }

  return [words.slice(0, bestSplit).join(' '), words.slice(bestSplit).join(' ')];
}

/**
 * Automatically finds the largest visually balanced font size so that any Bengali
 * headline fits cleanly within maxWidth x maxHeight according to lineMode:
 * - 'auto': automatically picks optimal lines (1..maxLines) and font size
 * - '1': fits the entire headline cleanly on 1 single line
 * - '2': splits cleanly into 2 balanced lines (respecting manual Enter break if 2 lines typed)
 */
export function solveHeadlineLayout(params: {
  text: string;
  maxWidth: number;
  maxHeight: number;
  minFontSize?: number;
  maxFontSize?: number;
  maxLines?: number;
  lineHeightRatio?: number;
  scaleMultiplier?: number;
  lineMode?: HeadlineLineMode;
  measureWidth: TextMeasureFn;
}): HeadlineLayoutResult {
  const {
    text,
    maxWidth,
    maxHeight,
    minFontSize = 30,
    maxFontSize = 58,
    maxLines = 4,
    lineHeightRatio = 1.3,
    scaleMultiplier = 1,
    lineMode = 'auto',
    measureWidth,
  } = params;

  const trimmed = text.trim();
  if (!trimmed) {
    return {
      lines: [],
      fontSize: maxFontSize,
      lineHeight: maxFontSize * lineHeightRatio,
      totalHeight: 0,
    };
  }

  // Mode 1: Strict single line (auto-scales smoothly down to 18px if headline is long)
  if (lineMode === '1') {
    const singleLine = trimmed.replace(/\s+/g, ' ');
    const startSize = Math.max(22, Math.round(maxFontSize * scaleMultiplier));
    const floorSize = 18;
    for (let size = startSize; size >= floorSize; size -= 1) {
      const w = measureWidth(singleLine, size);
      const lh = Math.round(size * lineHeightRatio);
      if (w <= maxWidth && lh <= maxHeight) {
        return { lines: [singleLine], fontSize: size, lineHeight: lh, totalHeight: lh };
      }
    }
    const lh = Math.round(floorSize * lineHeightRatio);
    return { lines: [singleLine], fontSize: floorSize, lineHeight: lh, totalHeight: lh };
  }

  // Mode 2: Balanced 2-line mode
  if (lineMode === '2') {
    const startSize = Math.max(24, Math.round(maxFontSize * scaleMultiplier));
    const floorSize = 20;
    for (let size = startSize; size >= floorSize; size -= 1) {
      const twoLines = splitIntoTwoBalancedLines(trimmed, size, measureWidth);
      const lh = Math.round(size * lineHeightRatio);
      const totalH = twoLines.length * lh;
      const fitsWidth = twoLines.every((line) => measureWidth(line, size) <= maxWidth * 1.01);
      if (fitsWidth && totalH <= maxHeight) {
        return { lines: twoLines, fontSize: size, lineHeight: lh, totalHeight: totalH };
      }
    }
    const fallbackLines = splitIntoTwoBalancedLines(trimmed, floorSize, measureWidth);
    const lh = Math.round(floorSize * lineHeightRatio);
    return {
      lines: fallbackLines,
      fontSize: floorSize,
      lineHeight: lh,
      totalHeight: fallbackLines.length * lh,
    };
  }

  // Default Mode ('auto'): Automatic balanced zone selection
  const effectiveMax = Math.max(minFontSize, Math.round(maxFontSize * scaleMultiplier));
  const effectiveMin = Math.max(24, Math.round(minFontSize * Math.min(1, scaleMultiplier)));

  for (let size = effectiveMax; size >= effectiveMin; size -= 2) {
    const lines = wrapBalancedLines(trimmed, maxWidth, size, measureWidth);
    const lineHeight = Math.round(size * lineHeightRatio);
    const totalHeight = lines.length * lineHeight;

    const fitsLineCount = lines.length <= maxLines;
    const fitsHeight = totalHeight <= maxHeight;
    const widestLineFits = lines.every((line) => measureWidth(line, size) <= maxWidth * 1.02);

    if (fitsLineCount && fitsHeight && widestLineFits) {
      return { lines, fontSize: size, lineHeight, totalHeight };
    }
  }

  const lines = wrapBalancedLines(trimmed, maxWidth, effectiveMin, measureWidth);
  const clamped = lines.slice(0, maxLines);
  if (lines.length > maxLines && clamped.length > 0) {
    clamped[clamped.length - 1] = `${clamped[clamped.length - 1].replace(/[।.,!?]*$/, '')}…`;
  }
  const lineHeight = Math.round(effectiveMin * lineHeightRatio);
  return {
    lines: clamped,
    fontSize: effectiveMin,
    lineHeight,
    totalHeight: clamped.length * lineHeight,
  };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Computes the non-destructive source rectangle on the original image after
 * applying top/right/bottom/left percentage crop insets.
 */
export function computeCroppedSourceRect(
  naturalWidth: number,
  naturalHeight: number,
  crop: CropInsets
): Rect {
  const safeTop = Math.max(0, Math.min(45, crop.top));
  const safeBottom = Math.max(0, Math.min(45, crop.bottom));
  const safeLeft = Math.max(0, Math.min(45, crop.left));
  const safeRight = Math.max(0, Math.min(45, crop.right));

  const sx = (safeLeft / 100) * naturalWidth;
  const sy = (safeTop / 100) * naturalHeight;
  const sw = Math.max(10, naturalWidth * (1 - (safeLeft + safeRight) / 100));
  const sh = Math.max(10, naturalHeight * (1 - (safeTop + safeBottom) / 100));

  return { x: sx, y: sy, w: sw, h: sh };
}

/**
 * Computes the destination rectangle inside the photo frame for any zoom (0.25x to 3.0x)
 * and normalized pan offset (-100..100).
 *
 * At zoom = 1.0: image fits the frame cleanly using "cover" scaling so there are
 * zero accidental gaps by default.
 * At zoom < 1.0 (down to 0.25): image shrinks smoothly inside the frame, exposing
 * the blurred backdrop or custom solid color behind it!
 */
export function computePhotoDrawRect(
  sourceW: number,
  sourceH: number,
  frame: Rect,
  edit: Pick<PhotoEditState, 'zoom' | 'offsetX' | 'offsetY'>
): Rect {
  const safeZoom = Math.max(0.25, Math.min(3.0, edit.zoom));
  const coverScale = Math.max(frame.w / sourceW, frame.h / sourceH);

  // When zooming below 1.0, smoothly transition from cover-fit (1.0) down through
  // contain-fit so extreme zoom-out feels natural on both landscape & portrait photos
  const containScale = Math.min(frame.w / sourceW, frame.h / sourceH);
  const baseScale =
    safeZoom >= 1
      ? coverScale * safeZoom
      : safeZoom >= 0.8
        ? containScale + ((safeZoom - 0.8) / 0.2) * (coverScale - containScale)
        : containScale * (safeZoom / 0.8);

  const drawW = sourceW * baseScale;
  const drawH = sourceH * baseScale;

  const panRangeX = Math.max(frame.w * 0.45, Math.abs(drawW - frame.w) * 0.65);
  const panRangeY = Math.max(frame.h * 0.45, Math.abs(drawH - frame.h) * 0.65);

  const centerX = frame.x + frame.w / 2 + (edit.offsetX / 100) * panRangeX;
  const centerY = frame.y + frame.h / 2 + (edit.offsetY / 100) * panRangeY;

  return {
    x: centerX - drawW / 2,
    y: centerY - drawH / 2,
    w: drawW,
    h: drawH,
  };
}

/**
 * Computes symmetrical crop insets to match a target aspect ratio (e.g. 16/9, 4/3, 1/1, 3/4)
 * from the source image's natural dimensions.
 */
export function computeAspectCropInsets(
  naturalWidth: number,
  naturalHeight: number,
  targetAspect: number | null
): CropInsets {
  if (!targetAspect || naturalWidth <= 0 || naturalHeight <= 0) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const currentAspect = naturalWidth / naturalHeight;
  if (Math.abs(currentAspect - targetAspect) < 0.01) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  if (currentAspect > targetAspect) {
    // Source is wider than target -> crop left & right
    const keepRatio = targetAspect / currentAspect;
    const inset = Math.min(45, Math.round(((1 - keepRatio) / 2) * 100));
    return { top: 0, right: inset, bottom: 0, left: inset };
  } else {
    // Source is taller than target -> crop top & bottom
    const keepRatio = currentAspect / targetAspect;
    const inset = Math.min(45, Math.round(((1 - keepRatio) / 2) * 100));
    return { top: inset, right: 0, bottom: inset, left: 0 };
  }
}

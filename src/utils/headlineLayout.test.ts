import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAspectCropInsets,
  computeCroppedSourceRect,
  computePhotoDrawRect,
  solveHeadlineLayout,
  wrapBalancedLines,
} from './headlineLayout';

// Deterministic monospace-like approximation for pure unit testing
const mockMeasure = (text: string, fontSize: number) => text.length * fontSize * 0.52;

test('wrapBalancedLines avoids single-word trailing orphans when rebalancing fits', () => {
  const headline = 'সিলেট নগরের সড়ক সংস্কারে নতুন প্রকল্প অনুমোদন করল কর্তৃপক্ষ';
  const lines = wrapBalancedLines(headline, 720, 44, mockMeasure);
  assert.ok(lines.length >= 2);
  const lastLineWordCount = lines[lines.length - 1].split(' ').length;
  assert.ok(lastLineWordCount >= 2, `Expected balanced last line, got: "${lines[lines.length - 1]}"`);
});

test('solveHeadlineLayout automatically scales down long Bengali headlines to fit maxHeight & maxLines', () => {
  const shortHeadline = 'সিলেটে বৃষ্টির সম্ভাবনা';
  const longHeadline =
    'পলাতক আসামি ও সন্ত্রাসীদের দেশে ফিরিয়ে আনার ক্ষেত্রে কোনো পাসপোর্টের প্রয়োজন নেই বলে মন্তব্য করেছেন পররাষ্ট্র প্রতিমন্ত্রী হুমায়ুন কবির';

  const shortRes = solveHeadlineLayout({
    text: shortHeadline,
    maxWidth: 920,
    maxHeight: 220,
    minFontSize: 30,
    maxFontSize: 56,
    maxLines: 4,
    measureWidth: mockMeasure,
  });

  const longRes = solveHeadlineLayout({
    text: longHeadline,
    maxWidth: 920,
    maxHeight: 220,
    minFontSize: 30,
    maxFontSize: 56,
    maxLines: 4,
    measureWidth: mockMeasure,
  });

  assert.ok(shortRes.fontSize > longRes.fontSize);
  assert.ok(longRes.lines.length <= 4);
  assert.ok(longRes.totalHeight <= 220);
});

test('computePhotoDrawRect shrinks image cleanly below 1.0 zoom down to 0.25 to expose backdrop', () => {
  const frame = { x: 60, y: 120, w: 960, h: 560 };

  const defaultFit = computePhotoDrawRect(1600, 900, frame, {
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
  // At 1.0 cover fit, image covers at least full width and height
  assert.ok(defaultFit.w >= frame.w - 1);
  assert.ok(defaultFit.h >= frame.h - 1);

  const zoomedOut = computePhotoDrawRect(1600, 900, frame, {
    zoom: 0.4,
    offsetX: 0,
    offsetY: 0,
  });
  // At 0.4x zoom out, image is significantly smaller than frame, leaving room on sides/top/bottom
  assert.ok(zoomedOut.w < frame.w * 0.6);
  assert.ok(zoomedOut.h < frame.h * 0.6);
  // Centered inside frame
  const centerDiffX = Math.abs(zoomedOut.x + zoomedOut.w / 2 - (frame.x + frame.w / 2));
  assert.ok(centerDiffX < 0.01);
});

test('computeCroppedSourceRect and computeAspectCropInsets compute accurate non-destructive crops', () => {
  const src = computeCroppedSourceRect(1000, 800, {
    top: 10,
    right: 20,
    bottom: 10,
    left: 20,
  });
  assert.equal(src.x, 200);
  assert.equal(src.y, 80);
  assert.equal(src.w, 600);
  assert.equal(src.h, 640);

  // Cropping 1600x800 (2:1) into 1:1 should inset left & right by 25% each
  const squareInsets = computeAspectCropInsets(1600, 800, 1);
  assert.equal(squareInsets.left, 25);
  assert.equal(squareInsets.right, 25);
  assert.equal(squareInsets.top, 0);
  assert.equal(squareInsets.bottom, 0);
});

test('solveHeadlineLayout supports 1-line, balanced 2-line, and manual newline breaks', () => {
  const headline = 'পলাতক আসামিদের ফেরাতে পাসপোর্টের প্রয়োজন নেই: পররাষ্ট্র প্রতিমন্ত্রী';

  const oneLine = solveHeadlineLayout({
    text: headline,
    maxWidth: 960,
    maxHeight: 200,
    maxFontSize: 54,
    lineMode: '1',
    measureWidth: mockMeasure,
  });
  assert.equal(oneLine.lines.length, 1);
  assert.ok(mockMeasure(oneLine.lines[0], oneLine.fontSize) <= 960);

  const twoLine = solveHeadlineLayout({
    text: headline,
    maxWidth: 960,
    maxHeight: 200,
    maxFontSize: 54,
    lineMode: '2',
    measureWidth: mockMeasure,
  });
  assert.equal(twoLine.lines.length, 2);
  assert.ok(twoLine.lines.every((l) => mockMeasure(l, twoLine.fontSize) <= 960 * 1.01));

  const manualTwoLine = solveHeadlineLayout({
    text: 'সিলেটে নতুন প্রকল্প\nউদ্বোধন করলেন মন্ত্রী',
    maxWidth: 960,
    maxHeight: 200,
    maxFontSize: 54,
    lineMode: '2',
    measureWidth: mockMeasure,
  });
  assert.deepEqual(manualTwoLine.lines, ['সিলেটে নতুন প্রকল্প', 'উদ্বোধন করলেন মন্ত্রী']);
});

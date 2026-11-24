import { useRef } from 'react';
import {
  Crop,
  FlipHorizontal2,
  ImagePlus,
  RotateCcw,
  SlidersHorizontal,
  Type,
} from 'lucide-react';
import {
  BACKDROP_SWATCHES,
  COMMENT_NOTE_PRESETS,
  DEFAULT_CROP,
  DEFAULT_PHOTO_EDIT,
  HEADLINE_FONTS,
  type CardTypographyOptions,
  type HeadlineLineMode,
  type NewsArticleData,
  type PhotoEditState,
  type PhotoTonePreset,
} from '../types/photocard';
import { computeAspectCropInsets } from '../utils/headlineLayout';

export type EditorTabId = 'content' | 'frame' | 'crop';

interface EditorPanelProps {
  activeTab: EditorTabId;
  onChangeTab: (tab: EditorTabId) => void;
  article: NewsArticleData;
  onChangeArticle: (updater: (prev: NewsArticleData) => NewsArticleData) => void;
  edit: PhotoEditState;
  onChangeEdit: (updater: (prev: PhotoEditState) => PhotoEditState) => void;
  typography: CardTypographyOptions;
  onChangeTypography: (
    updater: (prev: CardTypographyOptions) => CardTypographyOptions
  ) => void;
  onUploadLocalImage: (file: File) => void;
  photoNaturalSize: { width: number; height: number } | null;
}

const QUICK_CATEGORIES = ['সিলেট', 'জাতীয়', 'রাজনীতি', 'খেলাধুলা', 'আন্তর্জাতিক', 'অর্থনীতি'];

const TONE_PRESETS: { id: PhotoTonePreset; label: string }[] = [
  { id: 'normal', label: 'স্বাভাবিক' },
  { id: 'crisp', label: 'স্পষ্ট' },
  { id: 'warm', label: 'উষ্ণ' },
  { id: 'mono', label: 'সাদা-কালো' },
];

const CROP_RATIOS: { label: string; ratio: number | null }[] = [
  { label: 'মূল ছবি', ratio: null },
  { label: '১৬:৯', ratio: 16 / 9 },
  { label: '৪:৩', ratio: 4 / 3 },
  { label: '১:১', ratio: 1 },
  { label: '৩:৪', ratio: 3 / 4 },
];

export function EditorPanel({
  activeTab,
  onChangeTab,
  article,
  onChangeArticle,
  edit,
  onChangeEdit,
  typography,
  onChangeTypography,
  onUploadLocalImage,
  photoNaturalSize,
}: EditorPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadLocalImage(file);
    }
    e.target.value = '';
  };

  const applyAspectCrop = (ratio: number | null) => {
    if (!photoNaturalSize) {
      onChangeEdit((prev) => ({ ...prev, crop: { ...DEFAULT_CROP } }));
      return;
    }
    const nextCrop = computeAspectCropInsets(
      photoNaturalSize.width,
      photoNaturalSize.height,
      ratio
    );
    onChangeEdit((prev) => ({ ...prev, crop: nextCrop }));
  };

  return (
    <aside
      aria-label="ফটো কার্ড কাস্টমাইজেশন প্যানেল"
      className="flex flex-col rounded-xl border border-[#DFD8CC] bg-white"
    >
      {/* Hidden shared file input so both 'শিরোনাম ও ছবি' and 'ছবি ও ফ্রেম' can trigger upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="sr-only"
        id="local-photo-upload"
      />

      {/* Clean 3-Tab Segmented Control — 'শিরোনাম ও ছবি' first */}
      <div
        role="tablist"
        aria-label="এডিটর বিভাগ"
        className="grid grid-cols-3 border-b border-[#EAE4D9] bg-[#FAF8F4] p-1.5 rounded-t-xl"
      >
        {[
          { id: 'content' as const, label: 'শিরোনাম ও ছবি', icon: Type },
          { id: 'frame' as const, label: 'ছবি ও ফ্রেম', icon: SlidersHorizontal },
          { id: 'crop' as const, label: 'ক্রপ ও এডিট', icon: Crop },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChangeTab(tab.id)}
              className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C] ${
                active
                  ? 'bg-white text-[#161513] shadow-xs'
                  : 'text-[#666057] hover:text-[#161513]'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Panel Body */}
      <div className="flex flex-col gap-6 p-4 sm:p-5">
        {/* ================= TAB 2: FRAME, UPLOAD, ZOOM-OUT, BACKDROP & ROUND CORNERS ================= */}
        {activeTab === 'frame' && (
          <>
            {/* Quick Upload directly inside Frame tab */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#C7BEB0] bg-[#FAF8F4] px-3.5 py-2.5 text-xs font-semibold text-[#161513] transition-colors hover:border-[#161513] hover:bg-[#F3EFE6] sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C]"
            >
              <ImagePlus className="h-4 w-4 text-[#B91C1C]" aria-hidden="true" />
              <span>ফ্রেম থেকে নিজস্ব ছবি আপলোড করুন</span>
            </button>

            <hr className="border-[#EFEAE0]" />

            {/* Extreme Zoom Out & Zoom In */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="photo-zoom-slider"
                  className="text-sm font-semibold text-[#161513]"
                >
                  ছবির সাইজ (জুম ইন / আউট)
                </label>
                <span className="text-xs font-semibold tabular-nums text-[#B91C1C]">
                  {Math.round(edit.zoom * 100)}%
                </span>
              </div>

              <input
                id="photo-zoom-slider"
                type="range"
                min={0.25}
                max={3.0}
                step={0.02}
                value={edit.zoom}
                onChange={(e) =>
                  onChangeEdit((prev) => ({
                    ...prev,
                    zoom: Number(e.target.value),
                  }))
                }
                className="editorial-slider"
              />

              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {[
                  { label: '৪০%', val: 0.4 },
                  { label: '৬৫%', val: 0.65 },
                  { label: '৮৫%', val: 0.85 },
                  { label: '১০০%', val: 1.0 },
                  { label: '১৪০%', val: 1.4 },
                ].map((preset) => {
                  const isNear = Math.abs(edit.zoom - preset.val) < 0.03;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        onChangeEdit((prev) => ({ ...prev, zoom: preset.val }))
                      }
                      className={`h-8 rounded-md border text-xs font-medium tabular-nums transition-colors ${
                        isNear
                          ? 'border-[#161513] bg-[#161513] text-white'
                          : 'border-[#E0D9CD] bg-[#FAF8F4] text-[#44403C] hover:border-[#B8B0A2]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-[#666057]">
                ১০০%-এর নিচে নামালে ছবিটি আরও ছোট হবে এবং দুই পাশে নিচের পছন্দের ব্যাকগ্রাউন্ড দেখাবে।
              </p>
            </div>

            <hr className="border-[#EFEAE0]" />

            {/* Backdrop Fill: Blur vs Custom Solid Color */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#161513]">
                  ছবির পাশের ব্যাকগ্রাউন্ড
                </span>
                <div
                  role="group"
                  aria-label="ব্যাকগ্রাউন্ড মোড"
                  className="inline-flex rounded-lg border border-[#E0D9CD] bg-[#F2EFE8] p-0.5"
                >
                  <button
                    type="button"
                    onClick={() =>
                      onChangeEdit((prev) => ({ ...prev, backdropMode: 'blur' }))
                    }
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      edit.backdropMode === 'blur'
                        ? 'bg-white text-[#161513] shadow-xs'
                        : 'text-[#666057] hover:text-[#161513]'
                    }`}
                  >
                    ব্লার ছবি
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeEdit((prev) => ({ ...prev, backdropMode: 'color' }))
                    }
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      edit.backdropMode === 'color'
                        ? 'bg-white text-[#161513] shadow-xs'
                        : 'text-[#666057] hover:text-[#161513]'
                    }`}
                  >
                    পছন্দের রঙ
                  </button>
                </div>
              </div>

              {edit.backdropMode === 'blur' ? (
                <div className="space-y-2 rounded-lg border border-[#EAE4D9] bg-[#FAF8F4] p-3">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="blur-amount-slider" className="font-medium text-[#44403C]">
                      ব্লারের মাত্রা
                    </label>
                    <span className="font-semibold tabular-nums text-[#161513]">
                      {edit.blurAmount}px
                    </span>
                  </div>
                  <input
                    id="blur-amount-slider"
                    type="range"
                    min={8}
                    max={64}
                    step={2}
                    value={edit.blurAmount}
                    onChange={(e) =>
                      onChangeEdit((prev) => ({
                        ...prev,
                        blurAmount: Number(e.target.value),
                      }))
                    }
                    className="editorial-slider"
                  />
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border border-[#EAE4D9] bg-[#FAF8F4] p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {BACKDROP_SWATCHES.map((swatch) => {
                      const active =
                        edit.backdropColor.toLowerCase() === swatch.hex.toLowerCase();
                      return (
                        <button
                          key={swatch.hex}
                          type="button"
                          onClick={() =>
                            onChangeEdit((prev) => ({
                              ...prev,
                              backdropColor: swatch.hex,
                            }))
                          }
                          aria-label={`ব্যাকগ্রাউন্ড রঙ ${swatch.label}`}
                          className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                            active
                              ? 'border-[#161513] bg-white text-[#161513] shadow-2xs'
                              : 'border-[#E0D9CD] bg-white/75 text-[#44403C] hover:border-[#B8B0A2]'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 rounded-full border border-black/15"
                            style={{ backgroundColor: swatch.hex }}
                          />
                          <span className="whitespace-nowrap">{swatch.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Any-Color Picker */}
                  <div className="flex items-center justify-between border-t border-[#E6E0D5] pt-2.5">
                    <label
                      htmlFor="custom-backdrop-color"
                      className="text-xs font-semibold text-[#161513]"
                    >
                      যেকোনো কাস্টম রঙ বেছে নিন
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs uppercase text-[#666057]">
                        {edit.backdropColor}
                      </span>
                      <input
                        id="custom-backdrop-color"
                        type="color"
                        value={edit.backdropColor}
                        onChange={(e) =>
                          onChangeEdit((prev) => ({
                            ...prev,
                            backdropColor: e.target.value,
                          }))
                        }
                        className="h-8 w-10 cursor-pointer rounded border border-[#D4CCC0] bg-white p-0.5"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <hr className="border-[#EFEAE0]" />

            {/* Rounded Corners */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="photo-radius-slider"
                  className="text-sm font-semibold text-[#161513]"
                >
                  ছবির কোণা গোল করুন (রাউন্ড)
                </label>
                <span className="text-xs font-semibold tabular-nums text-[#161513]">
                  {edit.borderRadius}px
                </span>
              </div>

              <input
                id="photo-radius-slider"
                type="range"
                min={0}
                max={72}
                step={2}
                value={edit.borderRadius}
                onChange={(e) =>
                  onChangeEdit((prev) => ({
                    ...prev,
                    borderRadius: Number(e.target.value),
                  }))
                }
                className="editorial-slider"
              />

              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                {[
                  { label: 'সোজা (০)', val: 0 },
                  { label: 'হালকা (১৬)', val: 16 },
                  { label: 'মাঝারি (৩২)', val: 32 },
                  { label: 'বেশি (৫৬)', val: 56 },
                ].map((r) => (
                  <button
                    key={r.val}
                    type="button"
                    onClick={() =>
                      onChangeEdit((prev) => ({ ...prev, borderRadius: r.val }))
                    }
                    className={`h-8 rounded-md border text-xs font-medium transition-colors ${
                      edit.borderRadius === r.val
                        ? 'border-[#161513] bg-[#161513] text-white'
                        : 'border-[#E0D9CD] bg-[#FAF8F4] text-[#44403C] hover:border-[#B8B0A2]'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-[#EFEAE0]" />

            {/* Fine Position Sliders */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#161513]">
                  ছবির অবস্থান (পজিশন)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChangeEdit((prev) => ({ ...prev, offsetX: 0, offsetY: 0 }))
                  }
                  className="text-xs font-medium text-[#B91C1C] hover:underline"
                >
                  মাঝখানে আনুন
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-[#666057]">
                    <label htmlFor="offset-x-slider">ডান / বাম</label>
                    <span className="tabular-nums">{edit.offsetX}</span>
                  </div>
                  <input
                    id="offset-x-slider"
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={edit.offsetX}
                    onChange={(e) =>
                      onChangeEdit((prev) => ({
                        ...prev,
                        offsetX: Number(e.target.value),
                      }))
                    }
                    className="editorial-slider"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-[#666057]">
                    <label htmlFor="offset-y-slider">উপর / নিচ</label>
                    <span className="tabular-nums">{edit.offsetY}</span>
                  </div>
                  <input
                    id="offset-y-slider"
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={edit.offsetY}
                    onChange={(e) =>
                      onChangeEdit((prev) => ({
                        ...prev,
                        offsetY: Number(e.target.value),
                      }))
                    }
                    className="editorial-slider"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================= TAB 2: CROP & PHOTO ADJUSTMENTS ================= */}
        {activeTab === 'crop' && (
          <>
            {/* Quick Aspect Crop Presets */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#161513]">
                  ছবি ক্রপ অনুপাত
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChangeEdit((prev) => ({ ...prev, crop: { ...DEFAULT_CROP } }))
                  }
                  className="text-xs font-medium text-[#B91C1C] hover:underline"
                >
                  ক্রপ রিসেট
                </button>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {CROP_RATIOS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyAspectCrop(preset.ratio)}
                    className="h-9 rounded-md border border-[#E0D9CD] bg-[#FAF8F4] text-xs font-semibold text-[#161513] transition-colors hover:border-[#161513] hover:bg-white"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Precision 4-Side Edge Crop */}
            <div className="space-y-3 rounded-lg border border-[#EAE4D9] bg-[#FAF8F4] p-3.5">
              <span className="block text-xs font-semibold text-[#161513]">
                নিখুঁতভাবে চারদিক থেকে কাটুন (ক্রপ)
              </span>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {(
                  [
                    { key: 'top', label: 'উপর থেকে' },
                    { key: 'bottom', label: 'নিচ থেকে' },
                    { key: 'left', label: 'বাম থেকে' },
                    { key: 'right', label: 'ডান থেকে' },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs text-[#57534E]">
                      <label htmlFor={`crop-${key}`}>{label}</label>
                      <span className="font-semibold tabular-nums text-[#161513]">
                        {edit.crop[key]}%
                      </span>
                    </div>
                    <input
                      id={`crop-${key}`}
                      type="range"
                      min={0}
                      max={42}
                      step={1}
                      value={edit.crop[key]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onChangeEdit((prev) => ({
                          ...prev,
                          crop: { ...prev.crop, [key]: val },
                        }));
                      }}
                      className="editorial-slider"
                    />
                  </div>
                ))}
              </div>
            </div>

            <hr className="border-[#EFEAE0]" />

            {/* Editorial Tone Presets */}
            <div className="space-y-2.5">
              <span className="block text-sm font-semibold text-[#161513]">
                ছবির রঙ ও সম্পাদকীয় টোন
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {TONE_PRESETS.map((tone) => {
                  const active = edit.tonePreset === tone.id;
                  return (
                    <button
                      key={tone.id}
                      type="button"
                      onClick={() =>
                        onChangeEdit((prev) => ({ ...prev, tonePreset: tone.id }))
                      }
                      className={`h-9 rounded-md border text-xs font-semibold transition-colors ${
                        active
                          ? 'border-[#161513] bg-[#161513] text-white'
                          : 'border-[#E0D9CD] bg-[#FAF8F4] text-[#44403C] hover:border-[#B8B0A2]'
                      }`}
                    >
                      {tone.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Brightness, Contrast, Saturation */}
            <div className="space-y-3">
              {[
                {
                  id: 'edit-brightness',
                  label: 'উজ্জ্বলতা',
                  key: 'brightness' as const,
                  min: 60,
                  max: 145,
                },
                {
                  id: 'edit-contrast',
                  label: 'কনট্রাস্ট',
                  key: 'contrast' as const,
                  min: 60,
                  max: 155,
                },
                {
                  id: 'edit-saturation',
                  label: 'রঙের গভীরতা',
                  key: 'saturation' as const,
                  min: 0,
                  max: 165,
                },
              ].map((ctrl) => (
                <div key={ctrl.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <label htmlFor={ctrl.id} className="font-medium text-[#44403C]">
                      {ctrl.label}
                    </label>
                    <span className="font-semibold tabular-nums text-[#161513]">
                      {edit[ctrl.key]}%
                    </span>
                  </div>
                  <input
                    id={ctrl.id}
                    type="range"
                    min={ctrl.min}
                    max={ctrl.max}
                    step={1}
                    value={edit[ctrl.key]}
                    onChange={(e) =>
                      onChangeEdit((prev) => ({
                        ...prev,
                        [ctrl.key]: Number(e.target.value),
                      }))
                    }
                    className="editorial-slider"
                  />
                </div>
              ))}
            </div>

            {/* Flip & Reset All Edits */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  onChangeEdit((prev) => ({ ...prev, flipX: !prev.flipX }))
                }
                className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-xs font-semibold transition-colors ${
                  edit.flipX
                    ? 'border-[#161513] bg-[#161513] text-white'
                    : 'border-[#D8D1C4] bg-[#FAF8F4] text-[#161513] hover:bg-white'
                }`}
              >
                <FlipHorizontal2 className="h-4 w-4" aria-hidden="true" />
                <span>ছবি উল্টান</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChangeEdit((prev) => ({
                    ...prev,
                    crop: { ...DEFAULT_CROP },
                    brightness: DEFAULT_PHOTO_EDIT.brightness,
                    contrast: DEFAULT_PHOTO_EDIT.contrast,
                    saturation: DEFAULT_PHOTO_EDIT.saturation,
                    flipX: false,
                    tonePreset: 'normal',
                  }))
                }
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#D8D1C4] bg-white px-4 text-xs font-semibold text-[#57534E] transition-colors hover:border-[#161513] hover:text-[#161513]"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>রিসেট</span>
              </button>
            </div>
          </>
        )}

        {/* ================= TAB 1: HEADLINE, FONTS, LINE MODE & PHOTO UPLOAD ================= */}
        {activeTab === 'content' && (
          <>
            {/* Local Image Upload */}
            <div className="space-y-2">
              <span className="block text-sm font-semibold text-[#161513]">
                নিজস্ব ছবি আপলোড করুন
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-lg border border-dashed border-[#C7BEB0] bg-[#FAF8F4] px-4 py-3 text-sm font-semibold text-[#161513] transition-colors hover:border-[#161513] hover:bg-[#F3EFE6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C]"
              >
                <ImagePlus className="h-4 w-4 text-[#B91C1C]" aria-hidden="true" />
                <span>ডিভাইস থেকে নতুন ছবি বাছাই করুন</span>
              </button>
            </div>

            <hr className="border-[#EFEAE0]" />

            {/* Editable Headline */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="manual-headline-input"
                  className="text-sm font-semibold text-[#161513]"
                >
                  সংবাদের শিরোনাম
                </label>
                <span className="text-xs text-[#666057]">
                  {typography.headlineLineMode === 'auto'
                    ? 'অটো জোন সক্রিয়'
                    : typography.headlineLineMode === '1'
                      ? '১ লাইনে ফিট'
                      : '২ লাইনে ফিট'}
                </span>
              </div>
              <textarea
                id="manual-headline-input"
                rows={3}
                value={article.headline}
                onChange={(e) =>
                  onChangeArticle((prev) => ({ ...prev, headline: e.target.value }))
                }
                placeholder="এখানে সংবাদের শিরোনাম লিখুন (চাইলে Enter চেপে ২ লাইন করতে পারেন)..."
                className="w-full resize-none rounded-lg border border-[#D4CCC0] bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[#161513] placeholder:text-[#8E867B] focus:border-[#161513] focus:outline-none"
              />
            </div>

            {/* Headline Line Mode: Auto / 1 Line / 2 Lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#161513]">
                  শিরোনামের লাইন সেটিং
                </span>
              </div>
              <div
                role="radiogroup"
                aria-label="শিরোনামের লাইন নির্বাচন"
                className="grid grid-cols-3 gap-1.5 rounded-lg border border-[#E0D9CD] bg-[#F2EFE8] p-1"
              >
                {(
                  [
                    { id: 'auto', label: 'অটোমেটিক' },
                    { id: '1', label: '১ লাইন' },
                    { id: '2', label: '২ লাইন' },
                  ] as { id: HeadlineLineMode; label: string }[]
                ).map((mode) => {
                  const active = typography.headlineLineMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() =>
                        onChangeTypography((prev) => ({
                          ...prev,
                          headlineLineMode: mode.id,
                        }))
                      }
                      className={`h-8 whitespace-nowrap rounded-md text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-white text-[#161513] shadow-xs'
                          : 'text-[#666057] hover:text-[#161513]'
                      }`}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <hr className="border-[#EFEAE0]" />

            {/* 6 Curated Bengali Font Styles */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#161513]">
                  বাংলা ফন্টের স্টাইল (৬টি প্রিমিয়াম ফন্ট)
                </span>
              </div>

              <div
                role="radiogroup"
                aria-label="বাংলা ফন্ট নির্বাচন করুন"
                className="grid grid-cols-2 gap-2"
              >
                {HEADLINE_FONTS.map((font) => {
                  const active = typography.headlineFont === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() =>
                        onChangeTypography((prev) => ({
                          ...prev,
                          headlineFont: font.id,
                        }))
                      }
                      className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C] ${
                        active
                          ? 'border-[#161513] bg-[#161513] text-white'
                          : 'border-[#E0D9CD] bg-[#FAF8F4] text-[#161513] hover:border-[#B8B0A2] hover:bg-white'
                      }`}
                    >
                      <span
                        className="text-sm leading-tight"
                        style={{
                          fontFamily: font.cssFamily,
                          fontWeight: font.canvasWeight,
                        }}
                      >
                        {font.labelBn}
                      </span>
                      <span
                        className={`mt-0.5 text-[11px] ${
                          active ? 'text-[#D6D3CD]' : 'text-[#666057]'
                        }`}
                      >
                        {font.styleTagBn}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs text-[#57534E]">
                  <label htmlFor="headline-scale-slider">ফন্ট সাইজ সামঞ্জস্য</label>
                  <span className="font-semibold tabular-nums text-[#161513]">
                    {Math.round(typography.headlineScale * 100)}%
                  </span>
                </div>
                <input
                  id="headline-scale-slider"
                  type="range"
                  min={0.78}
                  max={1.22}
                  step={0.02}
                  value={typography.headlineScale}
                  onChange={(e) =>
                    onChangeTypography((prev) => ({
                      ...prev,
                      headlineScale: Number(e.target.value),
                    }))
                  }
                  className="editorial-slider"
                />
              </div>
            </div>

            <hr className="border-[#EFEAE0]" />

            {/* Category & Date Controls */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="category-input"
                    className="text-xs font-semibold text-[#161513]"
                  >
                    বিভাগ
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[#666057]">
                    <input
                      type="checkbox"
                      checked={typography.showCategory}
                      onChange={(e) =>
                        onChangeTypography((prev) => ({
                          ...prev,
                          showCategory: e.target.checked,
                        }))
                      }
                      className="h-3.5 w-3.5 accent-[#B91C1C]"
                    />
                    দেখান
                  </label>
                </div>
                <input
                  id="category-input"
                  type="text"
                  value={article.category}
                  onChange={(e) =>
                    onChangeArticle((prev) => ({ ...prev, category: e.target.value }))
                  }
                  placeholder="যেমন: সিলেট"
                  className="h-10 w-full rounded-lg border border-[#D4CCC0] bg-white px-3 text-sm text-[#161513] focus:border-[#161513] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="date-input"
                    className="text-xs font-semibold text-[#161513]"
                  >
                    তারিখ
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[#666057]">
                    <input
                      type="checkbox"
                      checked={typography.showDate}
                      onChange={(e) =>
                        onChangeTypography((prev) => ({
                          ...prev,
                          showDate: e.target.checked,
                        }))
                      }
                      className="h-3.5 w-3.5 accent-[#B91C1C]"
                    />
                    দেখান
                  </label>
                </div>
                <input
                  id="date-input"
                  type="text"
                  value={article.dateText}
                  onChange={(e) =>
                    onChangeArticle((prev) => ({ ...prev, dateText: e.target.value }))
                  }
                  placeholder="২১ নভেম্বর ২০২৬"
                  className="h-10 w-full rounded-lg border border-[#D4CCC0] bg-white px-3 text-sm text-[#161513] focus:border-[#161513] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() =>
                    onChangeArticle((prev) => ({ ...prev, category: cat }))
                  }
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    article.category === cat
                      ? 'border-[#047857] bg-[#047857] text-white'
                      : 'border-[#E0D9CD] bg-[#FAF8F4] text-[#57534E] hover:border-[#B8B0A2]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <hr className="border-[#EFEAE0]" />

            {/* Bottom-Center Comment Callout Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="comment-note-input"
                  className="text-xs font-semibold text-[#161513]"
                >
                  কার্ডের নিচের কমেন্ট বার্তা
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[#666057]">
                  <input
                    type="checkbox"
                    checked={typography.showCommentNote}
                    onChange={(e) =>
                      onChangeTypography((prev) => ({
                        ...prev,
                        showCommentNote: e.target.checked,
                      }))
                    }
                    className="h-3.5 w-3.5 accent-[#B91C1C]"
                  />
                  দেখান
                </label>
              </div>

              <input
                id="comment-note-input"
                type="text"
                value={typography.commentNoteText}
                disabled={!typography.showCommentNote}
                onChange={(e) =>
                  onChangeTypography((prev) => ({
                    ...prev,
                    commentNoteText: e.target.value,
                  }))
                }
                placeholder="বিস্তারিত কমেন্টে"
                className="h-10 w-full rounded-lg border border-[#D4CCC0] bg-white px-3 text-sm text-[#161513] focus:border-[#161513] focus:outline-none disabled:bg-[#F5F2EC] disabled:text-[#8E867B]"
              />

              <div className="flex flex-wrap gap-1.5">
                {COMMENT_NOTE_PRESETS.map((preset) => {
                  const active =
                    typography.showCommentNote && typography.commentNoteText.trim() === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        onChangeTypography((prev) => ({
                          ...prev,
                          showCommentNote: true,
                          commentNoteText: preset,
                        }))
                      }
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? 'border-[#161513] bg-[#161513] text-white'
                          : 'border-[#E0D9CD] bg-[#FAF8F4] text-[#57534E] hover:border-[#B8B0A2]'
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

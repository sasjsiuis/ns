export type CardStyleId =
  | 'editorial-classic'
  | 'editorial-midnight'
  | 'editorial-gallery';

export type CardAspectRatio = '1:1' | '4:5';

export type BackdropMode = 'blur' | 'color';

export type PhotoTonePreset = 'normal' | 'crisp' | 'warm' | 'mono';

export interface CropInsets {
  /** Percentage cropped from each edge (0 to 45) */
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PhotoEditState {
  /** Zoom scale: 0.25 (extreme zoom-out) to 3.0 (zoom-in). 1.0 = default smart cover fit */
  zoom: number;
  /** Horizontal offset in normalized frame coordinates (-100 to 100) */
  offsetX: number;
  /** Vertical offset in normalized frame coordinates (-100 to 100) */
  offsetY: number;
  /** Corner roundness in canvas pixels (0 to 72) */
  borderRadius: number;
  /** What fills exposed space when zoomed out or rounded */
  backdropMode: BackdropMode;
  /** Solid backdrop color when backdropMode === 'color' */
  backdropColor: string;
  /** Blur radius in canvas px when backdropMode === 'blur' (8 to 64) */
  blurAmount: number;
  /** Non-destructive edge crop insets in percent */
  crop: CropInsets;
  /** Image adjustments (100 = neutral) */
  brightness: number;
  contrast: number;
  saturation: number;
  /** Horizontal flip */
  flipX: boolean;
  /** Active color grade preset */
  tonePreset: PhotoTonePreset;
}

export interface NewsArticleData {
  headline: string;
  category: string;
  dateText: string;
  imageUrl: string;
  originalImageUrl?: string;
  sourceUrl?: string;
  bannerStripped?: boolean;
}

export type HeadlineFontId =
  | 'hind-siliguri'
  | 'noto-serif'
  | 'anek-bangla'
  | 'tiro-bangla'
  | 'baloo-da'
  | 'galada';

export type HeadlineLineMode = 'auto' | '1' | '2';

export interface HeadlineFontMeta {
  id: HeadlineFontId;
  labelBn: string;
  styleTagBn: string;
  cssFamily: string;
  canvasWeight: string;
  lineHeightRatio: number;
}

export const HEADLINE_FONTS: HeadlineFontMeta[] = [
  {
    id: 'hind-siliguri',
    labelBn: 'হিন্দ শিলিগুড়ি',
    styleTagBn: 'আধুনিক নিউজ',
    cssFamily: '"Hind Siliguri", sans-serif',
    canvasWeight: '700',
    lineHeightRatio: 1.3,
  },
  {
    id: 'noto-serif',
    labelBn: 'নোটো সেরিফ',
    styleTagBn: 'সংবাদপত্র সেরিফ',
    cssFamily: '"Noto Serif Bengali", Georgia, serif',
    canvasWeight: '700',
    lineHeightRatio: 1.34,
  },
  {
    id: 'anek-bangla',
    labelBn: 'অনেক বাংলা',
    styleTagBn: 'বোল্ড হেডলাইন',
    cssFamily: '"Anek Bangla", sans-serif',
    canvasWeight: '800',
    lineHeightRatio: 1.28,
  },
  {
    id: 'tiro-bangla',
    labelBn: 'তিরো বাংলা',
    styleTagBn: 'সম্পাদকীয় ক্লাসিক',
    cssFamily: '"Tiro Bangla", Georgia, serif',
    canvasWeight: '400',
    lineHeightRatio: 1.36,
  },
  {
    id: 'baloo-da',
    labelBn: 'বালু দা ২',
    styleTagBn: 'রাউন্ডেড মডার্ন',
    cssFamily: '"Baloo Da 2", sans-serif',
    canvasWeight: '700',
    lineHeightRatio: 1.28,
  },
  {
    id: 'galada',
    labelBn: 'গ্যালাডা',
    styleTagBn: 'ক্যালিগ্রাফিক',
    cssFamily: '"Galada", cursive, serif',
    canvasWeight: '400',
    lineHeightRatio: 1.38,
  },
];

export interface CardTypographyOptions {
  /** Manual multiplier (0.75 - 1.25); 1 = automatic optimal sizing */
  headlineScale: number;
  showCategory: boolean;
  showDate: boolean;
  headlineFont: HeadlineFontId;
  /** 'auto' chooses best zone automatically; '1' fits strictly on 1 line; '2' balances cleanly into 2 lines */
  headlineLineMode: HeadlineLineMode;
  /** Whether to show the bottom-centered comment callout (e.g. 'বিস্তারিত কমেন্টে') */
  showCommentNote: boolean;
  /** Editable bottom-centered callout text */
  commentNoteText: string;
}

export const COMMENT_NOTE_PRESETS: string[] = [
  'বিস্তারিত কমেন্টে',
  'বিস্তারিত প্রথম কমেন্টে',
  'পুরো খবর কমেন্টে',
];

export const DEFAULT_CROP: CropInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

export const DEFAULT_PHOTO_EDIT: PhotoEditState = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  borderRadius: 0,
  backdropMode: 'blur',
  backdropColor: '#1C1B19',
  blurAmount: 32,
  crop: { ...DEFAULT_CROP },
  brightness: 100,
  contrast: 100,
  saturation: 100,
  flipX: false,
  tonePreset: 'normal',
};

export const DEFAULT_TYPOGRAPHY: CardTypographyOptions = {
  headlineScale: 1,
  showCategory: true,
  showDate: true,
  headlineFont: 'hind-siliguri',
  headlineLineMode: 'auto',
  showCommentNote: true,
  commentNoteText: 'বিস্তারিত কমেন্টে',
};

export interface CardStyleMeta {
  id: CardStyleId;
  nameBn: string;
  subtitleBn: string;
  swatchBg: string;
  swatchAccent: string;
  swatchText: string;
}

export const CARD_STYLES: CardStyleMeta[] = [
  {
    id: 'editorial-classic',
    nameBn: 'সম্পাদকীয় ক্লাসিক',
    subtitleBn: 'আধুনিক কাগজ ও দ্বৈত রেখা',
    swatchBg: '#FAF8F3',
    swatchAccent: '#B91C1C',
    swatchText: '#141311',
  },
  {
    id: 'editorial-midnight',
    nameBn: 'আধুনিক নাইট',
    subtitleBn: 'ডার্ক এডিটোরিয়াল ফোকাস',
    swatchBg: '#101214',
    swatchAccent: '#DC2626',
    swatchText: '#F8F7F4',
  },
  {
    id: 'editorial-gallery',
    nameBn: 'গ্যালারি ফ্রেম',
    subtitleBn: 'শীর্ষ শিরোনাম ও ম্যাগাজিন ফ্রেম',
    swatchBg: '#FFFFFF',
    swatchAccent: '#047857',
    swatchText: '#111827',
  },
];

export const BACKDROP_SWATCHES: { label: string; hex: string }[] = [
  { label: 'গাঢ় কয়লা', hex: '#18181B' },
  { label: 'সিলেট সবুজ', hex: '#064E3B' },
  { label: 'সম্পাদকীয় লাল', hex: '#7F1D1D' },
  { label: 'উষ্ণ কাগজ', hex: '#EAE4D7' },
  { label: 'সাদা', hex: '#FFFFFF' },
  { label: 'নেভি স্লেট', hex: '#1E293B' },
  { label: 'মাটির ছায়া', hex: '#44403C' },
  { label: 'সোনালী বালি', hex: '#D6C7AE' },
];

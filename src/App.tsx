import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { LinkIntakeBar, type LinkFetchStatus } from './components/LinkIntakeBar';
import { PhotocardStage } from './components/PhotocardStage';
import { EditorPanel, type EditorTabId } from './components/EditorPanel';
import {
  DEFAULT_PHOTO_EDIT,
  DEFAULT_TYPOGRAPHY,
  HEADLINE_FONTS,
  type CardAspectRatio,
  type CardStyleId,
  type CardTypographyOptions,
  type NewsArticleData,
  type PhotoEditState,
} from './types/photocard';
import { NATUN_SYLHET_LOGO_PATH } from './utils/canvasRenderer';
import { getTodayBanglaDate } from './utils/newsParser';

const DEFAULT_SAMPLE_PHOTO =
  '/src/assets/images/sylhet_editorial_sample_1795288961205.jpg';

const INITIAL_ARTICLE: NewsArticleData = {
  headline: 'সুরমা তীরে সন্ধ্যার আলোয় নতুন সাজে ঐতিহাসিক ক্বীন ব্রিজ ও সিলেট নগরী',
  category: 'সিলেট',
  dateText: getTodayBanglaDate(),
  imageUrl: DEFAULT_SAMPLE_PHOTO,
};

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}

export default function App() {
  const [urlValue, setUrlValue] = useState('');
  const [status, setStatus] = useState<LinkFetchStatus>({ state: 'idle' });
  const [activeStyle, setActiveStyle] = useState<CardStyleId>('editorial-classic');
  const [aspect, setAspect] = useState<CardAspectRatio>('1:1');
  const [activeTab, setActiveTab] = useState<EditorTabId>('content');

  const [article, setArticle] = useState<NewsArticleData>(INITIAL_ARTICLE);
  const [edit, setEdit] = useState<PhotoEditState>(DEFAULT_PHOTO_EDIT);
  const [typography, setTypography] = useState<CardTypographyOptions>(DEFAULT_TYPOGRAPHY);

  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [fontRenderVersion, setFontRenderVersion] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeFetchAbort = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Wait for Bengali Google Fonts so Canvas 2D draws crisp fonts immediately
  useEffect(() => {
    let active = true;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (active) setFontsReady(true);
      });
    } else {
      setFontsReady(true);
    }
    return () => {
      active = false;
    };
  }, []);

  // Ensure any newly selected Bengali Google Font is loaded before repainting canvas
  useEffect(() => {
    if (!document.fonts || !document.fonts.load) return;
    let active = true;
    const meta = HEADLINE_FONTS.find((f) => f.id === typography.headlineFont);
    if (!meta) return;
    document.fonts
      .load(`${meta.canvasWeight} 48px ${meta.cssFamily}`, 'নতুন সিলেট সংবাদ')
      .then(() => {
        if (active) setFontRenderVersion((v) => v + 1);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [typography.headlineFont]);

  // Load official Natun Sylhet logo once
  useEffect(() => {
    let active = true;
    loadImageElement(NATUN_SYLHET_LOGO_PATH)
      .then((img) => {
        if (active) setLogoImage(img);
      })
      .catch(() => {
        // Canvas renderer has crisp typographic fallback if image ever fails
      });
    return () => {
      active = false;
    };
  }, []);

  // Load current article photo whenever article.imageUrl changes
  useEffect(() => {
    if (!article.imageUrl) {
      setPhotoImage(null);
      return;
    }
    let active = true;
    setIsLoadingPhoto(true);
    loadImageElement(article.imageUrl)
      .then((img) => {
        if (active) {
          setPhotoImage(img);
          setIsLoadingPhoto(false);
        }
      })
      .catch(() => {
        if (active) {
          setIsLoadingPhoto(false);
        }
      });
    return () => {
      active = false;
    };
  }, [article.imageUrl]);

  // Clean up any local uploaded object URL on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleInstantFetch = useCallback(async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return;

    if (activeFetchAbort.current) {
      activeFetchAbort.current.abort();
    }
    const controller = new AbortController();
    activeFetchAbort.current = controller;

    setStatus({ state: 'loading' });
    // Reset pan/zoom/crop immediately at fetch start so any edits made while loading are preserved
    setEdit((prev) => ({
      ...DEFAULT_PHOTO_EDIT,
      backdropMode: prev.backdropMode,
      backdropColor: prev.backdropColor,
      borderRadius: prev.borderRadius,
    }));

    try {
      const response = await fetch(
        `/api/fetch-news?url=${encodeURIComponent(trimmed)}`,
        { signal: controller.signal }
      );
      const data = await response.json();

      if (!response.ok) {
        setStatus({
          state: 'fallback',
          message:
            data?.error ||
            'লিংকটি লোড হতে সমস্যা হয়েছে — আপনি সহজেই নিজে শিরোনাম ও ছবি বসাতে পারেন।',
        });
        return;
      }

      const nextHeadline = (data.headline || '').trim();
      const nextImage = (data.imageUrl || '').trim();

      if (!nextHeadline && !nextImage) {
        setStatus({
          state: 'fallback',
          message:
            'এই পাতায় সংবাদের শিরোনাম বা ছবি পাওয়া যায়নি — নিচ থেকে নিজে যোগ করে নিন।',
        });
        return;
      }

      setArticle((prev) => ({
        headline: nextHeadline || prev.headline,
        category: data.category || prev.category || 'সিলেট',
        dateText: data.dateText || prev.dateText || getTodayBanglaDate(),
        imageUrl: nextImage || prev.imageUrl,
        originalImageUrl: data.originalImageUrl,
        sourceUrl: data.sourceUrl,
        bannerStripped: Boolean(data.bannerStripped),
      }));

      setStatus({
        state: 'success',
        bannerStripped: Boolean(data.bannerStripped),
        message: data.bannerStripped
          ? 'ফটো কার্ড তৈরি হয়েছে — ব্যানারমুক্ত পূর্ণ মানের আসল ছবি ও শিরোনাম যুক্ত করা হয়েছে।'
          : 'ফটো কার্ড তৈরি হয়েছে — শিরোনাম ও ছবি স্বয়ংক্রিয়ভাবে বসে গেছে।',
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setStatus({
        state: 'fallback',
        message:
          'সংযোগে সাময়িক বিলম্ব হচ্ছে — অনুগ্রহ করে আবার চেষ্টা করুন অথবা নিজে শিরোনাম ও ছবি যোগ করুন।',
      });
    }
  }, []);

  const handleUploadLocalImage = useCallback((file: File) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const localUrl = URL.createObjectURL(file);
    objectUrlRef.current = localUrl;
    setArticle((prev) => ({
      ...prev,
      imageUrl: localUrl,
      bannerStripped: false,
    }));
    setEdit((prev) => ({
      ...prev,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
    }));
    setStatus({
      state: 'success',
      message: 'আপনার ছবিটি ফটো কার্ডে যুক্ত হয়েছে।',
    });
  }, []);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDownloading(true);

    const safeSlug = (article.category || 'news')
      .replace(/[^\u0980-\u09FFa-zA-Z0-9]+/g, '-')
      .slice(0, 20);
    const filename = `NS-Photocard-${activeStyle}-${safeSlug || 'sylhet'}.png`;

    canvas.toBlob((blob) => {
      if (blob) {
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
      }
      setIsDownloading(false);
    }, 'image/png');
  }, [activeStyle, article.category]);

  const handleResetPhoto = useCallback(() => {
    setEdit((prev) => ({
      ...DEFAULT_PHOTO_EDIT,
      backdropMode: prev.backdropMode,
      backdropColor: prev.backdropColor,
    }));
  }, []);

  return (
    <div id="top" className="flex min-h-screen flex-col bg-[#F7F5F0] text-[#161513]">
      <Header
        activeStyle={activeStyle}
        onSelectStyle={setActiveStyle}
        onDownload={handleDownload}
        isDownloading={isDownloading}
      />

      <LinkIntakeBar
        urlValue={urlValue}
        onUrlChange={setUrlValue}
        onInstantFetch={handleInstantFetch}
        onClearUrl={() => {
          setUrlValue('');
          setStatus({ state: 'idle' });
        }}
        onOpenManualTab={() => setActiveTab('content')}
        status={status}
      />

      <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Dominant Studio Stage: Live High-Res Editorial Photocard */}
          <div className="lg:col-span-7 xl:col-span-8">
            <PhotocardStage
              style={activeStyle}
              onSelectStyle={setActiveStyle}
              aspect={aspect}
              onSelectAspect={setAspect}
              article={article}
              edit={edit}
              onChangeEdit={setEdit}
              onResetPhoto={handleResetPhoto}
              typography={typography}
              photoImage={photoImage}
              logoImage={logoImage}
              fontsReady={fontsReady}
              fontRenderVersion={fontRenderVersion}
              canvasRef={canvasRef}
              onUploadLocalImage={handleUploadLocalImage}
              onDownload={handleDownload}
              isDownloading={isDownloading}
              isLoadingPhoto={isLoadingPhoto}
            />
          </div>

          {/* Right Editorial Control Rail */}
          <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-20">
            <EditorPanel
              activeTab={activeTab}
              onChangeTab={setActiveTab}
              article={article}
              onChangeArticle={setArticle}
              edit={edit}
              onChangeEdit={setEdit}
              typography={typography}
              onChangeTypography={setTypography}
              onUploadLocalImage={handleUploadLocalImage}
              photoNaturalSize={
                photoImage
                  ? { width: photoImage.naturalWidth, height: photoImage.naturalHeight }
                  : null
              }
            />
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-[#E3DDD2] bg-[#FAF8F4]">
        <div className="mx-auto flex max-w-[1360px] flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-[#666057] sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img
              src={NATUN_SYLHET_LOGO_PATH}
              alt="নতুন সিলেট লোগো"
              referrerPolicy="no-referrer"
              className="h-6 w-auto object-contain mix-blend-multiply"
            />
            <span>·</span>
            <span>NS-Photocard · নতুন সিলেটের জন্য নির্মিত</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

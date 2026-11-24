import { useEffect, useRef, useState } from 'react';
import { Download, ImagePlus, Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import {
  CARD_STYLES,
  type CardAspectRatio,
  type CardStyleId,
  type CardTypographyOptions,
  type NewsArticleData,
  type PhotoEditState,
} from '../types/photocard';
import {
  getCanvasDimensions,
  getPhotoFrameRect,
  renderPhotocard,
} from '../utils/canvasRenderer';

interface PhotocardStageProps {
  style: CardStyleId;
  onSelectStyle: (style: CardStyleId) => void;
  aspect: CardAspectRatio;
  onSelectAspect: (aspect: CardAspectRatio) => void;
  article: NewsArticleData;
  edit: PhotoEditState;
  onChangeEdit: (updater: (prev: PhotoEditState) => PhotoEditState) => void;
  onResetPhoto: () => void;
  typography: CardTypographyOptions;
  photoImage: HTMLImageElement | null;
  logoImage: HTMLImageElement | null;
  fontsReady: boolean;
  fontRenderVersion: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onUploadLocalImage: (file: File) => void;
  onDownload: () => void;
  isDownloading: boolean;
  isLoadingPhoto: boolean;
}

export function PhotocardStage({
  style,
  onSelectStyle,
  aspect,
  onSelectAspect,
  article,
  edit,
  onChangeEdit,
  onResetPhoto,
  typography,
  photoImage,
  logoImage,
  fontsReady,
  fontRenderVersion,
  canvasRef,
  onUploadLocalImage,
  onDownload,
  isDownloading,
  isLoadingPhoto,
}: PhotocardStageProps) {
  const frameUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [isFileDragOver, setIsFileDragOver] = useState(false);

  const dragState = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originOffsetX: number;
    originOffsetY: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    originOffsetX: 0,
    originOffsetY: 0,
  });

  const [isDragging, setIsDragging] = useState(false);

  // Re-render canvas whenever any state or loaded asset updates
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderPhotocard({
      canvas,
      style,
      aspect,
      article,
      edit,
      typography,
      photo: photoImage,
      logo: logoImage,
    });
  }, [
    canvasRef,
    style,
    aspect,
    article,
    edit,
    typography,
    photoImage,
    logoImage,
    fontsReady,
    fontRenderVersion,
  ]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !photoImage) return;
    const rect = canvas.getBoundingClientRect();
    const dims = getCanvasDimensions(aspect);
    const frame = getPhotoFrameRect(style, aspect);

    const canvasX = ((e.clientX - rect.left) / rect.width) * dims.width;
    const canvasY = ((e.clientY - rect.top) / rect.height) * dims.height;

    const insideFrame =
      canvasX >= frame.x &&
      canvasX <= frame.x + frame.w &&
      canvasY >= frame.y &&
      canvasY <= frame.y + frame.h;

    if (!insideFrame) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originOffsetX: edit.offsetX,
      originOffsetY: edit.offsetY,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragState.current.active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dxPct = ((e.clientX - dragState.current.startX) / rect.width) * 200;
    const dyPct = ((e.clientY - dragState.current.startY) / rect.height) * 200;

    const nextX = Math.max(-100, Math.min(100, Math.round(dragState.current.originOffsetX + dxPct)));
    const nextY = Math.max(-100, Math.min(100, Math.round(dragState.current.originOffsetY + dyPct)));

    onChangeEdit((prev) => ({
      ...prev,
      offsetX: nextX,
      offsetY: nextY,
    }));
  };

  const endDrag = () => {
    dragState.current.active = false;
    setIsDragging(false);
  };

  const zoomPercent = Math.round(edit.zoom * 100);

  return (
    <div className="flex flex-col gap-5">
      {/* Top Toolbar: Style Switcher & Aspect Ratio */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="radiogroup"
          aria-label="ফটো কার্ডের ধরন নির্বাচন করুন"
          className="grid grid-cols-3 gap-2"
        >
          {CARD_STYLES.map((item) => {
            const active = item.id === style;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSelectStyle(item.id)}
                className={`group flex items-center justify-center gap-2 rounded-lg border px-2 py-2 text-center transition-all duration-150 sm:justify-start sm:px-3 sm:text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C] ${
                  active
                    ? 'border-[#161513] bg-white shadow-xs'
                    : 'border-[#E0D9CD] bg-[#FAF8F4] hover:border-[#BDB4A5] hover:bg-white'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="hidden h-7 w-7 shrink-0 flex-col overflow-hidden rounded border border-black/15 sm:flex"
                  style={{ backgroundColor: item.swatchBg }}
                >
                  <span
                    className="h-1.5 w-full"
                    style={{ backgroundColor: item.swatchAccent }}
                  />
                  <span className="mt-auto mx-1 mb-1 h-1 rounded-xs opacity-65" style={{ backgroundColor: item.swatchText }} />
                </span>
                <span className="min-w-0">
                  <span className="block whitespace-nowrap text-xs font-semibold text-[#161513] sm:text-sm">
                    {item.nameBn}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Aspect Ratio Segmented Switch */}
        <div
          role="group"
          aria-label="কার্ডের মাপ"
          className="inline-flex self-start rounded-lg border border-[#E0D9CD] bg-[#EFECE5] p-1 sm:self-auto"
        >
          {(['1:1', '4:5'] as CardAspectRatio[]).map((ratio) => {
            const active = aspect === ratio;
            return (
              <button
                key={ratio}
                type="button"
                onClick={() => onSelectAspect(ratio)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-white text-[#161513] shadow-xs'
                    : 'text-[#666057] hover:text-[#161513]'
                }`}
              >
                {ratio === '1:1' ? '১:১ স্কয়ার' : '৪:৫ পোর্ট্রেট'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Photocard Preview Surface (also supports direct drag-and-drop image upload) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsFileDragOver(true);
        }}
        onDragLeave={() => setIsFileDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsFileDragOver(false);
          const droppedFile = e.dataTransfer.files?.[0];
          if (droppedFile && droppedFile.type.startsWith('image/')) {
            onUploadLocalImage(droppedFile);
          }
        }}
        className={`relative flex flex-col items-center justify-center rounded-xl border p-3 transition-colors sm:p-4 ${
          isFileDragOver
            ? 'border-[#B91C1C] bg-[#F5EAE6]'
            : 'border-[#DFD8CC] bg-[#ECE8DF]'
        }`}
      >
        <input
          ref={frameUploadInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadLocalImage(file);
            e.target.value = '';
          }}
          className="sr-only"
          id="frame-stage-photo-upload"
        />

        <div
          className={`relative w-full overflow-hidden rounded-md bg-white shadow-[0_14px_38px_rgba(22,21,19,0.12)] ${
            aspect === '4:5' ? 'max-w-[420px]' : 'max-w-[490px] xl:max-w-[510px]'
          }`}
        >
          <canvas
            ref={canvasRef}
            data-testid="photocard-canvas"
            data-style={style}
            data-aspect={aspect}
            data-zoom={edit.zoom.toFixed(2)}
            data-backdrop={edit.backdropMode}
            data-radius={edit.borderRadius}
            data-font={typography.headlineFont}
            data-linemode={typography.headlineLineMode}
            data-comment-note={typography.showCommentNote ? typography.commentNoteText : 'off'}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={onResetPhoto}
            aria-label="নতুন সিলেট নিউজ ফটো কার্ড প্রিভিউ"
            className={`block h-auto w-full select-none ${
              photoImage ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
            style={{ touchAction: 'none' }}
          />

          {isLoadingPhoto && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#FAF8F4]/75 backdrop-blur-[2px]">
              <div className="rounded-lg border border-[#E0D9CD] bg-white px-4 py-2.5 text-sm font-semibold text-[#161513] shadow-sm">
                আসল ছবি লোড হচ্ছে...
              </div>
            </div>
          )}

          {isFileDragOver && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#161513]/70">
              <div className="rounded-lg border border-white/30 bg-white px-5 py-3 text-sm font-semibold text-[#161513] shadow-md">
                ছবিটি এখানে ছেড়ে দিন
              </div>
            </div>
          )}
        </div>

        {/* Interactive frame action bar: Direct Upload from Frame + Drag Hint + Zoom/Reset */}
        <div className="mt-4 flex w-full max-w-[560px] flex-wrap items-center justify-between gap-2.5 text-xs text-[#57534E]">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => frameUploadInputRef.current?.click()}
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-[#161513] bg-white px-3 font-semibold text-[#161513] transition-colors hover:bg-[#161513] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C]"
            >
              <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>ফ্রেমে ছবি আপলোড</span>
            </button>

            <span className="hidden items-center gap-1 sm:inline-flex">
              <Move className="h-3.5 w-3.5 shrink-0 text-[#78716C]" aria-hidden="true" />
              <span>টেনে পজিশন ঠিক করুন</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="জুম আউট করুন"
              onClick={() =>
                onChangeEdit((prev) => ({
                  ...prev,
                  zoom: Math.max(0.25, Number((prev.zoom - 0.1).toFixed(2))),
                }))
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#D8D1C4] bg-white text-[#161513] transition-colors hover:bg-[#FAF8F4]"
            >
              <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <span className="min-w-[44px] text-center font-semibold tabular-nums text-[#161513]">
              {zoomPercent}%
            </span>

            <button
              type="button"
              aria-label="জুম ইন করুন"
              onClick={() =>
                onChangeEdit((prev) => ({
                  ...prev,
                  zoom: Math.min(3, Number((prev.zoom + 0.1).toFixed(2))),
                }))
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#D8D1C4] bg-white text-[#161513] transition-colors hover:bg-[#FAF8F4]"
            >
              <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onResetPhoto}
              className="ml-1 inline-flex h-8 items-center gap-1 rounded-md border border-[#D8D1C4] bg-white px-2.5 font-medium text-[#161513] transition-colors hover:bg-[#FAF8F4]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>রিসেট</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary 1-Click Download Bar directly under preview (especially handy on mobile) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#161513] px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#B91C1C] active:scale-[0.99] disabled:opacity-60 sm:w-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C]"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{isDownloading ? 'ডাউনলোড প্রস্তুত হচ্ছে...' : 'ফটো কার্ড ডাউনলোড করুন (১ ক্লিকে)'}</span>
        </button>
      </div>
    </div>
  );
}

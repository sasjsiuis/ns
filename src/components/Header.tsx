import { Download } from 'lucide-react';
import { CARD_STYLES, type CardStyleId } from '../types/photocard';

interface HeaderProps {
  activeStyle: CardStyleId;
  onSelectStyle: (style: CardStyleId) => void;
  onDownload: () => void;
  isDownloading: boolean;
}

export function Header({
  activeStyle,
  onSelectStyle,
  onDownload,
  isDownloading,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E3DDD2] bg-[#FAF8F4]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1360px] items-center justify-between gap-4 px-4 sm:h-16 sm:gap-8 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Title */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="shrink-0 whitespace-nowrap text-xl font-bold tracking-tight text-[#161513] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B91C1C]"
        >
          NS-Photocard
        </a>

        {/* Zone 2: Remaining header style navigation link */}
        <nav
          aria-label="ফটো কার্ড শৈলী"
          className="hidden items-center gap-6 md:flex"
        >
          {CARD_STYLES.filter((style) => style.id === 'editorial-gallery').map((style) => {
            const isActive = style.id === activeStyle;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => onSelectStyle(style.id)}
                className={`shrink-0 whitespace-nowrap border-b-2 py-1 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B91C1C] ${
                  isActive
                    ? 'border-[#B91C1C] text-[#161513]'
                    : 'border-transparent text-[#666057] hover:border-[#CBC3B6] hover:text-[#161513]'
                }`}
              >
                {style.nameBn}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#B91C1C] px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#991B1B] active:scale-[0.99] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#161513]"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{isDownloading ? 'তৈরি হচ্ছে...' : 'ডাউনলোড করুন'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

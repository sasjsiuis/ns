import { useEffect, useRef } from 'react';
import { Link2, Loader2, RotateCcw, Check, AlertCircle } from 'lucide-react';

export interface LinkFetchStatus {
  state: 'idle' | 'loading' | 'success' | 'fallback';
  message?: string;
  bannerStripped?: boolean;
}

interface LinkIntakeBarProps {
  urlValue: string;
  onUrlChange: (value: string) => void;
  onInstantFetch: (url: string) => void;
  onClearUrl: () => void;
  onOpenManualTab: () => void;
  status: LinkFetchStatus;
}

function looksLikeCompleteNewsUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes(' ')) return false;
  return /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\/[^\s]+$/i.test(trimmed);
}

export function LinkIntakeBar({
  urlValue,
  onUrlChange,
  onInstantFetch,
  onClearUrl,
  onOpenManualTab,
  status,
}: LinkIntakeBarProps) {
  const debounceTimer = useRef<number | null>(null);
  const lastAutoFetched = useRef<string>('');

  useEffect(() => {
    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, []);

  const scheduleAutoFetch = (nextValue: string, immediate: boolean) => {
    if (debounceTimer.current) {
      window.clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    const trimmed = nextValue.trim();
    if (!looksLikeCompleteNewsUrl(trimmed)) return;
    if (trimmed === lastAutoFetched.current && status.state === 'loading') return;

    if (immediate) {
      lastAutoFetched.current = trimmed;
      onInstantFetch(trimmed);
      return;
    }

    debounceTimer.current = window.setTimeout(() => {
      lastAutoFetched.current = trimmed;
      onInstantFetch(trimmed);
    }, 150);
  };

  return (
    <section
      aria-label="নিউজ লিংক ইনপুট"
      className="border-b border-[#E3DDD2] bg-[#FAF8F4]"
    >
      <div className="mx-auto max-w-[1360px] px-4 py-3 sm:px-6 sm:py-3.5 lg:px-8">
        {/* Zero-click URL paste input */}
        <div>
          <label htmlFor="news-link-input" className="sr-only">
            নিউজের লিংক দিন
          </label>
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute left-3.5 flex items-center text-[#78716C]">
              {status.state === 'loading' ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#B91C1C]" aria-hidden="true" />
              ) : (
                <Link2 className="h-5 w-5" aria-hidden="true" />
              )}
            </div>

            <input
              id="news-link-input"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={urlValue}
              onChange={(e) => {
                const val = e.target.value;
                onUrlChange(val);
                scheduleAutoFetch(val, false);
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text').trim();
                if (pasted) {
                  e.preventDefault();
                  onUrlChange(pasted);
                  scheduleAutoFetch(pasted, true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && urlValue.trim()) {
                  e.preventDefault();
                  lastAutoFetched.current = urlValue.trim();
                  onInstantFetch(urlValue.trim());
                }
              }}
              placeholder="এখানে লিংক পেস্ট করুন (যেমন: https://www.natunsylhet24.com/details/62238)"
              className="h-12 w-full rounded-lg border border-[#D4CCC0] bg-white pl-11 pr-24 text-sm text-[#161513] placeholder:text-[#8E867B] transition-colors focus:border-[#161513] focus:outline-none sm:text-base"
            />

            <div className="absolute right-2 flex items-center gap-1.5">
              {urlValue && (
                <button
                  type="button"
                  onClick={() => {
                    lastAutoFetched.current = '';
                    onClearUrl();
                  }}
                  aria-label="লিংক মুছুন"
                  className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-[#666057] transition-colors hover:bg-[#F1EDE4] hover:text-[#161513]"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">মুছুন</span>
                </button>
              )}
            </div>
          </div>

          {/* Subtle progress line during live fetch */}
          {status.state === 'loading' && (
            <div
              role="status"
              aria-live="polite"
              className="mt-2 flex items-center gap-2 text-xs font-medium text-[#B91C1C]"
            >
              <span>নিউজের শিরোনাম ও ব্যানারমুক্ত আসল ছবি সংগ্রহ করা হচ্ছে...</span>
            </div>
          )}

          {status.state === 'success' && status.message && (
            <div
              role="status"
              aria-live="polite"
              data-testid="fetch-status-success"
              className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#047857]"
            >
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{status.message}</span>
            </div>
          )}

          {status.state === 'fallback' && status.message && (
            <div
              role="status"
              aria-live="polite"
              className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9A3412]"
            >
              <span className="inline-flex items-center gap-1.5 font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {status.message}
              </span>
              <button
                type="button"
                onClick={onOpenManualTab}
                className="font-semibold underline underline-offset-2 hover:text-[#7C2D12]"
              >
                নিজে শিরোনাম ও ছবি যোগ করুন
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

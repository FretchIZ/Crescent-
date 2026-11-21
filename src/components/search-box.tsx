"use client";

import { ArrowRight, Loader2, Mic, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type SpeechResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export function SearchBox({
  initialQuery = "",
  autoFocus = false,
  size = "hero",
  onSearch,
  busy = false,
}: {
  initialQuery?: string;
  autoFocus?: boolean;
  size?: "hero" | "compact";
  onSearch?: (query: string) => void;
  busy?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    setVoiceSupported(true);
    const recognition = new Ctor();
    recognition.lang = "en-PH";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) setQuery((current) => (current ? `${current} ${transcript}` : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        // already stopped
      }
    };
  }, []);

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const value = query.trim();
    if (value.length < 3) return;
    if (onSearch) {
      onSearch(value);
      return;
    }
    router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  function toggleVoice() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
      return;
    }
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  const hero = size === "hero";

  return (
    <form onSubmit={submit} role="search" className="w-full">
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl2 border bg-panel shadow-card transition focus-within:border-accent/50 focus-within:ring-4 focus-within:ring-accent/10",
          hero ? "border-accent/25 px-3 py-2.5 sm:px-4 sm:py-3" : "border-line px-2 py-1.5"
        )}
      >
        <Sparkles className={cn("shrink-0 text-accent", hero ? "h-5 w-5" : "h-4 w-4")} aria-hidden />
        <label htmlFor="ai-search" className="sr-only">
          Describe what you are looking for
        </label>
        <input
          id="ai-search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus={autoFocus}
          autoComplete="off"
          maxLength={500}
          placeholder={hero ? "Try: a gift for my mom who loves gardening, under ₱2,000" : "Refine your search…"}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-ink placeholder:text-muted/70 focus:outline-none",
            hero ? "py-1 text-[15px] sm:text-base" : "text-sm"
          )}
        />
        {voiceSupported ? (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={listening ? "Stop voice search" : "Search by voice"}
            aria-pressed={listening}
            title={listening ? "Listening…" : "Search by voice"}
            className={cn(
              "grid shrink-0 place-items-center rounded-lg border border-line text-muted transition hover:text-ink",
              hero ? "h-10 w-10" : "h-8 w-8",
              listening && "border-accent/30 bg-accent-soft text-accent"
            )}
          >
            <Mic className={cn(hero ? "h-4 w-4" : "h-3.5 w-3.5", listening && "animate-pulse")} />
          </button>
        ) : null}
        <button
          type="submit"
          disabled={busy || query.trim().length < 3}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50",
            hero ? "h-10 px-4 text-sm" : "h-8 px-3 text-xs"
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : hero ? <ArrowRight className="h-4 w-4" /> : <Search className="h-3.5 w-3.5" />}
          <span className={hero ? "" : "hidden sm:inline"}>{busy ? "Searching" : "Ask"}</span>
        </button>
      </div>
      {listening ? (
        <p className="mt-2 pl-1 text-xs font-medium text-accent-ink" role="status">
          Listening… speak your request.
        </p>
      ) : null}
    </form>
  );
}

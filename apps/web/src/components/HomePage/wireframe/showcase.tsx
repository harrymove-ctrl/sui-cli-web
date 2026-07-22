
import { AnimatePresence, motion, type Transition } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingUp,
  Search,
  Layers,
  Boxes,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { SectionCorners } from "./section-corners";

const MORPH_TRANSITION: Transition = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1],
};

type ShowcaseCard = {
  id: string;
  title: string;
  Icon: LucideIcon;
  body: string;
};

const CARDS: ReadonlyArray<ShowcaseCard> = [
  {
    id: "flagship",
    title: "Flagship\nLarge Cap",
    Icon: TrendingUp,
    body: "A long-horizon position in resilient, high-quality public companies. Built for compounding without the noise of short-term swings.",
  },
  {
    id: "opportunities",
    title: "Opportunities\nSmall Cap",
    Icon: Search,
    body: "Concentrated exposure to under-the-radar names with asymmetric upside. Researched in-house, screened for conviction, sized with discipline.",
  },
  {
    id: "offshore",
    title: "Offshore\nGlobal Equity",
    Icon: Layers,
    body: "International equity exposure across developed and emerging markets, balanced for currency, region, and sector concentration.",
  },
  {
    id: "automated",
    title: "Automated\nFixed Income",
    Icon: Boxes,
    body: "A rules-based bond ladder that rebalances itself as rates move. Designed for steady carry without the friction of manual trading.",
  },
  {
    id: "ventures",
    title: "Ventures\nPrivate Markets",
    Icon: Sparkles,
    body: "Curated access to late-stage private deals previously walled off to institutions. One subscription, one portfolio, one set of fees.",
  },
];

export function Showcase(): ReactNode {
  const [activeId, setActiveId] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const headingId = useId();

  const recompute = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const firstCard = track.querySelector<HTMLElement>("[data-card]");
    if (!firstCard) return;
    const cardWidth = firstCard.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).columnGap || "0");
    const step = cardWidth + gap;
    if (step <= 0) {
      setPage(0);
      setPageCount(1);
      return;
    }
    const totalScrollable = track.scrollWidth - track.clientWidth;
    const pages = Math.max(1, Math.round(totalScrollable / step) + 1);
    const current = Math.round(track.scrollLeft / step);
    setPageCount(pages);
    setPage(Math.min(pages - 1, Math.max(0, current)));
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = (): void => recompute();
    track.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => recompute());
    ro.observe(track);
    return () => {
      track.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [recompute]);

  useEffect(() => {
    if (!activeId) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setActiveId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [activeId]);

  const scrollByCards = useCallback((direction: 1 | -1): void => {
    const track = trackRef.current;
    if (!track) return;
    const firstCard = track.querySelector<HTMLElement>("[data-card]");
    if (!firstCard) return;
    const cardWidth = firstCard.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).columnGap || "0");
    track.scrollBy({ left: direction * (cardWidth + gap), behavior: "smooth" });
  }, []);

  const activeCard = activeId ? CARDS.find((c) => c.id === activeId) ?? null : null;

  return (
    <section
      aria-labelledby={headingId}
      className="relative border-b border-border"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-16 sm:px-10 sm:py-20 lg:border-r lg:border-border lg:px-14 lg:py-24">
          <h2
            id={headingId}
            className="text-4xl font-medium leading-[1.05] tracking-tighter text-foreground sm:text-5xl lg:text-[3.5rem] xl:text-[4rem]"
          >
            Built lean,
            <br />
            shipped fast,
            <br />
            <span className="text-muted-foreground">ready for your brand</span>
          </h2>
          <p className="mt-10 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            Each surface is intentionally generic so your brand drops in
            without resistance.
          </p>
          <div className="mt-10">
            <a
              href="#offerings"
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-90"
            >
              See Our Designs
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <div className="relative flex flex-col overflow-hidden">
          <div
            ref={trackRef}
            className="flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto scroll-smooth px-6 py-16 sm:gap-6 sm:px-10 sm:py-20 lg:px-14 lg:py-24 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {CARDS.map((card) => (
              <Card
                key={card.id}
                card={card}
                hidden={activeId === card.id}
                onClick={() => setActiveId(card.id)}
              />
            ))}
            <div aria-hidden="true" className="shrink-0 basis-6 sm:basis-10 lg:basis-14" />
          </div>

          <div className="flex items-center justify-center gap-2 px-6 pb-10 sm:px-10 sm:pb-12 lg:px-14 lg:pb-14">
            <button
              type="button"
              onClick={() => scrollByCards(-1)}
              disabled={page === 0}
              aria-label="Previous card"
              className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div
              role="tablist"
              aria-label="Card progress"
              className="flex h-8 items-center gap-2 rounded-full bg-muted px-4"
            >
              {Array.from({ length: pageCount }).map((_, i) => (
                <span
                  key={i}
                  role="tab"
                  aria-selected={i === page}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === page ? "w-6 bg-foreground" : "w-1.5 bg-muted-foreground/40"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => scrollByCards(1)}
              disabled={page >= pageCount - 1}
              aria-label="Next card"
              className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {activeCard ? (
          <ExpandedCard
            key="expanded"
            card={activeCard}
            onClose={() => setActiveId(null)}
          />
        ) : null}
      </AnimatePresence>
      <SectionCorners />
    </section>
  );
}

function Card({
  card,
  hidden,
  onClick,
}: {
  card: ShowcaseCard;
  hidden: boolean;
  onClick: () => void;
}): ReactNode {
  const { Icon } = card;
  return (
    <motion.button
      type="button"
      data-card
      onClick={onClick}
      layoutId={`card-${card.id}`}
      transition={MORPH_TRANSITION}
      style={{ visibility: hidden ? "hidden" : "visible" }}
      className="focus-ring group relative flex aspect-[3/4] w-[280px] shrink-0 cursor-pointer snap-center flex-col justify-between rounded-2xl bg-muted p-6 text-left sm:w-[320px] sm:p-7 lg:w-[360px] lg:p-8"
    >
      <motion.div
        layoutId={`card-icon-${card.id}`}
        transition={MORPH_TRANSITION}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-background/60 text-foreground"
      >
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </motion.div>
      <div className="space-y-5">
        <motion.h3
          layoutId={`card-title-${card.id}`}
          transition={MORPH_TRANSITION}
          className="whitespace-pre-line text-xl font-medium leading-tight tracking-tight text-foreground sm:text-2xl"
        >
          {card.title}
        </motion.h3>
        <motion.span
          layoutId={`card-plus-${card.id}`}
          aria-hidden="true"
          transition={MORPH_TRANSITION}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/60 text-foreground"
        >
          <motion.span
            className="inline-flex"
            animate={{ rotate: 0 }}
            transition={MORPH_TRANSITION}
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
          </motion.span>
        </motion.span>
      </div>
    </motion.button>
  );
}

function ExpandedCard({
  card,
  onClose,
}: {
  card: ShowcaseCard;
  onClose: () => void;
}): ReactNode {
  const { Icon } = card;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-10">
      <motion.button
        type="button"
        aria-label="Close"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 cursor-default bg-background/60 backdrop-blur-xl"
      />

      <motion.div
        layoutId={`card-${card.id}`}
        transition={MORPH_TRANSITION}
        className="relative z-10 flex aspect-[3/4] w-full max-w-[420px] flex-col justify-between rounded-2xl bg-muted p-8 sm:aspect-auto sm:max-w-2xl sm:p-10 lg:p-12"
      >
        <motion.div
          layoutId={`card-icon-${card.id}`}
          transition={MORPH_TRANSITION}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-background/60 text-foreground"
        >
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </motion.div>

        <div className="mt-8 space-y-6 sm:mt-12">
          <motion.h3
            layoutId={`card-title-${card.id}`}
            transition={MORPH_TRANSITION}
            className="whitespace-pre-line text-2xl font-medium leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl"
          >
            {card.title}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base"
          >
            {card.body}
          </motion.p>
          <motion.button
            type="button"
            onClick={onClose}
            layoutId={`card-plus-${card.id}`}
            transition={MORPH_TRANSITION}
            aria-label="Close card"
            className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/60 text-foreground transition-opacity hover:opacity-80"
          >
            <motion.span
              className="inline-flex"
              animate={{ rotate: 45 }}
              transition={MORPH_TRANSITION}
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
            </motion.span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

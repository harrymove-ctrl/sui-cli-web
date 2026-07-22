
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, type Transition } from "framer-motion";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { SectionCorners } from "./section-corners";

const SWAP_TRANSITION: Transition = {
  duration: 0.45,
  ease: [0.22, 1, 0.36, 1],
};

const TRACK_TRANSITION: Transition = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1],
};

const PEEK = 28;
const GAP = 16;

type Testimonial = {
  id: string;
  title: string;
  subtitle: string;
  name: string;
  role: string;
  topic: string;
  avatar: string;
};

const TESTIMONIALS: ReadonlyArray<Testimonial> = [
  {
    id: "alyssa",
    title: "Shipping the next version",
    subtitle:
      "Sui CLI Web let our team move from sketches to a working app on day one — by the time the brand system landed we were already iterating on real flows.",
    name: "Alyssa Reed",
    role: "Design Lead, Halftone",
    topic: "Brand-ready scaffold",
    avatar:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=facearea&facepad=2&w=200&h=200&q=80&sat=-100",
  },
  {
    id: "will",
    title: "Keeps up with iteration",
    subtitle:
      "We tore out maybe a quarter of the components and the rest just stayed — the structure was right enough that nothing got in our way.",
    name: "Will Aldridge",
    role: "Engineering, Northbridge",
    topic: "Structure that scales",
    avatar:
      "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=facearea&facepad=2.2&w=200&h=200&q=80&sat=-100",
  },
  {
    id: "andrew",
    title: "Terminal to launch in a sprint",
    subtitle:
      "We brought stakeholders something tangible by Wednesday and shipped it the following week. Frame removed the part of the timeline we used to dread.",
    name: "Andrew Marin",
    role: "Founder, Stack Studio",
    topic: "Fast stakeholder demos",
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=facearea&facepad=2&w=200&h=200&q=80&sat=-100",
  },
];

export function Testimonials(): ReactNode {
  const [activeIndex, setActiveIndex] = useState(0);
  const headingId = useId();

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const dragStartXRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const advance = useCallback((dir: 1 | -1): void => {
    setActiveIndex((i) => {
      const next = i + dir;
      if (next < 0) return 0;
      if (next >= TESTIMONIALS.length) return TESTIMONIALS.length - 1;
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if (e.key === "ArrowRight") advance(1);
      else if (e.key === "ArrowLeft") advance(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = (): void => setViewportWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cardWidth = Math.max(0, viewportWidth - 2 * PEEK - 2 * GAP);
  const step = cardWidth + GAP;
  const leadingInset = PEEK + GAP;
  const trackTranslate = -(activeIndex * step) + dragOffset;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    dragStartXRef.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragStartXRef.current === null) return;
    setDragOffset(e.clientX - dragStartXRef.current);
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragStartXRef.current === null) return;
    const delta = e.clientX - dragStartXRef.current;
    dragStartXRef.current = null;
    setDragOffset(0);
    setDragging(false);
    const threshold = Math.min(50, cardWidth * 0.25);
    if (delta <= -threshold) advance(1);
    else if (delta >= threshold) advance(-1);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const active = TESTIMONIALS[activeIndex];
  if (!active) return null;

  return (
    <section
      aria-labelledby={headingId}
      className="relative border-b border-border p-6 sm:p-10 lg:p-14"
    >
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-8">
        <div className="max-w-3xl">
          <div className="min-h-16">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={active.id}
                id={headingId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={SWAP_TRANSITION}
                className="text-3xl font-medium leading-[1.05] tracking-tighter text-foreground sm:text-4xl lg:text-[3.5rem]"
              >
                {active.title}
              </motion.h2>
            </AnimatePresence>
          </div>
          <div className="mt-6 min-h-16 max-w-xl">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={active.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ ...SWAP_TRANSITION, delay: 0.05 }}
                className="text-sm leading-relaxed text-muted-foreground sm:text-base"
              >
                {active.subtitle}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="mt-10">
            <a
              href="#templates"
              className="focus-ring inline-flex items-center gap-2 rounded-full border border-border px-5 py-3.5 font-mono text-xs font-medium uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-muted"
            >
              See the templates
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <div className="hidden sm:block">
          <CarouselControls
            count={TESTIMONIALS.length}
            activeIndex={activeIndex}
            onAdvance={advance}
            onSelect={setActiveIndex}
          />
        </div>
      </div>

      <div className="mt-12 sm:hidden">
        <div
          ref={viewportRef}
          className="-mx-6 overflow-hidden py-2"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          style={{ touchAction: "pan-y" }}
        >
          <motion.div
            className="flex items-stretch"
            style={{
              gap: `${GAP}px`,
              paddingLeft: `${leadingInset}px`,
              paddingRight: `${leadingInset}px`,
            }}
            animate={{ x: trackTranslate }}
            transition={dragging ? { duration: 0 } : TRACK_TRANSITION}
          >
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.id}
                className="shrink-0"
                style={{ width: `${cardWidth}px` }}
              >
                {i === activeIndex ? (
                  <TestimonialCard testimonial={t} active />
                ) : (
                  <TestimonialCard
                    testimonial={t}
                    active={false}
                    onClick={() => setActiveIndex(i)}
                  />
                )}
              </div>
            ))}
          </motion.div>
        </div>

        <div className="mt-8 flex justify-center">
          <CarouselControls
            count={TESTIMONIALS.length}
            activeIndex={activeIndex}
            onAdvance={advance}
            onSelect={setActiveIndex}
          />
        </div>
      </div>

      <div className="mt-14 hidden sm:block lg:mt-20">
        <div className="grid grid-cols-3 gap-4 lg:gap-6">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard
              key={t.id}
              testimonial={t}
              active={i === activeIndex}
              onClick={() => setActiveIndex(i)}
            />
          ))}
        </div>
      </div>
      <SectionCorners />
    </section>
  );
}

function CarouselControls({
  count,
  activeIndex,
  onAdvance,
  onSelect,
}: {
  count: number;
  activeIndex: number;
  onAdvance: (dir: 1 | -1) => void;
  onSelect: (i: number) => void;
}): ReactNode {
  return (
    <div className="flex items-center gap-2 sm:self-start">
      <button
        type="button"
        onClick={() => onAdvance(-1)}
        aria-label="Previous testimonial"
        className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground transition-opacity hover:opacity-80"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div
        role="tablist"
        aria-label="Testimonial progress"
        className="flex h-8 items-center gap-2 rounded-full bg-muted px-4"
      >
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-label={`Go to testimonial ${i + 1}`}
            onClick={() => onSelect(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === activeIndex
                ? "w-6 bg-foreground"
                : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70"
            }`}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => onAdvance(1)}
        aria-label="Next testimonial"
        className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground transition-opacity hover:opacity-80"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function TestimonialCard({
  testimonial,
  active,
  onClick,
}: {
  testimonial: Testimonial;
  active: boolean;
  onClick?: () => void;
}): ReactNode {
  const { name, role, topic, avatar } = testimonial;

  const Component = onClick ? motion.button : motion.div;
  const interactive = Boolean(onClick);

  return (
    <Component
      type={interactive ? "button" : undefined}
      onClick={onClick}
      animate={{
        opacity: active ? 1 : 0.6,
      }}
      transition={SWAP_TRANSITION}
      className={`focus-ring relative flex min-h-50 w-full flex-col justify-between rounded-2xl p-6 text-left ring-1 transition-colors duration-300 sm:p-7 ${
        active
          ? "bg-card ring-border"
          : "bg-muted ring-transparent hover:bg-muted/70"
      } ${interactive ? "cursor-pointer" : "cursor-default"}`}
      aria-pressed={interactive ? active : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {name}
          </p>
          <p className="mt-1 max-w-[20ch] text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {role}
          </p>
        </div>
        <div
          className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 sm:h-14 sm:w-14 ${
            active ? "ring-foreground/30" : "ring-border"
          }`}
        >
          <img
            src={avatar}
            alt=""
            fill
            sizes="56px"
            className="object-cover grayscale"
            unoptimized
          />
        </div>
      </div>

      <p className="mt-10 text-xs font-medium tracking-wide text-muted-foreground sm:text-sm">
        {topic}
      </p>
    </Component>
  );
}

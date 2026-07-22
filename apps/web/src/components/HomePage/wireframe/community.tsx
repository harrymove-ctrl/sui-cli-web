
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SectionCorners } from "./section-corners";
import { DitherShader } from "./dither-shader";

type CommunityEntry = { builder: string; project: string };

const COMMUNITY_TOP: ReadonlyArray<CommunityEntry> = [
  { builder: "Mira Halden", project: "Portfolio" },
  { builder: "Jules Okafor", project: "Agency site" },
  { builder: "Sora Linde", project: "Product launch" },
  { builder: "Ravi Mahar", project: "Studio index" },
  { builder: "Emi Tanaka", project: "Newsletter" },
  { builder: "Otto Vester", project: "Conference site" },
  { builder: "Petra Soros", project: "Photo journal" },
];

const COMMUNITY_BOTTOM: ReadonlyArray<CommunityEntry> = [
  { builder: "Lior Mendel", project: "Coffee shop" },
  { builder: "Anya Petrova", project: "Music label" },
  { builder: "Kai Westwood", project: "Restaurant" },
  { builder: "Noor Saleh", project: "Gallery" },
  { builder: "Tomás Ribeiro", project: "Skate brand" },
  { builder: "Ines Caron", project: "Architecture" },
  { builder: "Yuki Sato", project: "Type foundry" },
];

export function Community(): ReactNode {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackTopRef = useRef<HTMLDivElement>(null);
  const trackBottomRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const overflowTop = useMotionValue(0);
  const overflowBottom = useMotionValue(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stageEl = stageRef.current;
    const topEl = trackTopRef.current;
    const bottomEl = trackBottomRef.current;
    if (!stageEl || !topEl || !bottomEl) return;

    const measure = () => {
      const stageWidth = stageEl.clientWidth;
      overflowTop.set(Math.max(0, topEl.scrollWidth - stageWidth));
      overflowBottom.set(Math.max(0, bottomEl.scrollWidth - stageWidth));
      setReady(true);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stageEl);
    ro.observe(topEl);
    ro.observe(bottomEl);
    return () => ro.disconnect();
  }, [overflowTop, overflowBottom]);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 26,
    mass: 0.6,
    restDelta: 0.0005,
  });

  const xTop = useTransform([progress, overflowTop], (values) => {
    const [p, o] = values as [number, number];
    const clamped = Math.min(Math.max(p / 0.92, 0), 1);
    return -o * clamped;
  });

  const xBottom = useTransform([progress, overflowBottom], (values) => {
    const [p, o] = values as [number, number];
    const clamped = Math.min(Math.max(p / 0.92, 0), 1);
    return -o * (1 - clamped);
  });

  const backdropOpacity = useTransform(progress, [0, 0.85, 1], [0.22, 0.22, 0]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="community-heading"
      className="relative border-b border-border"
    >
      <div className="relative h-[180vh]">
        <div
          aria-hidden="true"
          className="pointer-events-none sticky top-16 h-[calc(100vh-4rem)] w-full sm:top-20 sm:h-[calc(100vh-5rem)]"
        >
          <Backdrop opacity={backdropOpacity} />
        </div>

        <div className="sticky top-16 z-10 -mt-[calc(100vh-4rem)] flex w-full flex-col gap-6 overflow-hidden py-6 sm:top-20 sm:-mt-[calc(100vh-5rem)] sm:gap-8 sm:py-10">
          <div className="relative z-10 flex flex-col gap-4 px-6 sm:flex-row sm:items-end sm:justify-between sm:gap-10 sm:px-10 lg:px-14">
            <div className="max-w-2xl">
              <h2
                id="community-heading"
                className="text-2xl font-medium leading-[1.05] tracking-tighter text-foreground sm:text-3xl lg:text-[2.5rem]"
              >
                From our community, built with Sui CLI Web
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
                A small wall of work shipped on top of the template.
                Different fields, different aesthetics, same starting
                point.
              </p>
            </div>
          </div>

          <div
            ref={stageRef}
            className="relative z-10 flex flex-col gap-4 overflow-hidden sm:gap-6"
          >
            {reduce ? (
              <>
                <ReducedRow entries={COMMUNITY_TOP} />
                <ReducedRow entries={COMMUNITY_BOTTOM} />
              </>
            ) : (
              <>
                <Row
                  ref={trackTopRef}
                  entries={COMMUNITY_TOP}
                  x={xTop}
                  ready={ready}
                />
                <Row
                  ref={trackBottomRef}
                  entries={COMMUNITY_BOTTOM}
                  x={xBottom}
                  ready={ready}
                />
              </>
            )}
          </div>
        </div>
      </div>
      <SectionCorners />
    </section>
  );
}

function Backdrop({
  opacity,
}: {
  opacity: MotionValue<number>;
}): ReactNode {
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[55vh]"
      style={{
        opacity,
        WebkitMaskImage:
          "linear-gradient(to top, black 0%, black 25%, transparent 100%)",
        maskImage:
          "linear-gradient(to top, black 0%, black 25%, transparent 100%)",
      }}
    >
      <DitherShader variant="hero" />
    </motion.div>
  );
}

function Row({
  ref,
  entries,
  x,
  ready,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  entries: ReadonlyArray<CommunityEntry>;
  x: MotionValue<number>;
  ready: boolean;
}): ReactNode {
  return (
    <div
      className="relative"
      style={{
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)",
        maskImage:
          "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)",
      }}
    >
      <motion.div
        ref={ref}
        className="flex shrink-0 gap-6 px-6 sm:gap-8 sm:px-10 lg:px-14"
        style={{ x, opacity: ready ? 1 : 0 }}
      >
        {entries.map((entry) => (
          <CommunityCard key={entry.builder} entry={entry} />
        ))}
      </motion.div>
    </div>
  );
}

function ReducedRow({
  entries,
}: {
  entries: ReadonlyArray<CommunityEntry>;
}): ReactNode {
  return (
    <div className="flex w-full gap-6 overflow-x-auto px-6 sm:gap-8 sm:px-10 lg:px-14">
      {entries.map((entry) => (
        <CommunityCard key={entry.builder} entry={entry} />
      ))}
    </div>
  );
}

function CommunityCard({ entry }: { entry: CommunityEntry }): ReactNode {
  return (
    <article className="relative flex aspect-5/6 w-75 shrink-0 flex-col justify-end overflow-hidden rounded-2xl border border-border bg-background p-5 sm:w-90 sm:p-6">
      <h3 className="text-base font-medium leading-tight tracking-tight text-foreground">
        {entry.builder}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {entry.project}
      </p>
    </article>
  );
}

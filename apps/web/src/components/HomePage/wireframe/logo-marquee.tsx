
import type { ReactNode } from "react";

const glyphs: { id: string; svg: ReactNode }[] = [
  {
    id: "circle",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="7" fill="currentColor" />
        <circle cx="12" cy="12" r="3" fill="var(--muted)" />
      </svg>
    ),
  },
  {
    id: "tri",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 4 L20 19 L4 19 Z" />
      </svg>
    ),
  },
  {
    id: "sq",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" rx="2" />
      </svg>
    ),
  },
  {
    id: "hex",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3 L20 7.5 L20 16.5 L12 21 L4 16.5 L4 7.5 Z" />
      </svg>
    ),
  },
  {
    id: "rings",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
        <circle cx="15" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "bars",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="5" y="6" width="3" height="12" />
        <rect x="10.5" y="6" width="3" height="12" />
        <rect x="16" y="6" width="3" height="12" />
      </svg>
    ),
  },
  {
    id: "slash",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 19 L19 5"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M5 12 L12 5"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "dot-grid",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="8" cy="8" r="1.6" />
        <circle cx="12" cy="8" r="1.6" />
        <circle cx="16" cy="8" r="1.6" />
        <circle cx="8" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="16" cy="12" r="1.6" />
        <circle cx="8" cy="16" r="1.6" />
        <circle cx="12" cy="16" r="1.6" />
        <circle cx="16" cy="16" r="1.6" />
      </svg>
    ),
  },
];

function LogoChip({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-background text-foreground sm:h-24 sm:w-24">
      <div className="h-9 w-9 sm:h-10 sm:w-10">{children}</div>
    </div>
  );
}

// Two stacked copies of the glyph list ensure -50% translation lands on the
// start of the duplicate, making the loop seamless.
function MarqueeColumn({
  direction,
  duration,
  glyphSet,
}: {
  direction: "up" | "down";
  duration: string;
  glyphSet: typeof glyphs;
}): ReactNode {
  const animation = direction === "up" ? "marquee-up" : "marquee-down";

  const renderCopy = (key: string): ReactNode => (
    <div key={key} className="flex shrink-0 flex-col items-center gap-4">
      {glyphSet.map((g) => (
        <LogoChip key={g.id}>{g.svg}</LogoChip>
      ))}
    </div>
  );

  return (
    <div
      className="flex flex-col items-center gap-4"
      style={{ animation: `${animation} ${duration} linear infinite` }}
    >
      {renderCopy("a")}
      {renderCopy("b")}
    </div>
  );
}

export function LogoMarquee(): ReactNode {
  const colA = glyphs.filter((_, i) => i % 2 === 0);
  const colB = glyphs.filter((_, i) => i % 2 === 1);

  return (
    <div
      className="relative h-full min-h-[360px] w-full overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
      }}
    >
      <div className="absolute inset-0 mx-auto grid max-w-[220px] grid-cols-2 place-items-center gap-1 sm:max-w-[260px]">
        <MarqueeColumn direction="up" duration="22s" glyphSet={colA} />
        <MarqueeColumn direction="down" duration="26s" glyphSet={colB} />
      </div>
    </div>
  );
}

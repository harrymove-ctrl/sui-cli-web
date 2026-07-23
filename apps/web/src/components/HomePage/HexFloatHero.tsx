import { HexFloat, supportsHtmlInCanvas } from '@/components/canvasui/HexFloat';
import { CommandPaletteHero } from './CommandPaletteHero';

/**
 * The hero, rendered onto a floor of hex tiles that lean back in perspective;
 * the cursor injects a fluid that flattens them into a readable window.
 *
 * The effect needs HTML-in-Canvas (`drawElementImage` + `requestPaint`), which
 * is behind an experimental flag in Chrome and absent everywhere else. The
 * component already degrades on its own — without the API the children render
 * as ordinary DOM and the WebGL canvas becomes a translucent glint overlay —
 * but that overlay costs a second GL context and a render loop for decoration
 * nobody asked for. So we check support first and mount the plain hero when it
 * is missing, rather than paying for a fallback that only ever adds sparkle.
 *
 * `supportsHtmlInCanvas()` is called at module scope on purpose: it probes a
 * throwaway canvas, the answer cannot change within a page load, and calling it
 * during render would repeat that work on every pass.
 */
const CAN_RENDER_HTML_IN_CANVAS = supportsHtmlInCanvas();

export function HexFloatHero() {
  if (!CAN_RENDER_HTML_IN_CANVAS) {
    return <CommandPaletteHero />;
  }

  return (
    <HexFloat
      // Values from the reference configuration. The two that carry the look:
      // tilt+perspective set how hard the floor leans away, and radius sets how
      // much of the page the cursor flattens back into readability at once.
      size={160}
      gap={0}
      bevel={1.5}
      tilt={24}
      perspective={0.5}
      float={0}
      speed={1}
      shine={0.5}
      lift={0.1}
      radius={1200}
      flow={0}
      swirl={0}
      trail={0}
      // The rest of this page is monochrome by design, so the iridescent hue
      // shift is off. The reference config ships it at 1; raising it is the one
      // knob that reintroduces colour.
      iridescence={0}
      bloom={0}
      grain={0.8}
      className="min-h-screen w-full"
    >
      <CommandPaletteHero />
    </HexFloat>
  );
}

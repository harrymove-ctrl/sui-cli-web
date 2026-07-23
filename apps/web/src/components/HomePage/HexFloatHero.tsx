import { HexFloat, supportsHtmlInCanvas } from '@/components/canvasui/HexFloat';
import { CommandPaletteHero } from './CommandPaletteHero';

/**
 * The hero on a floor of hex tiles. Move the cursor and a fluid pools where it
 * goes, flattening the tiles into a readable window that heals behind you.
 *
 * How much of that you actually see depends on one experimental API.
 *
 * With HTML-in-Canvas (`drawElementImage` + `requestPaint`, currently behind
 * chrome://flags/#enable-experimental-web-platform-features) the hero itself is
 * captured and mapped onto the tiles: the page *becomes* the floor, and the
 * fluid window is what makes it readable again.
 *
 * Without it, the children render as ordinary DOM and the shader takes its
 * `uHasContent = 0` path — a translucent hex lattice with lit rims drawn over
 * the page. Still the same tiles, the same lighting and the same cursor-driven
 * fluid; it just sits on top of the content instead of carrying it. That is
 * worth shipping, so this renders unconditionally.
 */
const CAN_RENDER_HTML_IN_CANVAS = supportsHtmlInCanvas();

export function HexFloatHero() {
  return (
    <HexFloat
      size={160}
      gap={0}
      bevel={1.5}
      // tilt + perspective set how hard the floor leans away from the camera.
      tilt={24}
      perspective={0.5}
      float={0}
      speed={1}
      shine={0.5}
      lift={0.1}
      // The reading window's scale. Large on purpose: the cursor needs to clear
      // enough tiles at once for the headline underneath to stay legible.
      radius={1200}
      flow={0}
      swirl={0}
      trail={0}
      // The rest of the page is monochrome, and this is the one prop that puts
      // colour back. Raise it to 1 for the reference look.
      iridescence={0}
      bloom={0}
      grain={0.8}
      // Without the capture API the lattice is an overlay, so it is dialled
      // back — at full strength it sits on the headline rather than behind it.
      // With capture, the tiles *are* the page and want their full contrast.
      className={
        CAN_RENDER_HTML_IN_CANVAS
          ? 'min-h-screen w-full'
          : 'min-h-screen w-full [&>canvas:last-of-type]:opacity-60'
      }
    >
      <CommandPaletteHero />
    </HexFloat>
  );
}

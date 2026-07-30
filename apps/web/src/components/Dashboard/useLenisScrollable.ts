import { useEffect, useRef } from 'react';

/**
 * Ref for a scrollable container living inside the Lenis smooth-scroll page.
 *
 * Lenis intercepts wheel events globally, so a nested `overflow-auto` box can't
 * scroll on its own - which is why the dashboard cards (recent activity, tables,
 * a resized-small chart) felt "stuck". Lenis honors a `data-lenis-prevent`
 * attribute and leaves native scrolling alone on that element.
 *
 * We toggle the attribute ONLY while the element actually overflows: if it were
 * always present, wheel events over a card that fits would be swallowed and the
 * page itself would refuse to scroll while the cursor sat over that card.
 */
export function useLenisScrollable<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sync = () => {
      const overflowing = el.scrollHeight - el.clientHeight > 1;
      el.toggleAttribute('data-lenis-prevent', overflowing);
    };

    sync();
    // Re-check when the card is resized (grid drag/resize, window) or its content
    // changes (data loads in, sections expand).
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    const mo = new MutationObserver(sync);
    mo.observe(el, { childList: true, subtree: true, characterData: true });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return ref;
}

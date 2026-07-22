import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '@/lib/utils';

/** A scrollbar that stays discoverable on hover instead of macOS's hide-until-scrolled
 * default (which gives a clipped list no sign it has more below), and is styled to this
 * app's own shape system instead of sitting on top of it as the grey OS default.
 *
 * `viewportRef` forwards a ref to the actual scrolling element (Radix's Viewport, not the
 * outer Root) - needed by anything that measures/drives scroll itself, e.g. `@tanstack/
 * react-virtual`'s `getScrollElement`, which must point at the real `overflow` element. */
const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    viewportClassName?: string;
    viewportRef?: React.Ref<HTMLDivElement>;
  }
>(({ className, children, viewportClassName, viewportRef, ...props }, ref) => (
  <ScrollAreaPrimitive.Root ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
    {/* The app's global Lenis smooth-scroll (MainLayout's <SmoothScroll>) hijacks wheel
     * events everywhere by default; this opts the viewport out so native wheel scroll
     * reaches it instead of being swallowed - see lenis's own `data-lenis-prevent` check. */}
    <ScrollAreaPrimitive.Viewport
      ref={viewportRef}
      data-lenis-prevent
      className={cn('h-full w-full rounded-[inherit]', viewportClassName)}
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollBar orientation="horizontal" />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent p-[1px]',
      orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent p-[1px]',
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border hover:bg-muted-foreground/40 transition-colors" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };

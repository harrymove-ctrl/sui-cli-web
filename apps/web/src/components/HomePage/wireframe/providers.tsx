
import { SmoothScroll } from "./smooth-scroll";
import { ReducedMotionProvider } from "@/lib/wireframe_lib/motion";
import type { ReactNode } from "react";
const ThemeProvider = ({children}:any) => children;

export function Providers({ children }: { children: ReactNode }): ReactNode {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ReducedMotionProvider>
        <SmoothScroll>{children}</SmoothScroll>
      </ReducedMotionProvider>
    </ThemeProvider>
  );
}

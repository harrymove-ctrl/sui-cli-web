
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
const useTheme = () => ({ resolvedTheme: "dark", theme: "dark", setTheme: () => {} });

function useIsMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function ThemeSwitch(): ReactNode {
  const mounted = useIsMounted();
  const { setTheme, resolvedTheme } = useTheme();

  const toggleTheme = (): void => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  if (!mounted) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          className="h-10 w-10 cursor-not-allowed rounded-full bg-foreground/10 opacity-30"
          aria-label="Toggle theme"
          disabled
        />
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={toggleTheme}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-muted text-foreground opacity-30 shadow-lg transition-opacity duration-300 hover:opacity-100 hover:shadow-xl"
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        aria-pressed={isDark}
        type="button"
      >
        {isDark ? (
          <Sun className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Moon className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

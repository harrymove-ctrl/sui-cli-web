
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";

const primaryLinks = [
  { label: "Layouts", href: "#layouts" },
  { label: "System", href: "#system" },
  { label: "Docs", href: "#docs" },
];

const mobileLinks = [
  { label: "Homepage", href: "#main-content" },
  ...primaryLinks,
];

const utilityLinks = [
  { label: "License", href: "#license" },
  { label: "Security", href: "#security" },
  { label: "Privacy", href: "#privacy" },
  { label: "Terms", href: "#terms" },
];

function Logo(): ReactNode {
  return (
    <Link
      href="#main-content"
      className="focus-ring enter inline-flex items-center gap-2 rounded-sm text-foreground"
      aria-label="Sui CLI Web home"
    >
      <span
        className="h-5 w-5 shrink-0 bg-foreground"
        aria-hidden="true"
      />
      <span className="text-lg font-semibold leading-none tracking-tight">
        Frame
      </span>
    </Link>
  );
}

export function Header(): ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const closeMenu = (): void => setIsOpen(false);

  useEffect(() => {
    const handleScroll = (): void => {
      setIsScrolled(window.scrollY > 8);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("nav-open");

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.classList.remove("nav-open");
    };
  }, [isOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 z-10 h-[7px] w-[7px] -translate-x-1/2 translate-y-1/2 border border-border bg-background"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 z-10 h-[7px] w-[7px] translate-x-1/2 translate-y-1/2 border border-border bg-background"
      />

      <div className="flex h-16 items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
        <Logo />

        <nav
          className={`hidden rounded-full px-2 py-1.5 transition-[background-color] duration-300 ease-out lg:ml-12 lg:flex lg:items-center lg:gap-1 ${
            isScrolled ? "bg-transparent" : "bg-muted"
          }`}
          aria-label="Primary navigation"
        >
          {primaryLinks.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              style={{ ["--enter-delay" as string]: `${80 + i * 60}ms` }}
              className="focus-ring enter rounded-full px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:text-muted-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-4 lg:flex">
          <Link
            href="#signin"
            style={{ ["--enter-delay" as string]: "260ms" }}
            className="focus-ring enter rounded-full px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:text-muted-foreground"
          >
            Sign In
          </Link>
          <Link
            href="#start"
            style={{ ["--enter-delay" as string]: "320ms" }}
            className={`focus-ring enter rounded-full px-5 py-2.5 text-sm font-medium text-foreground transition-[background-color] duration-300 ease-out hover:text-muted-foreground ${
              isScrolled ? "bg-transparent" : "bg-muted hover:bg-border"
            }`}
          >
            Launch App
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <Link
            href="#start"
            style={{ ["--enter-delay" as string]: "120ms" }}
            className="focus-ring enter rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-border"
          >
            Launch App
          </Link>
          <button
            type="button"
            style={{ ["--enter-delay" as string]: "180ms" }}
            className="focus-ring enter inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border"
            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
            onClick={() => setIsOpen((open) => !open)}
          >
            {isOpen ? (
              <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div
        id="mobile-navigation"
        className={`fixed inset-x-0 top-16 z-40 min-h-[calc(100dvh-4rem)] border-t border-border bg-background transition-[opacity,visibility] duration-200 sm:top-20 sm:min-h-[calc(100dvh-5rem)] lg:hidden ${
          isOpen
            ? "visible opacity-100"
            : "invisible pointer-events-none opacity-0"
        }`}
      >
        <div className="min-h-[calc(100dvh-4rem)] px-4 pt-16 sm:min-h-[calc(100dvh-5rem)] sm:px-6 sm:pt-20">
          <nav aria-label="Mobile navigation">
            <ul className="space-y-2">
              {mobileLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="focus-ring block rounded-lg text-4xl font-normal leading-tight tracking-[-0.04em] text-foreground transition-colors hover:text-muted-foreground sm:text-5xl"
                    onClick={closeMenu}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-12 flex flex-col items-start gap-2 pb-10">
            <p className="text-base font-medium tracking-[-0.02em] text-muted-foreground">
              Desk
            </p>
            {utilityLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="focus-ring rounded-md text-base font-normal text-foreground transition-colors hover:text-muted-foreground"
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

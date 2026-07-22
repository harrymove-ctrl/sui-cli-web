import { motion, useReducedMotion } from 'framer-motion';
import ReactLenis from 'lenis/react';
import {
  ChevronRight,
  ExternalLink,
  Github,
  Menu,
  Moon,
  Shield,
  Sun,
  Terminal,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_VERSION } from '@/config/version';
import { useTheme } from '@/contexts/ThemeContext';
import { StructuredData } from '../SEO/StructuredData';
import { CommandPaletteHero } from './CommandPaletteHero';
import { Features4 } from './Features4';
import { TestimonialWall } from './TestimonialWall';

export function HomePage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const prefersReducedMotion = useReducedMotion();

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Reduced motion for mobile or user preference
  const shouldReduceMotion = prefersReducedMotion || isMobile;

  return (
    <ReactLenis root>
      <StructuredData type="homepage" />

      {/* No font override here: the page inherits Geist Pixel, the same face
          the rest of the app is set in. Terminal-literal strings opt back
          into Geist Mono individually. */}
      <div className="relative w-full min-h-screen">
        {/* ============ TOP NAV BAR (CTA) ============ */}
        <div className="fixed top-0 left-0 right-0 z-50 pt-3 sm:pt-4 pb-3 sm:pb-3 px-3 sm:px-4">
          <div className="max-w-5xl mx-auto">
            {/* Navbar container with glass effect */}
            <div className="flex flex-row items-center justify-between gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-3 bg-background/70 backdrop-blur-md border border-foreground/10 rounded-xl sm:rounded-2xl shadow-2xl shadow-black/50">
              {/* Left: Version badge */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-1.5 bg-foreground/10 border border-foreground/40 rounded-full text-xs">
                  <span className="w-1.5 h-1.5 bg-foreground rounded-full animate-pulse" />
                  <span className="text-foreground font-mono font-medium">v{APP_VERSION}</span>
                </div>
                {/* Stats - visible on tablet+ */}
                <div className="hidden md:flex items-center gap-3 text-xs text-foreground/60 border-l border-foreground/10 pl-3">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-foreground" />
                    <span>OSS</span>
                  </div>
                </div>
              </div>

              {/* Center/Right: Desktop CTA Buttons - hidden on mobile */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/setup')}
                  className="group px-4 py-2.5 bg-foreground hover:bg-foreground/90 active:bg-foreground/80 border border-foreground text-background font-bold rounded-lg transition-all text-sm shadow-lg shadow-background/20 min-h-[44px]"
                >
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-4 h-4" />
                    <span className="font-mono">./install.sh</span>
                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/app')}
                  className="px-4 py-2.5 bg-foreground/10 hover:bg-foreground/20 active:bg-foreground/30 text-foreground/90 hover:text-foreground font-bold rounded-lg transition-all border border-foreground/20 hover:border-foreground/40 text-sm min-h-[44px]"
                >
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    <span className="font-mono">launch --now</span>
                  </span>
                </button>

                <a
                  href="https://github.com/hien-p/raycast-sui-cli"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-foreground/10 hover:bg-foreground/20 active:bg-foreground/30 text-foreground/80 hover:text-foreground rounded-lg transition-all border border-foreground/20 hover:border-foreground/40 text-sm min-h-[44px] flex items-center gap-1.5"
                >
                  <Github className="w-4 h-4" />
                  <span>GitHub</span>
                </a>

                <a
                  href="/changelog"
                  className="px-4 py-2.5 bg-foreground/10 hover:bg-foreground/20 active:bg-foreground/30 text-foreground/80 hover:text-foreground rounded-lg transition-all border border-foreground/20 hover:border-foreground/40 text-sm min-h-[44px] flex items-center gap-1.5"
                >
                  <Zap className="w-4 h-4 text-foreground" />
                  <span>Changelog</span>
                </a>

                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="px-3 py-2.5 bg-foreground/10 hover:bg-foreground/20 text-foreground/80 hover:text-foreground rounded-lg transition-all border border-foreground/20 hover:border-foreground/40 min-h-[44px] flex items-center"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              </div>

              {/* Right: Mobile menu button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-3 hover:bg-foreground/10 active:bg-foreground/20 rounded-lg transition-all text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

            {/* Mobile Menu Dropdown */}
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="md:hidden mt-2 p-3 bg-background/90 backdrop-blur-md border border-foreground/10 rounded-xl shadow-2xl"
              >
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/setup');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-3.5 bg-foreground hover:bg-foreground/90 active:bg-foreground/80 border border-foreground text-background font-bold rounded-lg transition-all min-h-[44px]"
                  >
                    <span className="flex items-center gap-2">
                      <Terminal className="w-5 h-5" />
                      <span>Install CLI</span>
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigate('/app');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-3.5 bg-foreground/10 hover:bg-foreground/20 active:bg-foreground/30 text-foreground font-bold rounded-lg transition-all border border-foreground/20 min-h-[44px]"
                  >
                    <span className="flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      <span>Launch App</span>
                    </span>
                  </button>

                  <a
                    href="https://github.com/hien-p/raycast-sui-cli"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-left px-4 py-3.5 bg-foreground/10 hover:bg-foreground/20 active:bg-foreground/30 text-foreground rounded-lg transition-all border border-foreground/20 min-h-[44px] flex items-center gap-2"
                  >
                    <Github className="w-5 h-5" />
                    <span>View on GitHub</span>
                    <ExternalLink className="w-4 h-4 ml-auto" />
                  </a>

                  {/* Changelog - Mobile */}
                  <a
                    href="/changelog"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-left px-4 py-3.5 bg-foreground/10 hover:bg-foreground/20 text-foreground rounded-lg transition-all border border-foreground/20 min-h-[44px] flex items-center gap-2"
                  >
                    <Zap className="w-5 h-5 text-foreground" />
                    <span>Changelog</span>
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </a>

                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="w-full text-left px-4 py-3.5 bg-foreground/10 hover:bg-foreground/20 text-foreground rounded-lg transition-all border border-foreground/20 min-h-[44px] flex items-center gap-2"
                  >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                  </button>

                  {/* Mobile Stats */}
                  <div className="flex items-center justify-around pt-2 mt-2 border-t border-foreground/10 text-xs text-foreground/60">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-foreground" />
                      <span>Open Source</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* ============ COMMAND-PALETTE HERO ============ */}
        <CommandPaletteHero />

        {/* ============ FEATURES (Auto-cycling tabbed) ============ */}
        <Features4 />

        {/* ============ TESTIMONIAL WALL (hover to highlight) ============ */}
        <TestimonialWall />

        {/* ============ FINAL CTA ============ */}
        <section className="relative z-20 py-16 sm:py-20 md:py-24 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: shouldReduceMotion ? 0.3 : 0.5 }}
              className="space-y-6 sm:space-y-8"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal text-foreground px-4">
                <span className="text-foreground">$</span> ready?
              </h2>

              <button
                type="button"
                onClick={() => navigate('/setup')}
                className="group w-full sm:w-auto px-6 sm:px-10 py-4 sm:py-5 bg-foreground hover:bg-foreground/90 active:bg-foreground/80 text-background font-bold rounded-lg transition-all text-base sm:text-lg shadow-lg shadow-background/20 min-h-[56px]"
              >
                <span className="flex items-center justify-center gap-2 sm:gap-3">
                  <Terminal className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                  <span className="truncate font-mono text-sm sm:text-base">
                    npm i sui-cli-web-server
                  </span>
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>

              <p className="text-foreground/30 text-xs sm:text-sm px-4">
                works on macOS, Linux, Windows
              </p>
            </motion.div>
          </div>
        </section>

        {/* ============ FOOTER ============ */}
        <footer className="relative z-20 py-8 sm:py-12 px-4 border-t border-foreground/5">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 text-xs sm:text-sm text-foreground/40">
              <div className="flex items-center gap-2 text-center">
                <span className="text-foreground font-mono font-medium">v{APP_VERSION}</span>
                <span className="hidden sm:inline">•</span>
                <span>MIT License</span>
              </div>
              <div className="flex items-center gap-4 sm:gap-6">
                <a
                  href="https://github.com/hien-p/raycast-sui-cli"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground active:text-foreground transition-colors py-2 px-3 sm:p-0 min-h-[44px] sm:min-h-0 flex items-center"
                >
                  GitHub
                </a>
                <a
                  href="https://www.npmjs.com/package/sui-cli-web-server"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground active:text-foreground transition-colors py-2 px-3 sm:p-0 min-h-[44px] sm:min-h-0 flex items-center"
                >
                  NPM
                </a>
              </div>
            </div>

            {/* Copyright */}
            <div className="text-center mt-6 text-xs text-foreground/30">
              <p>Built with React, TypeScript, and Sui SDK</p>
            </div>
          </div>
        </footer>
      </div>
    </ReactLenis>
  );
}

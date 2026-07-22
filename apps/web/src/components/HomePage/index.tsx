import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import ReactLenis from 'lenis/react';
import { StructuredData } from '../SEO/StructuredData';
import { Features4 } from './Features4';
import { CommandPaletteHero } from './CommandPaletteHero';
import { TestimonialWall } from './TestimonialWall';
import {
  Terminal,
  Zap,
  Shield,
  Github,
  ChevronRight,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import { APP_VERSION } from '@/config/version';

export function HomePage() {
  const navigate = useNavigate();
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

      <div className="relative w-full min-h-screen font-mono">
        {/* ============ TOP NAV BAR (CTA) ============ */}
        <div className="fixed top-0 left-0 right-0 z-50 pt-3 sm:pt-4 pb-3 sm:pb-3 px-3 sm:px-4">
          <div className="max-w-5xl mx-auto">
            {/* Navbar container with glass effect */}
            <div className="flex flex-row items-center justify-between gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-3 bg-black/70 backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl shadow-black/50">
              {/* Left: Version badge */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-1.5 bg-rose-500/10 border border-rose-500/40 rounded-full text-xs">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                  <span className="text-rose-400 font-medium">v{APP_VERSION}</span>
                </div>
                {/* Stats - visible on tablet+ */}
                <div className="hidden md:flex items-center gap-3 text-xs text-white/60 border-l border-white/10 pl-3">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-green-400" />
                    <span>OSS</span>
                  </div>
                </div>
              </div>

              {/* Center/Right: Desktop CTA Buttons - hidden on mobile */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => navigate('/setup')}
                  className="group px-4 py-2.5 bg-rose-500/30 hover:bg-rose-500/50 active:bg-rose-500/60 border border-rose-500/60 hover:border-rose-500 text-rose-300 hover:text-white font-bold rounded-lg transition-all text-sm shadow-lg shadow-rose-500/20 min-h-[44px]"
                >
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-4 h-4" />
                    <span>./install.sh</span>
                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>

                <button
                  onClick={() => navigate('/app')}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/90 hover:text-white font-bold rounded-lg transition-all border border-white/20 hover:border-white/40 text-sm min-h-[44px]"
                >
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    <span>launch --now</span>
                  </span>
                </button>

                <a
                  href="https://github.com/hien-p/raycast-sui-cli"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/80 hover:text-white rounded-lg transition-all border border-white/20 hover:border-white/40 text-sm min-h-[44px] flex items-center gap-1.5"
                >
                  <Github className="w-4 h-4" />
                  <span>GitHub</span>
                </a>

                <a
                  href="/changelog"
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/80 hover:text-white rounded-lg transition-all border border-white/20 hover:border-white/40 text-sm min-h-[44px] flex items-center gap-1.5"
                >
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span>Changelog</span>
                </a>

                {/* Blog - Enhanced with shimmer effect */}
                <a
                  href="/blog"
                  className="group relative px-4 py-2.5 rounded-lg text-sm min-h-[44px] flex items-center gap-2 overflow-hidden"
                >
                  {/* Animated gradient border */}
                  <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-500 opacity-70 group-hover:opacity-100 transition-opacity" />
                  <span className="absolute inset-[1px] rounded-[7px] bg-black/90 group-hover:bg-black/80 transition-colors" />

                  {/* Shimmer effect */}
                  <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />

                  {/* Content */}
                  <span className="relative flex items-center gap-2 text-cyan-300 group-hover:text-cyan-200 font-medium transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                    <span>Read Blog</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </a>
              </div>

              {/* Right: Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-3 hover:bg-white/10 active:bg-white/20 rounded-lg transition-all text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                className="md:hidden mt-2 p-3 bg-black/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl"
              >
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      navigate('/setup');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-3.5 bg-rose-500/30 hover:bg-rose-500/50 active:bg-rose-500/60 border border-rose-500/60 text-rose-300 font-bold rounded-lg transition-all min-h-[44px]"
                  >
                    <span className="flex items-center gap-2">
                      <Terminal className="w-5 h-5" />
                      <span>Install CLI</span>
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      navigate('/app');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-3.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-bold rounded-lg transition-all border border-white/20 min-h-[44px]"
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
                    className="w-full text-left px-4 py-3.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-lg transition-all border border-white/20 min-h-[44px] flex items-center gap-2"
                  >
                    <Github className="w-5 h-5" />
                    <span>View on GitHub</span>
                    <ExternalLink className="w-4 h-4 ml-auto" />
                  </a>

                  {/* Changelog - Mobile */}
                  <a
                    href="/changelog"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-left px-4 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all border border-white/20 min-h-[44px] flex items-center gap-2"
                  >
                    <Zap className="w-5 h-5 text-cyan-400" />
                    <span>Changelog</span>
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </a>

                  {/* Blog - Mobile */}
                  <a
                    href="/blog"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-left px-4 py-3.5 bg-gradient-to-r from-cyan-500/20 to-teal-500/20 hover:from-cyan-500/30 hover:to-teal-500/30 text-cyan-300 rounded-lg transition-all border border-cyan-500/30 min-h-[44px] flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                    <span>Read Blog</span>
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </a>

                  {/* Mobile Stats */}
                  <div className="flex items-center justify-around pt-2 mt-2 border-t border-white/10 text-xs text-white/60">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-green-400" />
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
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white px-4">
                <span className="text-rose-500">$</span> ready?
              </h2>

              <button
                onClick={() => navigate('/setup')}
                className="group w-full sm:w-auto px-6 sm:px-10 py-4 sm:py-5 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-bold rounded-lg transition-all text-base sm:text-lg shadow-lg shadow-rose-500/20 min-h-[56px]"
              >
                <span className="flex items-center justify-center gap-2 sm:gap-3">
                  <Terminal className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                  <span className="truncate text-sm sm:text-base">npm i sui-cli-web-server</span>
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>

              <p className="text-white/30 text-xs sm:text-sm px-4">
                works on macOS, Linux, Windows
              </p>
            </motion.div>
          </div>
        </section>

        {/* ============ FOOTER ============ */}
        <footer className="relative z-20 py-8 sm:py-12 px-4 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 text-xs sm:text-sm text-white/40">
              <div className="flex items-center gap-2 text-center">
                <span className="text-rose-400 font-medium">v{APP_VERSION}</span>
                <span className="hidden sm:inline">•</span>
                <span>MIT License</span>
              </div>
              <div className="flex items-center gap-4 sm:gap-6">
                <a
                  href="https://github.com/hien-p/raycast-sui-cli"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-rose-400 active:text-rose-500 transition-colors py-2 px-3 sm:p-0 min-h-[44px] sm:min-h-0 flex items-center"
                >
                  GitHub
                </a>
                <a
                  href="https://www.npmjs.com/package/sui-cli-web-server"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-rose-400 active:text-rose-500 transition-colors py-2 px-3 sm:p-0 min-h-[44px] sm:min-h-0 flex items-center"
                >
                  NPM
                </a>
              </div>
            </div>

            {/* Copyright */}
            <div className="text-center mt-6 text-xs text-white/30">
              <p>Built with React, TypeScript, and Sui SDK</p>
            </div>
          </div>
        </footer>
      </div>
    </ReactLenis>
  );
}

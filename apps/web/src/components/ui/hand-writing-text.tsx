"use client";

import { motion, type Variants } from "framer-motion";

interface HandWrittenTitleProps {
    title?: string;
    subtitle?: string;
    subtitleLink?: string;
}

function HandWrittenTitle({
    title = "Build for First Movers in Sui",
    subtitle = "@harry_phan06",
    subtitleLink = "https://x.com/harry_phan06",
}: HandWrittenTitleProps) {
    const draw: Variants = {
        hidden: { pathLength: 0, opacity: 0 },
        visible: {
            pathLength: 1,
            opacity: 1,
            transition: {
                pathLength: { duration: 2.5, ease: [0.43, 0.13, 0.23, 0.96] },
                opacity: { duration: 0.5 },
            },
        },
    };

    return (
        <div className="relative w-full max-w-3xl mx-auto pointer-events-auto">
            <div className="absolute inset-0 pointer-events-none z-0">
                <motion.svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 800 300"
                    initial="hidden"
                    animate="visible"
                    className="w-full h-full"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <title>Hand Written Animation</title>
                    <motion.path
                        d="M 650 50
                           C 850 150, 750 250, 400 270
                           C 100 270, 50 220, 50 150
                           C 50 70, 200 30, 400 30
                           C 600 30, 650 90, 650 90"
                        fill="none"
                        strokeWidth="4"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        variants={draw}
                        className="text-rose-500/40"
                    />
                </motion.svg>
            </div>
            <div className="relative text-center z-10 flex flex-col items-center justify-center py-12 sm:py-16 pointer-events-auto">
                <motion.h1
                    className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black font-mono tracking-tight bg-gradient-to-r from-rose-400 via-pink-400 to-rose-500 bg-clip-text text-transparent"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                >
                    {title}
                </motion.h1>
                {subtitle && (
                    <motion.div
                        className="mt-6 relative z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 0.8 }}
                    >
                        {subtitleLink ? (
                            <a
                                href={subtitleLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-rose-500/40 border-2 border-white/40 hover:border-rose-400 rounded-full text-white hover:text-white transition-all font-mono text-base sm:text-lg font-semibold cursor-pointer shadow-lg hover:shadow-rose-500/30"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                </svg>
                                {subtitle}
                            </a>
                        ) : (
                            <span className="text-white font-mono text-base sm:text-lg font-semibold">{subtitle}</span>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}

export { HandWrittenTitle };

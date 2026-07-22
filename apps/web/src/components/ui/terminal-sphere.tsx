import { useRef, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';

export const TerminalSphere = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Generate random hex/code strings
    const items = Array.from({ length: 40 }).map((_, i) => {
        const chars = '0123456789ABCDEF';
        let str = '0x';
        for (let j = 0; j < 4; j++) str += chars[Math.floor(Math.random() * chars.length)];
        return { id: i, text: str };
    });

    return (
        <div className="relative w-64 h-64 perspective-1000 pointer-events-none select-none opacity-40">
            <motion.div
                className="relative w-full h-full preserve-3d"
                animate={{ rotateY: 360, rotateX: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                style={{ transformStyle: "preserve-3d" }}
            >
                {items.map((item, i) => {
                    const phi = Math.acos(-1 + (2 * i) / items.length);
                    const theta = Math.sqrt(items.length * Math.PI) * phi;
                    const x = 120 * Math.cos(theta) * Math.sin(phi);
                    const y = 120 * Math.sin(theta) * Math.sin(phi);
                    const z = 120 * Math.cos(phi);

                    return (
                        <div
                            key={item.id}
                            className="absolute left-1/2 top-1/2 text-xs font-mono text-[#4da2ff]"
                            style={{
                                transform: `translate3d(${x}px, ${y}px, ${z}px) rotateY(${theta}rad) rotateX(${phi}rad)`,
                                backfaceVisibility: "visible" // Show text from back too for density
                            }}
                        >
                            {item.text}
                        </div>
                    );
                })}
            </motion.div>
        </div>
    );
};

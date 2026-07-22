import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface SquaresProps {
    direction?: 'diagonal' | 'up' | 'down' | 'right' | 'left';
    speed?: number;
    borderColor?: string;
    squareColor?: string;
    hoverFillColor?: string;
    className?: string;
}

export function Squares({
    // direction, speed are placeholders for future animation enhancements
    // direction = 'right',
    // speed = 1,
    borderColor = '#333',
    squareColor = 'transparent',
    hoverFillColor = '#222',
    className,
}: SquaresProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
    const squareSize = 40;

    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setGridSize({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight,
                });
            }
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const cols = Math.ceil(gridSize.width / squareSize);
    const rows = Math.ceil(gridSize.height / squareSize);
    const numSquares = cols * rows;

    return (
        <div
            ref={containerRef}
            className={`absolute inset-0 overflow-hidden ${className}`}
            style={{ background: squareColor }}
        >
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, ${squareSize}px)`,
                    gridTemplateRows: `repeat(${rows}, ${squareSize}px)`,
                }}
            >
                {Array.from({ length: numSquares }).map((_, i) => (
                    <motion.div
                        key={i}
                        whileHover={{ backgroundColor: hoverFillColor }}
                        transition={{ duration: 0.2 }}
                        style={{
                            width: squareSize,
                            height: squareSize,
                            borderRight: `1px solid ${borderColor}`,
                            borderBottom: `1px solid ${borderColor}`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

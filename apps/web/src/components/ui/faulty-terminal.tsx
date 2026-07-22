import { useRef, useState, useEffect } from "react";

export const FaultyTerminal = () => {
    const [text, setText] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&*";
        const generateLine = () => {
            const length = Math.floor(Math.random() * 50) + 10;
            let line = "";
            for (let i = 0; i < length; i++) {
                line += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return line;
        };

        const interval = setInterval(() => {
            setText((prev) => {
                const newLines = [...prev, generateLine()];
                if (newLines.length > 20) newLines.shift();
                return newLines;
            });
        }, 100);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden bg-black font-mono text-xs opacity-20 pointer-events-none select-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black" />
            <div className="p-4 text-[#4da2ff]/30" style={{ textShadow: "0 0 5px rgba(77, 162, 255, 0.5)" }}>
                {text.map((line, i) => (
                    <div key={i} className="whitespace-nowrap overflow-hidden">
                        {line}
                    </div>
                ))}
            </div>
            {/* Scanline effect */}
            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,_rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] pointer-events-none" />
            <div className="absolute inset-0 animate-scanline bg-gradient-to-b from-transparent via-[#4da2ff]/5 to-transparent h-[100px] w-full pointer-events-none" />
        </div>
    );
};

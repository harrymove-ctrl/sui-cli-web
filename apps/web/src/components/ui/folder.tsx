import { motion } from "framer-motion";

interface FolderProps {
    color?: string;
    label?: string;
    isOpen?: boolean;
}

export const Folder = ({ color = "#4da2ff", label = "Config", isOpen = false }: FolderProps) => {
    return (
        <div className="relative w-16 h-14 group cursor-pointer">
            {/* Back plate */}
            <motion.div
                className="absolute inset-0 rounded-lg bg-white/10 border border-white/5"
                style={{ backgroundColor: color, opacity: 0.2 }}
            />
            {/* Tab */}
            <div
                className="absolute top-[-6px] left-0 w-6 h-4 rounded-t-md bg-white/10 border-t border-l border-r border-white/5"
                style={{ backgroundColor: color, opacity: 0.2 }}
            />
            {/* Front plate (animated) */}
            <motion.div
                className="absolute inset-0 rounded-lg border-t border-white/20 shadow-inner origin-bottom"
                style={{ backgroundColor: color }}
                animate={{ rotateX: isOpen ? -20 : 0, scaleY: isOpen ? 0.9 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-lg" />
                {label && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-mono text-white/80 uppercase tracking-wider">
                        {label}
                    </div>
                )}
            </motion.div>
            {/* Paper insert */}
            <motion.div
                className="absolute left-2 right-2 top-2 bottom-2 bg-white rounded-sm shadow-sm z-[-1]"
                animate={{ y: isOpen ? -10 : 0 }}
            />
        </div>
    );
};

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SwapCardProps {
    activeId: string;
    children: React.ReactNode;
}

export const SwapCard = ({ activeId, children }: SwapCardProps) => {
    return (
        <div className="relative w-full perspective-1000">
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeId}
                    initial={{ opacity: 0, rotateX: -10, y: 20 }}
                    animate={{ opacity: 1, rotateX: 0, y: 0 }}
                    exit={{ opacity: 0, rotateX: 10, y: -20 }}
                    transition={{ duration: 0.4, ease: "backOut" }}
                    className="w-full"
                >
                    {children}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

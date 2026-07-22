import React, { useState } from "react";
import { motion } from "framer-motion";

interface BubbleMenuProps {
    items: { id: string; label: string; icon?: React.ReactNode }[];
    activeId: string;
    onSelect: (id: string) => void;
}

export const BubbleMenu = ({ items, activeId, onSelect }: BubbleMenuProps) => {
    return (
        <div className="flex justify-center items-center gap-4 py-8">
            {items.map((item) => {
                const isActive = activeId === item.id;
                return (
                    <motion.button
                        key={item.id}
                        onClick={() => onSelect(item.id)}
                        layout
                        initial={false}
                        animate={{
                            backgroundColor: isActive ? "#4da2ff" : "rgba(255, 255, 255, 0.05)",
                            color: isActive ? "#fff" : "rgba(255, 255, 255, 0.6)",
                            scale: isActive ? 1.1 : 1,
                            borderRadius: "24px",
                        }}
                        whileHover={{ scale: isActive ? 1.1 : 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="relative px-6 py-3 text-sm font-medium backdrop-blur-md border border-white/10 shadow-lg overflow-hidden"
                    >
                        <div className="relative z-10 flex items-center gap-2">
                            {item.icon}
                            <span>{item.label}</span>
                        </div>
                        {isActive && (
                            <motion.div
                                layoutId="bubble-glow"
                                className="absolute inset-0 bg-white/20 blur-md"
                                transition={{ duration: 0.3 }}
                            />
                        )}
                    </motion.button>
                );
            })}
        </div>
    );
};

import { motion } from "framer-motion";

interface AnimatedListProps {
  children: React.ReactNode;
  delay?: number;
}

export const AnimatedList = ({ children, delay = 0 }: AnimatedListProps) => {
  return (
    <div className="space-y-4">
      {React.Children.map(children, (child, i) => (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + i * 0.1, duration: 0.3 }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
};

import React from "react";

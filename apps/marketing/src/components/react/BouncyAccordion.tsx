'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface AccordionItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  link?: string;
  linkText?: string;
}

interface BouncyAccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
}

/**
 * Bouncy accordion with glassmorphism styling and spring transitions.
 * Perfect for CTAs directing users to the app.
 */
export function BouncyAccordion({ items, allowMultiple = false }: BouncyAccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setOpenIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        if (!allowMultiple) {
          newSet.clear();
        }
        newSet.add(id);
      }
      return newSet;
    });
  };

  const isOpen = (id: string) => openIds.has(id);

  return (
    <div className="space-y-3 not-prose">
      {items.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, type: 'spring', stiffness: 200, damping: 20 }}
          className="rounded-xl overflow-hidden"
        >
          {/* Accordion Header */}
          <motion.button
            onClick={() => toggleItem(item.id)}
            className={`
              w-full flex items-center gap-3 p-4
              glass transition-all duration-200
              ${isOpen(item.id)
                ? 'rounded-t-xl border-b-0'
                : 'rounded-xl hover:bg-white/10'
              }
            `}
            whileHover={{ scale: 1.005 }}
            whileTap={{ scale: 0.995 }}
          >
            {/* Glassmorphism Icon Container */}
            <motion.div
              className="w-10 h-10 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center text-lg"
              animate={{
                scale: isOpen(item.id) ? 1.1 : 1,
                rotate: isOpen(item.id) ? 5 : 0,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              {item.icon}
            </motion.div>

            {/* Title */}
            <span className="flex-1 text-left font-medium text-text-primary">
              {item.title}
            </span>

            {/* Chevron */}
            <motion.svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              animate={{ rotate: isOpen(item.id) ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="text-text-muted"
            >
              <path
                d="M5 7.5L10 12.5L15 7.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          </motion.button>

          {/* Accordion Content */}
          <AnimatePresence initial={false}>
            {isOpen(item.id) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{
                  height: 'auto',
                  opacity: 1,
                  transition: {
                    height: {
                      type: 'spring',
                      stiffness: 300,
                      damping: 30,
                    },
                    opacity: { duration: 0.2, delay: 0.1 },
                  },
                }}
                exit={{
                  height: 0,
                  opacity: 0,
                  transition: {
                    height: {
                      type: 'spring',
                      stiffness: 300,
                      damping: 30,
                    },
                    opacity: { duration: 0.15 },
                  },
                }}
                className="overflow-hidden"
              >
                <div className="p-4 pt-0 glass border-t-0 rounded-b-xl">
                  <p className="text-text-secondary text-sm mb-4 leading-relaxed">
                    {item.description}
                  </p>

                  {item.link && (
                    <motion.a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#4da2ff]/20 rounded-lg text-sm font-mono hover:bg-[#4da2ff]/30 transition-colors border border-[#4da2ff]/30"
                      style={{ color: '#4da2ff' }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {item.linkText || 'Open in App'}
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        className="transition-transform group-hover:translate-x-1"
                      >
                        <path
                          d="M3 11L11 3M11 3H5M11 3V9"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </motion.a>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Single accordion item for inline use in MDX.
 */
export function AccordionCTA({
  icon,
  title,
  description,
  link,
  linkText = 'Try it now',
}: Omit<AccordionItem, 'id'>) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="my-6 rounded-xl overflow-hidden not-prose">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center gap-3 p-4
          glass transition-all duration-200
          ${isOpen ? 'rounded-t-xl' : 'rounded-xl hover:bg-white/10'}
        `}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
      >
        <div className="w-10 h-10 rounded-lg bg-[#4da2ff]/20 border border-[#4da2ff]/30 flex items-center justify-center text-lg">
          {icon}
        </div>
        <span className="flex-1 text-left font-medium text-text-primary">{title}</span>
        <motion.svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="text-text-muted"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-2 glass border-t-0 rounded-b-xl">
              <p className="text-text-secondary text-sm mb-4">{description}</p>
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#4da2ff] rounded-lg text-sm font-mono hover:bg-[#4da2ff]/90 transition-colors border-0"
                  style={{ color: 'white' }}
                >
                  {linkText}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3 11L11 3M11 3H5M11 3V9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

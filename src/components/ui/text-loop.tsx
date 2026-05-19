import { AnimatePresence, motion, Transition, Variants } from 'motion/react';
import React, { useState, useEffect, Children } from 'react';

export type TextLoopProps = {
  children: React.ReactNode[];
  className?: string;
  interval?: number;
  transition?: Transition;
  variants?: Variants;
  onIndexChange?: (index: number) => void;
  trigger?: boolean;
};

export function TextLoop({
  children,
  className,
  interval = 2,
  transition = { duration: 0.5, ease: 'easeOut' },
  variants,
  onIndexChange,
  trigger = true,
}: TextLoopProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = React.Children.toArray(children);

  useEffect(() => {
    if (!trigger) return;

    const intervalMs = interval * 1000;
    const timer = setInterval(() => {
      setCurrentIndex((current) => {
        const next = (current + 1) % items.length;
        if (onIndexChange) onIndexChange(next);
        return next;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [items.length, interval, onIndexChange, trigger]);

  return (
    <div className={`relative inline-block overflow-hidden ${className || ''}`}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={currentIndex}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          variants={
            variants || {
              initial: { y: 20, opacity: 0 },
              animate: { y: 0, opacity: 1 },
              exit: { y: -20, opacity: 0 },
            }
          }
        >
          {items[currentIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

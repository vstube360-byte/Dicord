import React from 'react';
import { motion } from 'motion/react';

export function TypingIndicator({ name = 'User' }: { name?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 3, transition: { duration: 0.12 } }}
      className="flex items-center text-[11px] text-theme-muted/75 italic select-none shrink-0 gap-1"
    >
      <span>{name} is typing</span>
      <div className="flex pb-0.5 gap-0.5 items-center">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1 h-1 bg-theme-muted/50 rounded-full"
            animate={{ y: [0, -1.5, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.12,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

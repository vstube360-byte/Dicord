import React from 'react';
import { motion } from 'motion/react';

export function TypingIndicator({ name = 'User' }: { name?: string }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="flex items-end space-x-3 max-w-[70%]"
    >
      <div className="w-8 h-8 rounded-full border border-theme-border shrink-0 hidden sm:block" />
      <div className="glass py-2 px-4 rounded-2xl rounded-bl-none text-theme-muted text-sm italic flex items-center space-x-2 shadow-sm">
        <span>{name} is typing</span>
        <div className="flex pb-1 gap-0.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="typing-dot"
              animate={{ y: [0, -3, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

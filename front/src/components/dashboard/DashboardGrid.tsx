"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function DashboardHeader({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
}

export function DashboardStaggerGrid({ children }: { children: ReactNode[] | ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 gap-6"
      initial="hidden"
      animate="show"
      variants={containerVariants}
    >
      {items.map((child, i) => (
        <motion.div
          key={i}
          variants={itemVariants}
          className={items.length % 2 !== 0 && i === items.length - 1 ? "md:col-span-2" : ""}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

export function DashboardBlobs() {
  return (
    <>
      <div className="pointer-events-none absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full bg-shadow-teal/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-[420px] h-[420px] rounded-full bg-abyss-green/30 blur-[100px]" />
    </>
  );
}

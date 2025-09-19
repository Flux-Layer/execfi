"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiMenu } from "react-icons/fi";

/** ====== PUBLIC API ====== */
export const NavDrawer = () => {
  return (
    <div className="bg-neutral-950">
      <SimpleFloatingNav />
    </div>
  );
};

/** ====== MAIN NAV ====== */
const SimpleFloatingNav = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed left-1/2 top-8 z-40 w-fit -translate-x-1/2 rounded-lg border border-neutral-700 bg-neutral-900/95 px-3 py-2 text-sm text-neutral-500 shadow-lg shadow-black/30 backdrop-blur">
      <div className="flex items-center gap-6">
        <Logo />

        {/* Desktop links */}
        <div className="hidden items-center gap-6 md:flex">
          <NavLink>Home</NavLink>
          <NavLink>About</NavLink>
          <NavLink>Pricing</NavLink>
        </div>

        <JoinButton />

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((p) => !p)}
          className="block text-2xl text-neutral-50 md:hidden"
        >
          <FiMenu />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-3 flex flex-col gap-3 md:hidden"
          >
            <a
              href="#"
              className="block text-neutral-300 hover:text-neutral-100"
            >
              Home
            </a>
            <a
              href="#"
              className="block text-neutral-300 hover:text-neutral-100"
            >
              About
            </a>
            <a
              href="#"
              className="block text-neutral-300 hover:text-neutral-100"
            >
              Pricing
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

/** ====== PARTS ====== */

const Logo = () => {
  return (
    <svg
      width="28"
      height="auto"
      viewBox="0 0 50 39"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="ml-2 fill-neutral-50"
    >
      <path d="M16.4992 2H37.5808L22.0816 24.9729H1L16.4992 2Z"></path>
      <path d="M17.4224 27.102L11.4192 36H33.5008L49 13.0271H32.7024L23.2064 27.102H17.4224Z"></path>
    </svg>
  );
};

const NavLink = ({ children }: { children: string }) => {
  return (
    <a href="#" rel="nofollow" className="block overflow-hidden">
      <motion.div
        whileHover={{ y: -20 }}
        transition={{ ease: "backInOut", duration: 0.5 }}
        className="h-[20px]"
      >
        <span className="flex h-[20px] items-center text-neutral-400">
          {children}
        </span>
        <span className="flex h-[20px] items-center text-neutral-50">
          {children}
        </span>
      </motion.div>
    </a>
  );
};

const JoinButton = () => {
  return (
    <button
      className={`
        relative z-0 hidden items-center overflow-hidden whitespace-nowrap rounded-lg border border-neutral-700
        px-4 py-1.5 font-medium text-neutral-300 transition-all duration-300
        before:absolute before:inset-0 before:-z-10 before:translate-y-[200%] before:scale-[2.5]
        before:rounded-[100%] before:bg-neutral-50 before:transition-transform before:duration-700 before:content-[""]
        hover:scale-105 hover:border-neutral-50 hover:text-neutral-900 hover:before:translate-y-[0%] active:scale-100
        md:flex
      `}
    >
      Join waitlist
    </button>
  );
};

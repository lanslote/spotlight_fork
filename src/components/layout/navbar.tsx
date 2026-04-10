"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu, X, Github, ExternalLink } from "lucide-react";

const NAV_LINKS = [
  { href: "/templates", label: "Templates" },
  { href: "/enhance", label: "Enhance" },
  { href: "/demo", label: "Demo Builder" },
  { href: "/editor/product-hunt", label: "Editor" },
  {
    href: "https://github.com/lanslote/spotlight_fork",
    label: "GitHub",
    external: true,
    icon: <Github className="w-3.5 h-3.5" />,
  },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-surface-0/85 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_40px_rgba(0,0,0,0.4)]"
          : "bg-transparent"
      )}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0 group"
          aria-label="Spotlight home"
        >
          {/* Diamond spark icon */}
          <span className="relative flex items-center justify-center w-7 h-7">
            <svg
              viewBox="0 0 28 28"
              fill="none"
              className="w-7 h-7 transition-transform duration-300 group-hover:rotate-12"
            >
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
              <path
                d="M14 2 L20 10 L14 26 L8 10 Z"
                fill="url(#logo-grad)"
                opacity="0.9"
              />
              <path
                d="M2 14 L10 8 L26 14 L10 20 Z"
                fill="url(#logo-grad)"
                opacity="0.5"
              />
            </svg>
          </span>
          <span className="font-display italic text-xl text-zinc-100 group-hover:text-white transition-colors">
            Spotlight
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm",
                "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]",
                "transition-all duration-150"
              )}
            >
              {link.icon}
              {link.label}
              {link.external && (
                <ExternalLink className="w-2.5 h-2.5 opacity-50" />
              )}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/templates">
            <Button variant="primary" size="sm">
              Get Started
            </Button>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-surface-0/95 backdrop-blur-xl border-b border-white/[0.06] px-4 pb-4">
          <div className="flex flex-col gap-1 pt-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] transition-all"
                onClick={() => setMobileOpen(false)}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-white/[0.06] mt-1">
              <Link href="/templates" onClick={() => setMobileOpen(false)}>
                <Button variant="primary" size="sm" className="w-full">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

import Link from "next/link";
import { Github, Twitter, MessageCircle, BookOpen } from "lucide-react";

const LINKS = [
  {
    href: "/docs",
    label: "Docs",
    icon: <BookOpen className="w-3.5 h-3.5" />,
  },
  {
    href: "https://github.com/lanslote/spotlight_fork",
    label: "GitHub",
    icon: <Github className="w-3.5 h-3.5" />,
    external: true,
  },
  {
    href: "https://twitter.com/spotlight",
    label: "Twitter",
    icon: <Twitter className="w-3.5 h-3.5" />,
    external: true,
  },
  {
    href: "https://discord.gg/spotlight",
    label: "Discord",
    icon: <MessageCircle className="w-3.5 h-3.5" />,
    external: true,
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.05] bg-surface-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Brand */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
                <defs>
                  <linearGradient id="footer-logo-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
                <path
                  d="M14 2 L20 10 L14 26 L8 10 Z"
                  fill="url(#footer-logo-grad)"
                  opacity="0.9"
                />
                <path
                  d="M2 14 L10 8 L26 14 L10 20 Z"
                  fill="url(#footer-logo-grad)"
                  opacity="0.5"
                />
              </svg>
              <span className="font-display italic text-lg text-zinc-300">
                Spotlight
              </span>
            </div>
            <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
              Launch videos &amp; interactive demos in minutes.
              Open-source, no watermark.
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} Spotlight. AGPL-3.0 core · MIT templates.
          </p>
          <p className="text-xs text-zinc-600 italic">
            Built with obsessive attention to detail.
          </p>
        </div>
      </div>
    </footer>
  );
}

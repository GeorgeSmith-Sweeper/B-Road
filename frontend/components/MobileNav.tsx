'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { href: '#explore', label: 'EXPLORE' },
  { href: '#routes', label: 'ROUTES' },
  { href: '#community', label: 'COMMUNITY' },
  { href: '#about', label: 'ABOUT' },
];

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-text-secondary hover:text-text-primary transition-colors p-1"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 bg-[#0D0D0DEE] backdrop-blur-sm border-t border-border-subtle">
          <nav className="flex flex-col px-6 py-4 gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="font-bebas text-sm tracking-[2px] text-text-secondary hover:text-text-primary transition-colors"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/planner"
              onClick={() => setIsOpen(false)}
              className="font-bebas text-sm tracking-[2px] bg-accent-gold text-bg-primary px-7 py-3 text-center hover:brightness-110 transition"
            >
              PLAN YOUR TRIP
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}

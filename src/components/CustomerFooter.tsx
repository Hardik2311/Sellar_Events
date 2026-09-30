import React from 'react';
import type { IconType } from 'react-icons';
import { FaGlobe, FaInstagram, FaFacebook, FaXTwitter, FaWhatsapp } from 'react-icons/fa6';

interface CustomerFooterProps {
  organizationName?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  whatsappNumber?: string;
  /** 'brand' = full dark footer (discover). 'slim' = thin bar (event detail). */
  variant?: 'default' | 'brand' | 'slim';
}

// helper — normalizes handles/numbers into full URLs
const toWebsiteUrl = (url: string) =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`;

const toInstagramUrl = (handle: string) =>
  handle.startsWith('http') ? handle : `https://instagram.com/${handle.replace(/^@/, '')}`;

const toTwitterUrl = (handle: string) =>
  handle.startsWith('http') ? handle : `https://x.com/${handle.replace(/^@/, '')}`;

const toFacebookUrl = (handle: string) =>
  handle.startsWith('http') ? handle : `https://facebook.com/${handle}`;

const toWhatsappUrl = (number: string) =>
  `https://wa.me/${number.replace(/\D/g, '')}`;

const CustomerFooter: React.FC<CustomerFooterProps> = ({
  organizationName,
  website,
  instagram,
  facebook,
  twitter,
  whatsappNumber,
  variant = 'default',
}) => {
    const links = [
    website && { icon: FaGlobe, label: 'Website', href: toWebsiteUrl(website) },
    instagram && { icon: FaInstagram, label: 'Instagram', href: toInstagramUrl(instagram) },
    facebook && { icon: FaFacebook, label: 'Facebook', href: toFacebookUrl(facebook) },
    twitter && { icon: FaXTwitter, label: 'Twitter / X', href: toTwitterUrl(twitter) },
    whatsappNumber && { icon: FaWhatsapp, label: 'WhatsApp', href: toWhatsappUrl(whatsappNumber) },
  ].filter(Boolean) as { icon: IconType; label: string; href: string }[];

  if (variant === 'default' && links.length === 0 && !organizationName) return null;

  if (variant === 'brand') {
    const displayName = organizationName || 'Outsold';
    return (
      <footer className="brand-theme w-full overflow-hidden bg-[var(--brand-black)] px-4 pt-10 pb-6 text-center sm:px-8">
        <p className="brand-display text-2xl text-white">
          Never miss <span className="text-[var(--brand-yellow)]">the next one.</span>
        </p>
        <p className="brand-mono mt-2 text-xs text-white/50">
          Follow {displayName} for new drops and announcements.
        </p>

        {links.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {links.map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/60 hover:border-[var(--brand-yellow)] hover:text-[var(--brand-yellow)] transition-colors"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        )}

        <p
          className="brand-display mt-8 truncate text-[15vw] leading-none text-transparent sm:text-7xl"
          style={{ WebkitTextStroke: '1px rgba(255,255,255,0.15)' }}
          aria-hidden="true"
        >
          {displayName}
        </p>

        <div className="brand-mono mt-6 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-4 text-[10px] text-white/30 sm:flex-row">
          <span>&copy; {new Date().getFullYear()} {displayName}. All rights reserved.</span>
          <span className="flex items-center gap-3">
            <a href="#" className="hover:text-white/60 transition-colors">Terms</a>
            <a href="#" className="hover:text-white/60 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/60 transition-colors">Refund policy</a>
          </span>
          <span className="flex items-center gap-1.5">
            Ticketing by
            <span className="rounded-sm bg-[var(--brand-yellow)] px-1.5 py-0.5 font-bold text-black">Outsold</span>
          </span>
        </div>
      </footer>
    );
  }

  if (variant === 'slim') {
    const displayName = organizationName || 'Outsold';
    return (
      <footer className="brand-theme w-full bg-[var(--brand-black)] px-4 py-3 text-center sm:px-8">
        <div className="brand-mono mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-1.5 text-[10px] text-white/40 sm:flex-row">
          <span className="font-bold text-white/70">
            {displayName.toUpperCase()} <span className="text-[var(--brand-yellow)]">EVENTS</span>
          </span>
          <span>&copy; {new Date().getFullYear()} {displayName}. All rights reserved.</span>
          <span className="flex items-center gap-1.5">
            Ticketing by
            <span className="rounded-sm bg-[var(--brand-yellow)] px-1.5 py-0.5 font-bold text-black">Outsold</span>
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="w-full border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] px-4 py-6 text-center">
      {links.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-center gap-3">
          {links.map(({ icon: Icon, label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={label}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-[#007A78] hover:text-[#007A78] dark:hover:border-[#2DD4BF] dark:hover:text-[#2DD4BF] transition-colors"
            >
              <Icon size={16} />
            </a>
          ))}
        </div>
      )}
      {organizationName && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} {organizationName}. All rights reserved.
        </p>
      )}
    </footer>
  );
};

export default CustomerFooter;
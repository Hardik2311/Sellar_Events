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
}) => {
    const links = [
    website && { icon: FaGlobe, label: 'Website', href: toWebsiteUrl(website) },
    instagram && { icon: FaInstagram, label: 'Instagram', href: toInstagramUrl(instagram) },
    facebook && { icon: FaFacebook, label: 'Facebook', href: toFacebookUrl(facebook) },
    twitter && { icon: FaXTwitter, label: 'Twitter / X', href: toTwitterUrl(twitter) },
    whatsappNumber && { icon: FaWhatsapp, label: 'WhatsApp', href: toWhatsappUrl(whatsappNumber) },
  ].filter(Boolean) as { icon: IconType; label: string; href: string }[];

  if (links.length === 0 && !organizationName) return null;

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
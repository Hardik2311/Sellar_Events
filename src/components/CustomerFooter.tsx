import React from 'react';
import { Link } from 'react-router-dom';
import type { IconType } from 'react-icons';
import { FaGlobe, FaInstagram, FaFacebook, FaXTwitter, FaWhatsapp, FaRegEnvelope } from 'react-icons/fa6';
import { ArrowUpRight } from 'lucide-react';
import PoweredByOutsold from './brand/PoweredByOutsold';
import { brandButtonClass } from './brand/brandButtonClass';
import { STOREFRONT_POLICY_KEYS, STOREFRONT_POLICY_LINK_LABELS } from '../lib/storefrontPolicies';

// "Sell on Outsold" in the storefront footer — tagged separately from the
// ticketing badge so footer sign-ups show up on their own in analytics.
const OUTSOLD_SELL_URL = 'https://outsold.in/?utm_source=storefront&utm_medium=footer_cta';

// "https://www.jaipurnights.in/" -> "jaipurnights.in"
const toDisplayHost = (url: string) => url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');

interface CustomerFooterProps {
  organizationName?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  whatsappNumber?: string;
  /** 'brand' = full dark footer (discover, event detail). 'slim' = thin bar. */
  variant?: 'default' | 'brand' | 'slim';
  /** Event detail only — organizer row shown at the top of the 'brand' footer. */
  host?: { name: string; onMoreEvents?: () => void };
  /** 'brand' only — short line under the organizer name (Settings → Storefront & policies). */
  bio?: string;
  /** 'brand' only — public contact email (Settings → Storefront & policies). */
  contactEmail?: string;
  /** 'brand' only — prefix for store links: '' on a subdomain, '/public/<companyId>' otherwise. */
  storeBasePath?: string;
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
  host,
  bio,
  contactEmail,
  storeBasePath = '',
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
    const hostName = host?.name || organizationName || 'Outsold';
    // Contact rows show the handle itself, not just an icon.
    const email = contactEmail?.trim();
    const contactRows = [
      email && { icon: FaRegEnvelope, label: email, href: `mailto:${email}` },
      website && { icon: FaGlobe, label: toDisplayHost(website), href: toWebsiteUrl(website) },
      instagram && { icon: FaInstagram, label: instagram.startsWith('http') ? 'Instagram' : `@${instagram.replace(/^@/, '')}`, href: toInstagramUrl(instagram) },
      facebook && { icon: FaFacebook, label: 'Facebook', href: toFacebookUrl(facebook) },
      twitter && { icon: FaXTwitter, label: twitter.startsWith('http') ? 'X' : `@${twitter.replace(/^@/, '')}`, href: toTwitterUrl(twitter) },
      whatsappNumber && { icon: FaWhatsapp, label: 'WhatsApp', href: toWhatsappUrl(whatsappNumber) },
    ].filter(Boolean) as { icon: IconType; label: string; href: string }[];
    // The organizer's own policies (Settings → Storefront & policies).
    const helpLinks = STOREFRONT_POLICY_KEYS.map((key) => ({
      label: STOREFRONT_POLICY_LINK_LABELS[key],
      to: `${storeBasePath}/policies/${key}`,
    }));
    const columnLabel = 'text-[11px] font-semibold uppercase leading-[14px] tracking-[0.08em] text-white/60';

    return (
      <footer className="brand-theme w-full overflow-hidden bg-[var(--brand-footer)] text-[var(--brand-cream)]">
        {/* ── Organizer ─────────────────────────────────────────────── */}
        {/* Forest Slate */}
        <div className="bg-[#111816] px-4 pt-10 pb-6 sm:px-8 lg:px-24">
          <div className="mx-auto w-full max-w-[1440px]">
            <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-x-20 lg:gap-x-28">
              <div className="col-span-2 flex flex-col items-start gap-3 md:col-span-1">
                <p className={columnLabel}>Hosted by</p>
                <p className="brand-display break-words text-[32px] leading-none sm:text-4xl">{hostName}</p>
                {bio?.trim() && (
                  <p className="max-w-[44ch] text-[15px] leading-[22px] text-[var(--brand-cream)]/85">{bio.trim()}</p>
                )}
                {host?.onMoreEvents && (
                  <button
                    type="button"
                    onClick={host.onMoreEvents}
                    className="mt-2 inline-flex h-10 items-center gap-2 rounded-sm border border-white/30 bg-white/5 px-4 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10"
                  >
                    More events by {host.name}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </button>
                )}
              </div>

              {contactRows.length > 0 && (
                <div className="flex min-w-0 flex-col gap-3">
                  <p className={columnLabel}>Contact</p>
                  <ul className="flex flex-col gap-2.5">
                    {contactRows.map(({ icon: Icon, label, href }) => (
                      <li key={href}>
                        <a
                          href={href}
                          {...(href.startsWith('mailto:') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                          className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--brand-cream)] transition-colors hover:text-white hover:underline underline-offset-4"
                        >
                          <Icon size={15} className="shrink-0 text-white" aria-hidden="true" />
                          <span className="truncate">{label}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <p className={columnLabel}>Help</p>
                <ul className="flex flex-col gap-2.5">
                  {helpLinks.map(({ label, to }) => (
                    <li key={label}>
                      <Link to={to} className="text-sm font-semibold text-[var(--brand-cream)] transition-colors hover:text-white hover:underline underline-offset-4">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="mt-10 border-t border-white/10 pt-5 text-[13px] text-[var(--brand-cream)]/60">
              &copy; {new Date().getFullYear()} {hostName}
            </p>
          </div>
        </div>

        {/* ── Ticketing by Outsold ──────────────────────────────────── */}
        <div className="relative overflow-hidden border-t border-[var(--brand-yellow)] bg-[#111816] px-4 py-6 sm:px-8 lg:px-24">
          <span
            className="brand-display pointer-events-none absolute -bottom-6 right-0 select-none text-[120px] leading-none text-[var(--brand-yellow)] opacity-[0.07] sm:-bottom-8 sm:text-[160px]"
            aria-hidden="true"
          >
            Outsold
          </span>
          <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-4 md:flex-row md:items-center md:gap-8">
            <a href={OUTSOLD_SELL_URL} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-3" aria-label="Outsold">
              <img src="/Outsold.png" alt="" className="h-9 w-auto" />
              <span className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase leading-[12px] tracking-[0.08em] text-white/50">Ticketing by</span>
                <span className="brand-display text-xl leading-none text-[var(--brand-cream)]">Outsold</span>
              </span>
            </a>
            <p className="max-w-[46ch] text-sm leading-[20px] text-[#c9c4b8]">
              Hosting an event? Sell tickets, check in guests and get paid with Outsold.
            </p>
            <a
              href={OUTSOLD_SELL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${brandButtonClass('onInk', { size: 'sm' })} self-start md:self-auto`}
            >
              Sell on Outsold <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>
    );
  }

  if (variant === 'slim') {
    const displayName = organizationName || 'Outsold';
    return (
      <footer className="brand-theme w-full bg-[var(--brand-footer)] px-4 py-3 text-center sm:px-8">
        <div className="brand-mono mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-1.5 text-[10px] text-white/40 sm:flex-row">
          <span className="font-bold text-white/70">
            {displayName.toUpperCase()} <span className="text-[var(--brand-yellow)]">EVENTS</span>
          </span>
          <span>&copy; {new Date().getFullYear()} All rights reserved by Outsold.</span>
          <PoweredByOutsold size="sm" />
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
              className="flex h-9 w-9 items-center justify-center rounded-sm border border-gray-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-[#007A78] hover:text-[#007A78] dark:hover:border-[#2DD4BF] dark:hover:text-[#2DD4BF] transition-colors"
            >
              <Icon size={16} />
            </a>
          ))}
        </div>
      )}
      {organizationName && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} All rights reserved by Outsold.
        </p>
      )}
    </footer>
  );
};

export default CustomerFooter;
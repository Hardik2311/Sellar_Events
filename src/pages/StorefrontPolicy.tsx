import React from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { useDomainResolution } from '../hooks/useDomainResolution';
import { useCompanySettings } from '../hooks/useSettings';
import { getSubdomain } from '../lib/subdomain';
import {
  STOREFRONT_POLICY_KEYS,
  STOREFRONT_POLICY_LABELS,
  isStorefrontPolicyKey,
  resolvePolicyText,
  toPolicyBlocks,
} from '../lib/storefrontPolicies';
import { formatLongDate } from '../lib/storefrontFormat';
import BrandNavHeader from '../components/brand/BrandNavHeader';
import BrandButton from '../components/brand/BrandButton';
import BrandEmptyState from '../components/brand/BrandEmptyState';
import CustomerFooter from '../components/CustomerFooter';

// Public page for an organizer's refund policy, terms or privacy policy —
// the text they wrote in Settings → Storefront & policies, or the template
// with their name filled in until they've saved their own.
const StorefrontPolicy: React.FC = () => {
  const { policy, companyId } = useParams<{ policy: string; companyId?: string }>();
  const navigate = useNavigate();
  const { resolvedCompanyId, loading: domainLoading, error: domainError } = useDomainResolution(companyId);
  const { settings, loading: settingsLoading } = useCompanySettings(resolvedCompanyId);

  const subdomain = getSubdomain();
  const storeBasePath = subdomain ? '' : resolvedCompanyId ? `/public/${resolvedCompanyId}` : '';
  const storeHome = storeBasePath || '/';

  if (!isStorefrontPolicyKey(policy)) {
    return <Navigate to={storeHome} replace />;
  }

  if (domainLoading || settingsLoading) {
    return (
      <div className="brand-theme flex min-h-dvh w-full flex-col bg-[var(--brand-cream)]" aria-busy="true" aria-label="Loading policy">
        <div className="h-16 border-b border-[var(--brand-line)] bg-[var(--brand-surface)]" />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10 sm:px-8">
          <div className="h-10 w-2/3 animate-pulse rounded-lg bg-[var(--brand-skeleton)] motion-reduce:animate-none" />
          <div className="h-80 animate-pulse rounded-xl bg-[var(--brand-skeleton)] motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  if (domainError || !resolvedCompanyId) {
    return (
      <div className="brand-theme flex min-h-dvh w-full items-center justify-center bg-[var(--brand-cream)] p-4">
        <BrandEmptyState
          icon={FileText}
          title="This page isn't available"
          body="The link may be wrong, or the store has moved."
          className="w-full max-w-md"
        />
      </div>
    );
  }

  const organizationName = settings.organizationName;
  const blocks = toPolicyBlocks(resolvePolicyText(policy, settings.storefront.policies[policy], organizationName));
  const updatedAt = settings.storefront.policiesUpdatedAt;

  return (
    <div className="brand-theme flex min-h-screen w-full flex-col bg-[var(--brand-cream)] text-[var(--brand-black)]">
      <BrandNavHeader organizationName={organizationName} onBrowse={() => navigate(storeHome)} />

      <main className="grow px-4 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <BrandButton variant="link" onClick={() => navigate(storeHome)} className="self-start !text-[var(--brand-black)]">
            <ArrowLeft size={18} /> All events
          </BrandButton>

          <div className="flex flex-col gap-2">
            <h1 className="brand-display text-[32px] leading-none sm:text-[44px]">{STOREFRONT_POLICY_LABELS[policy]}</h1>
            <p className="text-[15px] text-[var(--brand-muted)]">
              {organizationName || 'This organizer'}
              {updatedAt && <> &middot; Updated {formatLongDate(updatedAt)}</>}
            </p>
          </div>

          {/* Switch between the three policies */}
          <nav aria-label="Policies" className="flex flex-wrap gap-2">
            {STOREFRONT_POLICY_KEYS.map((key) => {
              const active = key === policy;
              return (
                <Link
                  key={key}
                  to={`${storeBasePath}/policies/${key}`}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex h-9 items-center rounded-sm border px-3.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-[var(--brand-black)] bg-[var(--brand-black)] text-[var(--brand-cream)]'
                      : 'border-[var(--brand-line-strong)] bg-[var(--brand-surface)] text-[var(--brand-black)] hover:bg-[var(--brand-cream)]'
                  }`}
                >
                  {STOREFRONT_POLICY_LABELS[key]}
                </Link>
              );
            })}
          </nav>

          <article className="flex flex-col gap-4 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-surface)] p-5 sm:p-8">
            {blocks.map((block, i) =>
              block.type === 'heading' ? (
                <h2 key={i} className={`text-[17px] font-bold leading-[24px] ${i > 0 ? 'mt-2' : ''}`}>
                  {block.text}
                </h2>
              ) : (
                <p key={i} className="max-w-[68ch] whitespace-pre-line text-[15px] leading-[24px] text-[var(--brand-black)]">
                  {block.text}
                </p>
              )
            )}
          </article>
        </div>
      </main>

      <CustomerFooter
        variant="brand"
        organizationName={organizationName}
        website={settings.website}
        instagram={settings.instagram}
        facebook={settings.facebook}
        twitter={settings.twitter}
        whatsappNumber={settings.whatsappNumber}
        bio={settings.storefront.bio}
        contactEmail={settings.storefront.contactEmail}
        storeBasePath={storeBasePath}
      />
    </div>
  );
};

export default StorefrontPolicy;

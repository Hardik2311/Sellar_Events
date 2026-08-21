export const mapGstRegistrationType = (
  type: string
): { gstScheme: 'regular' | 'composition' | 'none'; taxType: 'inclusive' | 'exclusive' } => {
  switch (type) {
    case 'regular_inclusive':
      return { gstScheme: 'regular', taxType: 'inclusive' };
    case 'regular_exclusive':
      return { gstScheme: 'regular', taxType: 'exclusive' };
    case 'composition':
      return { gstScheme: 'composition', taxType: 'inclusive' };
    default:
      return { gstScheme: 'none', taxType: 'inclusive' };
  }
};

// Inverse of the above — used to derive the EditProfile "gstType" dropdown
// value from what's actually saved in companies/{id}/settings/general,
// which is the source of truth (signup writes there, not business_info).
export const reverseMapGstScheme = (
  gstScheme?: string,
  taxType?: string
): string => {
  if (gstScheme === 'regular') {
    return taxType === 'exclusive' ? 'regular_exclusive' : 'regular_inclusive';
  }
  if (gstScheme === 'composition') return 'composition';
  return 'none';
};
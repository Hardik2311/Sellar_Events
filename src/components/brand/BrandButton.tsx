import React from 'react';
import { brandButtonClass, type BrandButtonVariant } from './brandButtonClass';

interface BrandButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BrandButtonVariant;
  size?: 'md' | 'sm';
  block?: boolean;
}

// Storefront button: primary (ink), onInk (yellow, only on ink surfaces),
// secondary (outlined) and link. Always rounded-sm.
const BrandButton: React.FC<BrandButtonProps> = ({ variant = 'primary', size = 'md', block, className = '', type = 'button', ...rest }) => (
  <button type={type} className={`${brandButtonClass(variant, { block, size })} ${className}`} {...rest} />
);

export default BrandButton;

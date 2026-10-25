import React from 'react';
import clsx from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'surface' | 'interactive' | 'accent-border';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className,
  ...props
}) => {
  const baseStyles = 'rounded-2xl transition-all duration-150';

  const variantStyles = {
    default: 'bg-card text-card-foreground border border-border shadow-theme',
    surface: 'bg-muted text-foreground border border-border',
    interactive:
      'bg-card text-card-foreground border border-border hover:border-primary/50 hover:bg-muted/70 cursor-pointer transition-all shadow-theme',
    'accent-border':
      'bg-card text-card-foreground border-l-4 border-l-primary border-y border-r border-border shadow-theme',
  };

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3.5',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <div className={clsx(baseStyles, variantStyles[variant], paddingStyles[padding], className)} {...props}>
      {children}
    </div>
  );
};

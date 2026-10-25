import React from 'react';
import clsx from 'clsx';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'yellow' | 'neutral' | 'success' | 'danger' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-medium rounded-lg select-none shrink-0';

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  const variantStyles = {
    yellow: 'bg-primary/15 text-primary border border-primary/30 font-bold',
    neutral: 'bg-muted text-muted-foreground border border-border',
    success: 'bg-chart-3/15 text-chart-3 border border-chart-3/30 font-bold',
    danger: 'bg-destructive/15 text-destructive border border-destructive/30 font-bold',
    outline: 'bg-transparent text-foreground border border-border',
  };

  return (
    <span className={clsx(baseStyles, sizeStyles[size], variantStyles[variant], className)} {...props}>
      {children}
    </span>
  );
};

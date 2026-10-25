import React from 'react';
import clsx from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  className,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed touch-target cursor-pointer select-none';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5 min-h-[36px]',
    md: 'px-4 py-2 text-sm gap-2 min-h-touch',
    lg: 'px-5 py-2.5 text-base gap-2.5 min-h-[48px]',
  };

  const variantStyles = {
    primary:
      'bg-primary hover:bg-primary-hover active:bg-primary-active text-primary-foreground font-bold shadow-md shadow-primary/20',
    secondary:
      'bg-secondary hover:bg-muted active:bg-card border border-border text-foreground',
    outline:
      'bg-transparent hover:bg-muted border border-border hover:border-muted-foreground text-foreground',
    ghost:
      'bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground',
    danger:
      'bg-destructive/20 hover:bg-destructive/30 text-destructive border border-destructive/40',
  };

  return (
    <button
      className={clsx(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};

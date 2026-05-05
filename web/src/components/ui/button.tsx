import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
  {
    variants: {
      variant: {
        default: 'border-sky-400 bg-sky-300 text-slate-950 hover:bg-sky-200',
        secondary: 'border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700',
        ghost: 'border-transparent bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100',
        destructive: 'border-red-900/60 bg-red-950/40 text-red-200 hover:bg-red-950/70',
      },
      size: {
        sm: 'h-8 px-2.5',
        md: 'h-9 px-3',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

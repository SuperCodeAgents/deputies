import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20',
        className,
      )}
      {...props}
    />
  );
}

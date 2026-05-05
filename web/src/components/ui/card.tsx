import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-md border border-slate-800 bg-slate-950/40', className)} {...props} />;
}

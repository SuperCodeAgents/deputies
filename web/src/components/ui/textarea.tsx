import type { TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full resize-y rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20',
        className,
      )}
      {...props}
    />
  );
}

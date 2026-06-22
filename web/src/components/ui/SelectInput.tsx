import { ChevronDown } from 'lucide-react';
import type { SelectHTMLAttributes } from 'react';

type Props = SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Drop-in replacement for <select className="mc-input">.
 * Adds the wrapper div + ChevronDown icon so the dropdown looks
 * consistent with FilterBar.Select (appearance: none, token color,
 * adapts automatically to dark mode).
 *
 * Usage:
 *   <SelectInput id="x" value={v} onChange={...}>
 *     <option value="">…</option>
 *   </SelectInput>
 */
export function SelectInput({ children, className, ...props }: Props) {
  return (
    <div className="mc-input-wrap">
      <select className={['mc-input', className].filter(Boolean).join(' ')} {...props}>
        {children}
      </select>
      <ChevronDown size={12} className="mc-input-chevron" aria-hidden />
    </div>
  );
}

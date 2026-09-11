/**
 * A grouped picker with a way out.
 *
 * Every clinical vocabulary in this app needs the same two things: a list
 * short enough to scan and long enough to cover the ward, and an "Other" that
 * takes free text. Without the second, whoever meets the case the list missed
 * types it into the nearest box instead, and the coding is worse than if there
 * had been no list at all.
 *
 * A value loaded from a record that is NOT on the list — an older free-text
 * entry, or something a colleague typed under "Other" — opens in the other
 * state with the text intact, so editing an old wound never silently discards
 * what someone wrote.
 */

import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { OTHER_OPTION, isListed, type TaxonomyGroup } from '../../data/woundTaxonomy';

interface Props {
  groups: TaxonomyGroup[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Free-text placeholder once "Other" is chosen. */
  otherPlaceholder?: string;
  id?: string;
  required?: boolean;
  className?: string;
}

export function TaxonomySelect({
  groups, value, onChange, placeholder = 'Select…',
  otherPlaceholder = 'Describe it', id, required, className = '',
}: Props) {
  // An unlisted non-empty value can only have come from free text, so the
  // control opens in that mode rather than showing a blank select over it.
  const [isOther, setIsOther] = useState(() => !!value && !isListed(groups, value));
  const otherRef = useRef<HTMLInputElement | null>(null);

  // Keep in step when the form is reset or a different record is loaded.
  useEffect(() => {
    setIsOther(!!value && !isListed(groups, value));
  }, [value, groups]);

  const handleSelect = (v: string) => {
    if (v === OTHER_OPTION) {
      setIsOther(true);
      onChange('');
      // The text box is the whole point of choosing Other; land in it.
      window.setTimeout(() => otherRef.current?.focus(), 0);
      return;
    }
    setIsOther(false);
    onChange(v);
  };

  const selectValue = isOther ? OTHER_OPTION : (isListed(groups, value) ? value : '');

  return (
    <div className={className}>
      <div className="relative">
        <select
          id={id}
          value={selectValue}
          required={required && !isOther}
          onChange={(e) => handleSelect(e.target.value)}
          className="w-full appearance-none border rounded-lg pl-3 pr-9 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
        >
          <option value="">{placeholder}</option>
          {groups.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </optgroup>
          ))}
          <option value={OTHER_OPTION}>{OTHER_OPTION}</option>
        </select>
        <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {isOther && (
        <input
          ref={otherRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={otherPlaceholder}
          aria-label={otherPlaceholder}
          className="mt-2 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
        />
      )}
    </div>
  );
}

export default TaxonomySelect;

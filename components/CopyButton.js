'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useI18n } from '../i18n/client';

export default function CopyButton({ text }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition hover:border-brand"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t('common.copied') : t('common.copy')}
    </button>
  );
}

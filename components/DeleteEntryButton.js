'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';
import { createClient } from '../utils/supabase/client';

// Two-tap delete: the first tap arms it, the second deletes. Removes the
// entry's photo files from Storage first (the database row cascades to its
// setlist, photos, tags and attendees, but Storage files don't cascade).
export default function DeleteEntryButton({ entryId, userId }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    setDeleting(true);
    setError('');
    const supabase = createClient();

    const folder = `${userId}/${entryId}`;
    const { data: files } = await supabase.storage.from('entry-photos').list(folder);
    if (files?.length) {
      await supabase.storage.from('entry-photos').remove(files.map((f) => `${folder}/${f.name}`));
    }

    const { error: deleteError } = await supabase.from('concert_entries').delete().eq('id', entryId);
    if (deleteError) {
      setError('Could not delete this entry.');
      setDeleting(false);
      setArmed(false);
      return;
    }
    router.push('/collection');
  };

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={handleClick}
        disabled={deleting}
        className={`flex items-center gap-1.5 text-sm rounded-full px-3 py-1.5 border transition disabled:opacity-60 ${
          armed ? 'bg-red-500/10 border-red-400 text-red-400' : 'bg-surface border-border hover:border-red-400'
        }`}
      >
        {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        {armed ? 'Tap again to delete' : 'Delete'}
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

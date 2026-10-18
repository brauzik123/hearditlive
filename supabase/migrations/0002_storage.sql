-- Storage buckets for entry photos and profile avatars.
-- Path convention:
--   entry-photos/{user_id}/{entry_id}/{filename}
--   avatars/{user_id}/{filename}

insert into storage.buckets (id, name, public)
values ('entry-photos', 'entry-photos', false),
       ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- entry-photos: owner can read/write their own folder; other viewers can
-- read only when the referenced entry is visible to them and media isn't hidden.
create policy "entry-photos owner all"
  on storage.objects for all
  using (bucket_id = 'entry-photos' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'entry-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "entry-photos visible to entry viewers"
  on storage.objects for select
  using (
    bucket_id = 'entry-photos'
    and exists (
      select 1 from concert_entries e
      where e.id = ((storage.foldername(name))[2])::uuid
        and entry_visible_to_viewer(e)
        and not coalesce(
          (select coalesce(e2.hide_media, p.hide_entry_media_default)
           from concert_entries e2 join profiles p on p.id = e2.user_id
           where e2.id = e.id),
          false
        )
    )
  );

-- avatars: owner can read/write their own folder; anyone can view any
-- avatar (matches the profiles table's own visibility policy being the
-- gate for the rest of the profile, not the image itself).
create policy "avatars owner all"
  on storage.objects for all
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatars publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

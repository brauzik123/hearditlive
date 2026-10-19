-- Profile photos are shown anywhere a username is (profiles, friend lists,
-- entries), and usernames are already public. Serving them from a public
-- bucket gives each photo a stable URL instead of a signed one per view.
-- Uploads stay restricted by the existing "avatars owner all" policy:
-- each user can only write inside their own {user_id}/ folder.
-- Concert photos (entry-photos) remain private.
update storage.buckets set public = true where id = 'avatars';

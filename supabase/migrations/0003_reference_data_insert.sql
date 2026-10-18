-- artists/venues/festivals are shared reference data (like a wiki):
-- any authenticated user can contribute a new row, everyone can read them.
create policy "artists insertable by authenticated users"
  on artists for insert
  with check (auth.uid() is not null);

create policy "venues insertable by authenticated users"
  on venues for insert
  with check (auth.uid() is not null);

create policy "festivals insertable by authenticated users"
  on festivals for insert
  with check (auth.uid() is not null);

create policy "songs insertable by authenticated users"
  on songs for insert
  with check (auth.uid() is not null);

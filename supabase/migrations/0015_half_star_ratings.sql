-- Ratings are ten stars with half steps (0.5 … 10). The scale stays out of
-- 10, so existing whole-number ratings keep their meaning (8 → 8 stars).
alter table concert_entries drop constraint if exists concert_entries_rating_check;
alter table concert_entries alter column rating type numeric(3, 1);
alter table concert_entries
  add constraint concert_entries_rating_check
  check (rating between 0.5 and 10 and rating * 2 = floor(rating * 2));

// What a ticket stub (components/TicketStub.js) needs from concert_entries.
export const TICKET_FIELDS =
  'id, entry_type, event_date, rating, ticket_status, is_support, created_at, artists!concert_entries_artist_id_fkey(name), entry_co_artists(artist_id, position, artists(name)), venues(name, city, city_id, cities(name_en, name_pl))';

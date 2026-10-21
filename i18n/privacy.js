// Privacy page content, per language. Kept apart from the UI dictionaries
// because it's long-form text. Update the date whenever this changes.
export const PRIVACY_UPDATED = '2026-10-21';

const en = {
  title: 'Privacy',
  intro:
    'Heard It Live is a small, non-commercial concert diary run for a group of friends. This page explains what it stores about you, who can see it, and how to remove it.',
  updated: 'Last updated',
  contactLabel: 'Questions or requests',
  contactFallback: 'Ask the person who invited you to Heard It Live.',
  sections: [
    {
      title: 'What we store',
      items: [
        'Your account: email address, username, password (stored only as a secure hash by our login provider) and, if you add them, a bio and profile photo.',
        'What you log: concerts, dates, venues, ratings, notes, setlists, tags, the names of people you went with, and photos you upload with their captions.',
        'Who you follow and who follows you.',
        'Settings on your device: your language, date format and preferred Collection view, plus the cookie that keeps you signed in.',
      ],
    },
    {
      title: 'Who can see it',
      items: [
        'Your username and profile photo are visible to other users, so friends can find you.',
        'Your concerts, setlists and photos follow your privacy settings: everyone, friends only (people you follow who follow you back), or only you. You can also set this per concert.',
        'Your email address is never shown to anyone.',
      ],
    },
    {
      title: 'Services we use',
      items: [
        'Supabase stores the database and your photos, and handles sign-in.',
        'Google, only if you choose “Continue with Google” to sign in.',
        'setlist.fm: when you tap “Find this show on setlist.fm”, we look up the artist and date there. The setlist you pick is saved to your concert, and its page on setlist.fm is linked from it. Setlist data comes from setlist.fm and its contributors.',
        'Spotify: we look up artists to show photos, albums and tracklists. Nothing about you is sent to Spotify.',
        'GeoNames: when you type a city, the letters you typed are sent to GeoNames to suggest matching cities.',
      ],
    },
    {
      title: 'What we don’t do',
      items: [
        'No ads, no tracking or analytics cookies, and no selling or sharing your data with anyone else.',
        'Photos are shrunk on your device before upload, which also removes location data stored in them.',
      ],
    },
    {
      title: 'Your control',
      items: [
        'Edit or delete any concert at any time.',
        'Settings → Delete account removes your account, every concert, setlist and photo, and your follows, permanently.',
        'For a copy of your data, or anything else, use the contact below.',
      ],
    },
  ],
};

const pl = {
  title: 'Prywatność',
  intro:
    'Heard It Live to mały, niekomercyjny dziennik koncertów prowadzony dla grupy znajomych. Ta strona wyjaśnia, co o Tobie przechowujemy, kto to widzi i jak to usunąć.',
  updated: 'Ostatnia zmiana',
  contactLabel: 'Pytania i prośby',
  contactFallback: 'Napisz do osoby, która zaprosiła Cię do Heard It Live.',
  sections: [
    {
      title: 'Co przechowujemy',
      items: [
        'Twoje konto: adres e-mail, nazwę użytkownika, hasło (przechowywane wyłącznie jako bezpieczny skrót przez dostawcę logowania) oraz, jeśli je dodasz, opis i zdjęcie profilowe.',
        'To, co dodajesz: koncerty, daty, miejsca, oceny, notatki, setlisty, tagi, imiona osób, które były tam z Tobą, oraz wgrane zdjęcia z podpisami.',
        'Kogo obserwujesz i kto obserwuje Ciebie.',
        'Ustawienia na Twoim urządzeniu: język, format daty i wybrany widok kolekcji, a także plik cookie, który utrzymuje Twoje logowanie.',
      ],
    },
    {
      title: 'Kto to widzi',
      items: [
        'Twoja nazwa użytkownika i zdjęcie profilowe są widoczne dla innych, żeby znajomi mogli Cię znaleźć.',
        'Twoje koncerty, setlisty i zdjęcia są widoczne zgodnie z ustawieniami prywatności: dla wszystkich, tylko dla znajomych (osób, które obserwujesz i które obserwują Ciebie) albo tylko dla Ciebie. Możesz to też ustawić dla każdego koncertu osobno.',
        'Twój adres e-mail nigdy nie jest nikomu pokazywany.',
      ],
    },
    {
      title: 'Z jakich usług korzystamy',
      items: [
        'Supabase przechowuje bazę danych i Twoje zdjęcia oraz obsługuje logowanie.',
        'Google, tylko jeśli logujesz się przez „Kontynuuj z Google”.',
        'setlist.fm: gdy klikniesz „Znajdź ten koncert na setlist.fm”, wyszukujemy tam wykonawcę i datę. Wybrana setlista zapisuje się przy koncercie razem z linkiem do jej strony na setlist.fm. Dane setlist pochodzą z setlist.fm i od jego użytkowników.',
        'Spotify: wyszukujemy wykonawców, żeby pokazać zdjęcia, albumy i listy utworów. Żadne dane o Tobie nie trafiają do Spotify.',
        'GeoNames: gdy wpisujesz miasto, wpisane litery trafiają do GeoNames, żeby podpowiedzieć pasujące miasta.',
      ],
    },
    {
      title: 'Czego nie robimy',
      items: [
        'Żadnych reklam, żadnych plików cookie śledzących ani analitycznych, żadnej sprzedaży ani udostępniania Twoich danych komukolwiek.',
        'Zdjęcia są zmniejszane na Twoim urządzeniu przed wysłaniem, co usuwa też zapisaną w nich lokalizację.',
      ],
    },
    {
      title: 'Masz kontrolę',
      items: [
        'Każdy koncert możesz w dowolnej chwili edytować lub usunąć.',
        'Ustawienia → Usuń konto trwale usuwa konto, wszystkie koncerty, setlisty i zdjęcia oraz obserwacje.',
        'Jeśli chcesz kopię swoich danych albo masz inną sprawę, skorzystaj z kontaktu poniżej.',
      ],
    },
  ],
};

export const PRIVACY = { en, pl };

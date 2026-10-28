'use client';

// Last resort, when the root layout itself fails. It replaces the whole
// document, so there's no stylesheet, font or language here — just inline
// styles in the app's colours and both languages.
export default function GlobalError({ retry }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          textAlign: 'center',
          background: '#1b1838',
          color: '#f4f1fb',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <title>Heard It Live</title>
        <h1 style={{ margin: 0, fontSize: 28 }}>Something went wrong</h1>
        <p style={{ margin: 0, opacity: 0.75 }}>Coś poszło nie tak</p>
        <button
          onClick={() => retry()}
          style={{
            marginTop: 8,
            padding: '10px 22px',
            border: 0,
            borderRadius: 999,
            background: '#ffc23d',
            color: '#1b1838',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Try again / Spróbuj ponownie
        </button>
      </body>
    </html>
  );
}

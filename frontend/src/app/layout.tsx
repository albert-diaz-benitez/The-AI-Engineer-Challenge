import 'leaflet/dist/leaflet.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          background:
            "linear-gradient(rgba(255,255,255,0.7), rgba(255,255,255,0.7)), url('/background.jpg') center center / cover no-repeat",
          minHeight: '100vh',
          width: '100vw',
          margin: 0,
          padding: 0,
        }}
      >
        <header style={{
          width: '100%',
          padding: '40px 0 24px 0',
          textAlign: 'center',
          background: 'rgba(255,255,255,0)',
          boxShadow: '0 2px 8px 0 rgba(25, 118, 210, 0.07)',
          backdropFilter: 'blur(2px)',
        }}>
          <h1 style={{ fontSize: '2.6rem', fontWeight: 800, color: '#1976d2', marginBottom: 8 }}>Trail running Chat Assistant</h1>
          <div style={{ fontSize: '1.25rem', color: '#1976d2', opacity: 0.85, marginBottom: 0 }}>
            Upload PDF or GPX files, select a document, and chat with an AI assistant that can help you on analyzing your routes. Preview GPX routes on the map!
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

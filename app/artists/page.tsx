import Link from "next/link";

const artists = [
  {
    name: "Sara Kim",
    role: "Senior stylist",
    specialties: "Precision cuts · Texture · Styling",
    image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Maya Brooks",
    role: "Color specialist",
    specialties: "Dimensional color · Balayage · Gloss",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=700&q=85",
  },
];

export default function ArtistsPage() {
  return (
    <main className="artists-page">
      <header className="site-header">
        <Link className="brand" href="/book" aria-label="Luma Salon booking">
          <span className="brand-mark">L</span>
          <span>
            <strong>Luma</strong>
            <small>Salon</small>
          </span>
        </Link>
        <nav aria-label="Artists navigation">
          <Link href="/book">Booking demo</Link>
        </nav>
      </header>

      <section className="artists-hero">
        <p className="eyebrow">The people behind Luma</p>
        <h1>Meet our artists</h1>
        <p>
          Thoughtful listeners, meticulous craftspeople, and experts in making
          every appointment feel entirely your own.
        </p>
      </section>

      <section className="artist-grid">
        {artists.map((artist) => (
          <article className="artist-profile" key={artist.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={artist.image} alt={`${artist.name}, ${artist.role}`} />
            <p className="eyebrow">{artist.role}</p>
            <h2>{artist.name}</h2>
            <p>{artist.specialties}</p>
          </article>
        ))}
      </section>

      <div className="artists-footer">
        <div>
          <p className="eyebrow">Verified repair</p>
          <h2>The Artists page opened successfully.</h2>
        </div>
        <Link className="primary-link" href="/book">
          Return to booking demo <span>→</span>
        </Link>
      </div>
    </main>
  );
}

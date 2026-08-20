"use client";

const footerLinks = [
  {
    title: "Producto",
    links: [
      { label: "Cómo funciona", href: "#how-it-works" },
      { label: "Funciones", href: "#features" },
      { label: "Precios", href: "#pricing" },
      { label: "Demo", href: "#demo" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacidad", href: "#" },
      { label: "Términos", href: "#" },
      { label: "Cookies", href: "#" },
    ],
  },
  {
    title: "Contacto",
    links: [
      { label: "Soporte", href: "#" },
      { label: "Twitter", href: "#" },
      { label: "Instagram", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--color-midnight-tide)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "64px 2rem 48px" }}>
        {/* Top section */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: "2rem", marginBottom: "48px" }}>
          {/* Brand */}
          <div>
            <a href="#" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none", marginBottom: "16px" }}>
              <img src="/assets/hero_logo.svg" alt="AutoMisho" style={{ width: "36px", height: "36px", objectFit: "contain" }} />
              <span style={{ color: "var(--color-pure-light)", fontSize: "18px", fontWeight: 400 }}>AutoMisho</span>
            </a>
            <p style={{ color: "var(--color-mist-gray)", fontSize: "14px", lineHeight: 1.6, maxWidth: "240px" }}>
              Tu copiloto IA para comprar coches de segunda mano con confianza.
            </p>
          </div>

          {/* Link columns */}
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h4 style={{ color: "var(--color-pure-light)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>
                {group.title}
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {group.links.map((link) => (
                  <li key={link.label} style={{ marginBottom: "10px" }}>
                    <a href={link.href} style={{ color: "var(--color-mist-gray)", fontSize: "14px", textDecoration: "none" }}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid var(--color-midnight-tide)", paddingTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <p style={{ color: "var(--color-mist-gray)", fontSize: "12px" }}>© 2026 AutoMisho. Todos los derechos reservados.</p>
          <p style={{ color: "var(--color-mist-gray)", fontSize: "12px" }}>Hecho con <span style={{ color: "var(--color-mint-glow)" }}>♥</span> en España</p>
        </div>
      </div>
    </footer>
  );
}

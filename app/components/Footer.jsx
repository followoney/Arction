"use client";

export default function Footer() {
  const links = [
    { label: "Arc Docs", href: "https://docs.arc.network" },
    { label: "Explorer", href: "https://testnet.arcscan.app" },
    { label: "Faucet", href: "https://faucet.circle.com" },
    { label: "Circle Dev", href: "https://developers.circle.com" },
    { label: "GitHub", href: "https://github.com/followoney/Arction" },
  ];

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-links">
            {links.map(({ label, href }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" className="footer-link">
                {label} <span style={{ opacity: 0.4, fontSize: 10 }}>↗</span>
              </a>
            ))}
          </div>
          <p className="footer-copy">
            Arction · Arc Testnet (5042002) · USDC Settlement · ethers.js v6
          </p>
        </div>
      </div>
    </footer>
  );
}

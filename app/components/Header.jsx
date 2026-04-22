"use client";

import WalletButton from "./WalletButton";

export default function Header() {
  return (
    <header className="header">
      <div className="container">
        <div className="header-inner">
          <div className="logo-group">
            <div className="logo-mark">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#38d2be" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="logo-text">
              Arc<span>tion</span>
            </div>
          </div>

          <nav className="nav-links">
            <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer" className="nav-link">
              Explorer
            </a>
            <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="nav-link">
              Faucet
            </a>
            <a href="https://docs.arc.network" target="_blank" rel="noreferrer" className="nav-link">
              Docs
            </a>
            <WalletButton />
          </nav>
        </div>
      </div>
    </header>
  );
}

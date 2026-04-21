"use client";

import { useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import NetworkStatus from "./components/NetworkStatus";
import VaultPanel from "./components/VaultPanel";
import ProtocolFlow from "./components/ProtocolFlow";
import Footer from "./components/Footer";
import WalletButton from "./components/WalletButton";

export default function Home() {
  const [account, setAccount] = useState(null);

  const resources = [
    { label: "Arc Docs", href: "https://docs.arc.network", icon: "📄" },
    { label: "Explorer", href: "https://testnet.arcscan.app", icon: "🔍" },
    { label: "Faucet", href: "https://faucet.circle.com", icon: "🚰" },
    { label: "Circle Dev", href: "https://developers.circle.com", icon: "⭕" },
  ];

  return (
    <div>
      <Header />
      <Hero />

      <main className="container">
        <NetworkStatus />

        <div className="main-grid">
          {/* Left — Vault Panel */}
          <div>
            {account ? (
              <VaultPanel account={account} />
            ) : (
              <div className="glow-card connect-prompt">
                <div className="connect-icon">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M21 12a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6m18 0V4.5a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 4.5V6" />
                  </svg>
                </div>
                <h3>Wallet Not Connected</h3>
                <p>Connect MetaMask to interact with CellularVault on Arc Testnet.</p>
                <WalletButton onConnect={setAccount} />
              </div>
            )}
          </div>

          {/* Right — Protocol Flow */}
          <div>
            <ProtocolFlow />
          </div>
        </div>

        {/* Resource Cards */}
        <div className="resource-grid">
          {resources.map(({ label, href, icon }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" className="resource-card glass-card">
              <span className="resource-icon">{icon}</span>
              <span>{label} ↗</span>
            </a>
          ))}
        </div>
      </main>

      <Footer />

      {/* Hidden wallet button for header sync */}
      <div style={{ display: "none" }}>
        <WalletButton onConnect={setAccount} />
      </div>
    </div>
  );
}

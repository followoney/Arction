"use client";

import { useState, useEffect, useCallback } from "react";
import { ARC_TESTNET, ARC_WALLET_PARAMS } from "@/lib/contracts";

export default function WalletButton({ onConnect }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isArc = chainId === ARC_TESTNET.chainId;

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then((a) => {
      if (a[0]) setAccount(a[0]);
    });
    window.ethereum.request({ method: "eth_chainId" }).then((id) => {
      setChainId(parseInt(id, 16));
    });
    const onAcc = (a) => setAccount(a[0] ?? null);
    const onChain = (id) => setChainId(parseInt(id, 16));
    window.ethereum.on("accountsChanged", onAcc);
    window.ethereum.on("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAcc);
      window.ethereum.removeListener("chainChanged", onChain);
    };
  }, []);

  useEffect(() => {
    if (account && isArc) onConnect?.(account);
    if (!account || !isArc) onConnect?.(null);
  }, [account, isArc, onConnect]);

  const switchToArc = useCallback(async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_WALLET_PARAMS.chainId }],
      });
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [ARC_WALLET_PARAMS],
        });
      } else throw e;
    }
  }, []);

  async function connect() {
    if (!window.ethereum) {
      setError("MetaMask not found. Please install MetaMask.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await switchToArc();
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const short = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";

  if (account && isArc) {
    return (
      <div className="wallet-connected">
        <span className="wallet-dot" />
        <span className="wallet-addr">{short(account)}</span>
        <span className="wallet-net">Arc Testnet</span>
      </div>
    );
  }

  if (account && !isArc) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <div className="wrong-badge">
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#eab308" }} />
          Wrong Network
        </div>
        <button className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 12 }} onClick={switchToArc}>
          Switch to Arc
        </button>
      </div>
    );
  }

  return (
    <div>
      <button className="btn btn-primary" onClick={connect} disabled={loading}>
        {loading ? <span className="spinner" /> : (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )}
        {loading ? "Connecting…" : "Connect Wallet"}
      </button>
      {error && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{error}</p>}
    </div>
  );
}

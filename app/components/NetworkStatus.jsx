"use client";

import { useEffect, useState } from "react";
import { ARC_TESTNET } from "@/lib/contracts";

export default function NetworkStatus() {
  const [block, setBlock] = useState(null);
  const [latency, setLatency] = useState(null);

  useEffect(() => {
    async function fetch_block() {
      const t0 = Date.now();
      try {
        const res = await fetch(ARC_TESTNET.rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
        });
        const data = await res.json();
        setBlock(parseInt(data.result, 16));
        setLatency(Date.now() - t0);
      } catch {
        /* network unavailable — silent */
      }
    }
    fetch_block();
    const iv = setInterval(fetch_block, 5000);
    return () => clearInterval(iv);
  }, []);

  const items = [
    { label: "Network", value: "Arc Testnet", cls: "accent" },
    { label: "Chain ID", value: ARC_TESTNET.chainId, cls: "" },
    { label: "Block", value: block ?? "—", cls: "live" },
    { label: "Latency", value: latency ? `${latency}ms` : "—", cls: latency && latency < 500 ? "live" : "" },
    { label: "Gas", value: "USDC (native)", cls: "" },
  ];

  return (
    <div className="network-bar glass-card">
      {items.map(({ label, value, cls }) => (
        <div key={label} className="net-item">
          <span className="net-label">{label}:</span>
          <span className={`net-val ${cls}`}>{value}</span>
        </div>
      ))}
    </div>
  );
}

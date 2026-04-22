"use client";

export default function Hero() {
  const kpis = [
    { value: "< 1s", label: "Finality", sub: "Deterministic" },
    { value: "1/2⁶⁴", label: "Collision", sub: "Simhash security" },
    { value: "~40%", label: "Savings", sub: "State storage" },
  ];

  return (
    <section className="hero">
      <div className="container">
        <div className="hero-badge">
          <span className="pulse-dot" />
          Arc Testnet · Chain 5042002 · USDC Native
        </div>

        <h1>
          Cellular Parallel
          <br />
          <span className="gradient-text">Execution Engine</span>
        </h1>

        <p>
          Simhash-powered spam filtering with CellularVault atomic USDC
          settlement. Sub-second finality on Arc Testnet.
        </p>

        <div className="kpi-grid">
          {kpis.map(({ value, label, sub }) => (
            <div key={label} className="kpi-card glass-card">
              <div className="kpi-value">{value}</div>
              <div className="kpi-label">{label}</div>
              <div className="kpi-sub">{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

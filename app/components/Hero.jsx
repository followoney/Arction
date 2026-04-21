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
          Arc Testnet · Chain ID 5042002 · USDC Gas
        </div>

        <h1>
          Simhash + Cellular
          <br />
          <span className="gradient-text">Parallel Execution</span>
        </h1>

        <p>
          Simhash-based spam filter, cellular parallel transaction execution,
          and Circle USDC atomic settlement on Arc Testnet.
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

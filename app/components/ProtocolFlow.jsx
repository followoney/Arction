"use client";

export default function ProtocolFlow() {
  const steps = [
    {
      num: "1", cls: "blue", icon: "⚡",
      title: "Sequencing",
      desc: "Arc Malachite BFT consensus sequences the transaction with sub-second deterministic finality.",
    },
    {
      num: "2", cls: "purple", icon: "🛡",
      title: "Verification",
      desc: "Simhash filter + Nullifier Registry prevents spam and double-spend attacks (d_H < ε = 3).",
    },
    {
      num: "3", cls: "green", icon: "✓",
      title: "Settlement",
      desc: "CellularVault atomically releases USDC funds to the recipient via CEI pattern.",
    },
  ];

  return (
    <div className="protocol-flow glow-card">
      <div className="panel-header">
        <span className="panel-dot" style={{ background: "#6c63ff", boxShadow: "0 0 12px rgba(108,99,255,.3)" }} />
        <h3 className="panel-title">TriSync Protocol</h3>
      </div>

      <div className="flow-steps">
        {steps.map(({ num, cls, title, desc }) => (
          <div key={num} className="flow-step">
            <div className={`step-num ${cls}`}>{num}</div>
            <div className="step-body">
              <h4>{title}</h4>
              <p>{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

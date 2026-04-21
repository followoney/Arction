"use client";

export default function ProtocolFlow() {
  const steps = [
    {
      num: "1", cls: "blue",
      title: "Sequencing",
      desc: "Arc Malachite BFT consensus sequences the transaction with sub-second deterministic finality.",
    },
    {
      num: "2", cls: "purple",
      title: "Verification",
      desc: "Simhash filter + Nullifier Registry prevents spam and double-spend attacks (d_H < ε = 3).",
    },
    {
      num: "3", cls: "green",
      title: "Settlement",
      desc: "Circle USDC + CellularVault atomically releases funds to the recipient via CEI pattern.",
    },
  ];

  return (
    <div className="protocol-flow glow-card">
      <div className="panel-header">
        <span className="panel-dot" style={{ background: "#8b5cf6" }} />
        <h3 className="panel-title">TriSync Protocol Flow</h3>
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

"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { ADDRESSES, CELLULAR_VAULT_ABI, USDC_ABI } from "@/lib/contracts";
import { computeSimhash, fingerprintToUint64 } from "@/lib/simhash";

export default function VaultPanel({ account }) {
  const [tab, setTab] = useState("open");
  const [form, setForm] = useState({
    recipient: "", amount: "", secret: "", ttl: "3600",
    cellId: "", settlSecret: "",
    refundCellId: "",
  });
  const [status, setStatus] = useState(null);

  function getProvider() {
    if (!window.ethereum) throw new Error("MetaMask not found.");
    return new ethers.BrowserProvider(window.ethereum);
  }

  const explorer = process.env.NEXT_PUBLIC_ARC_EXPLORER ?? "https://testnet.arcscan.app";

  async function openCell() {
    setStatus({ type: "loading", msg: "Submitting transaction…" });
    try {
      const provider = getProvider();
      const signer = await provider.getSigner();
      const usdc = new ethers.Contract(ADDRESSES.usdc, USDC_ABI, signer);
      const vault = new ethers.Contract(ADDRESSES.cellularVault, CELLULAR_VAULT_ABI, signer);

      const amount = ethers.parseUnits(form.amount, 6);
      console.log("Submitting Amount (6 decimals):", amount.toString());
      
      const tx = { from: account, to: form.recipient, amount: form.amount, token: "USDC", chainId: 5042002 };
      const { fingerprint } = computeSimhash(tx);
      const fp64 = fingerprintToUint64(fingerprint);
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes(form.secret));

      // Use a more robust nonce
      const nonce = BigInt(Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000000));

      setStatus({ type: "loading", msg: "Step 1: Approving USDC…" });
      const currentAllowance = await usdc.allowance(account, ADDRESSES.cellularVault);
      
      if (currentAllowance < amount) {
        const approveTx = await usdc.approve(ADDRESSES.cellularVault, amount);
        await approveTx.wait();
      }

      setStatus({ type: "loading", msg: "Step 2: Opening cellular vault…" });
      const openTx = await vault.openCell(
        form.recipient, amount, secretHash,
        BigInt(form.ttl), BigInt(fp64), [], nonce,
        { gasLimit: 500000 } // Manual gas limit to bypass estimation issues
      );
      const receipt = await openTx.wait();
      const cellId = receipt.logs?.[0]?.topics?.[1] ?? "—";

      setStatus({
        type: "success",
        msg: `Success! Cell ID: ${cellId.slice(0, 18)}…`,
        txHash: receipt.hash,
      });
    } catch (e) {
      console.error("DApp Error:", e);
      let errorMsg = e.reason || e.message;
      if (e.data) errorMsg += " | Data: " + e.data;
      setStatus({ type: "error", msg: errorMsg });
    }
  }

  async function settleCell() {
    setStatus({ type: "loading", msg: "Settling cell…" });
    try {
      const signer = await getProvider().getSigner();
      const vault = new ethers.Contract(ADDRESSES.cellularVault, CELLULAR_VAULT_ABI, signer);
      const tx = await vault.settleCell(form.cellId, ethers.encodeBytes32String(form.settlSecret));
      const receipt = await tx.wait();
      setStatus({ type: "success", msg: "Settlement complete!", txHash: receipt.hash });
    } catch (e) {
      setStatus({ type: "error", msg: e.reason ?? e.message });
    }
  }

  async function refundCell() {
    setStatus({ type: "loading", msg: "Processing refund…" });
    try {
      const signer = await getProvider().getSigner();
      const vault = new ethers.Contract(ADDRESSES.cellularVault, CELLULAR_VAULT_ABI, signer);
      const tx = await vault.refundCell(form.refundCellId);
      const receipt = await tx.wait();
      setStatus({ type: "success", msg: "Refund complete!", txHash: receipt.hash });
    } catch (e) {
      setStatus({ type: "error", msg: e.reason ?? e.message });
    }
  }

  const tabs = [
    { key: "open", label: "Open Cell", cls: "" },
    { key: "settle", label: "Settlement", cls: "tab-settle" },
    { key: "refund", label: "Refund", cls: "tab-refund" },
  ];

  return (
    <div className="vault-panel glow-card">
      <div className="panel-header">
        <span className="panel-dot" />
        <h3 className="panel-title">CellularVault Manager</h3>
      </div>

      <div className="tabs">
        {tabs.map(({ key, label, cls }) => (
          <button
            key={key}
            className={`tab ${cls} ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "open" && (
        <div className="form-group">
          <div>
            <label className="input-label">Recipient Address</label>
            <input className="input" placeholder="0x…" value={form.recipient}
              onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
          </div>
          <div>
            <label className="input-label">USDC Amount</label>
            <input className="input" placeholder="e.g. 10" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} type="number" />
          </div>
          <div>
            <label className="input-label">Secret Key</label>
            <input className="input" placeholder="Enter secret" value={form.secret}
              onChange={(e) => setForm({ ...form, secret: e.target.value })} type="password" />
          </div>
          <div>
            <label className="input-label">TTL (seconds)</label>
            <input className="input" placeholder="3600" value={form.ttl}
              onChange={(e) => setForm({ ...form, ttl: e.target.value })} type="number" />
          </div>
          <button className="btn btn-primary btn-full" onClick={openCell}>
            Open Cell & Lock USDC
          </button>
        </div>
      )}

      {tab === "settle" && (
        <div className="form-group">
          <div>
            <label className="input-label">Cell ID (bytes32)</label>
            <input className="input" placeholder="0x…" value={form.cellId}
              onChange={(e) => setForm({ ...form, cellId: e.target.value })} />
          </div>
          <div>
            <label className="input-label">Secret Key</label>
            <input className="input" placeholder="Enter secret" value={form.settlSecret}
              onChange={(e) => setForm({ ...form, settlSecret: e.target.value })} type="password" />
          </div>
          <button className="btn btn-success btn-full" onClick={settleCell}>
            Settle Cell
          </button>
        </div>
      )}

      {tab === "refund" && (
        <div className="form-group">
          <div>
            <label className="input-label">Cell ID (bytes32)</label>
            <input className="input" placeholder="0x…" value={form.refundCellId}
              onChange={(e) => setForm({ ...form, refundCellId: e.target.value })} />
          </div>
          <button className="btn btn-warning btn-full" onClick={refundCell}>
            Refund Expired Cell
          </button>
        </div>
      )}

      {status && (
        <div className={`status-msg ${status.type}`} style={{ marginTop: 16 }}>
          <div className="status-row">
            {status.type === "loading" && <span className="spinner" />}
            <span>{status.msg}</span>
          </div>
          {status.txHash && (
            <a href={`${explorer}/tx/${status.txHash}`} target="_blank" rel="noreferrer">
              {status.txHash}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

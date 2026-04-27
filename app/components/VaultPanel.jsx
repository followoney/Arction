"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { ADDRESSES, CELLULAR_VAULT_ABI, USDC_ABI } from "@/lib/contracts";
import { computeSimhash, fingerprintToUint64 } from "@/lib/simhash";

export default function VaultPanel({ account, onTxStateChange }) {
  const [tab, setTab] = useState("open");
  const [form, setForm] = useState({
    recipient: "", amount: "", secret: "", ttl: "3600",
    cellId: "", settlSecret: "",
    refundCellId: "",
  });
  const [status, setStatus] = useState(null);
  const [toast, setToast] = useState(null);

  function getProvider() {
    if (!window.ethereum) throw new Error("MetaMask not found.");
    return new ethers.BrowserProvider(window.ethereum);
  }

  function formatError(e) {
    console.error("Full Error Object:", e);
    if (e.data) return `Contract Revert: ${e.data}`;
    if (e.reason) return `Reason: ${e.reason}`;
    if (e.message && e.message.includes("user rejected")) return "User rejected transaction.";
    return e.shortMessage || e.message || "Unknown Blockchain Error";
  }

  async function openCell() {
    if (!form.recipient || !form.amount || !form.secret) return;
    setStatus({ type: "loading", msg: "Initializing..." });
    try {
      const provider = getProvider();
      const signer = await provider.getSigner();
      
      // ENSURE ADDRESSES ARE CORRECT
      const VAULT_ADDR = "0x35eF6b0CF36ec0aE213F23FB40Ceb1A79f23B376";
      const USDC_ADDR = "0x3600000000000000000000000000000000000000";

      const usdc = new ethers.Contract(USDC_ADDR, USDC_ABI, signer);
      const vault = new ethers.Contract(VAULT_ADDR, CELLULAR_VAULT_ABI, signer);

      let decimals = 6;
      try { decimals = await usdc.decimals(); } catch(e) { console.error("Decimals failed", e); }
      
      const amount = ethers.parseUnits(form.amount, decimals);

      // TriSync uniqueness
      const txData = { r: Math.random(), t: Date.now(), a: account, to: form.recipient };
      const { fingerprint } = computeSimhash(txData);
      const fp64 = fingerprintToUint64(fingerprint);
      const secretHash = ethers.keccak256(ethers.encodeBytes32String(form.secret));
      const nonce = BigInt(Math.floor(Date.now() / 1000));

      setStatus({ type: "loading", msg: "Checking Allowance & Balance…" });
      const balance = await usdc.balanceOf(account);
      if (balance < amount) throw new Error("Insufficient USDC balance.");

      const allowance = await usdc.allowance(account, VAULT_ADDR);
      if (allowance < amount) {
        setStatus({ type: "loading", msg: "Approving USDC…" });
        const tx = await usdc.approve(VAULT_ADDR, amount);
        await tx.wait();
      }

      setStatus({ type: "loading", msg: "Sending OpenCell Transaction…" });
      // Use explicit gas price and limit to avoid RPC estimation errors
      const openTx = await vault.openCell(
        form.recipient, amount, secretHash,
        BigInt(form.ttl), BigInt(fp64), [], nonce,
        { gasLimit: 1500000 }
      );
      
      setStatus({ type: "loading", msg: "Confirming on-chain…" });
      const receipt = await openTx.wait();
      setStatus({ type: "success", msg: "Vault Created!", cellId: receipt.logs[0]?.topics[1], txHash: receipt.hash });
    } catch (e) {
      setStatus({ type: "error", msg: formatError(e) });
    }
  }

  // Settle and Refund updated to be simpler
  async function settleCell() {
    try {
      const signer = await getProvider().getSigner();
      const vault = new ethers.Contract("0x35eF6b0CF36ec0aE213F23FB40Ceb1A79f23B376", CELLULAR_VAULT_ABI, signer);
      const secretBytes32 = ethers.encodeBytes32String(form.settlSecret);
      const tx = await vault.settleCell(form.cellId.trim(), secretBytes32, { gasLimit: 1000000 });
      await tx.wait();
      setStatus({ type: "success", msg: "Claimed!" });
    } catch (e) { setStatus({ type: "error", msg: formatError(e) }); }
  }

  async function refundCell() {
    try {
      const signer = await getProvider().getSigner();
      const vault = new ethers.Contract("0x35eF6b0CF36ec0aE213F23FB40Ceb1A79f23B376", CELLULAR_VAULT_ABI, signer);
      const tx = await vault.refundCell(form.refundCellId.trim(), { gasLimit: 1000000 });
      await tx.wait();
      setStatus({ type: "success", msg: "Refunded!" });
    } catch (e) { setStatus({ type: "error", msg: formatError(e) }); }
  }

  return (
    <div className="vault-panel glow-card">
      <div className="tabs">
        {["open", "settle", "refund"].map(k => (
          <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{k.toUpperCase()}</button>
        ))}
      </div>
      <div className="form-group" style={{ marginTop: 20 }}>
        {tab === "open" && (
          <>
            <input className="input" placeholder="Recipient" value={form.recipient} onChange={e => setForm({...form, recipient: e.target.value})} />
            <input className="input" placeholder="Amount" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} type="number" />
            <input className="input" placeholder="Secret" value={form.secret} onChange={e => setForm({...form, secret: e.target.value})} type="password" />
            <button className="btn btn-primary btn-full" onClick={openCell}>SEND</button>
          </>
        )}
        {tab === "settle" && (
          <>
            <input className="input" placeholder="Cell ID" value={form.cellId} onChange={e => setForm({...form, cellId: e.target.value})} />
            <input className="input" placeholder="Secret" value={form.settlSecret} onChange={e => setForm({...form, settlSecret: e.target.value})} type="password" />
            <button className="btn btn-success btn-full" onClick={settleCell}>CLAIM</button>
          </>
        )}
        {tab === "refund" && (
          <>
            <input className="input" placeholder="Cell ID" value={form.refundCellId} onChange={e => setForm({...form, refundCellId: e.target.value})} />
            <button className="btn btn-warning btn-full" onClick={refundCell}>REFUND</button>
          </>
        )}
      </div>
      {status && <div className={`status-msg ${status.type}`} style={{ marginTop: 20 }}>{status.msg}</div>}
    </div>
  );
}

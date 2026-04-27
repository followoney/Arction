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
    console.error("Full Error Context:", e);
    
    // Check for "TriSync: Rejected" or similar in the message
    const msg = e.message || e.shortMessage || "";
    if (msg.includes("TriSync: Rejected")) return "TriSync Rejected: Spam filter blocked this transaction. Try changing the amount slightly.";
    if (msg.includes("user rejected")) return "Transaction rejected by user.";
    if (msg.includes("insufficient funds")) return "Insufficient USDC balance.";
    
    if (e.data) return `Contract Revert: ${e.data}`;
    return msg || "Unknown transaction error.";
  }

  async function openCell() {
    if (!form.recipient || !form.amount || !form.secret) return;
    setStatus({ type: "loading", msg: "Preparing transaction…" });
    try {
      const provider = getProvider();
      const signer = await provider.getSigner();
      
      const VAULT_ADDR = "0x35eF6b0CF36ec0aE213F23FB40Ceb1A79f23B376";
      const USDC_ADDR = "0x3600000000000000000000000000000000000000";

      const usdc = new ethers.Contract(USDC_ADDR, USDC_ABI, signer);
      const vault = new ethers.Contract(VAULT_ADDR, CELLULAR_VAULT_ABI, signer);

      let decimals = 6;
      try { decimals = await usdc.decimals(); } catch(e) { }
      
      const amount = ethers.parseUnits(form.amount, decimals);

      // ENSURE UNIQUE FINGERPRINT
      // tokenizeTx expects: from, to, amount, token, chainId, nonce
      const txDataForSimhash = {
        from: account,
        to: form.recipient,
        amount: form.amount,
        token: "USDC",
        chainId: "5042002",
        nonce: Date.now().toString() + Math.random().toString() // Double uniqueness
      };
      
      const { fingerprint } = computeSimhash(txDataForSimhash);
      const fp64 = fingerprintToUint64(fingerprint);
      const secretHash = ethers.keccak256(ethers.encodeBytes32String(form.secret));
      const contractNonce = BigInt(Math.floor(Date.now() / 1000));

      setStatus({ type: "loading", msg: "Checking balance & allowance…" });
      const allowance = await usdc.allowance(account, VAULT_ADDR);
      if (allowance < amount) {
        setStatus({ type: "loading", msg: "Step 1/2 — Approving USDC…" });
        const approveTx = await usdc.approve(VAULT_ADDR, amount);
        await approveTx.wait();
      }

      setStatus({ type: "loading", msg: "Step 2/2 — Confirming Vault Creation…" });
      const openTx = await vault.openCell(
        form.recipient, amount, secretHash,
        BigInt(form.ttl), BigInt(fp64), [], contractNonce,
        { gasLimit: 1500000 }
      );
      
      setStatus({ type: "loading", msg: "Awaiting finality…" });
      const receipt = await openTx.wait();
      
      // Get Cell ID from logs
      let cellId = null;
      try {
        const iface = new ethers.Interface(CELLULAR_VAULT_ABI);
        for (const log of receipt.logs) {
            const p = iface.parseLog({ topics: log.topics, data: log.data });
            if (p && p.name === "CellOpened") { cellId = p.args[0]; break; }
        }
      } catch { }

      setStatus({ type: "success", msg: "Cell Opened!", cellId: cellId || receipt.logs[0]?.topics[1], txHash: receipt.hash });
    } catch (e) {
      setStatus({ type: "error", msg: formatError(e) });
    }
  }

  async function settleCell() {
    if (!form.cellId || !form.settlSecret) return;
    setStatus({ type: "loading", msg: "Claiming funds…" });
    try {
      const signer = await getProvider().getSigner();
      const vault = new ethers.Contract("0x35eF6b0CF36ec0aE213F23FB40Ceb1A79f23B376", CELLULAR_VAULT_ABI, signer);
      const secretBytes32 = ethers.encodeBytes32String(form.settlSecret);
      const tx = await vault.settleCell(form.cellId.trim(), secretBytes32, { gasLimit: 1000000 });
      const receipt = await tx.wait();
      setStatus({ type: "success", msg: "Funds released!", txHash: receipt.hash });
    } catch (e) { setStatus({ type: "error", msg: formatError(e) }); }
  }

  async function refundCell() {
    if (!form.refundCellId) return;
    setStatus({ type: "loading", msg: "Refunding…" });
    try {
      const signer = await getProvider().getSigner();
      const vault = new ethers.Contract("0x35eF6b0CF36ec0aE213F23FB40Ceb1A79f23B376", CELLULAR_VAULT_ABI, signer);
      const tx = await vault.refundCell(form.refundCellId.trim(), { gasLimit: 1000000 });
      const receipt = await tx.wait();
      setStatus({ type: "success", msg: "Refunded!", txHash: receipt.hash });
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
            <div className="input-label">Recipient</div>
            <input className="input" placeholder="0x…" value={form.recipient} onChange={e => setForm({...form, recipient: e.target.value})} />
            <div className="input-label">Amount (USDC)</div>
            <input className="input" placeholder="e.g. 10" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} type="number" />
            <div className="input-label">Secret Key</div>
            <input className="input" placeholder="Passphrase" value={form.secret} onChange={e => setForm({...form, secret: e.target.value})} type="password" />
            <button className="btn btn-primary btn-full" onClick={openCell} style={{ marginTop: 10 }}>SEND FUNDS</button>
          </>
        )}
        {tab === "settle" && (
          <>
            <div className="input-label">Cell ID</div>
            <input className="input" placeholder="0x…" value={form.cellId} onChange={e => setForm({...form, cellId: e.target.value})} />
            <div className="input-label">Secret Key</div>
            <input className="input" placeholder="Passphrase" value={form.settlSecret} onChange={e => setForm({...form, settlSecret: e.target.value})} type="password" />
            <button className="btn btn-success btn-full" onClick={settleCell} style={{ marginTop: 10 }}>CLAIM FUNDS</button>
          </>
        )}
        {tab === "refund" && (
          <>
            <div className="input-label">Cell ID</div>
            <input className="input" placeholder="0x…" value={form.refundCellId} onChange={e => setForm({...form, refundCellId: e.target.value})} />
            <button className="btn btn-warning btn-full" onClick={refundCell} style={{ marginTop: 10 }}>REFUND EXPIRED</button>
          </>
        )}
      </div>
      {status && (
        <div className={`status-msg ${status.type}`} style={{ marginTop: 20 }}>
          <div>{status.msg}</div>
          {status.cellId && <div style={{ fontSize: '10px', marginTop: 5 }}>ID: {status.cellId}</div>}
          {status.txHash && <a href={`${explorer}/tx/${status.txHash}`} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: '10px', marginTop: 5, color: '#34d399' }}>View Explorer ↗</a>}
        </div>
      )}
    </div>
  );
}

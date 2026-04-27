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

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function getProvider() {
    if (!window.ethereum) throw new Error("MetaMask not found. Please install MetaMask.");
    return new ethers.BrowserProvider(window.ethereum);
  }

  const explorer = process.env.NEXT_PUBLIC_ARC_EXPLORER ?? "https://testnet.arcscan.app";

  function formatError(e, context = "general") {
    if (e.data && e.data !== "0x") {
      try {
        const iface = new ethers.Interface(CELLULAR_VAULT_ABI);
        const decoded = iface.parseError(e.data);
        if (decoded) return `Contract Error: ${decoded.name}`;
      } catch { }
    }
    let msg = e.reason || e.shortMessage || e.message || "Unknown error";
    msg = msg.replace(/\s*\(.*0x[a-fA-F0-9]{8,}.*\)/g, "");
    if (msg.includes("user rejected")) return "Transaction was rejected by user.";
    if (msg.includes("insufficient funds")) return "Insufficient balance or gas.";
    return `Error: ${msg}`;
  }

  const setTxActive = useCallback((active) => {
    if (onTxStateChange) onTxStateChange(active);
  }, [onTxStateChange]);

  async function openCell() {
    if (!form.recipient || !form.amount || !form.secret) return;
    setTxActive(true);
    setStatus({ type: "loading", msg: "Connecting to Arc Testnet…" });
    try {
      const provider = getProvider();
      const signer = await provider.getSigner();
      const usdc = new ethers.Contract(ADDRESSES.usdc, USDC_ABI, signer);
      const vault = new ethers.Contract(ADDRESSES.cellularVault, CELLULAR_VAULT_ABI, signer);

      // Get precision
      let decimals = 6;
      try { decimals = await usdc.decimals(); } catch { }
      const amount = ethers.parseUnits(form.amount, decimals);

      // Unique hash for TriSync to prevent "Already Registered" error
      const uniqueNonce = Date.now().toString();
      const txData = {
        from: account,
        to: form.recipient,
        amount: form.amount,
        nonce: uniqueNonce, // Milisaniyelik benzersizlik
        salt: Math.random().toString() 
      };
      const { fingerprint } = computeSimhash(txData);
      const fp64 = fingerprintToUint64(fingerprint);
      const secretHash = ethers.keccak256(ethers.encodeBytes32String(form.secret));
      const contractNonce = BigInt(Math.floor(Date.now() / 1000));

      setStatus({ type: "loading", msg: "Verifying USDC balance…" });
      const balance = await usdc.balanceOf(account);
      if (balance < amount) {
        throw new Error(`Insufficient balance (${ethers.formatUnits(balance, decimals)} available)`);
      }

      setStatus({ type: "loading", msg: "Step 1/2 — Approving USDC…" });
      const allowance = await usdc.allowance(account, ADDRESSES.cellularVault);
      if (allowance < amount) {
        const approveTx = await usdc.approve(ADDRESSES.cellularVault, amount);
        await approveTx.wait();
      }

      setStatus({ type: "loading", msg: "Step 2/2 — Opening Vault…" });
      // Gas limit increased to handle TriSync logic depth
      const openTx = await vault.openCell(
        form.recipient, amount, secretHash,
        BigInt(form.ttl), BigInt(fp64), [], contractNonce,
        { gasLimit: 1200000 }
      );
      
      setStatus({ type: "loading", msg: "Waiting for blockchain confirmation…" });
      const receipt = await openTx.wait();

      let cellId = null;
      try {
        const iface = new ethers.Interface(CELLULAR_VAULT_ABI);
        for (const log of receipt.logs) {
            const p = iface.parseLog({ topics: log.topics, data: log.data });
            if (p && p.name === "CellOpened") { cellId = p.args[0]; break; }
        }
      } catch { }

      setStatus({
        type: "success",
        msg: "USDC successfully locked in cellular vault!",
        cellId: cellId || receipt.logs[0]?.topics[1],
        txHash: receipt.hash,
      });
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", msg: formatError(e, "open") });
    } finally {
      setTxActive(false);
    }
  }

  async function settleCell() {
    if (!form.cellId || !form.settlSecret) return;
    setTxActive(true);
    setStatus({ type: "loading", msg: "Verifying secret and claiming…" });
    try {
      const signer = await getProvider().getSigner();
      const vault = new ethers.Contract(ADDRESSES.cellularVault, CELLULAR_VAULT_ABI, signer);
      const secretBytes32 = ethers.encodeBytes32String(form.settlSecret);
      const tx = await vault.settleCell(form.cellId.trim(), secretBytes32, { gasLimit: 800000 });
      const receipt = await tx.wait();
      setStatus({ type: "success", msg: "Funds claimed successfully!", txHash: receipt.hash });
    } catch (e) {
      setStatus({ type: "error", msg: formatError(e, "settle") });
    } finally {
      setTxActive(false);
    }
  }

  async function refundCell() {
    if (!form.refundCellId) return;
    setTxActive(true);
    setStatus({ type: "loading", msg: "Processing refund…" });
    try {
      const signer = await getProvider().getSigner();
      const vault = new ethers.Contract(ADDRESSES.cellularVault, CELLULAR_VAULT_ABI, signer);
      const tx = await vault.refundCell(form.refundCellId.trim(), { gasLimit: 500000 });
      const receipt = await tx.wait();
      setStatus({ type: "success", msg: "Refund successful!", txHash: receipt.hash });
    } catch (e) {
      setStatus({ type: "error", msg: formatError(e, "refund") });
    } finally {
      setTxActive(false);
    }
  }

  return (
    <>
      <div className="vault-panel glow-card">
        <div className="panel-header">
          <span className="panel-dot" />
          <h3 className="panel-title">CellularVault</h3>
        </div>

        <div className="tabs">
          {["open", "settle", "refund"].map(k => (
            <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => { setTab(k); setStatus(null); }}>
              {k.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="form-group">
          {tab === "open" && (
            <>
              <input className="input" placeholder="Recipient Address" value={form.recipient} onChange={e => setForm({...form, recipient: e.target.value})} />
              <input className="input" placeholder="Amount (USDC)" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} type="number" />
              <input className="input" placeholder="Secret Key" value={form.secret} onChange={e => setForm({...form, secret: e.target.value})} type="password" />
              <button className="btn btn-primary btn-full" onClick={openCell}>Send &amp; Lock</button>
            </>
          )}
          {tab === "settle" && (
            <>
              <input className="input" placeholder="Cell ID" value={form.cellId} onChange={e => setForm({...form, cellId: e.target.value})} />
              <input className="input" placeholder="Secret Key" value={form.settlSecret} onChange={e => setForm({...form, settlSecret: e.target.value})} type="password" />
              <button className="btn btn-success btn-full" onClick={settleCell}>Claim Funds</button>
            </>
          )}
          {tab === "refund" && (
            <>
              <input className="input" placeholder="Cell ID" value={form.refundCellId} onChange={e => setForm({...form, refundCellId: e.target.value})} />
              <button className="btn btn-warning btn-full" onClick={refundCell}>Refund Expired</button>
            </>
          )}
        </div>

        {status && (
          <div className={`status-msg ${status.type}`} style={{ marginTop: 20 }}>
            <div className="status-row">
              {status.type === "loading" && <span className="spinner" />}
              <span>{status.msg}</span>
            </div>
            {status.cellId && (
              <div className="cell-id-display">
                <code>{status.cellId}</code>
                <button className="btn-copy" onClick={() => { navigator.clipboard.writeText(status.cellId); showToast("Copied!"); }}>📋</button>
              </div>
            )}
            {status.txHash && (
              <a href={`${explorer}/tx/${status.txHash}`} target="_blank" rel="noreferrer" className="tx-link">View Transaction ↗</a>
            )}
          </div>
        )}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

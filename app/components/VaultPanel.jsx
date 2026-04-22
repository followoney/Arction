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

  // Input validation
  function validateOpenCell() {
    if (!form.recipient || !form.recipient.startsWith("0x") || form.recipient.length !== 42) {
      setStatus({ type: "error", msg: "Please enter a valid recipient address (0x...)" });
      return false;
    }
    if (form.recipient.toLowerCase() === account.toLowerCase()) {
      setStatus({ type: "error", msg: "Cannot send to yourself." });
      return false;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setStatus({ type: "error", msg: "Please enter a valid USDC amount." });
      return false;
    }
    if (!form.secret || form.secret.length < 3) {
      setStatus({ type: "error", msg: "Secret key must be at least 3 characters." });
      return false;
    }
    return true;
  }

  function formatError(e) {
    let msg = e.reason || e.shortMessage || e.message || "Unknown error";
    // Strip long hex data
    msg = msg.replace(/\s*\(.*0x[a-fA-F0-9]{8,}.*\)/g, "");
    if (msg.includes("user rejected")) msg = "Transaction was rejected by user.";
    if (msg.includes("insufficient funds")) msg = "Insufficient USDC balance.";
    if (msg.includes("CellNotExpired")) msg = "Cell has not expired yet. Wait for TTL to pass before refunding.";
    if (msg.includes("CellNotFound")) msg = "Cell not found or already settled/refunded.";
    if (msg.includes("InvalidSecret")) msg = "Invalid secret key. Please check and try again.";
    if (msg.includes("CellExpired")) msg = "Cell has expired. It can only be refunded now.";
    if (msg.includes("UnauthorizedCaller")) msg = "You are not authorized for this action.";
    return msg;
  }

  const setTxActive = useCallback((active) => {
    if (onTxStateChange) onTxStateChange(active);
  }, [onTxStateChange]);

  async function openCell() {
    if (!validateOpenCell()) return;
    setTxActive(true);
    setStatus({ type: "loading", msg: "Preparing transaction…" });
    try {
      const provider = getProvider();
      const signer = await provider.getSigner();
      const usdc = new ethers.Contract(ADDRESSES.usdc, USDC_ABI, signer);
      const vault = new ethers.Contract(ADDRESSES.cellularVault, CELLULAR_VAULT_ABI, signer);

      const amount = ethers.parseUnits(form.amount, 6);

      const tx = {
        from: account, to: form.recipient,
        amount: form.amount, token: "USDC",
        chainId: 5042002, nonce: Date.now()
      };
      const { fingerprint } = computeSimhash(tx);
      const fp64 = fingerprintToUint64(fingerprint);
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes(form.secret));
      const nonce = BigInt(Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000000));

      setStatus({ type: "loading", msg: "Step 1/2 — Approving USDC transfer…" });
      const currentAllowance = await usdc.allowance(account, ADDRESSES.cellularVault);

      if (currentAllowance < amount) {
        const approveTx = await usdc.approve(ADDRESSES.cellularVault, amount);
        await approveTx.wait();
      }

      setStatus({ type: "loading", msg: "Step 2/2 — Opening cellular vault…" });
      const openTx = await vault.openCell(
        form.recipient, amount, secretHash,
        BigInt(form.ttl), BigInt(fp64), [], nonce,
        { gasLimit: 500000 }
      );
      const receipt = await openTx.wait();

      // Properly parse CellOpened event
      let cellId = null;
      try {
        const iface = new ethers.Interface(CELLULAR_VAULT_ABI);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            if (parsed && parsed.name === "CellOpened") {
              cellId = parsed.args[0]; // cellId is first indexed param
              break;
            }
          } catch { /* skip non-matching logs */ }
        }
      } catch { /* fallback */ }

      if (!cellId) {
        // Fallback: try raw topic
        const event = receipt.logs.find(log =>
          log.address.toLowerCase() === ADDRESSES.cellularVault.toLowerCase()
        );
        cellId = event?.topics?.[1] ?? null;
      }

      setStatus({
        type: "success",
        msg: `Cell opened successfully! ${form.amount} USDC locked.`,
        cellId: cellId,
        txHash: receipt.hash,
      });
    } catch (e) {
      console.error("DApp Error:", e);
      setStatus({ type: "error", msg: formatError(e) });
    } finally {
      setTxActive(false);
    }
  }

  async function settleCell() {
    if (!form.cellId || !form.cellId.startsWith("0x")) {
      setStatus({ type: "error", msg: "Please enter a valid Cell ID (0x...)" });
      return;
    }
    if (!form.settlSecret || form.settlSecret.length < 3) {
      setStatus({ type: "error", msg: "Please enter the secret key used when opening the cell." });
      return;
    }
    setTxActive(true);
    setStatus({ type: "loading", msg: "Settling cell — verifying secret…" });
    try {
      const signer = await getProvider().getSigner();
      const vault = new ethers.Contract(ADDRESSES.cellularVault, CELLULAR_VAULT_ABI, signer);
      const tx = await vault.settleCell(form.cellId, form.settlSecret);
      const receipt = await tx.wait();
      setStatus({ type: "success", msg: "Settlement complete! Funds released to recipient.", txHash: receipt.hash });
    } catch (e) {
      setStatus({ type: "error", msg: formatError(e) });
    } finally {
      setTxActive(false);
    }
  }

  async function refundCell() {
    if (!form.refundCellId || !form.refundCellId.startsWith("0x")) {
      setStatus({ type: "error", msg: "Please enter a valid Cell ID (0x...)" });
      return;
    }
    setTxActive(true);
    setStatus({ type: "loading", msg: "Processing refund…" });
    try {
      const signer = await getProvider().getSigner();
      const vault = new ethers.Contract(ADDRESSES.cellularVault, CELLULAR_VAULT_ABI, signer);
      const tx = await vault.refundCell(form.refundCellId);
      const receipt = await tx.wait();
      setStatus({ type: "success", msg: "Refund complete! USDC returned to depositor.", txHash: receipt.hash });
    } catch (e) {
      setStatus({ type: "error", msg: formatError(e) });
    } finally {
      setTxActive(false);
    }
  }

  const tabs = [
    { key: "open", label: "Send", icon: "↑", cls: "" },
    { key: "settle", label: "Claim", icon: "↓", cls: "tab-settle" },
    { key: "refund", label: "Refund", icon: "↩", cls: "tab-refund" },
  ];

  return (
    <>
      <div className="vault-panel glow-card">
        <div className="panel-header">
          <span className="panel-dot" />
          <h3 className="panel-title">CellularVault</h3>
        </div>

        <div className="tabs">
          {tabs.map(({ key, label, icon, cls }) => (
            <button
              key={key}
              className={`tab ${cls} ${tab === key ? "active" : ""}`}
              onClick={() => { setTab(key); setStatus(null); }}
            >
              <span style={{ marginRight: 6 }}>{icon}</span>{label}
            </button>
          ))}
        </div>

        {tab === "open" && (
          <div className="form-group">
            <div>
              <label className="input-label">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                Recipient Address
              </label>
              <input className="input" placeholder="0x…" value={form.recipient}
                onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
            </div>
            <div>
              <label className="input-label">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>
                USDC Amount
              </label>
              <input className="input" placeholder="e.g. 10" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} type="number" min="0" step="0.01" />
            </div>
            <div>
              <label className="input-label">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                Secret Key
              </label>
              <input className="input" placeholder="Enter a secret passphrase" value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })} type="password" />
            </div>
            <div>
              <label className="input-label">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>
                TTL (seconds)
              </label>
              <input className="input" placeholder="3600" value={form.ttl}
                onChange={(e) => setForm({ ...form, ttl: e.target.value || "3600" })} type="number" min="60" />
            </div>
            <button className="btn btn-primary btn-full" onClick={openCell}
              disabled={!form.recipient || !form.amount || !form.secret}>
              Send & Lock USDC
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
              <input className="input" placeholder="Enter the secret used by sender" value={form.settlSecret}
                onChange={(e) => setForm({ ...form, settlSecret: e.target.value })} type="password" />
            </div>
            <button className="btn btn-success btn-full" onClick={settleCell}
              disabled={!form.cellId || !form.settlSecret}>
              Claim Funds
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
            <p className="form-hint">
              ⏳ Refunds are only available after the cell&apos;s TTL has expired. If you set a 3600s TTL, you must wait 1 hour from creation before refunding.
            </p>
            <button className="btn btn-warning btn-full" onClick={refundCell}
              disabled={!form.refundCellId}>
              Refund Expired Cell
            </button>
          </div>
        )}

        {status && (
          <div className={`status-msg ${status.type}`} style={{ marginTop: 20 }}>
            <div className="status-row">
              {status.type === "loading" && <span className="spinner" />}
              {status.type === "success" && <span>✓</span>}
              {status.type === "error" && <span>✕</span>}
              <span>{status.msg}</span>
            </div>
            {status.cellId && (
              <div className="cell-id-display">
                <span className="label">CELL ID</span>
                <code className="value">{status.cellId}</code>
                <button className="btn-copy" onClick={() => {
                  navigator.clipboard.writeText(status.cellId);
                  showToast("Cell ID copied!");
                }}>📋</button>
              </div>
            )}
            {status.txHash && (
              <a href={`${explorer}/tx/${status.txHash}`} target="_blank" rel="noreferrer" className="tx-link">
                View on Explorer ↗
              </a>
            )}
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

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

  function formatError(e, context = "general") {
    if (e.data && e.data !== "0x") {
      try {
        const iface = new ethers.Interface(CELLULAR_VAULT_ABI);
        const decoded = iface.parseError(e.data);
        if (decoded) {
          const errorMap = {
            "CellAlreadyExists": "A cell with this ID already exists.",
            "CellNotFound": "Cell not found or already settled/refunded.",
            "CellExpired": "Cell has expired.",
            "CellNotExpired": "Cell has not expired yet.",
            "InvalidSecret": "Invalid secret key.",
            "InsufficientAmount": "Amount must be greater than zero.",
            "UnauthorizedCaller": "Unauthorized action.",
            "TriSyncIncomplete": "TriSync verification incomplete.",
          };
          return errorMap[decoded.name] || `Contract error: ${decoded.name}`;
        }
      } catch { }
    }

    let msg = e.reason || e.shortMessage || e.message || "Unknown error";
    msg = msg.replace(/\s*\(.*0x[a-fA-F0-9]{8,}.*\)/g, "");
    
    if (msg.includes("user rejected")) return "Transaction was rejected by user.";
    if (msg.includes("insufficient funds")) return "Insufficient balance or gas.";
    if (msg.includes("TriSync: Rejected")) return "TriSync Spam Filter: Transaction rejected as duplicate or spam.";
    
    if (msg.includes("missing revert data")) {
        return `Transaction reverted. Possible reasons: Insufficient USDC, wrong decimals, or TriSync filter rejection.`;
    }
    return msg;
  }

  const setTxActive = useCallback((active) => {
    if (onTxStateChange) onTxStateChange(active);
  }, [onTxStateChange]);

  async function openCell() {
    if (!validateOpenCell()) return;
    setTxActive(true);
    setStatus({ type: "loading", msg: "Analyzing network parameters…" });
    try {
      const provider = getProvider();
      const signer = await provider.getSigner();
      const usdc = new ethers.Contract(ADDRESSES.usdc, USDC_ABI, signer);
      const vault = new ethers.Contract(ADDRESSES.cellularVault, CELLULAR_VAULT_ABI, signer);

      // 1. Check Decimals & Balance
      setStatus({ type: "loading", msg: "Checking USDC balance and decimals…" });
      let decimals = 6;
      try {
        decimals = await usdc.decimals();
      } catch (err) {
        console.warn("Could not fetch decimals, using default 6");
      }
      
      const balance = await usdc.balanceOf(account);
      const amount = ethers.parseUnits(form.amount, decimals);

      if (balance < amount) {
        setStatus({ 
            type: "error", 
            msg: `Insufficient USDC. Your balance: ${ethers.formatUnits(balance, decimals)} USDC (Detected ${decimals} decimals).` 
        });
        setTxActive(false);
        return;
      }

      // 2. Simhash (TriSync)
      const txData = {
        from: account, to: form.recipient,
        amount: form.amount, token: "USDC",
        chainId: 5042002, nonce: Date.now()
      };
      const { fingerprint } = computeSimhash(txData);
      const fp64 = fingerprintToUint64(fingerprint);
      const secretHash = ethers.keccak256(ethers.encodeBytes32String(form.secret));
      const nonce = BigInt(Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000000));

      // 3. Allowance
      setStatus({ type: "loading", msg: "Checking allowance…" });
      const currentAllowance = await usdc.allowance(account, ADDRESSES.cellularVault);
      if (currentAllowance < amount) {
        setStatus({ type: "loading", msg: "Approving USDC (1/2)…" });
        const approveTx = await usdc.approve(ADDRESSES.cellularVault, amount);
        await approveTx.wait();
      }

      // 4. Open Cell
      setStatus({ type: "loading", msg: "Opening cellular vault (2/2)…" });
      const openTx = await vault.openCell(
        form.recipient, amount, secretHash,
        BigInt(form.ttl), BigInt(fp64), [], nonce,
        { gasLimit: 1000000 } // Safety gas limit
      );
      setStatus({ type: "loading", msg: "Awaiting finality…" });
      const receipt = await openTx.wait();

      let cellId = null;
      try {
        const iface = new ethers.Interface(CELLULAR_VAULT_ABI);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            if (parsed && parsed.name === "CellOpened") {
              cellId = parsed.args[0];
              break;
            }
          } catch { }
        }
      } catch { }

      if (!cellId) {
        const event = receipt.logs.find(log =>
          log.address.toLowerCase() === ADDRESSES.cellularVault.toLowerCase()
        );
        cellId = event?.topics?.[1] ?? null;
      }

      setStatus({
        type: "success",
        msg: `Sent ${form.amount} USDC (Precision: ${decimals}).`,
        cellId: cellId,
        txHash: receipt.hash,
      });
    } catch (e) {
      console.error("DApp Error:", e);
      setStatus({ type: "error", msg: formatError(e, "open") });
    } finally {
      setTxActive(false);
    }
  }

  async function settleCell() {
    if (!form.cellId) return;
    setTxActive(true);
    setStatus({ type: "loading", msg: "Claiming funds…" });
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
    setStatus({ type: "loading", msg: "Refunding…" });
    try {
      const signer = await getProvider().getSigner();
      const vault = new ethers.Contract(ADDRESSES.cellularVault, CELLULAR_VAULT_ABI, signer);
      const tx = await vault.refundCell(form.refundCellId.trim(), { gasLimit: 500000 });
      const receipt = await tx.wait();
      setStatus({ type: "success", msg: "Refunded successfully!", txHash: receipt.hash });
    } catch (e) {
      setStatus({ type: "error", msg: formatError(e, "refund") });
    } finally {
      setTxActive(false);
    }
  }

  const tabs = [
    { key: "open", label: "Send", icon: "↑" },
    { key: "settle", label: "Claim", icon: "↓" },
    { key: "refund", label: "Refund", icon: "↩" },
  ];

  return (
    <>
      <div className="vault-panel glow-card">
        <div className="panel-header">
          <span className="panel-dot" />
          <h3 className="panel-title">CellularVault</h3>
        </div>

        <div className="tabs">
          {tabs.map(({ key, label, icon }) => (
            <button
              key={key}
              className={`tab ${tab === key ? "active" : ""}`}
              onClick={() => { setTab(key); setStatus(null); }}
            >
              <span style={{ marginRight: 6 }}>{icon}</span>{label}
            </button>
          ))}
        </div>

        {tab === "open" && (
          <div className="form-group">
            <input className="input" placeholder="Recipient 0x…" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
            <input className="input" placeholder="Amount USDC" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} type="number" />
            <input className="input" placeholder="Secret Key" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} type="password" />
            <input className="input" placeholder="TTL (sec)" value={form.ttl} onChange={(e) => setForm({ ...form, ttl: e.target.value })} type="number" />
            <button className="btn btn-primary btn-full" onClick={openCell} disabled={!form.recipient || !form.amount || !form.secret}>Send &amp; Lock</button>
          </div>
        )}

        {tab === "settle" && (
          <div className="form-group">
            <input className="input" placeholder="Cell ID" value={form.cellId} onChange={(e) => setForm({ ...form, cellId: e.target.value })} />
            <input className="input" placeholder="Secret Key" value={form.settlSecret} onChange={(e) => setForm({ ...form, settlSecret: e.target.value })} type="password" />
            <button className="btn btn-success btn-full" onClick={settleCell} disabled={!form.cellId || !form.settlSecret}>Claim Funds</button>
          </div>
        )}

        {tab === "refund" && (
          <div className="form-group">
            <input className="input" placeholder="Cell ID" value={form.refundCellId} onChange={(e) => setForm({ ...form, refundCellId: e.target.value })} />
            <button className="btn btn-warning btn-full" onClick={refundCell} disabled={!form.refundCellId}>Refund Expired</button>
          </div>
        )}

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

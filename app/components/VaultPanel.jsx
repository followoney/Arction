"use client";
import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { ADDRESSES, CELLULAR_VAULT_ABI, USDC_ABI } from "@/lib/contracts";
import { computeSimhash, fingerprintToUint64 } from "@/lib/simhash";

const VAULT = "0x35eF6b0CF36ec0aE213F23FB40Ceb1A79f23B376";
const USDC  = "0x3600000000000000000000000000000000000000";
const GAS   = { gasLimit: 1500000 };

export default function VaultPanel({ account, onTxStateChange }) {
  const [tab, setTab] = useState("open");
  const [form, setForm] = useState({
    recipient:"", amount:"", secret:"", ttl:"3600",
    cellId:"", settlSecret:"",
    refundCellId:"",
  });
  const [status, setStatus] = useState(null);
  const [toast, setToast] = useState(null);
  const explorer = process.env.NEXT_PUBLIC_ARC_EXPLORER ?? "https://testnet.arcscan.app";

  function getProvider() {
    if (!window.ethereum) throw new Error("Wallet not found");
    return new ethers.BrowserProvider(window.ethereum);
  }

  // ── SEND ──────────────────────────────────────────────
  async function openCell() {
    if (!form.recipient || !form.amount || !form.secret) return;
    setStatus({ type:"loading", msg:"Connecting…" });
    try {
      const signer = await getProvider().getSigner();
      const usdc = new ethers.Contract(USDC, USDC_ABI, signer);
      const vault = new ethers.Contract(VAULT, CELLULAR_VAULT_ABI, signer);

      // Step 1: Detect decimals
      let dec = 18; // Arc Testnet USDC default (contract comment says 18)
      try { dec = Number(await usdc.decimals()); } catch { }
      setStatus({ type:"loading", msg:`Using ${dec} decimals…` });

      const amount = ethers.parseUnits(form.amount, dec);

      // Step 2: Check balance
      let bal;
      try { bal = await usdc.balanceOf(account); } catch { bal = amount + 1n; }
      if (bal < amount) {
        setStatus({ type:"error", msg:`Insufficient USDC. Have: ${ethers.formatUnits(bal,dec)}` });
        return;
      }

      // Step 3: Simhash (unique per call)
      const fp = computeSimhash({
        from: account, to: form.recipient,
        amount: form.amount, token: "USDC",
        chainId: "5042002",
        nonce: `${Date.now()}-${Math.random()}`
      });
      const fp64 = fingerprintToUint64(fp.fingerprint);
      const secretHash = ethers.keccak256(ethers.encodeBytes32String(form.secret));
      const nonce = BigInt(Date.now()) + BigInt(Math.floor(Math.random()*1e9));

      // Step 4: Approve (with gasLimit!)
      setStatus({ type:"loading", msg:"Approving USDC…" });
      try {
        const allowance = await usdc.allowance(account, VAULT);
        if (allowance < amount) {
          const tx = await usdc.approve(VAULT, ethers.MaxUint256, GAS);
          await tx.wait();
        }
      } catch(e) {
        setStatus({ type:"error", msg:`Approve failed: ${e.shortMessage||e.message}` });
        return;
      }

      // Step 5: Open Cell
      setStatus({ type:"loading", msg:"Opening vault…" });
      const openTx = await vault.openCell(
        form.recipient, amount, secretHash,
        BigInt(form.ttl), BigInt(fp64), [], nonce, GAS
      );
      setStatus({ type:"loading", msg:"Confirming…" });
      const receipt = await openTx.wait();

      // Parse cell ID
      let cellId = null;
      try {
        const iface = new ethers.Interface(CELLULAR_VAULT_ABI);
        for (const log of receipt.logs) {
          try {
            const p = iface.parseLog({topics:log.topics, data:log.data});
            if (p?.name === "CellOpened") { cellId = p.args[0]; break; }
          } catch {}
        }
      } catch {}
      if (!cellId) cellId = receipt.logs[0]?.topics?.[1];

      setStatus({ type:"success", msg:`Sent ${form.amount} USDC!`, cellId, txHash:receipt.hash });
    } catch(e) {
      console.error("Send error:", e);
      setStatus({ type:"error", msg: e.shortMessage || e.reason || e.message || "Send failed" });
    }
  }

  // ── CLAIM ─────────────────────────────────────────────
  async function settleCell() {
    if (!form.cellId || !form.settlSecret) return;
    setStatus({ type:"loading", msg:"Claiming…" });
    try {
      const signer = await getProvider().getSigner();
      const vault = new ethers.Contract(VAULT, CELLULAR_VAULT_ABI, signer);
      const secret = ethers.encodeBytes32String(form.settlSecret);
      const tx = await vault.settleCell(form.cellId.trim(), secret, GAS);
      setStatus({ type:"loading", msg:"Confirming…" });
      const r = await tx.wait();
      setStatus({ type:"success", msg:"Claimed!", txHash:r.hash });
    } catch(e) {
      console.error("Claim error:", e);
      setStatus({ type:"error", msg: e.shortMessage || e.reason || e.message || "Claim failed" });
    }
  }

  // ── REFUND ────────────────────────────────────────────
  async function refundCell() {
    if (!form.refundCellId) return;
    setStatus({ type:"loading", msg:"Refunding…" });
    try {
      const signer = await getProvider().getSigner();
      const vault = new ethers.Contract(VAULT, CELLULAR_VAULT_ABI, signer);
      const tx = await vault.refundCell(form.refundCellId.trim(), GAS);
      setStatus({ type:"loading", msg:"Confirming…" });
      const r = await tx.wait();
      setStatus({ type:"success", msg:"Refunded!", txHash:r.hash });
    } catch(e) {
      console.error("Refund error:", e);
      setStatus({ type:"error", msg: e.shortMessage || e.reason || e.message || "Refund failed" });
    }
  }

  return (
    <div className="vault-panel glow-card">
      <div className="panel-header"><span className="panel-dot"/><h3 className="panel-title">CellularVault</h3></div>
      <div className="tabs">
        {[{k:"open",l:"Send"},{k:"settle",l:"Claim"},{k:"refund",l:"Refund"}].map(({k,l})=>(
          <button key={k} className={`tab ${tab===k?"active":""}`} onClick={()=>{setTab(k);setStatus(null);}}>{l}</button>
        ))}
      </div>
      <div className="form-group">
        {tab==="open" && <>
          <label className="input-label">Recipient</label>
          <input className="input" placeholder="0x…" value={form.recipient} onChange={e=>setForm({...form,recipient:e.target.value})}/>
          <label className="input-label">Amount (USDC)</label>
          <input className="input" placeholder="3" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} type="number"/>
          <label className="input-label">Secret Key</label>
          <input className="input" placeholder="passphrase" value={form.secret} onChange={e=>setForm({...form,secret:e.target.value})} type="password"/>
          <button className="btn btn-primary btn-full" onClick={openCell}>Send &amp; Lock</button>
        </>}
        {tab==="settle" && <>
          <label className="input-label">Cell ID</label>
          <input className="input" placeholder="0x…" value={form.cellId} onChange={e=>setForm({...form,cellId:e.target.value})}/>
          <label className="input-label">Secret Key</label>
          <input className="input" placeholder="passphrase" value={form.settlSecret} onChange={e=>setForm({...form,settlSecret:e.target.value})} type="password"/>
          <button className="btn btn-success btn-full" onClick={settleCell}>Claim Funds</button>
        </>}
        {tab==="refund" && <>
          <label className="input-label">Cell ID</label>
          <input className="input" placeholder="0x…" value={form.refundCellId} onChange={e=>setForm({...form,refundCellId:e.target.value})}/>
          <button className="btn btn-warning btn-full" onClick={refundCell}>Refund Expired</button>
        </>}
      </div>
      {status && (
        <div className={`status-msg ${status.type}`} style={{marginTop:20}}>
          <div className="status-row">
            {status.type==="loading" && <span className="spinner"/>}
            <span>{status.msg}</span>
          </div>
          {status.cellId && <div className="cell-id-display">
            <code className="value">{status.cellId}</code>
            <button className="btn-copy" onClick={()=>{navigator.clipboard.writeText(status.cellId);setToast("Copied!")}}>📋</button>
          </div>}
          {status.txHash && <a href={`${explorer}/tx/${status.txHash}`} target="_blank" rel="noreferrer" className="tx-link">Explorer ↗</a>}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

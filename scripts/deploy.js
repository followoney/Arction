/**
 * scripts/deploy.js
 * Arc Testnet deployment script
 *
 * Usage: npm run deploy:testnet
 *
 * Prerequisites:
 *   1. DEPLOYER_PRIVATE_KEY defined in .env.local
 *   2. Wallet funded with Arc Testnet USDC (https://faucet.circle.com)
 *   3. NEXT_PUBLIC_USDC_ADDRESS set to verified Arc USDC address
 */

const { ethers } = require("hardhat");
require("dotenv").config({ path: ".env.local" });

const ARC_USDC = process.env.NEXT_PUBLIC_USDC_ADDRESS
  ?? "0x3600000000000000000000000000000000000000";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("\n❌ DEPLOYER_PRIVATE_KEY bulunamadı! Lütfen Arction klasörü içindeki .env.local dosyasını kontrol edin.");
  }
  const network = await ethers.provider.getNetwork();

  console.log("═══════════════════════════════════════════");
  console.log("   Arction — Arc Testnet Deployment        ");
  console.log("═══════════════════════════════════════════");
  console.log(`Network  : ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Deployer : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance  : ${ethers.formatUnits(balance, 18)} USDC`);
  if (balance === 0n) console.warn("⚠️  Balance is zero! → https://faucet.circle.com");

  // 1. SimhashChecker
  console.log("\n[1/2] Deploying SimhashChecker...");
  const SimhashChecker = await ethers.getContractFactory("SimhashChecker");
  const checker = await SimhashChecker.deploy();
  await checker.waitForDeployment();
  const checkerAddr = await checker.getAddress();
  console.log(`✅ SimhashChecker : ${checkerAddr}`);
  console.log(`   Explorer       : https://testnet.arcscan.app/address/${checkerAddr}`);

  // 2. CellularVault
  console.log("\n[2/2] Deploying CellularVault...");
  const CellularVault = await ethers.getContractFactory("CellularVault");
  const vault = await CellularVault.deploy(ARC_USDC, checkerAddr);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log(`✅ CellularVault  : ${vaultAddr}`);
  console.log(`   Explorer       : https://testnet.arcscan.app/address/${vaultAddr}`);

  // Summary
  console.log("\n═══════════════════════════════════════════");
  console.log("  Add these to .env.local and Vercel:");
  console.log("═══════════════════════════════════════════");
  console.log(`NEXT_PUBLIC_SIMHASH_CHECKER_ADDRESS=${checkerAddr}`);
  console.log(`NEXT_PUBLIC_CELLULAR_VAULT_ADDRESS=${vaultAddr}`);
}

main().catch((err) => { console.error(err); process.exit(1); });

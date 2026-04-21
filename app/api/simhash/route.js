/**
 * POST /api/simhash
 * Body: { transaction: { from, to, amount, token, chainId }, registry?: string[] }
 * Response: { fingerprint, hex, isSpam, distance, tokenCount }
 */

import { NextResponse } from "next/server";
import { computeSimhash, checkSpam } from "@/lib/simhash";

export async function POST(req) {
  try {
    const body = await req.json();
    const { transaction, registry = [] } = body;

    if (!transaction?.from || !transaction?.to) {
      return NextResponse.json(
        { error: "transaction.from and transaction.to are required" },
        { status: 400 }
      );
    }

    const { fingerprint, hex, tokenCount } = computeSimhash(transaction);

    const regBigInt = registry.map((r) => {
      try { return BigInt(r); }
      catch { return 0n; }
    });

    const spamResult = checkSpam(fingerprint, regBigInt);

    return NextResponse.json({
      fingerprint: fingerprint.toString(),
      hex,
      isSpam: spamResult.isSpam,
      distance: spamResult.distance,
      nearest: spamResult.nearest?.toString() ?? null,
      tokenCount,
      epsilon: 3,
    });
  } catch (err) {
    console.error("Simhash API error:", err);
    return NextResponse.json(
      { error: "Server error", detail: err.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/simhash",
    description: "Generates transaction fingerprint and performs spam detection",
    body: {
      transaction: "{ from, to, amount, token, chainId }",
      registry: "string[] — previous fingerprints (optional)",
    },
  });
}

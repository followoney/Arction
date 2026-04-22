import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Arction — Cellular Parallel Execution on Arc",
  description:
    "CellularVault USDC settlement with Simhash spam filtering. Sub-second finality on Arc Testnet.",
  openGraph: {
    title: "Arction",
    description: "Cellular parallel execution with atomic USDC settlement on Arc Testnet",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

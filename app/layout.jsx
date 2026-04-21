import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Arction — Corporate-Grade DApp on Arc",
  description:
    "Simhash spam filter + CellularVault parallel execution with USDC settlement on Arc Testnet. Sub-second finality, USDC-native gas.",
  openGraph: {
    title: "Arction",
    description: "Corporate-grade DApp on Arc — USDC settlement with sub-second finality",
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

import "./globals.css";

export const metadata = {
  title: "CryptoPulse",
  description: "Crypto analytics dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

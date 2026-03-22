import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { getSessionUserFromCookies, type SessionUser } from "@/lib/auth/access";
import "./globals.css";
import AppSwitchNav from "./_components/AppSwitchNav";
import ProtectedSessionClient from "./_components/ProtectedSessionClient";
import SiteFooter from "./_components/SiteFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VenMeBaby",
  description: "Secure product access for VMB operator workflows.",
};

/** Public pages still run the root layout; keep session resolution best-effort so a cookies/runtime edge case cannot brick the whole site. */
export const dynamic = "force-dynamic";

async function getCurrentSessionUser(): Promise<SessionUser> {
  try {
    const cookieStore = await cookies();
    return await getSessionUserFromCookies(cookieStore);
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessionUser = await getCurrentSessionUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <AppSwitchNav sessionUser={sessionUser} />
          <ProtectedSessionClient />
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}

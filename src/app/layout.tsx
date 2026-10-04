import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { RegisterPwa } from "@/components/pwa/register-pwa";
import { AppChrome } from "@/components/app-chrome";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { buildBrandingCssVars, getSchoolBrandingForSchool } from "@/lib/school-branding";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Schooliva | School operations, clearly managed",
  description: "The foundation for a secure, modular school management system.",
  applicationName: "Schooliva",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Schooliva",
  },
  icons: {
    icon: [
      { url: "/brand/landscape_logo.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/brand/landscape_logo.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f5b4e",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const activeSchoolContext = user ? await getActiveSchoolContext(supabase, user.id) : null;
  const brandingProfile = activeSchoolContext?.schoolId
    ? await getSchoolBrandingForSchool(supabase, activeSchoolContext.schoolId)
    : null;
  const brandingStyle = brandingProfile?.theme ? buildBrandingCssVars(brandingProfile.theme) : undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={brandingStyle}>
        <RegisterPwa />
        <AppChrome schoolLogoUrl={brandingProfile?.logoUrl ?? null}>{children}</AppChrome>
      </body>
    </html>
  );
}

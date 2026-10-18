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
      { url: "/brand/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/brand/app-icon-192.png", sizes: "192x192", type: "image/png" },
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
  const [brandingProfile, { data: headerProfile }] = await Promise.all([
    activeSchoolContext?.schoolId
      ? getSchoolBrandingForSchool(supabase, activeSchoolContext.schoolId)
      : Promise.resolve(null),
    user
      ? supabase.from("profiles").select("full_name,avatar_path").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const { data: roleAssignments } = user && activeSchoolContext?.schoolId
    ? await supabase.from("user_roles").select("roles!inner(slug)").eq("user_id", user.id).eq("school_id", activeSchoolContext.schoolId)
    : { data: [] };
  const canAccessSupport = (roleAssignments ?? []).some((assignment) => {
    const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
    return role && typeof role === "object" && "slug" in role && ["school_admin", "principal"].includes(String(role.slug));
  });
  const brandingStyle = brandingProfile?.theme ? buildBrandingCssVars(brandingProfile.theme) : undefined;
  const { data: userAvatar } = user && headerProfile?.avatar_path
    ? await supabase.storage.from("profile-avatars").createSignedUrl(headerProfile.avatar_path, 60 * 60)
    : { data: null };

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={brandingStyle}>
        <RegisterPwa />
        <AppChrome
          schoolLogoUrl={brandingProfile?.logoUrl ?? null}
          userName={headerProfile?.full_name ?? user?.email ?? "Schooliva user"}
          userAvatarUrl={userAvatar?.signedUrl ?? null}
          schoolName={activeSchoolContext?.schoolName ?? null}
          canAccessSupport={canAccessSupport}
        >
          {children}
        </AppChrome>
      </body>
    </html>
  );
}

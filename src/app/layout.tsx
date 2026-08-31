import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWAProvider from "@/components/PWAProvider";
import CookieBanner from "@/components/CookieBanner";
import { FeedbackButton } from "@/components/FeedbackButton";
import { Analytics } from "@vercel/analytics/react";
import { ThemeProvider, type ThemePreference } from "@/components/ThemeProvider";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "TrainAI - Planos de Treino com IA",
  description: "Plataforma de treino personalizado para corredores e triatletas com inteligência artificial",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TrainAI",
    startupImage: "/api/icon/512",
  },
  icons: {
    apple: "/api/icon/192",
    icon: "/api/icon/192",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#22c55e",
};

// "system" means nobody has chosen yet: the server cannot know the device's
// preference, so it leaves data-theme unset and the inline script below resolves
// it before the first paint.
async function getInitialTheme(): Promise<ThemePreference> {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;
    const themeCookie = cookieStore.get('trainai_theme')?.value as ThemePreference | undefined;

    if (!userId) return themeCookie || 'system';

    const athlete = await prisma.athlete.findUnique({
      where: { userId },
      select: { theme: true },
    });

    const dbTheme = athlete?.theme as ThemePreference | undefined;
    return dbTheme || themeCookie || 'system';
  } catch {
    return 'system';
  }
}

// Runs before paint. Only acts when the server left the choice open, so an
// explicit preference is never second-guessed.
const THEME_SCRIPT = `(function(){try{var e=document.documentElement,c=e.getAttribute('data-theme');if(!c||c==='system'){e.setAttribute('data-theme',window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}}catch(_){}})()`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialTheme = await getInitialTheme();
  
  return (
    <html lang="pt" {...(initialTheme !== 'system' && { 'data-theme': initialTheme })}>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <ThemeProvider initialTheme={initialTheme}>
          <PWAProvider>
            {children}
            <CookieBanner />
            <FeedbackButton />
          </PWAProvider>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}

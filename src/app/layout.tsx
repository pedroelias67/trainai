import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWAInstall from "@/components/PWAInstall";
import { ThemeProvider } from "@/components/ThemeProvider";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "TrainAI - Planos de Treino com IA",
  description: "Plataforma de treino personalizado para corredores e triatletas com inteligência artificial",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TrainAI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#22c55e",
};

async function getInitialTheme(): Promise<'dark' | 'dim' | 'light'> {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;
    const themeCookie = cookieStore.get('trainai_theme')?.value as 'dark' | 'dim' | 'light' | undefined;
    
    // If no user logged in, use cookie or default
    if (!userId) return themeCookie || 'dark';
    
    const athlete = await prisma.athlete.findUnique({
      where: { userId },
      select: { theme: true },
    });
    
    const dbTheme = athlete?.theme as 'dark' | 'dim' | 'light' | undefined;
    return dbTheme || themeCookie || 'dark';
  } catch {
    return 'dark';
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialTheme = await getInitialTheme();
  
  return (
    <html lang="pt" data-theme={initialTheme}>
      <body className="antialiased">
        <ThemeProvider initialTheme={initialTheme}>
          {children}
          <PWAInstall />
        </ThemeProvider>
      </body>
    </html>
  );
}

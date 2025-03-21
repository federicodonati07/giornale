import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Inter, Merriweather } from 'next/font/google'
import { Montserrat } from 'next/font/google'
import ScheduledArticlesChecker from "./components/ScheduledArticlesChecker"

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const merriweather = Merriweather({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-merriweather',
})

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  title: "STEELE NEWS",
  description: "Il portale di notizie di STEELE NEWS",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${GeistSans.variable} ${GeistMono.variable} ${inter.variable} ${merriweather.variable} ${montserrat.variable} antialiased dark`}>
      <head>
        <meta name="theme-color" content="#27272a" />
      </head>
      <body className="bg-zinc-900">
        <ScheduledArticlesChecker />
        {children}
      </body>
    </html>
  );
}

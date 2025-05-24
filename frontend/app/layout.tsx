import type React from "react"
import type { Metadata } from "next/types"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/next"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Research Hub",
  description: "Explore academic communities and research categories",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <div className="relative min-h-screen overflow-hidden bg-background">
            <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">{children}</div>
          </div>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

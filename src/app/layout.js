import { Cormorant_Garamond, Inter } from 'next/font/google'
import './globals.css'
import { BRAND } from '@/lib/brandUi'
import { Toaster } from 'sonner'
import { Providers } from './providers'
import { UserProvider } from '@/context/UserContext'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-serif',
})

export const metadata = {
  title: BRAND.lockup,
  description: "Human-led growth execution powered by your Brand Intelligence Layer",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${cormorant.variable} font-sans`}>
        <Providers>
          <UserProvider>
            <Toaster position="bottom-right" />
            {children}
          </UserProvider>
        </Providers>
      </body>
    </html>
  )
}

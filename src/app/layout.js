import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { Providers } from './providers'
import { UserProvider } from '@/context/UserContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: "ClarWiz",
  description: "Intelligent Outreach Campaign Engine for B2B",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
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

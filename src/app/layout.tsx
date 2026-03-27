import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SMalshi | St. Marks Prediction Market',
  description: 'The premier prediction market for St. Marks students.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-mono bg-[#f4f0e6] text-[#1a1a1a] antialiased">
        {children}
      </body>
    </html>
  )
}

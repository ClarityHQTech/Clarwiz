'use client'

import { ChakraProvider, ColorModeScript, theme } from '@chakra-ui/react';
import { SessionProvider } from "next-auth/react"

export function Providers({ children }) {
  return (
    <SessionProvider>
      <ChakraProvider theme={theme}>
        <ColorModeScript />
        {children}
      </ChakraProvider>
    </SessionProvider>
  )
}

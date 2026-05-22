'use client'

import { ChakraProvider, ColorModeScript, theme } from '@chakra-ui/react';
import { SessionProvider } from "next-auth/react"
import { useEffect } from 'react';


export function Providers({ children }) {
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7471/ingest/39c2ddfe-8c91-4319-a2ec-db88511e5558',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c79a5f'},body:JSON.stringify({sessionId:'c79a5f',runId:'initial',hypothesisId:'H1',location:'src/app/providers.js:9',message:'Providers mounted',data:{hasTheme:!!theme,themeConfig:theme?.config || null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, []);

  return (
    <SessionProvider>
      <ChakraProvider theme={theme}>
        <ColorModeScript />
        {children}
      </ChakraProvider>
    </SessionProvider>
  )
}
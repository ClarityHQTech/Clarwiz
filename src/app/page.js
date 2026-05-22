'use client'
import AppLayout from '@/components/layout/AppLayout'
import React from 'react'

const page = () => {
  return (
    <div>
      <h1>Hello World</h1>
    </div>
  )
}

export default AppLayout()(page);
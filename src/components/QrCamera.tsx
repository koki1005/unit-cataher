'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

type Props = {
  onDetected: (url: string) => void
}

export default function QrCamera({ onDetected }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isStartedRef = useRef(false)
  const onDetectedRef = useRef(onDetected)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  // Suppress AbortError from browser when video element is removed while playing
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      if (e.reason?.name === 'AbortError') e.preventDefault()
    }
    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [])

  useEffect(() => {
    const id = 'qr-reader-' + Math.random().toString(36).slice(2)
    if (!containerRef.current) return
    containerRef.current.id = id

    const scanner = new Html5Qrcode(id)
    scannerRef.current = scanner
    let cancelled = false

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        if (!isStartedRef.current) return
        isStartedRef.current = false
        scanner.stop().catch(() => {})
        onDetectedRef.current(decodedText)
      },
      undefined
    ).then(() => {
      if (cancelled) {
        scanner.stop().catch(() => {})
      } else {
        isStartedRef.current = true
      }
    }).catch(() => {
      setError('カメラのアクセスが拒否されました')
    })

    return () => {
      cancelled = true
      if (isStartedRef.current) {
        isStartedRef.current = false
        scanner.stop().catch(() => {})
      }
    }
  }, []) // onDetected を依存から外し、refで参照

  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-destructive text-sm text-center">{error}</p>
      ) : (
        <p className="text-muted-foreground text-sm text-center">QRコードをカメラに向けてください</p>
      )}
      <div ref={containerRef} className="w-full rounded-xl overflow-hidden" />
    </div>
  )
}

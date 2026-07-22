'use client'

import React from 'react'

interface BlogIntroProps {
  title?: string
  duration?: number
}

/**
 * Cinematic Blog Intro - Minimal Version for Debugging
 */
function BlogIntro({ title = "Loading...", duration = 4000 }: BlogIntroProps) {
  const [visible, setVisible] = React.useState(true)
  const [fading, setFading] = React.useState(false)
  const [step, setStep] = React.useState(0)
  const [isMounted, setIsMounted] = React.useState(false)

  const words = React.useMemo(() => title.split(' '), [title])

  // Mark component as mounted (client-side only)
  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  // Animate words sequentially after mount
  React.useEffect(() => {
    if (!isMounted || !visible) return
    const timers = words.map((_, i) =>
      setTimeout(() => setStep(prev => prev + 1), 300 + i * 100)
    )
    return () => timers.forEach(clearTimeout)
  }, [isMounted, visible, words])

  // Auto-dismiss after duration
  React.useEffect(() => {
    if (!isMounted || !visible) return
    const timer = setTimeout(() => {
      setFading(true)
      setTimeout(() => setVisible(false), 800)
    }, duration)
    return () => clearTimeout(timer)
  }, [isMounted, visible, duration])

  const handleSkip = React.useCallback(() => {
    setFading(true)
    setTimeout(() => setVisible(false), 800)
  }, [])

  // Generate particles deterministically
  const particles = React.useMemo(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i,
      left: `${(i * 37) % 100}%`,
      top: `${(i * 53) % 100}%`,
      size: 2 + (i % 3),
      delay: (i * 0.3) % 5,
      dur: 3 + (i % 4),
    })), []
  )

  // Don't render until mounted on client
  if (!isMounted) return null
  if (!visible) return null

  return (
    <div
      id="blog-intro-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
        zIndex: 99999,
        opacity: fading ? 0 : 1,
        transition: 'opacity 800ms ease-out',
        pointerEvents: fading ? 'none' : 'auto',
        overflow: 'hidden',
      }}
    >
      {/* Aurora Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 50% at 20% 40%, rgba(30, 64, 175, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 60%, rgba(88, 28, 135, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse 100% 80% at 50% 100%, rgba(6, 78, 59, 0.1) 0%, transparent 40%)
          `,
        }}
      />

      {/* Floating Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            animation: `particleFloat ${p.dur}s ease-in-out infinite ${p.delay}s`,
          }}
        />
      ))}

      {/* Grid Pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.5) 100%)',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingLeft: 'clamp(2rem, 8vw, 6rem)',
          paddingRight: '2rem',
          maxWidth: '75%',
          zIndex: 10,
        }}
      >
        {/* Decorative Line */}
        <div
          style={{
            width: step > 0 ? 60 : 0,
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.3)',
            marginBottom: 24,
            transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />

        {/* Subtitle */}
        <p
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: 'clamp(0.65rem, 1.5vw, 0.8rem)',
            fontFamily: 'ui-monospace, monospace',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            marginBottom: 16,
            marginTop: 0,
            opacity: step > 0 ? 1 : 0,
            transform: step > 0 ? 'translateY(0)' : 'translateY(15px)',
            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          ◈ Loading Article
        </p>

        {/* Title */}
        <h1
          style={{
            color: 'white',
            fontSize: 'clamp(1.5rem, 4vw, 3rem)',
            fontFamily: 'Georgia, serif',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {words.map((word, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: '0.25em',
                opacity: step > i ? 1 : 0,
                transform: step > i ? 'translateX(0)' : 'translateX(40px)',
                filter: step > i ? 'blur(0px)' : 'blur(4px)',
                transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.04}s`,
              }}
            >
              {word}
            </span>
          ))}
        </h1>

        {/* Progress Bar */}
        <div
          style={{
            marginTop: 40,
            width: 'clamp(150px, 20vw, 250px)',
            opacity: step > 0 ? 1 : 0,
            transition: 'opacity 0.8s ease 0.3s',
          }}
        >
          <div
            style={{
              height: 2,
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.3))',
                animation: `progressFill ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
              }}
            />
          </div>
          <p
            style={{
              color: 'rgba(255,255,255,0.3)',
              fontSize: '0.65rem',
              fontFamily: 'ui-monospace, monospace',
              marginTop: 8,
              marginBottom: 0,
              letterSpacing: '0.1em',
            }}
          >
            PREPARING CONTENT
          </p>
        </div>
      </div>

      {/* Skip Button */}
      <button
        onClick={handleSkip}
        style={{
          position: 'absolute',
          bottom: 'clamp(1.5rem, 4vh, 2.5rem)',
          right: 'clamp(1.5rem, 4vw, 2.5rem)',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '0.7rem',
          fontFamily: 'ui-monospace, monospace',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          padding: '10px 20px',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 100,
          background: 'rgba(255,255,255,0.03)',
          cursor: 'pointer',
          zIndex: 20,
          opacity: step > 0 && !fading ? 1 : 0,
          transition: 'all 0.4s ease',
        }}
      >
        Skip →
      </button>

      {/* CSS Keyframes */}
      <style>{`
        @keyframes particleFloat {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.25; }
          50% { transform: translateY(-15px) translateX(8px); opacity: 0.5; }
        }
        @keyframes progressFill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  )
}

export { BlogIntro }
export default BlogIntro

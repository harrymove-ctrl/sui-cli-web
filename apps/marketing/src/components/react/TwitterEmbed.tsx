import { useEffect, useRef, useState } from 'react';

interface TwitterEmbedProps {
  /** Tweet URL or ID */
  tweetUrl: string;
  /** Theme: dark or light */
  theme?: 'dark' | 'light';
  /** Watermark text */
  watermark?: string;
  /** Maximum tilt angle */
  maxTilt?: number;
}

declare global {
  interface Window {
    twttr?: {
      widgets: {
        createTweet: (
          tweetId: string,
          container: HTMLElement,
          options?: Record<string, unknown>
        ) => Promise<HTMLElement | undefined>;
      };
      ready: (callback: () => void) => void;
    };
  }
}

/**
 * TwitterEmbed - Embeds a Twitter/X post with 3D tilt effect
 */
export function TwitterEmbed({
  tweetUrl,
  theme = 'dark',
  watermark = 'cli.firstmovers.io',
  maxTilt = 12,
}: TwitterEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tweetContainerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [tiltStyle, setTiltStyle] = useState({ rotateX: 0, rotateY: 0, scale: 1 });
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const mountedRef = useRef(true);

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    );
  }, []);

  // Extract tweet ID from URL
  const getTweetId = (url: string): string => {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : url;
  };

  // 3D Tilt effect
  useEffect(() => {
    const container = containerRef.current;
    if (!container || isTouchDevice) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateY = ((x - centerX) / centerX) * maxTilt;
      const rotateX = ((centerY - y) / centerY) * maxTilt;
      setTiltStyle({ rotateX, rotateY, scale: 1.02 });
    };

    const handleMouseLeave = () => {
      setTiltStyle({ rotateX: 0, rotateY: 0, scale: 1 });
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [maxTilt, isTouchDevice]);

  // Preload Twitter script as early as possible
  useEffect(() => {
    // Add preload link hint immediately
    if (!document.querySelector('link[href*="platform.twitter.com/widgets.js"]')) {
      const preloadLink = document.createElement('link');
      preloadLink.rel = 'preload';
      preloadLink.as = 'script';
      preloadLink.href = 'https://platform.twitter.com/widgets.js';
      document.head.appendChild(preloadLink);
    }
  }, []);

  // Load Twitter embed
  useEffect(() => {
    mountedRef.current = true;
    const tweetId = getTweetId(tweetUrl);

    const loadTwitterScript = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (window.twttr?.widgets) {
          resolve();
          return;
        }

        const existingScript = document.querySelector('script[src*="platform.twitter.com/widgets.js"]');
        if (existingScript) {
          const checkReady = setInterval(() => {
            if (window.twttr?.widgets) {
              clearInterval(checkReady);
              resolve();
            }
          }, 50); // Faster polling (50ms instead of 100ms)
          setTimeout(() => {
            clearInterval(checkReady);
            reject(new Error('Twitter script timeout'));
          }, 15000); // Longer timeout for slow connections
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        script.charset = 'utf-8';
        script.onload = () => {
          if (window.twttr?.ready) {
            window.twttr.ready(() => resolve());
          } else {
            resolve();
          }
        };
        script.onerror = () => reject(new Error('Failed to load Twitter script'));
        document.head.appendChild(script);
      });
    };

    const embedTweet = async () => {
      const tweetContainer = tweetContainerRef.current;
      if (!tweetContainer || !mountedRef.current) return;

      try {
        await loadTwitterScript();
        if (!mountedRef.current) return;

        while (tweetContainer.firstChild) {
          tweetContainer.removeChild(tweetContainer.firstChild);
        }

        if (window.twttr?.widgets) {
          const result = await window.twttr.widgets.createTweet(tweetId, tweetContainer, {
            theme,
            conversation: 'none',
            dnt: true,
          });

          if (mountedRef.current) {
            setStatus(result ? 'loaded' : 'error');
          }
        }
      } catch (error) {
        console.error('Error embedding tweet:', error);
        if (mountedRef.current) {
          setStatus('error');
        }
      }
    };

    embedTweet();

    return () => {
      mountedRef.current = false;
    };
  }, [tweetUrl, theme]);

  if (status === 'error') {
    return (
      <div style={{ padding: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', margin: '24px 0' }}>
        <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>
          Unable to load tweet. <a href={tweetUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>View on X →</a>
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0', perspective: '1000px' }}>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          maxWidth: '550px',
          width: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          transform: `rotateX(${tiltStyle.rotateX}deg) rotateY(${tiltStyle.rotateY}deg) scale(${tiltStyle.scale})`,
          transition: 'transform 0.1s ease-out, box-shadow 0.2s ease-out',
          transformStyle: 'preserve-3d',
          boxShadow: tiltStyle.scale > 1
            ? `${-tiltStyle.rotateY * 1.5}px ${tiltStyle.rotateX * 1.5}px 50px rgba(0,0,0,0.5)`
            : '0 10px 40px rgba(0,0,0,0.4)',
          background: 'linear-gradient(145deg, rgba(20,30,50,0.95) 0%, rgba(10,18,35,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        {/* Twitter embed */}
        <div ref={tweetContainerRef} style={{ minHeight: status === 'loading' ? '400px' : 'auto' }} />

        {status === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.95)' }}>
            <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'twitterSpin 1s linear infinite' }} />
            <span style={{ marginTop: '16px', color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>Loading tweet...</span>
          </div>
        )}

        {/* Watermark bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            background: 'linear-gradient(135deg, rgba(10,18,35,0.98) 0%, rgba(5,10,20,1) 100%)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              fontSize: '14px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.9)',
              letterSpacing: '-0.3px',
            }}
          >
            {watermark}
          </span>

          {/* Traffic lights */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#eab308', boxShadow: '0 0 8px #eab308' }} />
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
          </div>
        </div>

        <style>{`
          @keyframes twitterSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default TwitterEmbed;

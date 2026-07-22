import { useEffect, useRef, useState, useCallback } from 'react';

interface BrandedImageProps {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  watermark?: string;
  className?: string;
  /** Enable 3D tilt effect on hover */
  enableTilt?: boolean;
  /** Maximum tilt angle in degrees */
  maxTilt?: number;
}

/**
 * BrandedImage - An animated image component with decay effect and branded watermark
 * Inspired by DecayCard from reactbits.dev
 *
 * Features:
 * - SVG displacement filter for interactive "decay" effect on hover
 * - 3D perspective tilt effect (rotateX/rotateY based on mouse position)
 * - Smooth mouse-tracking distortion
 * - Branded watermark overlay (default: cli.firstmovers.io)
 * - Works with both online URLs and local images
 */
export function BrandedImage({
  src,
  alt = 'Image',
  width = 400,
  height = 300,
  watermark = 'cli.firstmovers.io',
  className = '',
  enableTilt = true,
  maxTilt = 15,
}: BrandedImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const displacementRef = useRef<SVGFEDisplacementMapElement>(null);
  const turbulenceRef = useRef<SVGFETurbulenceElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Handle Escape key to close lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLightboxOpen) {
        setIsLightboxOpen(false);
      }
    };

    if (isLightboxOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isLightboxOpen]);

  // Detect touch device on mount
  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches
      );
    };
    checkTouch();
  }, []);

  // Check if image is already loaded (for hydration case when image is cached)
  // Use a small timeout to ensure React has connected the ref after hydration
  useEffect(() => {
    const checkImageLoaded = () => {
      if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
        setIsLoaded(true);
      }
    };

    // Check immediately
    checkImageLoaded();

    // Also check after a small delay for hydration edge cases
    const timeout = setTimeout(checkImageLoaded, 100);

    return () => clearTimeout(timeout);
  }, [src]);

  const handleImageLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setHasError(true);
  }, []);

  // Animation state refs (persist across renders without triggering re-renders)
  const animationRef = useRef<{
    currentScale: number;
    targetScale: number;
    currentX: number;
    currentY: number;
    prevX: number;
    prevY: number;
    animationFrame: number | null;
  }>({
    currentScale: 0,
    targetScale: 0,
    currentX: 0,
    currentY: 0,
    prevX: 0,
    prevY: 0,
    animationFrame: null,
  });

  // Linear interpolation helper
  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  };

  useEffect(() => {
    const container = containerRef.current;
    const displacement = displacementRef.current;
    const turbulence = turbulenceRef.current;
    if (!container || !displacement || !turbulence) return;

    const state = animationRef.current;
    let isAnimating = false;

    // Only run animation loop when there's active movement
    const startAnimation = () => {
      if (isAnimating) return;
      isAnimating = true;
      animate();
    };

    const stopAnimation = () => {
      isAnimating = false;
      if (state.animationFrame) {
        cancelAnimationFrame(state.animationFrame);
        state.animationFrame = null;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Calculate distance from previous position (velocity)
      const dx = x - state.prevX;
      const dy = y - state.prevY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Update target scale based on movement velocity
      state.targetScale = Math.min(distance * 1.5, 80);
      state.prevX = x;
      state.prevY = y;

      // Update turbulence seed for organic feel (throttled)
      if (distance > 5) {
        const seed = Math.floor(Math.random() * 100);
        turbulence.setAttribute('seed', seed.toString());
      }

      // Start animation if not running
      startAnimation();

      // 3D Tilt effect - use CSS variables instead of state for performance
      if (enableTilt && !isTouchDevice) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateY = ((x - centerX) / centerX) * maxTilt;
        const rotateX = ((centerY - y) / centerY) * maxTilt;
        // Direct DOM update instead of setState to avoid re-renders
        container.style.setProperty('--tilt-x', `${rotateX}deg`);
        container.style.setProperty('--tilt-y', `${rotateY}deg`);
        container.style.setProperty('--tilt-scale', '1.02');
      }
    };

    const handleMouseLeave = () => {
      state.targetScale = 0;
      // Reset tilt on mouse leave
      if (enableTilt && !isTouchDevice) {
        container.style.setProperty('--tilt-x', '0deg');
        container.style.setProperty('--tilt-y', '0deg');
        container.style.setProperty('--tilt-scale', '1');
      }
    };

    // Touch handlers for mobile - trigger decay effect on touch move
    const handleTouchStart = (e: TouchEvent) => {
      setIsTouching(true);
      const touch = e.touches[0];
      const rect = container.getBoundingClientRect();
      state.prevX = touch.clientX - rect.left;
      state.prevY = touch.clientY - rect.top;
      startAnimation();
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = container.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      // Calculate distance from previous position (velocity)
      const dx = x - state.prevX;
      const dy = y - state.prevY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Trigger decay effect
      state.targetScale = Math.min(distance * 2, 100);
      state.prevX = x;
      state.prevY = y;

      // Update turbulence (throttled)
      if (distance > 5) {
        const seed = Math.floor(Math.random() * 100);
        turbulence.setAttribute('seed', seed.toString());
      }
    };

    const handleTouchEnd = () => {
      setIsTouching(false);
      state.targetScale = 0;
    };

    const animate = () => {
      if (!isAnimating) return;

      // Smooth interpolation toward target
      state.currentScale = lerp(state.currentScale, state.targetScale, 0.15);

      // Apply displacement scale
      displacement.setAttribute('scale', state.currentScale.toString());

      // Gradually decay the target
      state.targetScale *= 0.95;

      // Stop animation when effect is nearly complete
      if (state.currentScale < 0.1 && state.targetScale < 0.1) {
        state.currentScale = 0;
        displacement.setAttribute('scale', '0');
        stopAnimation();
        return;
      }

      state.animationFrame = requestAnimationFrame(animate);
    };

    // Initialize CSS variables
    container.style.setProperty('--tilt-x', '0deg');
    container.style.setProperty('--tilt-y', '0deg');
    container.style.setProperty('--tilt-scale', '1');

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    // Touch events for mobile
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      stopAnimation();
    };
  }, [enableTilt, maxTilt, isTouchDevice]);

  const filterId = `decay-filter-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <>
    <div
      ref={containerRef}
      className={`branded-image-container ${className}`}
      onClick={() => setIsLightboxOpen(true)}
      style={{
        position: 'relative',
        width: width,
        maxWidth: '100%',
        aspectRatio: `${width}/${height}`,
        overflow: 'visible', // Allow tilt to overflow
        borderRadius: '12px',
        cursor: 'zoom-in',
        perspective: '1000px', // Enable 3D perspective
        transformStyle: 'preserve-3d',
      }}
    >
      {/* SVG Filter Definition - outside tilt wrapper */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              ref={turbulenceRef}
              type="fractalNoise"
              baseFrequency="0.015"
              numOctaves="3"
              seed="1"
              result="turbulence"
            />
            <feDisplacementMap
              ref={displacementRef}
              in="SourceGraphic"
              in2="turbulence"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Tilt wrapper - applies 3D rotation (desktop) or scale (mobile) */}
      <div
        className="branded-image-tilt-wrapper"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '12px',
          overflow: 'hidden',
          // Use CSS variables for tilt (set via JS for performance)
          // Desktop: tilt transform using CSS vars, Mobile: scale on touch
          transform: !isTouchDevice
            ? 'rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)) scale(var(--tilt-scale, 1))'
            : isTouching
              ? 'scale(0.98)'
              : 'scale(1)',
          transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out',
          transformStyle: 'preserve-3d',
          boxShadow: isTouching
            ? '0 2px 10px rgba(0,0,0,0.3)'
            : '0 4px 20px rgba(0,0,0,0.2)',
        }}
      >
        {/* Image with decay effect */}
        <div
          style={{
            width: '100%',
            height: '100%',
            filter: `url(#${filterId})`,
            willChange: 'filter',
          }}
        >
        {!hasError ? (
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: isLoaded ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '14px',
            }}
          >
            Failed to load image
          </div>
        )}
      </div>

      {/* Gradient overlay for better watermark visibility */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '50%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Branded watermark */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '14px',
          right: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            fontSize: '13px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.9)',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            letterSpacing: '-0.3px',
          }}
        >
          {watermark}
        </span>

        {/* Small decorative element */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#eab308' }} />
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
        </div>
      </div>

      {/* Subtle border */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          pointerEvents: 'none',
        }}
      />

      {/* Loading state */}
      {!isLoaded && !hasError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              border: '2px solid rgba(255,255,255,0.2)',
              borderTopColor: 'rgba(255,255,255,0.8)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
        </div>
      )}
      </div>
      {/* End tilt wrapper */}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .branded-image-container:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>

    {/* Lightbox */}
    {isLightboxOpen && (
      <div
        onClick={() => setIsLightboxOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          cursor: 'zoom-out',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: '8px',
            animation: 'scaleIn 0.3s ease-out',
          }}
        />

        {/* Close button */}
        <button
          onClick={() => setIsLightboxOpen(false)}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '40px',
            height: '40px',
            border: 'none',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '24px',
            transition: 'background 0.2s',
          }}
        >
          ×
        </button>

        {/* Watermark in lightbox */}
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: '8px',
            color: 'rgba(255,255,255,0.8)',
            fontSize: '14px',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          }}
        >
          {watermark}
        </div>
      </div>
    )}
    </>
  );
}

export default BrandedImage;

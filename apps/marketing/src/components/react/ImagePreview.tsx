import { useState, useRef, useEffect } from 'react';

interface ImagePreviewProps {
  src: string;
  alt?: string;
  caption?: string;
  className?: string;
}

/**
 * ImagePreview - Blog image component with hover effect and lightbox zoom
 */
export function ImagePreview({
  src,
  alt = 'Image',
  caption,
  className = '',
}: ImagePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  // Intersection Observer for entrance animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Handle Escape key to close lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      <figure
        ref={containerRef}
        className={`my-8 ${className}`}
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
        }}
      >
        <div
          onClick={() => setIsOpen(true)}
          className="group"
          style={{
            position: 'relative',
            borderRadius: '12px',
            overflow: 'hidden',
            cursor: 'zoom-in',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          }}
        >
          <img
            src={src}
            alt={alt}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              transition: 'transform 0.3s ease',
            }}
            className="group-hover:scale-[1.02]"
          />

          {/* Border overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {caption && (
          <figcaption
            style={{
              textAlign: 'center',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '14px',
              marginTop: '12px',
            }}
          >
            {caption}
          </figcaption>
        )}
      </figure>

      {/* Lightbox */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
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
            onClick={() => setIsOpen(false)}
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
            className="hover:bg-white/20"
          >
            ×
          </button>

          {/* Caption in lightbox */}
          {caption && (
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
                maxWidth: '80%',
                textAlign: 'center',
              }}
            >
              {caption}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}

export default ImagePreview;

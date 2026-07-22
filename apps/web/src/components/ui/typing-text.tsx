import { useEffect, useState } from 'react';

interface TypingTextProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  onComplete?: () => void;
  showCursor?: boolean;
}

export function TypingText({
  text,
  speed = 50,
  delay = 0,
  className = '',
  onComplete,
  showCursor = true
}: TypingTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (currentIndex === 0 && delay > 0) {
      const delayTimeout = setTimeout(() => {
        setCurrentIndex(1);
      }, delay);
      return () => clearTimeout(delayTimeout);
    }

    if (currentIndex > 0 && currentIndex <= text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex));
        setCurrentIndex(currentIndex + 1);
      }, speed);

      return () => clearTimeout(timeout);
    }

    if (currentIndex > text.length && !isComplete) {
      setIsComplete(true);
      onComplete?.();
    }
  }, [currentIndex, text, speed, delay, isComplete, onComplete]);

  return (
    <span className={`font-mono ${className}`}>
      {displayedText}
      {showCursor && !isComplete && (
        <span className="inline-block w-0.5 h-[1em] bg-rose-500 ml-0.5 animate-blink" />
      )}
    </span>
  );
}

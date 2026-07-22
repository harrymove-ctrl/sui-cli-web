import { useId } from 'react';

/** "key" glass-style icon, Nucleo (nucleoapp.com) - used under the project owner's paid Nucleo license. */
export function KeyGlassIcon({ className, size = 24 }: { className?: string; size?: number }) {
  const uid = useId().replace(/:/g, '');
  const g0 = `key-g0-${uid}`;
  const g1 = `key-g1-${uid}`;
  const g2 = `key-g2-${uid}`;
  const filter = `key-filter-${uid}`;
  const clip = `key-clip-${uid}`;
  const mask = `key-mask-${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <g fill="none">
        <path
          d="M23.0002 4.00002C23.0002 4.31476 22.852 4.61115 22.6002 4.8L20.9998 6.00033L18.1599 5.59448C17.8299 5.54732 17.547 5.83019 17.5942 6.16019L18 9.00016L11.7072 15.293C11.3167 15.6835 10.6837 15.6834 10.2931 15.293L8.20719 13.207C7.81668 12.8165 7.81668 12.1835 8.20719 11.793L18.7073 1.29289C18.8948 1.10536 19.1492 1 19.4144 1H22.0002C22.5524 1 23.0002 1.44772 23.0002 2V4.00002Z"
          fill={`url(#${g0})`}
          mask={`url(#${mask})`}
        />
        <path
          d="M23.0002 4.00002C23.0002 4.31476 22.852 4.61115 22.6002 4.8L20.9998 6.00033L18.1599 5.59448C17.8299 5.54732 17.547 5.83019 17.5942 6.16019L18 9.00016L11.7072 15.293C11.3167 15.6835 10.6837 15.6834 10.2931 15.293L8.20719 13.207C7.81668 12.8165 7.81668 12.1835 8.20719 11.793L18.7073 1.29289C18.8948 1.10536 19.1492 1 19.4144 1H22.0002C22.5524 1 23.0002 1.44772 23.0002 2V4.00002Z"
          fill={`url(#${g0})`}
          filter={`url(#${filter})`}
          clipPath={`url(#${clip})`}
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M7.5 10C11.0899 10 14 12.9101 14 16.5C14 20.0899 11.0899 23 7.5 23C3.91015 23 1 20.0899 1 16.5C1 12.9101 3.91015 10 7.5 10Z"
          fill={`url(#${g1})`}
        />
        <path
          d="M7.5 10C11.0899 10 14 12.9101 14 16.5C14 20.0899 11.0899 23 7.5 23C3.91015 23 1 20.0899 1 16.5C1 12.9101 3.91015 10 7.5 10ZM7.5 10.75C4.32436 10.75 1.75 13.3244 1.75 16.5C1.75 19.6756 4.32436 22.25 7.5 22.25C10.6756 22.25 13.25 19.6756 13.25 16.5C13.25 13.3244 10.6756 10.75 7.5 10.75Z"
          fill={`url(#${g2})`}
        />
        <defs>
          <linearGradient id={g0} x1="15.457" y1="1" x2="15.457" y2="15.586" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(87, 87, 87, 1)" />
            <stop offset="1" stopColor="rgba(21, 21, 21, 1)" />
          </linearGradient>
          <linearGradient id={g1} x1="7.5" y1="10" x2="7.5" y2="23" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(227, 227, 229, 0.6)" />
            <stop offset="1" stopColor="rgba(187, 187, 192, 0.6)" />
          </linearGradient>
          <linearGradient id={g2} x1="7.5" y1="10" x2="7.5" y2="17.528" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(255, 255, 255, 1)" />
            <stop offset="1" stopColor="rgba(255, 255, 255, 1)" stopOpacity="0" />
          </linearGradient>
          <filter
            id={filter}
            x="-100%"
            y="-100%"
            width="400%"
            height="400%"
            filterUnits="objectBoundingBox"
            primitiveUnits="userSpaceOnUse"
          >
            <feGaussianBlur stdDeviation="2" x="0%" y="0%" width="100%" height="100%" in="SourceGraphic" result="blur" />
          </filter>
          <clipPath id={clip}>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M7.5 10C11.0899 10 14 12.9101 14 16.5C14 20.0899 11.0899 23 7.5 23C3.91015 23 1 20.0899 1 16.5C1 12.9101 3.91015 10 7.5 10Z"
              fill={`url(#${g1})`}
            />
          </clipPath>
          <mask id={mask}>
            <rect width="100%" height="100%" fill="#FFF" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M7.5 10C11.0899 10 14 12.9101 14 16.5C14 20.0899 11.0899 23 7.5 23C3.91015 23 1 20.0899 1 16.5C1 12.9101 3.91015 10 7.5 10Z"
              fill="#000"
            />
          </mask>
        </defs>
      </g>
    </svg>
  );
}

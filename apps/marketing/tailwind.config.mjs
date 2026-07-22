import typography from '@tailwindcss/typography';
import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--primary) / <alpha-value>)',
        background: 'rgb(var(--background) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-hover': 'rgb(var(--surface-hover) / <alpha-value>)',
        'text-primary': 'rgb(var(--text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: 'rgba(255, 255, 255, 0.75)',
            lineHeight: '1.8',
            fontSize: '1.0625rem',
            // Headings
            h2: {
              color: 'rgba(255, 255, 255, 0.95)',
              fontWeight: '700',
              fontSize: '1.5rem',
              marginTop: '3rem',
              marginBottom: '1.5rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              letterSpacing: '-0.025em',
              '&::before': {
                content: '"## "',
                color: '#4da2ff',
                fontFamily: 'ui-monospace, monospace',
                fontWeight: '400',
                opacity: '0.7',
              },
            },
            h3: {
              color: 'rgba(255, 255, 255, 0.95)',
              fontWeight: '600',
              fontSize: '1.125rem',
              marginTop: '2rem',
              marginBottom: '1rem',
              padding: '1rem 1.25rem',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '0.75rem',
            },
            h4: {
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: '600',
              marginTop: '1.75rem',
              marginBottom: '0.75rem',
            },
            // Paragraphs
            p: {
              marginTop: '1.25rem',
              marginBottom: '1.25rem',
            },
            // Strong
            strong: {
              color: 'rgba(255, 255, 255, 0.95)',
              fontWeight: '600',
            },
            // Links
            a: {
              color: '#4da2ff',
              textDecoration: 'none',
              borderBottom: '1px dashed rgba(77, 162, 255, 0.4)',
              transition: 'all 0.2s ease',
              '&:hover': {
                color: '#7dc4ff',
                borderBottomStyle: 'solid',
                borderBottomColor: '#4da2ff',
              },
            },
            // Lists
            ul: {
              paddingLeft: '0',
              listStyle: 'none',
            },
            'ul > li': {
              position: 'relative',
              paddingLeft: '1.75rem',
              marginBottom: '0.75rem',
              '&::before': {
                content: '"→"',
                position: 'absolute',
                left: '0',
                color: '#4da2ff',
                fontFamily: 'ui-monospace, monospace',
                fontWeight: '500',
              },
            },
            ol: {
              paddingLeft: '0',
              listStyle: 'none',
              counterReset: 'list-counter',
              marginTop: '1.25rem',
              marginBottom: '1.25rem',
            },
            'ol > li': {
              position: 'relative',
              paddingLeft: '2.5rem',
              marginBottom: '0.875rem',
              counterIncrement: 'list-counter',
              lineHeight: '1.75',
              '&::before': {
                content: 'counter(list-counter)',
                position: 'absolute',
                left: '0',
                top: '0',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '1.75rem',
                height: '1.75rem',
                background: 'rgba(77, 162, 255, 0.15)',
                color: '#4da2ff',
                fontFamily: 'ui-monospace, monospace',
                fontWeight: '600',
                fontSize: '0.8rem',
                borderRadius: '0.375rem',
                border: '1px solid rgba(77, 162, 255, 0.25)',
              },
            },
            // Code
            code: {
              color: '#7dc4ff',
              background: 'rgba(77, 162, 255, 0.15)',
              padding: '0.2rem 0.5rem',
              borderRadius: '0.375rem',
              fontSize: '0.875em',
              fontWeight: '500',
              border: '1px solid rgba(77, 162, 255, 0.2)',
              '&::before': { content: 'none' },
              '&::after': { content: 'none' },
            },
            'pre code': {
              background: 'transparent',
              border: 'none',
              padding: '0',
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: '0.875rem',
            },
            pre: {
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              marginTop: '1.5rem',
              marginBottom: '1.5rem',
            },
            // Blockquotes
            blockquote: {
              fontStyle: 'normal',
              color: 'rgba(255, 255, 255, 0.8)',
              borderLeftColor: '#4da2ff',
              borderLeftWidth: '3px',
              background: 'rgba(77, 162, 255, 0.08)',
              padding: '1rem 1.25rem',
              borderRadius: '0 0.5rem 0.5rem 0',
              marginTop: '1.5rem',
              marginBottom: '1.5rem',
              'p:first-of-type::before': { content: 'none' },
              'p:last-of-type::after': { content: 'none' },
            },
            // HR
            hr: {
              borderColor: 'rgba(255, 255, 255, 0.1)',
              marginTop: '3rem',
              marginBottom: '3rem',
            },
            // Tables
            table: {
              fontSize: '0.9375rem',
            },
            th: {
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: '600',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '0.75rem 1rem',
              borderBottomColor: 'rgba(255, 255, 255, 0.15)',
            },
            td: {
              padding: '0.75rem 1rem',
              borderBottomColor: 'rgba(255, 255, 255, 0.08)',
            },
            // Images
            img: {
              borderRadius: '0.75rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            },
          },
        },
      },
    },
  },
  plugins: [
    typography,
    // Hide scrollbar utility
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          /* Firefox */
          'scrollbar-width': 'none',
          /* Safari and Chrome */
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      });
    }),
  ],
};

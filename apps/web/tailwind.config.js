/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
  	extend: {
  		screens: {
  			xs: '475px'
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			success: '#34c759',
  			warning: '#ff9f0a',
  			error: '#ff453a',
  			tertiary: 'hsl(var(--text-tertiary))',
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			sans: [
  				'Geist Pixel',
  				'Geist',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'SF Pro Text',
  				'Segoe UI',
  				'Roboto',
  				'sans-serif'
  			],
  			mono: [
  				'Geist Mono',
  				'JetBrains Mono',
  				'SF Mono',
  				'Menlo',
  				'Monaco',
  				'Consolas',
  				'monospace'
  			]
  		},
  		boxShadow: {
  			modal: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  			dropdown: '0 10px 40px -10px rgba(0, 0, 0, 0.4)'
  		},
  		animation: {
  			'fade-in': 'fadeIn 0.15s ease-out',
  			'slide-up': 'slideUp 0.2s ease-out',
  			'scale-in': 'scaleIn 0.15s ease-out',
  			'gradient-x': 'gradient-x 15s ease infinite',
  			'gradient-y': 'gradient-y 15s ease infinite',
  			'gradient-xy': 'gradient-xy 15s ease infinite',
  			shimmer: 'shimmer 2s linear infinite',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			shine: 'shine 8s ease-in-out infinite',
  			'border-beam': 'border-beam calc(var(--duration)*1s) infinite linear',
  			scanline: 'scanline 8s linear infinite',
  			float: 'float 6s ease-in-out infinite',
  			'liquid-flow': 'liquidFlow 8s ease-in-out infinite',
  			'glass-shimmer': 'glassShimmer 3s ease-in-out infinite',
  			'glow-pulse': 'glowPulse 4s ease-in-out infinite',
  			aurora: 'aurora 15s ease infinite',
  			morph: 'morph 8s ease-in-out infinite',
  			ripple: 'ripple 2s ease-out infinite',
  			typing: 'typing 2s steps(20) infinite',
  			blink: 'blink 1s step-end infinite',
  			'bounce-in': 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  		},
  		keyframes: {
  			fadeIn: {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			},
  			slideUp: {
  				'0%': {
  					opacity: '0',
  					transform: 'translateY(10px)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			scaleIn: {
  				'0%': {
  					opacity: '0',
  					transform: 'scale(0.95)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'scale(1)'
  				}
  			},
  			'gradient-x': {
  				'0%, 100%': {
  					'background-size': '200% 200%',
  					'background-position': 'left center'
  				},
  				'50%': {
  					'background-size': '200% 200%',
  					'background-position': 'right center'
  				}
  			},
  			'gradient-y': {
  				'0%, 100%': {
  					'background-size': '400% 400%',
  					'background-position': 'center top'
  				},
  				'50%': {
  					'background-size': '200% 200%',
  					'background-position': 'center bottom'
  				}
  			},
  			'gradient-xy': {
  				'0%, 100%': {
  					'background-size': '400% 400%',
  					'background-position': 'left center'
  				},
  				'50%': {
  					'background-size': '200% 200%',
  					'background-position': 'right center'
  				}
  			},
  			shimmer: {
  				from: {
  					backgroundPosition: '0 0'
  				},
  				to: {
  					backgroundPosition: '-200% 0'
  				}
  			},
  			shine: {
  				'0%': {
  					'background-position': '0% 0%'
  				},
  				'50%': {
  					'background-position': '100% 100%'
  				},
  				to: {
  					'background-position': '0% 0%'
  				}
  			},
  			'border-beam': {
  				'100%': {
  					'offset-distance': '100%'
  				}
  			},
  			liquidFlow: {
  				'0%, 100%': {
  					'border-radius': '60% 40% 30% 70%/60% 30% 70% 40%',
  					transform: 'rotate(0deg)'
  				},
  				'50%': {
  					'border-radius': '30% 60% 70% 40%/50% 60% 30% 60%',
  					transform: 'rotate(180deg)'
  				}
  			},
  			glassShimmer: {
  				'0%': {
  					'background-position': '-200% 0'
  				},
  				'100%': {
  					'background-position': '200% 0'
  				}
  			},
  			glowPulse: {
  				'0%, 100%': {
  					opacity: '0.4',
  					transform: 'scale(1)'
  				},
  				'50%': {
  					opacity: '0.8',
  					transform: 'scale(1.05)'
  				}
  			},
  			aurora: {
  				'0%, 100%': {
  					'background-position': '50% 50%',
  					filter: 'hue-rotate(0deg)'
  				},
  				'50%': {
  					'background-position': '100% 50%',
  					filter: 'hue-rotate(30deg)'
  				}
  			},
  			morph: {
  				'0%, 100%': {
  					'border-radius': '40% 60% 70% 30%/40% 40% 60% 50%'
  				},
  				'34%': {
  					'border-radius': '70% 30% 50% 50%/30% 30% 70% 70%'
  				},
  				'67%': {
  					'border-radius': '100% 60% 60% 100%/100% 100% 60% 60%'
  				}
  			},
  			ripple: {
  				'0%': {
  					transform: 'scale(0.8)',
  					opacity: '1'
  				},
  				'100%': {
  					transform: 'scale(2.4)',
  					opacity: '0'
  				}
  			},
  			typing: {
  				'0%': {
  					width: '0'
  				},
  				'50%': {
  					width: '100%'
  				},
  				'100%': {
  					width: '0'
  				}
  			},
  			blink: {
  				'50%': {
  					'border-color': 'transparent'
  				}
  			},
  			bounceIn: {
  				'0%': {
  					opacity: '0',
  					transform: 'scale(0.3)'
  				},
  				'50%': {
  					opacity: '1',
  					transform: 'scale(1.05)'
  				},
  				'70%': {
  					transform: 'scale(0.9)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'scale(1)'
  				}
  			},
  			scanline: {
  				'0%': {
  					transform: 'translateY(-100%)'
  				},
  				'100%': {
  					transform: 'translateY(100vh)'
  				}
  			},
  			float: {
  				'0%, 100%': {
  					transform: 'translateY(0px)'
  				},
  				'50%': {
  					transform: 'translateY(-20px)'
  				}
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

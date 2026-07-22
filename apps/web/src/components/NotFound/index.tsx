import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Home, Terminal, ArrowLeft, Zap, Command } from 'lucide-react';

export function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const [glitchText, setGlitchText] = useState('404');
  const [typedPath, setTypedPath] = useState('');
  const [showCursor, setShowCursor] = useState(true);

  // Typewriter effect for the path
  useEffect(() => {
    const path = location.pathname;
    let i = 0;
    const interval = setInterval(() => {
      if (i <= path.length) {
        setTypedPath(path.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [location.pathname]);

  // Blinking cursor
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  // Glitch effect on 404
  useEffect(() => {
    const glitchChars = '!@#$%^&*()_+-=[]{}|;:,.<>?~`';
    const interval = setInterval(() => {
      if (Math.random() > 0.9) {
        const glitched = '404'.split('').map(char =>
          Math.random() > 0.7 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : char
        ).join('');
        setGlitchText(glitched);
        setTimeout(() => setGlitchText('404'), 100);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        {/* Terminal Window */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20 rounded-2xl blur-xl opacity-50" />

          {/* Main terminal */}
          <div className="relative bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/10">
              <div className="flex gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                <span className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />
                <span className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
              </div>
              <span className="ml-3 text-white/40 text-sm font-mono flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                sui-cli-web — error
              </span>
            </div>

            {/* Terminal content */}
            <div className="p-6 font-mono">
              {/* Command line */}
              <div className="space-y-3 mb-8">
                <div className="flex items-start gap-2">
                  <span className="text-green-400 shrink-0">$</span>
                  <span className="text-white/80">
                    curl https://cli.firstmovers.io{typedPath}
                    <span className={`inline-block w-2 h-4 bg-white/80 ml-0.5 ${showCursor ? 'opacity-100' : 'opacity-0'}`} />
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-red-400 shrink-0">!</span>
                  <span className="text-red-400">
                    Error: HTTP 404 — Resource not found
                  </span>
                </div>

                <div className="text-white/50 pl-4 text-sm">
                  The requested path does not exist on this server.
                </div>
              </div>

              {/* Big 404 */}
              <div className="text-center py-8 relative">
                {/* Background glow */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-64 bg-red-500/10 rounded-full blur-3xl" />
                </div>

                {/* 404 text with glitch */}
                <div className="relative">
                  <h1
                    className="text-[120px] md:text-[180px] font-bold leading-none select-none"
                    style={{
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.4) 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textShadow: '0 0 80px rgba(239,68,68,0.5)',
                    }}
                  >
                    {glitchText}
                  </h1>

                  {/* Scan lines effect */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-10"
                    style={{
                      background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
                    }}
                  />
                </div>

                <p className="text-white/60 text-lg mt-4">
                  Page not found
                </p>
              </div>

              {/* Suggestions */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-white/40 text-sm mb-4">Try one of these instead:</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Home className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="text-left">
                      <div className="text-white/90 font-medium">Home</div>
                      <div className="text-white/40 text-xs">Landing page</div>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate('/app')}
                    className="flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Terminal className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="text-left">
                      <div className="text-white/90 font-medium">Launch App</div>
                      <div className="text-white/40 text-xs">Command palette</div>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate('/setup')}
                    className="flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-yellow-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Zap className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="text-left">
                      <div className="text-white/90 font-medium">Setup Guide</div>
                      <div className="text-white/40 text-xs">Get started</div>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ArrowLeft className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="text-left">
                      <div className="text-white/90 font-medium">Go Back</div>
                      <div className="text-white/40 text-xs">Previous page</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Keyboard hint */}
              <div className="mt-6 text-center">
                <p className="text-white/30 text-sm inline-flex items-center gap-2">
                  Press
                  <kbd className="px-2 py-1 bg-white/10 rounded text-white/50 text-xs inline-flex items-center gap-1">
                    <Command className="w-3 h-3" /> K
                  </kbd>
                  in app to search
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Fun ASCII art at bottom */}
        <div className="mt-8 text-center">
          <pre className="text-white/20 text-xs font-mono inline-block">
{`   _____  ___  _  _
  |   | ||   || || |
  | | | ||   ||_  _|
  |_|___||___| |_|
                      `}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default NotFound;

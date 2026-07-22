import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { Terminal, Copy, Check, RefreshCw, Monitor, Apple, Shield, Zap, Server, ChevronRight, Laptop, Smartphone } from 'lucide-react';
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { StreamingText } from '@/components/ui/streaming-text';

interface SetupInstructionsProps {
  onRetry: () => void;
  isRetrying: boolean;
  connectionError?: string | null;
}

/**
 * This screen is dark-on-dark regardless of the app theme (which defaults to
 * light), so the shadcn tokens StreamingText settles its words into are pinned
 * to dark values for this subtree.
 */
const DARK_TOKENS = {
  '--foreground': '0 0% 100%',
} as CSSProperties;

/** Same, for streams that should settle into muted body copy rather than
 *  full-strength white. */
const DIM_TOKENS = {
  '--foreground': '0 0% 100% / 0.7',
} as CSSProperties;

/** The stream's ink, warmed to this screen's rose/orange accent. */
const ROSE_INK =
  'bg-gradient-to-r from-rose-400 via-pink-400 to-orange-300 bg-clip-text text-transparent';
const ROSE_CURSOR =
  'bg-gradient-to-br from-rose-400 to-orange-300 shadow-[0_0_0.7em_rgba(244,63,94,0.55)]';

const INTRO_TEXT =
  'Sui CLI Web talks to the Sui CLI already installed on your machine.\nNothing is hosted, and your keys never leave your laptop.\nStart the local server and this page connects itself.';

export function SetupInstructions({ onRetry, isRetrying, connectionError }: SetupInstructionsProps) {
  const isMobile = useMobileDetect();
  const [activeOS, setActiveOS] = useState<'mac' | 'linux' | 'windows'>('mac');
  const [copied, setCopied] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [showContent, setShowContent] = useState(false);

  // The intro ends when the narration finishes, not on a fixed timer — so the
  // copy can change without the hand-off falling out of sync with it.
  const finishIntro = useCallback(() => {
    setShowContent(true);
    // Let the last word settle out of the gradient before the overlay leaves.
    setTimeout(() => setShowIntro(false), 700);
  }, []);

  // Any click or key press skips the narration — nobody should be held behind
  // an animation on a screen they are already trying to get past.
  useEffect(() => {
    if (!showIntro) return;
    window.addEventListener('keydown', finishIntro);
    window.addEventListener('pointerdown', finishIntro);
    return () => {
      window.removeEventListener('keydown', finishIntro);
      window.removeEventListener('pointerdown', finishIntro);
    };
  }, [showIntro, finishIntro]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const osConfigs: {
    [key: string]: {
      icon: JSX.Element;
      label: string;
      steps: Array<{ title: string; cmd: string; label: string; note?: string; link?: { text: string; url: string } }>;
    };
  } = {
    mac: {
      icon: <Apple className="w-4 h-4" />,
      label: 'macOS',
      steps: [
        {
          title: 'Install Homebrew (if not installed)',
          cmd: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
          label: 'Terminal',
          link: { text: 'Homebrew Installation', url: 'https://brew.sh' }
        },
        {
          title: 'Install Node.js',
          cmd: 'brew install node',
          label: 'Terminal',
          note: 'Node.js 18+ required for the server'
        },
        {
          title: 'Install Sui CLI',
          cmd: 'brew install sui',
          label: 'Terminal',
          link: { text: 'Sui Installation Guide', url: 'https://docs.sui.io/guides/developer/getting-started/sui-install' }
        },
        {
          title: 'Start Server',
          cmd: 'npx sui-cli-web-server',
          label: 'Terminal',
          note: 'Keep this terminal running'
        },
      ],
    },
    linux: {
      icon: <Terminal className="w-4 h-4" />,
      label: 'Linux',
      steps: [
        {
          title: 'Install Prerequisites',
          cmd: 'sudo apt-get update && sudo apt-get install curl git-all cmake gcc libssl-dev pkg-config libclang-dev libpq-dev build-essential',
          label: 'Bash',
          note: 'For Ubuntu/Debian. Use equivalent commands for other distros'
        },
        {
          title: 'Install Rust',
          cmd: 'curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh',
          label: 'Bash',
          link: { text: 'Rust Installation', url: 'https://www.rust-lang.org/tools/install' }
        },
        {
          title: 'Install Sui CLI',
          cmd: 'cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui',
          label: 'Bash',
          link: { text: 'Sui Installation Guide', url: 'https://docs.sui.io/guides/developer/getting-started/sui-install' }
        },
        {
          title: 'Install Node.js',
          cmd: 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs',
          label: 'Bash',
          note: 'Node.js 18+ required'
        },
        {
          title: 'Start Server',
          cmd: 'npx sui-cli-web-server',
          label: 'Bash',
          note: 'Keep this terminal running'
        },
      ],
    },
    windows: {
      icon: <Monitor className="w-4 h-4" />,
      label: 'Windows',
      steps: [
        {
          title: 'Install Chocolatey (if not installed)',
          cmd: 'Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString(\'https://community.chocolatey.org/install.ps1\'))',
          label: 'PowerShell (Admin)',
          note: 'Run PowerShell as Administrator',
          link: { text: 'Chocolatey Installation', url: 'https://chocolatey.org/install' }
        },
        {
          title: 'Install Sui CLI',
          cmd: 'choco install sui',
          label: 'PowerShell (Admin)',
          link: { text: 'Sui Installation Guide', url: 'https://docs.sui.io/guides/developer/getting-started/sui-install' }
        },
        {
          title: 'Install Node.js',
          cmd: 'choco install nodejs-lts',
          label: 'PowerShell (Admin)',
          note: 'Node.js 18+ required for the server'
        },
        {
          title: 'Verify Installation',
          cmd: 'sui --version',
          label: 'PowerShell',
          note: 'Restart PowerShell if command not found'
        },
        {
          title: 'Start Server',
          cmd: 'npx sui-cli-web-server',
          label: 'PowerShell',
          note: 'Keep this terminal running'
        },
      ],
    },
  };

  // Mobile-friendly message - show instead of server error
  if (isMobile) {
    return (
      <div className="relative w-full max-w-lg mx-auto px-4">
        <div className="text-center space-y-8">
          {/* Icon */}
          <div className="inline-flex items-center justify-center relative">
            <div className="absolute w-32 h-32 bg-rose-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="relative w-24 h-24 bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl">
              <Laptop className="w-12 h-12 text-rose-400" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Desktop <span className="text-rose-400">Required</span>
            </h1>
            <StreamingText
              className="block text-sm sm:text-base leading-relaxed"
              cursorClassName={ROSE_CURSOR}
              gradientClassName={ROSE_INK}
              settleDelay={300}
              speed={85}
              style={DIM_TOKENS}
              text="Sui CLI Web runs a local server on your computer to keep your keys secure."
            />
          </div>

          {/* Info Card */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-left space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-500/20 rounded-lg shrink-0">
                <Shield className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Why Desktop?</h3>
                <p className="text-xs text-white/60 leading-relaxed">
                  Your private keys stay on your machine. We need a local terminal to run Sui CLI commands securely.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg shrink-0">
                <Terminal className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">How to Use</h3>
                <p className="text-xs text-white/60 leading-relaxed">
                  Open this site on a Mac, Windows, or Linux computer with Node.js installed.
                </p>
              </div>
            </div>
          </div>

          {/* Device indicator */}
          <div className="flex items-center justify-center gap-3 text-white/40 text-sm">
            <Smartphone className="w-4 h-4" />
            <span>You're on mobile</span>
            <span className="text-white/20">•</span>
            <span>Switch to desktop</span>
            <Laptop className="w-4 h-4" />
          </div>

          {/* Quick setup hint */}
          <div className="bg-gradient-to-r from-rose-500/10 to-pink-500/10 border border-rose-500/20 rounded-xl p-4">
            <p className="text-xs text-white/70 font-mono">
              <span className="text-rose-400">$</span> npx sui-cli-web-server
            </p>
            <p className="text-xs text-white/50 mt-2">
              Run this command on your laptop to start
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-5xl mx-auto min-h-[600px]">
      {/* Intro: the setup is narrated in, word by word, instead of hard-cutting
          to a wall of instructions. */}
      {showIntro && (
        <div
          className={`absolute inset-0 z-50 flex items-center justify-center px-4 transition-opacity duration-500 ${
            showContent ? 'opacity-0' : 'opacity-100'
          }`}
          style={DARK_TOKENS}
        >
          <div className="max-w-2xl space-y-8">
            <div className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.2em] text-white/40">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span>setting you up</span>
            </div>

            <StreamingText
              className="block text-xl sm:text-2xl md:text-3xl font-medium leading-relaxed tracking-tight"
              cursorClassName={ROSE_CURSOR}
              gradientClassName={ROSE_INK}
              onComplete={finishIntro}
              settleDelay={400}
              speed={95}
              text={INTRO_TEXT}
            />

            <p className="font-mono text-xs text-white/25">
              press any key to skip
            </p>
          </div>
        </div>
      )}

      {/* Content - fade in after intro */}
      <div
        className={`relative z-10 p-6 sm:p-10 transition-opacity duration-700 ${
          showContent ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Header */}
        <div className="text-center mb-10 space-y-5">
          {/* Icon with status */}
          <div className="inline-flex items-center justify-center relative">
            <div className="absolute w-28 h-28 bg-rose-500/30 rounded-full blur-3xl animate-pulse" />
            <div className="relative w-20 h-20 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl">
              <Server className="w-10 h-10 text-white/90" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/50 animate-pulse">
                <span className="text-xs font-bold">!</span>
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Local Server <span className="text-rose-400">Disconnected</span>
            </h1>

            {/* Status line — streams in once and settles, rather than looping
                a typewriter forever next to the real instructions. */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full"
              style={DIM_TOKENS}
            >
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-lg shadow-amber-500/50" />
              {showContent && (
                <StreamingText
                  className="text-sm font-mono text-white/70"
                  cursorClassName={ROSE_CURSOR}
                  gradientClassName={ROSE_INK}
                  settleDelay={250}
                  speed={70}
                  text="Waiting for local server connection..."
                />
              )}
            </div>
          </div>
        </div>

        {/* Main Content Card with Curved Sphere Effect */}
        <div
          className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            perspective: '1000px',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* OS Tabs */}
          <div className="flex border-b border-white/10">
            {(Object.keys(osConfigs) as Array<'mac' | 'linux' | 'windows'>).map((os) => (
              <button
                key={os}
                onClick={() => setActiveOS(os as 'mac' | 'linux' | 'windows')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-all ${
                  activeOS === os
                    ? 'bg-white/10 text-white border-b-2 border-rose-500'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                }`}
              >
                {osConfigs[os].icon}
                <span className="hidden sm:inline">{osConfigs[os].label}</span>
              </button>
            ))}
          </div>

          {/* Content with Curved Glass Effect */}
          <div
            className="p-6 sm:p-8 relative"
            style={{
              transform: 'rotateX(2deg)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Curved glass overlay effect */}
            <div
              className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 70%)',
                mixBlendMode: 'overlay',
              }}
            />

            <div className="grid lg:grid-cols-2 gap-8 relative z-10">
              {/* Installation Steps */}
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <Terminal className="w-5 h-5 text-rose-400" />
                  <h2 className="text-lg font-semibold text-white">Installation Steps</h2>
                </div>

                <div className="space-y-6">
                  {osConfigs[activeOS].steps.map((step, index) => (
                    <div key={index} className="relative pl-8">
                      {/* Step number */}
                      <div className="absolute left-0 top-0 w-6 h-6 bg-gradient-to-br from-rose-500/30 to-orange-500/20 border border-rose-500/40 rounded-full flex items-center justify-center text-xs font-bold text-rose-400">
                        {index + 1}
                      </div>

                      {/* Connecting line */}
                      {index < osConfigs[activeOS].steps.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-gradient-to-b from-rose-500/40 via-orange-500/20 to-transparent" />
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-medium text-white">{step.title}</h3>
                          {step.link && (
                            <a
                              href={step.link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-rose-400 hover:text-rose-300 underline decoration-dotted underline-offset-2 transition-colors"
                            >
                              📖 {step.link.text}
                            </a>
                          )}
                        </div>
                        {step.note && (
                          <p className="text-xs text-amber-400/80 mb-2">ℹ️ {step.note}</p>
                        )}
                        <div className="relative group">
                          <div className="text-xs text-white/40 mb-1">{step.label}</div>
                          <div className="bg-black/60 border border-white/10 rounded-lg p-3 pr-12 overflow-x-auto hover:border-rose-500/30 transition-colors">
                            <code className="text-sm font-mono text-rose-300">$ {step.cmd}</code>
                          </div>
                          <button
                            onClick={() => copyToClipboard(step.cmd, `${activeOS}-${index}`)}
                            className="absolute top-6 right-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            {copied === `${activeOS}-${index}` ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-white/50" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status & Actions */}
              <div className="space-y-5">
                {/* Security Note - Warm pink/rose gradient to match theme */}
                <div className="relative overflow-hidden rounded-xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-500/15 via-rose-500/10 to-red-500/5" />
                  <div className="relative border border-pink-500/25 rounded-xl p-5 backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gradient-to-br from-pink-500/25 to-rose-500/15 rounded-lg">
                        <Shield className="w-5 h-5 text-pink-300" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white mb-2">Security First</h4>
                        <ul className="space-y-1.5 text-sm text-white/70">
                          <li className="flex items-center gap-2">
                            <span className="text-pink-400">&#10003;</span>
                            Private keys never leave your machine
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-pink-400">&#10003;</span>
                            All operations run locally
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-pink-400">&#10003;</span>
                            Open source & auditable
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connection Status - Rose/red gradient */}
                <div className="relative overflow-hidden rounded-xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-500/15 via-red-500/10 to-orange-500/5" />
                  <div className="relative border border-rose-500/25 rounded-xl p-5 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-3 h-3 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50" />
                          <div className="absolute inset-0 w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                        </div>
                        <span className="text-sm font-medium text-rose-400">Disconnected</span>
                      </div>
                      <span className="text-xs font-mono text-white/40 bg-white/5 px-2 py-1 rounded">scanning ports...</span>
                    </div>

                    {/* Debug info - show connection error */}
                    {connectionError && (
                      <details className="mb-4">
                        <summary className="text-xs text-white/50 cursor-pointer hover:text-white/70 transition-colors">
                          🔍 Debug: Click to see error details
                        </summary>
                        <div className="mt-2 p-2 bg-black/40 rounded-lg text-xs font-mono text-rose-300/70 max-h-24 overflow-y-auto break-all">
                          {connectionError}
                        </div>
                        <p className="mt-2 text-xs text-white/40">
                          💡 Open browser DevTools (F12) → Console for more details
                        </p>
                      </details>
                    )}

                    {/* Retry Button - Rose/orange gradient */}
                    <button
                      onClick={onRetry}
                      disabled={isRetrying}
                      className="w-full py-3.5 font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{
                        background: isRetrying
                          ? 'rgba(255,255,255,0.1)'
                          : 'linear-gradient(135deg, #e11d48 0%, #f43f5e 50%, #fb7185 100%)',
                        boxShadow: isRetrying ? 'none' : '0 10px 40px -10px rgba(225,29,72,0.4)',
                      }}
                    >
                      <RefreshCw className={`w-5 h-5 ${isRetrying ? 'animate-spin text-white/50' : 'text-white'}`} />
                      <span className={isRetrying ? 'text-white/50' : 'text-white'}>
                        {isRetrying ? 'Connecting...' : 'Try Connection'}
                      </span>
                      {!isRetrying && <ChevronRight className="w-4 h-4 text-white" />}
                    </button>
                  </div>
                </div>

                {/* Quick Tip - Orange/red warm gradient */}
                <div className="relative overflow-hidden rounded-xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/15 via-red-500/8 to-rose-500/5" />
                  <div className="relative flex items-start gap-3 p-4 border border-orange-500/25 rounded-xl backdrop-blur-sm">
                    <div className="p-1.5 bg-gradient-to-br from-orange-500/25 to-red-500/15 rounded-lg">
                      <Zap className="w-4 h-4 text-orange-300" />
                    </div>
                    <div>
                      <p className="text-sm text-orange-100/90">
                        <strong className="text-orange-300">Tip:</strong> Run the server in a separate terminal and keep it running.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <p className="text-center text-sm text-white/40 mt-6">
          Press <kbd className="px-2 py-1 bg-white/10 rounded text-white/60 font-mono text-xs mx-1 border border-white/10">Enter</kbd> to retry connection
        </p>
      </div>
    </div>
  );
}

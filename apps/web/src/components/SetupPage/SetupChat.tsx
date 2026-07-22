import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy } from 'lucide-react';
import { StreamingText } from '@/components/ui/streaming-text';
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { cn } from '@/lib/utils';

type OS = 'mac' | 'linux' | 'windows';

interface SetupChatProps {
  /** null while the first connection probe is still in flight. */
  serverConnected: boolean | null;
  connectedPort: number | null;
  connectionError: string | null;
  isRetrying: boolean;
  onRetry: () => void;
  onLaunch: () => void;
}

/**
 * The magic-ink effect needs the fresh word to out-contrast the settled text,
 * which in monochrome has to come from lightness alone. So the wrapper stashes
 * the real foreground in --ink, then rebinds --foreground to the muted token
 * for everything inside: words stream in at full ink and settle to muted.
 * Both ends are theme tokens, so it reads correctly in light and dark.
 */
const INK_SCOPE = '[--ink:hsl(var(--foreground))]';
const SETTLE_SCOPE = '[--foreground:var(--muted-foreground)]';

const INK = 'text-[var(--ink)]';
const CURSOR = 'bg-[var(--ink)]';

const OS_LABEL: Record<OS, string> = {
  mac: 'macOS',
  linux: 'Linux',
  windows: 'Windows',
};

const STEPS: Record<OS, Array<{ title: string; cmd: string; note?: string }>> = {
  mac: [
    { title: 'Install Node.js', cmd: 'brew install node', note: 'Node 18+' },
    { title: 'Install Sui CLI', cmd: 'brew install sui' },
    {
      title: 'Start the server',
      cmd: 'npx sui-cli-web-server',
      note: 'Leave this terminal running',
    },
  ],
  linux: [
    {
      title: 'Install Node.js',
      cmd: 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs',
      note: 'Node 18+',
    },
    {
      title: 'Install Sui CLI',
      cmd: 'cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui',
    },
    {
      title: 'Start the server',
      cmd: 'npx sui-cli-web-server',
      note: 'Leave this terminal running',
    },
  ],
  windows: [
    { title: 'Install Node.js', cmd: 'choco install nodejs-lts', note: 'Node 18+' },
    { title: 'Install Sui CLI', cmd: 'choco install sui' },
    {
      title: 'Start the server',
      cmd: 'npx sui-cli-web-server',
      note: 'Leave this terminal running',
    },
  ],
};

/** Detect the likely platform so the chips arrive pre-sorted for this machine. */
function guessOS(): OS {
  const ua = navigator.userAgent;
  if (/Win/i.test(ua)) return 'windows';
  if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) return 'linux';
  return 'mac';
}

function Bubble({
  from,
  children,
  className,
}: {
  from: 'agent' | 'user';
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex w-full', from === 'user' ? 'justify-end' : 'justify-start')}
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed sm:text-base',
          from === 'user'
            ? 'bg-foreground font-medium text-background'
            : 'border border-foreground/10 bg-foreground/[0.04] backdrop-blur-sm',
          className
        )}
      >
        {children}
      </div>
    </motion.div>
  );
}

/** An agent line that streams itself in, then hands the turn to the next beat. */
function Say({
  text,
  onDone,
  speed = 80,
}: {
  text: string;
  onDone?: () => void;
  speed?: number;
}) {
  return (
    <Bubble className={INK_SCOPE} from="agent">
      <StreamingText
        className={cn('block', SETTLE_SCOPE)}
        cursorClassName={CURSOR}
        gradientClassName={INK}
        onComplete={onDone}
        settleDelay={280}
        speed={speed}
        text={text}
      />
    </Bubble>
  );
}

function CommandRow({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="group relative mt-2 overflow-hidden rounded-xl border border-foreground/10 bg-background/50">
      <pre className="overflow-x-auto px-3 py-2.5 pr-11 font-mono text-[13px] text-foreground/85">
        <span className="select-none text-foreground/30">$ </span>
        {cmd}
      </pre>
      <button
        aria-label={copied ? 'Copied' : 'Copy command'}
        className="absolute right-1.5 top-1.5 rounded-lg p-2 text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground"
        onClick={copy}
        type="button"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

export function SetupChat({
  serverConnected,
  connectedPort,
  connectionError,
  isRetrying,
  onRetry,
  onLaunch,
}: SetupChatProps) {
  // The transcript is a linear script; `beat` is how far it has played. Each
  // streamed line advances it from its own onComplete, so the pacing follows
  // the words rather than a wall-clock timer that drifts out of sync.
  const [beat, setBeat] = useState(0);
  const [os, setOS] = useState<OS | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const next = useCallback(() => setBeat((b) => b + 1), []);

  // A phone can't run the local server at all, so it gets its own short
  // script instead of a wall of terminal commands it cannot execute.
  const isMobile = useMobileDetect();

  // Which script plays is decided once, on the first probe that resolves —
  // so a machine that is already running the server never briefly gets told
  // to go install it, and a later connection appends rather than swaps.
  const [script, setScript] = useState<'connected' | 'setup' | 'mobile' | null>(
    null
  );
  useEffect(() => {
    if (script !== null || serverConnected === null) return;
    if (serverConnected) setScript('connected');
    else setScript(isMobile ? 'mobile' : 'setup');
  }, [script, serverConnected, isMobile]);

  // A connection that lands mid-setup is announced as a new message at the
  // end of the transcript — the screen never yanks itself out from under
  // whatever the user was reading.
  const arrived = script === 'setup' && serverConnected === true;

  const transcriptRef = useRef<HTMLDivElement>(null);
  // Layout effect, not effect: scroll before paint so a long message never
  // flashes at the wrong offset first.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these are the triggers for re-scrolling, not values the effect reads.
  useLayoutEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [beat, os, arrived, showDebug]);

  const steps = os ? STEPS[os] : [];

  return (
    <div className="relative z-10 flex h-screen flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-foreground/[0.08] px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-foreground/40">
            sui cli web · setup
          </span>
          <span className="flex items-center gap-2 font-mono text-xs text-foreground/50">
            <span
              className={cn(
                'size-1.5 rounded-full',
                serverConnected ? 'bg-foreground' : 'animate-pulse bg-foreground/40'
              )}
            />
            {serverConnected
              ? `localhost:${connectedPort ?? 4001}`
              : 'listening…'}
          </span>
        </div>
      </header>

      {/* Transcript */}
      <div
        className="flex-1 overflow-y-auto px-4 py-8 sm:px-6"
        ref={transcriptRef}
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {script === null && (
            <p className="font-mono text-sm text-foreground/30">connecting…</p>
          )}

          {script === 'connected' && (
            <>
              <Say
                onDone={next}
                text={`Your local server is already up on localhost:${connectedPort ?? 4001}.`}
              />
              {beat >= 1 && (
                <Say onDone={next} text="Nothing left to set up — taking you in." />
              )}
            </>
          )}

          {script === 'mobile' && (
            <>
              <Say onDone={next} text="You're on a phone." />
              {beat >= 1 && (
                <Say
                  onDone={next}
                  text="This drives the Sui CLI installed on your computer, so the setup has to happen there — that's also why your keys never touch a server."
                />
              )}
              {beat >= 2 && (
                <Say
                  onDone={next}
                  text="Open this page on your Mac, Windows or Linux machine, then run:"
                />
              )}
              {beat >= 3 && (
                <Bubble className="w-full max-w-[92%]" from="agent">
                  <CommandRow cmd="npx sui-cli-web-server" />
                </Bubble>
              )}
            </>
          )}

          {script === 'setup' && (
            <>
              <Say
                onDone={next}
                text="Hey. Let's get this machine talking to the Sui CLI."
              />

              {beat >= 1 && (
                <Say
                  onDone={next}
                  text="Everything runs locally — nothing is hosted, and your keys never leave this laptop."
                />
              )}

              {beat >= 2 && <Say onDone={next} text="What are you running?" />}

              {beat >= 3 && !os && (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap justify-end gap-2 pt-1"
                  initial={{ opacity: 0, y: 8 }}
                >
                  {(Object.keys(OS_LABEL) as OS[])
                    // The likely platform leads, so the common case is one click.
                    .sort((a, b) => (a === guessOS() ? -1 : b === guessOS() ? 1 : 0))
                    .map((key) => (
                      <button
                        className="rounded-full border border-foreground/20 px-4 py-2 text-sm text-foreground/80 transition-colors hover:border-foreground/50 hover:bg-foreground hover:text-background"
                        key={key}
                        onClick={() => {
                          setOS(key);
                          next();
                        }}
                        type="button"
                      >
                        {OS_LABEL[key]}
                      </button>
                    ))}
                </motion.div>
              )}

              {os && (
                <Bubble from="user">
                  {OS_LABEL[os]}
                </Bubble>
              )}

              {beat >= 4 && os && (
                <Say
                  onDone={next}
                  text={`Three commands. Run them in order and leave the last one going.`}
                />
              )}

              {beat >= 5 && os && (
                <Bubble className="w-full max-w-[92%]" from="agent">
                  <ol className="space-y-4">
                    {steps.map((step, i) => (
                      <li key={step.cmd}>
                        <div className="flex items-baseline gap-2.5">
                          <span className="font-mono text-xs text-foreground/30">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-foreground/90">
                            {step.title}
                          </span>
                          {step.note && (
                            <span className="font-mono text-[11px] text-foreground/35">
                              {step.note}
                            </span>
                          )}
                        </div>
                        <CommandRow cmd={step.cmd} />
                      </li>
                    ))}
                  </ol>
                </Bubble>
              )}

              {beat >= 5 && os && (
                <Say
                  speed={70}
                  text="I'm watching the port. The moment the server answers, this page moves on by itself."
                />
              )}

              {/* Connection landed while the user was working through the steps. */}
              <AnimatePresence>
                {arrived && (
                  <Say
                    text={`There it is — connected on localhost:${connectedPort ?? 4001}.`}
                  />
                )}
              </AnimatePresence>

              {connectionError && os && (
                <div className="pt-1">
                  <button
                    className="font-mono text-xs text-foreground/30 transition-colors hover:text-foreground/60"
                    onClick={() => setShowDebug((s) => !s)}
                    type="button"
                  >
                    {showDebug ? '− hide' : '+ show'} connection error
                  </button>
                  {showDebug && (
                    <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-foreground/10 bg-background/50 p-3 font-mono text-[11px] text-foreground/50">
                      {connectionError}
                    </pre>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Action bar — sits where a chat composer would, and holds whatever the
          single next action is. */}
      <footer className="shrink-0 border-t border-foreground/[0.08] px-4 py-4 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {serverConnected ? (
            <button
              className="flex-1 rounded-xl bg-foreground py-3.5 font-semibold text-background transition-transform hover:scale-[1.01] active:scale-[0.99]"
              onClick={onLaunch}
              type="button"
            >
              Launch app →
            </button>
          ) : (
            <>
              <button
                className="flex-1 rounded-xl border border-foreground/15 py-3.5 font-medium text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-40"
                disabled={isRetrying}
                onClick={onRetry}
                type="button"
              >
                {isRetrying ? 'Checking…' : 'Check again'}
              </button>
              <a
                className="rounded-xl px-4 py-3.5 font-mono text-xs text-foreground/35 transition-colors hover:text-foreground/70"
                href="https://github.com/hien-p/raycast-sui-cli"
                rel="noopener noreferrer"
                target="_blank"
              >
                docs
              </a>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

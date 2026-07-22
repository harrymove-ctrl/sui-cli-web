
import { DitherShader } from "./dither-shader";
import { SectionCorners } from "./section-corners";
import { Check } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
const useTheme = () => ({ resolvedTheme: "dark", theme: "dark", setTheme: () => {} });

type Tier = {
  id: string;
  name: string;
  tagline: string;
  monthly: number | null;
  cta: { label: string; href: string };
  features: ReadonlyArray<string>;
  featured: boolean;
};

const TIERS: ReadonlyArray<Tier> = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For solo builders shipping their first version.",
    monthly: 0,
    cta: { label: "Start for free", href: "#start" },
    features: [
      "Open-source GUI for the Sui CLI",
      "Tokenized design system",
      "Community support",
    ],
    featured: false,
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "For teams who need every template, brand-ready on day one.",
    monthly: 24,
    cta: { label: "Start with Studio", href: "#start" },
    features: [
      "Everything in Starter",
      "Full template library access",
      "Brand presets and theme tooling",
      "Priority support, weekly updates",
    ],
    featured: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For organizations with bespoke design and compliance needs.",
    monthly: null,
    cta: { label: "Talk to sales", href: "#contact" },
    features: [
      "Everything in Studio",
      "Custom integrations and SSO",
      "Dedicated solutions partner",
      "Audit, SLA, and procurement support",
    ],
    featured: false,
  },
];

type Billing = "monthly" | "annual";

function formatPrice(monthly: number, billing: Billing): string {
  if (monthly === 0) return "$0";
  const effective = billing === "annual" ? monthly * 0.8 : monthly;
  const rounded = Math.round(effective * 10) / 10;
  return Number.isInteger(rounded) ? `$${rounded}` : `$${rounded.toFixed(2)}`;
}

export function Pricing(): ReactNode {
  const [billing, setBilling] = useState<Billing>("monthly");
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="relative border-b border-border p-6 sm:p-10 lg:p-14"
    >
      <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h2
            id={headingId}
            className="text-2xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-3xl lg:text-[2.5rem]"
          >
            Three tiers. No surprises.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            Start free, scale into the full library when your team is
            ready, and bring it in-house when the work demands it.
          </p>
        </div>

        <BillingToggle value={billing} onChange={setBilling} />
      </div>

      <div className="relative mt-12 grid grid-cols-1 gap-4 lg:mt-16 lg:grid-cols-3 lg:gap-6">
        {TIERS.map((tier) => (
          <PricingCard key={tier.id} tier={tier} billing={billing} />
        ))}
      </div>
      <SectionCorners />
    </section>
  );
}

function BillingToggle({
  value,
  onChange,
}: {
  value: Billing;
  onChange: (next: Billing) => void;
}): ReactNode {
  const isAnnual = value === "annual";
  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      className="inline-flex items-center gap-4"
    >
      <div className="relative inline-flex h-10 items-center rounded-full bg-muted p-1">
        <span
          aria-hidden="true"
          className={`absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-foreground transition-transform duration-300 ease-out ${
            isAnnual ? "translate-x-full" : "translate-x-0"
          }`}
        />
        {(["monthly", "annual"] as const).map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option)}
              className={`focus-ring relative z-10 inline-flex h-8 items-center justify-center rounded-full px-4 font-mono text-xs font-medium uppercase tracking-[0.12em] transition-colors ${
                active ? "text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option === "monthly" ? "Monthly" : "Annual"}
            </button>
          );
        })}
      </div>
      <span
        className={`font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-opacity ${
          isAnnual ? "text-foreground opacity-100" : "text-muted-foreground opacity-60"
        }`}
      >
        Save 20% with annual
      </span>
    </div>
  );
}

function PricingCard({
  tier,
  billing,
}: {
  tier: Tier;
  billing: Billing;
}): ReactNode {
  const { featured } = tier;
  const featuredShadow = featured
    ? "shadow-[0_12px_32px_-18px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.45)]"
    : "";
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <article
      className={`relative flex min-h-[480px] flex-col overflow-hidden rounded-2xl border border-border bg-background p-6 text-foreground sm:p-8 lg:min-h-[520px] ${featuredShadow}`}
    >
      {featured ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-40"
        >
          <DitherShader
            variant="cta"
            tone={
              isDark
                ? { r: 0.18, g: 0.18, b: 0.18 }
                : { r: 0.83, g: 0.83, b: 0.83 }
            }
          />
        </div>
      ) : null}

      <div className="relative z-10 flex h-full flex-col">
        <header className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            {tier.name}
          </h3>
          {featured ? (
            <span className="inline-flex items-center rounded-full bg-foreground px-3 py-1 font-mono text-[0.625rem] font-medium uppercase tracking-[0.16em] text-background">
              Most popular
            </span>
          ) : null}
        </header>

        <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {tier.tagline}
        </p>

        <div className="mt-10 flex items-baseline gap-2">
          {tier.monthly === null ? (
            <span className="text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
              Custom
            </span>
          ) : (
            <>
              <span className="text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
                {formatPrice(tier.monthly, billing)}
              </span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </>
          )}
        </div>
        {tier.monthly !== null && tier.monthly > 0 ? (
          <p className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
            {billing === "annual" ? "Billed annually" : "Billed monthly"}
          </p>
        ) : (
          <p className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
            {tier.monthly === 0 ? "Free forever" : "Volume pricing"}
          </p>
        )}

        <ul className="mt-10 space-y-3">
          {tier.features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-3 text-sm leading-relaxed text-foreground"
            >
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                <Check className="h-3 w-3" strokeWidth={2} />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-10">
          <a
            href={tier.cta.href}
            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3.5 font-mono text-xs font-medium uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-90"
          >
            {tier.cta.label}
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </article>
  );
}

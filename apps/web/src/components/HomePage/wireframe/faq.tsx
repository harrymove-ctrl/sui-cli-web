import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import { type ReactNode, useId, useState } from "react";
import { SectionCorners } from "./section-corners";

const PANEL_TRANSITION: Transition = {
  duration: 0.4,
  ease: [0.22, 1, 0.36, 1],
};

const CHEVRON_TRANSITION: Transition = {
  duration: 0.3,
  ease: [0.22, 1, 0.36, 1],
};

type FAQ = {
  q: string;
  a: ReadonlyArray<string>;
};

const FAQS: ReadonlyArray<FAQ> = [
  {
    q: "What exactly does Sui CLI Web give me?",
    a: [
      "Sui CLI Web provides a visual, highly responsive dashboard over the standard Sui CLI. Instead of typing commands in the terminal, you get an intuitive graphical interface to manage local nodes, environments, keys, and smart contracts—all with real-time feedback and metrics.",
    ],
  },
  {
    q: "Do I need to stop using the terminal?",
    a: [
      "Not at all. Sui CLI Web complements the terminal by providing a visual overview of your Sui ecosystem. You can still use the standard CLI whenever you prefer. It works beautifully alongside your existing workflow.",
    ],
  },
  {
    q: "Does it support local development nodes?",
    a: [
      "Yes. You can start, stop, and monitor local Sui nodes directly from the dashboard. It hooks into your local environment to give you live transaction logs, RPC latency, and node health metrics instantly.",
    ],
  },
  {
    q: "Is it open source?",
    a: [
      "Yes. Sui CLI Web is fully open source and free to use for the community. Teams use it as an essential tool to streamline their smart contract development and network interactions.",
    ],
  },
  {
    q: "Can I manage multiple networks?",
    a: [
      "Absolutely. You can seamlessly switch between localnet, devnet, testnet, and mainnet. The interface instantly updates to reflect the active environment's state, RPC endpoints, and active addresses.",
    ],
  },
  {
    q: "Will this speed up my development?",
    a: [
      "That's the goal. By reducing the cognitive load of remembering complex CLI flags and providing instant visual feedback for transaction results, Sui CLI Web significantly accelerates your Move development lifecycle.",
    ],
  },
];

export function Faq(): ReactNode {
  const [openIndex, setOpenIndex] = useState<number>(0);
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="relative border-b border-border p-6 sm:p-10 lg:p-14"
    >
      <h2
        id={headingId}
        className="text-3xl font-medium leading-[1.05] tracking-tighter text-foreground sm:text-4xl lg:text-[3.5rem]"
      >
        FAQs
      </h2>

      <div className="mt-6 border-t border-border sm:mt-10 lg:mt-14">
        <ul className="divide-y divide-border">
          {FAQS.map((faq, i) => (
            <FaqRow
              key={faq.q}
              faq={faq}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex((prev) => (prev === i ? -1 : i))}
            />
          ))}
        </ul>
      </div>
      <SectionCorners />
    </section>
  );
}

function FaqRow({
  faq,
  isOpen,
  onToggle,
}: {
  faq: FAQ;
  isOpen: boolean;
  onToggle: () => void;
}): ReactNode {
  const triggerId = useId();
  const panelId = useId();

  return (
    <li>
      <button
        id={triggerId}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="focus-ring flex w-full cursor-pointer items-center justify-between gap-6 py-6 text-left sm:py-7"
      >
        <span className="text-base font-medium leading-snug tracking-tight text-foreground sm:text-lg">
          {faq.q}
        </span>

        {/* Chevron capsule. Cross-fades two background layers so the closed
         * state shows a filled muted chip and the open state shows a hairline
         * border ring. Animating the layers' opacities sidesteps Motion's
         * inability to interpolate between CSS-variable colors. */}
        <motion.span
          aria-hidden="true"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={CHEVRON_TRANSITION}
          className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center text-foreground"
        >
          <motion.span
            className="absolute inset-0 rounded-full bg-muted"
            animate={{ opacity: isOpen ? 0 : 1 }}
            transition={CHEVRON_TRANSITION}
          />
          <motion.span
            className="absolute inset-0 rounded-full border border-border"
            animate={{ opacity: isOpen ? 1 : 0 }}
            transition={CHEVRON_TRANSITION}
          />
          <ChevronDown className="relative h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.section
            id={panelId}
            role="region"
            aria-labelledby={triggerId}
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={PANEL_TRANSITION}
            style={{ overflow: "hidden" }}
          >
            <motion.div
              initial={{ y: -6 }}
              animate={{ y: 0 }}
              exit={{ y: -6 }}
              transition={PANEL_TRANSITION}
              className="max-w-3xl space-y-4 pb-7 pr-12 text-sm leading-relaxed text-muted-foreground sm:text-base"
            >
              {faq.a.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
    </li>
  );
}

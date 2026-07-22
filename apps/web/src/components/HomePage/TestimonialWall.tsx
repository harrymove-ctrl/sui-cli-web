import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Testimonial, Testimonials } from "@/components/ui/testimonials";

/**
 * The landing page is dark-on-dark regardless of the app theme (which defaults
 * to light), so the shadcn tokens the testimonial component reads are pinned to
 * their dark values for this section only.
 */
const DARK_TOKENS = {
  "--foreground": "0 0% 98%",
  "--muted-foreground": "0 0% 45%",
  "--muted": "0 0% 100% / 0.06",
  "--border": "0 0% 100% / 0.14",
} as CSSProperties;

export function TestimonialWall() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative z-20 px-4 py-16 sm:py-20 md:py-24">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: prefersReducedMotion ? 0.2 : 0.6 }}
        >
          <p className="mb-8 font-mono text-xs uppercase tracking-[0.2em] text-white/30 sm:mb-10">
            <span className="text-rose-500">$</span> who&apos;s shipping with it
          </p>

          <div style={DARK_TOKENS}>
            <Testimonials blur={4} dimOpacity={0.18}>
              <Testimonial name="Linh Tran" title="Move Engineer, Suiflow">
                Publishing a package used to be four terminal tabs and a prayer.
                Now it&apos;s one keystroke and I can actually read the object
                changes.
              </Testimonial>
              <Testimonial name="Marcus Reed" title="Founder, Onchain Labs">
                The gas breakdown alone paid for itself — we caught a loop that
                was burning 40% of our budget on a single entry function.
              </Testimonial>
              <Testimonial name="Aiko Nakamura" title="Smart Contract Auditor">
                I keep it open next to the explorer during reviews. Being able
                to split, merge and inspect coins without leaving the keyboard
                is the whole pitch.
              </Testimonial>
              <Testimonial name="Deniz Yilmaz" title="DevRel, Sui Ecosystem">
                We put it in front of forty workshop attendees who&apos;d never
                touched Move. Nobody got stuck on environment setup. That has
                never happened before.
              </Testimonial>
              <Testimonial name="Priya Sharma" title="Protocol Engineer">
                It runs the CLI I already trust — no hosted keys, no wrapper
                service, nothing leaves my machine. That&apos;s why it survived
                past the demo.
              </Testimonial>
            </Testimonials>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

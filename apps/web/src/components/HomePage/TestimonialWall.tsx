import { motion, useReducedMotion } from "framer-motion";
import { Testimonial, Testimonials } from "@/components/ui/testimonials";

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
          <p className="mb-8 font-mono text-xs uppercase tracking-[0.2em] text-foreground/30 sm:mb-10">
            <span className="text-foreground">$</span> who&apos;s shipping with it
          </p>

            <Testimonials blur={4} dimOpacity={0.18}>
              <Testimonial name="Harry Phan" title="Smart Contract Engineer">
                Publishing a package used to be four terminal tabs and a prayer.
                Now it&apos;s one keystroke and I can actually read the object
                changes.
              </Testimonial>
              <Testimonial name="Hulk" title="Smart Contract Engineer">
                The gas breakdown alone paid for itself — we caught a loop that
                was burning 40% of our budget on a single entry function.
              </Testimonial>
              <Testimonial name="Smart Contract Auditor">
                I keep it open next to the explorer during reviews. Being able
                to split, merge and inspect coins without leaving the keyboard
                is the whole pitch.
              </Testimonial>
              <Testimonial name="Sui DevRel">
                We put it in front of forty workshop attendees who&apos;d never
                touched Move. Nobody got stuck on environment setup. That has
                never happened before.
              </Testimonial>
              <Testimonial name="Software Engineer">
                It runs the CLI I already trust — no hosted keys, no wrapper
                service, nothing leaves my machine. That&apos;s why it survived
                past the demo.
              </Testimonial>
            </Testimonials>
        </motion.div>
      </div>
    </section>
  );
}

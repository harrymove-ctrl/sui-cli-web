import {
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Terminal, Send, Zap, Network, Droplets, Users, Package, Eye } from "lucide-react";

// Feature cards data with images - matching actual app screenshots
const FEATURE_CARDS = [
  {
    id: 'commands',
    title: 'Command Palette',
    description: 'Keyboard-first interface with instant access to all Sui CLI commands',
    icon: Terminal,
    gradient: 'from-rose-500/20 to-pink-500/20',
    borderColor: 'border-rose-500/30',
    image: '/images/landing/app_commands.png',
  },
  {
    id: 'addresses',
    title: 'Address Management',
    description: 'Create, switch, and label addresses with real-time SUI balance tracking',
    icon: Terminal,
    gradient: 'from-blue-500/20 to-cyan-500/20',
    borderColor: 'border-blue-500/30',
    image: '/images/landing/addresses.png',
  },
  {
    id: 'coins',
    title: 'Coin Management',
    description: 'View all coins with balance, merge/split gas, and transfer tokens',
    icon: Zap,
    gradient: 'from-yellow-500/20 to-orange-500/20',
    borderColor: 'border-yellow-500/30',
    image: '/images/landing/coins_management.png',
  },
  {
    id: 'objects',
    title: 'Object Explorer',
    description: 'Browse NFTs, capabilities, and on-chain objects with category filters',
    icon: Eye,
    gradient: 'from-cyan-500/20 to-teal-500/20',
    borderColor: 'border-cyan-500/30',
    image: '/images/landing/objects_management.png',
  },
  {
    id: 'move',
    title: 'Move Studio',
    description: 'Build, test, and publish Move packages with terminal output',
    icon: Package,
    gradient: 'from-green-500/20 to-emerald-500/20',
    borderColor: 'border-green-500/30',
    image: '/images/landing/move-studio.png',
  },
  {
    id: 'workflows',
    title: 'Package Workflows',
    description: 'Visual build pipeline with step-by-step progress tracking',
    icon: Network,
    gradient: 'from-purple-500/20 to-violet-500/20',
    borderColor: 'border-purple-500/30',
    image: '/images/landing/package_workflows.png',
  },
  {
    id: 'packages',
    title: 'Deployed Packages',
    description: 'Inspect modules, view functions, and call deployed contracts',
    icon: Package,
    gradient: 'from-pink-500/20 to-rose-500/20',
    borderColor: 'border-pink-500/30',
    image: '/images/landing/package_deployted_profiles.png',
  },
];

interface StickyCardProps {
  card: typeof FEATURE_CARDS[0];
  index: number;
}

function StickyCard({ card, index }: StickyCardProps) {
  const vertMargin = 10;
  const container = useRef(null);
  const [maxScrollY, setMaxScrollY] = useState(Infinity);

  const filter = useMotionValue(0);
  const negateFilter = useTransform(filter, (value) => -value);

  const { scrollY } = useScroll({
    target: container,
  });

  const scale = useTransform(scrollY, [maxScrollY - 500, maxScrollY + 200], [0.85, 1]);

  const isInView = useInView(container, {
    margin: `0px 0px -${100 - vertMargin}% 0px`,
    once: true,
  });

  useEffect(() => {
    const unsubscribe = scrollY.on("change", (currentScrollY) => {
      // Scale UP from 0.85 to 1 as card comes into view
      const scrollStart = maxScrollY - 500;
      const scrollEnd = maxScrollY + 200;
      let animationValue = 0.85;

      if (currentScrollY >= scrollStart && currentScrollY <= scrollEnd) {
        const progress = (currentScrollY - scrollStart) / (scrollEnd - scrollStart);
        animationValue = 0.85 + (progress * 0.15); // 0.85 -> 1.0
      } else if (currentScrollY > scrollEnd) {
        animationValue = 1;
      }

      scale.set(animationValue);
      // Reduce filter effect since we're scaling up now
      filter.set((1 - animationValue) * 10);
    });
    return () => unsubscribe();
  }, [maxScrollY, scrollY, scale, filter]);

  useEffect(() => {
    if (isInView) {
      setMaxScrollY(scrollY.get());
    }
  }, [isInView, scrollY]);

  return (
    <motion.div
      ref={container}
      className="sticky w-full max-w-5xl overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 shadow-2xl"
      style={{
        scale: scale,
        rotate: filter,
        height: `${100 - 2 * vertMargin}vh`,
        top: `${vertMargin}vh`,
      }}
    >
      <motion.div
        style={{ rotate: negateFilter }}
        className="h-full w-full relative"
      >
        {/* Full-bleed Image */}
        <img
          src={card.image}
          alt={card.title}
          className="w-full h-full object-cover object-top"
          loading="lazy"
        />

        {/* Gradient Overlay with Title */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6 sm:p-10">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
            {card.title}
          </h3>
          <p className="text-sm sm:text-base text-white/70 max-w-lg">
            {card.description}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function StickyCardsSection() {
  return (
    <section className="relative flex w-full flex-col items-center gap-[8vh] sm:gap-[10vh] px-2 sm:px-4 pt-0 pb-[20vh] sm:pb-[30vh] -mt-[15vh] sm:-mt-[20vh]">
      {/* Section header */}
      <div className="text-center mb-4 sm:mb-8">
        <span className="text-rose-400 text-xs sm:text-sm tracking-wider uppercase">Features in Action</span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mt-1 sm:mt-2">
          See what you can do
        </h2>
      </div>

      {FEATURE_CARDS.map((card, idx) => (
        <StickyCard key={card.id} card={card} index={idx} />
      ))}
    </section>
  );
}

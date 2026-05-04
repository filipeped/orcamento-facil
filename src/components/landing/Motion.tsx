import { motion, useInView, useMotionValue, useTransform, animate } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

// Easing suave e profissional — não é bounce, não é slam
const SMOOTH = [0.22, 1, 0.36, 1] as const;

type Direction = "up" | "down" | "left" | "right" | "scale" | "none";

interface RevealProps {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  once?: boolean;
  amount?: number;
}

// Componente base: aparece quando entra na viewport
export function Reveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.5,
  distance = 12,
  className = "",
  once = true,
  amount = 0.2,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount });

  const initial: Record<string, number> = { opacity: 0 };
  if (direction === "up") initial.y = distance;
  if (direction === "down") initial.y = -distance;
  if (direction === "left") initial.x = -distance;
  if (direction === "right") initial.x = distance;
  if (direction === "scale") initial.scale = 0.95;

  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={
        inView
          ? { opacity: 1, y: 0, x: 0, scale: 1 }
          : initial
      }
      transition={{ duration, delay, ease: SMOOTH }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Stagger: aplica a cada filho direto com delay incremental
interface StaggerProps {
  children: ReactNode;
  delay?: number;
  stagger?: number;
  className?: string;
  direction?: Direction;
  once?: boolean;
  amount?: number;
}

export function Stagger({
  children,
  delay = 0,
  stagger = 0.08,
  className = "",
  direction = "up",
  once = true,
  amount = 0.15,
}: StaggerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount });

  const variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  };

  const itemInitial: Record<string, number> = { opacity: 0 };
  if (direction === "up") itemInitial.y = 10;
  if (direction === "down") itemInitial.y = -10;
  if (direction === "left") itemInitial.x = -10;
  if (direction === "right") itemInitial.x = 10;

  const item = {
    hidden: itemInitial,
    show: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: 0.4, ease: SMOOTH },
    },
  };

  return (
    <motion.div
      ref={ref}
      variants={variants}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      className={className}
    >
      {Array.isArray(children)
        ? children.map((child, i) => (
            <motion.div key={i} variants={item}>
              {child}
            </motion.div>
          ))
        : <motion.div variants={item}>{children}</motion.div>}
    </motion.div>
  );
}

// Counter: anima número de 0 até o valor final
interface CounterProps {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  format?: (n: number) => string;
}

export function Counter({
  value,
  duration = 1.2,
  suffix = "",
  prefix = "",
  className = "",
  format,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => {
    const n = Math.round(latest);
    return format ? format(n) : n.toString();
  });

  useEffect(() => {
    if (inView) {
      const controls = animate(count, value, {
        duration,
        ease: SMOOTH,
      });
      return () => controls.stop();
    }
  }, [inView, value, duration, count]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}

// Hover sutil pra cards/CTAs
interface HoverLiftProps {
  children: ReactNode;
  className?: string;
  lift?: number;
  onClick?: () => void;
}

export function HoverLift({ children, className = "", lift = 2 }: HoverLiftProps) {
  return (
    <motion.div
      whileHover={{ y: -lift }}
      transition={{ duration: 0.2, ease: SMOOTH }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

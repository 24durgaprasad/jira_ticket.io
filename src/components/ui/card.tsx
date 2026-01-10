import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { HTMLMotionProps } from 'framer-motion';

interface CardProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={cn(
                "rounded-3xl border border-white/5 bg-slate-900/60 p-8 shadow-xl backdrop-blur-xl",
                "transition-all duration-300 hover:shadow-cyan-900/10 hover:border-white/10",
                className
            )}
            {...props}
        >
            {children}
        </motion.div>
    );
}

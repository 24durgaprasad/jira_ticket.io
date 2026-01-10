import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export interface ButtonProps extends React.ComponentPropsWithoutRef<typeof motion.button> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
    isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', isLoading, children, disabled, ...props }, ref) => {
        const variants = {
            primary: "bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-900/20 hover:shadow-sky-900/40 hover:translate-y-[-1px]",
            secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700",
            ghost: "bg-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/50",
            outline: "bg-transparent border border-slate-700 text-slate-300 hover:bg-slate-800/50 hover:text-white"
        };

        return (
            <motion.button
                ref={ref}
                whileTap={{ scale: 0.98 }}
                disabled={disabled || isLoading}
                className={cn(
                    "inline-flex items-center justify-center rounded-xl px-6 py-3.5 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/50 disabled:opacity-50 disabled:cursor-not-allowed",
                    variants[variant],
                    className
                )}
                {...props}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing
                    </>
                ) : (
                    children
                )}
            </motion.button>
        );
    }
);
Button.displayName = "Button";

export { Button };

import { CSSProperties, FC, ReactNode } from 'react';

interface ShinyTextProps {
    children: ReactNode;
    disabled?: boolean;
    speed?: number;
    className?: string;
    shimmerWidth?: number;
}

export const ShinyText: FC<ShinyTextProps> = ({
    children,
    disabled = false,
    speed = 5,
    className = '',
    // shimmerWidth = 100, // Placeholder for future width control
}) => {
    const animationDuration = `${speed}s`;

    return (
        <div
            className={`text-[#b5b5b5a4] bg-clip-text inline-block ${disabled ? '' : 'animate-shine'} ${className}`}
            style={
                {
                    backgroundImage:
                        'linear-gradient(120deg, rgba(255, 255, 255, 0) 40%, rgba(255, 255, 255, 0.8) 50%, rgba(255, 255, 255, 0) 60%)',
                    backgroundSize: '200% 100%',
                    WebkitBackgroundClip: 'text',
                    animationDuration: animationDuration,
                } as CSSProperties
            }
        >
            {children}
        </div>
    );
};

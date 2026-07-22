import { cn } from '@/lib/utils';

interface CRTWrapperProps {
    children: React.ReactNode;
    className?: string;
}

export const CRTWrapper = ({ children, className }: CRTWrapperProps) => {
    return (
        <div className="relative w-full h-full overflow-hidden perspective-2000">
            {/* CRT Curvature Container */}
            <div
                className={cn(
                    "relative w-full h-full transition-transform duration-500",
                    "origin-center",
                    className
                )}
                style={{
                    transform: "rotateX(2deg) scale(0.98)", // Slight tilt and scale to fit curvature
                    transformStyle: "preserve-3d",
                }}
            >
                {/* Main Content */}
                <div className="relative z-10 w-full h-full">
                    {children}
                </div>

                {/* Screen Effects Overlay */}
                <div className="absolute inset-0 z-50 pointer-events-none">
                    {/* Vignette */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.4)_100%)]" />

                    {/* Scanlines */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))]"
                        style={{ backgroundSize: "100% 3px, 3px 100%" }}
                    />

                    {/* Screen Glare */}
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/5 to-transparent opacity-30 rounded-t-[50%]" />
                </div>
            </div>
        </div>
    );
};

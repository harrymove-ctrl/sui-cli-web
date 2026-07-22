export function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Floating particles */}
      <div className="absolute top-[10%] left-[10%] w-1 h-1 bg-[#4da2ff]/40 rounded-full animate-float" />
      <div className="absolute top-[20%] right-[15%] w-1.5 h-1.5 bg-[#0ea5e9]/30 rounded-full animate-float" style={{ animationDelay: '1s' }} />
      <div className="absolute top-[40%] left-[20%] w-1 h-1 bg-[#4da2ff]/50 rounded-full animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[60%] right-[25%] w-2 h-2 bg-[#0ea5e9]/20 rounded-full animate-float" style={{ animationDelay: '3s' }} />
      <div className="absolute bottom-[20%] left-[30%] w-1 h-1 bg-[#4da2ff]/40 rounded-full animate-float" style={{ animationDelay: '4s' }} />
      <div className="absolute bottom-[30%] right-[20%] w-1.5 h-1.5 bg-[#0ea5e9]/35 rounded-full animate-float" style={{ animationDelay: '5s' }} />

      {/* Larger glowing orbs */}
      <div className="absolute top-[25%] left-[40%] w-3 h-3 bg-[#4da2ff]/10 rounded-full blur-sm animate-float" style={{ animationDelay: '1.5s', animationDuration: '8s' }} />
      <div className="absolute top-[70%] right-[40%] w-4 h-4 bg-[#0ea5e9]/10 rounded-full blur-sm animate-float" style={{ animationDelay: '2.5s', animationDuration: '10s' }} />
    </div>
  );
}

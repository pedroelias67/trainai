interface LogoProps {
  size?: number;
  className?: string;
}

export function LogoIcon({ size = 36, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 90 90"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="90" height="90" rx="20" fill="#0a0a0a" />
      <rect x="12" y="14" width="44" height="10" rx="3" fill="#22c55e" />
      <rect x="28" y="24" width="14" height="42" rx="3" fill="#22c55e" />
      <rect x="62" y="14" width="8" height="8" rx="2" fill="#22c55e" opacity="0.9" />
      <rect x="62" y="28" width="8" height="8" rx="2" fill="#22c55e" opacity="0.6" />
      <rect x="62" y="42" width="8" height="8" rx="2" fill="#22c55e" opacity="0.35" />
    </svg>
  );
}

export function LogoFull({ size = 36, className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={size} />
      <span
        style={{ fontSize: size * 0.56, fontWeight: 700, letterSpacing: "-0.03em" }}
        className="text-white"
      >
        Train<span className="text-green-400">AI</span>
      </span>
    </div>
  );
}

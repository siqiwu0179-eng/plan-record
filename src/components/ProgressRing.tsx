type ProgressRingProps = {
  value: number;
  color?: string;
  size?: "sm" | "md";
};

export function ProgressRing({ value, color = "#2563eb", size = "md" }: ProgressRingProps) {
  const dimension = size === "sm" ? "h-12 w-12" : "h-14 w-14";
  const inner = size === "sm" ? "h-8 w-8" : "h-10 w-10";

  return (
    <div
      className={`${dimension} flex shrink-0 items-center justify-center rounded-full`}
      style={{
        background: `conic-gradient(${color} ${value * 3.6}deg, #e5e7eb 0deg)`,
      }}
      aria-label={`完成度 ${value}%`}
    >
      <div className={`${inner} flex items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700`}>
        {value > 0 ? `${value}%` : "-"}
      </div>
    </div>
  );
}

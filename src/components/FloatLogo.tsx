import { Waves } from "lucide-react";

export function FloatLogo({ size = "default" }: { size?: "default" | "large" }) {
  const iconSize = size === "large" ? 28 : 20;
  const textClass = size === "large" ? "text-2xl" : "text-lg";

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center rounded-lg bg-primary p-1.5">
        <Waves className="text-primary-foreground" size={iconSize} />
      </div>
      <span className={`font-bold text-foreground ${textClass}`}>Float</span>
    </div>
  );
}

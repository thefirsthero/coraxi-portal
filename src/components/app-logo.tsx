import { appConfig } from "@/config/app";

export function AppLogo() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl">🌀</span>
      <span className="font-semibold text-nowrap">{appConfig.name}</span>
    </div>
  );
}

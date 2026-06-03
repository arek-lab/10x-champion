import { BellOff } from "lucide-react";

export default function AlertsPanel() {
  return (
    <div className="text-sidebar-foreground/60 flex flex-col items-center justify-center py-16">
      <BellOff className="mb-3 size-10" />
      <p className="text-sm">No alerts yet</p>
    </div>
  );
}

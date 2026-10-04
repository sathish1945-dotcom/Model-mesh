import React from "react";
import { Sparkles } from "lucide-react";
export const RoutingIndicator: React.FC<{
  status: "routing" | "streaming" | "idle";
}> = ({ status }) =>
  status === "idle" ? null : (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-3 text-xs text-blue-500"
    >
      <Sparkles size={14} aria-hidden="true" />
      <span>
        {status === "routing" ? "hello is thinking…" : "hello is replying…"}
      </span>
    </div>
  );

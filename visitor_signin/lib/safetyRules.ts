// The kinds of site rule in the safety briefing (Visitor Connect). No database access here, so the
// briefing can be shown in the browser too (phone sign-in, admin preview).
import type { IconName } from "@/app/Icon";

/** The kinds of rule, each with its icon, colour (stop / must / warn / safe / info) and name. */
export const RULE_KINDS: Record<string, { icon: IconName; tone: "stop" | "must" | "warn" | "safe" | "info"; label: string }> = {
  badge: { icon: "badge", tone: "must", label: "Visitor badge" },
  escort: { icon: "userCheck", tone: "must", label: "Stay with host" },
  camera: { icon: "cameraOff", tone: "stop", label: "No photos" },
  usb: { icon: "usb", tone: "stop", label: "No USB devices" },
  wifi: { icon: "wifi", tone: "info", label: "Guest Wi-Fi" },
  data: { icon: "eye", tone: "warn", label: "Client data" },
  smoke: { icon: "noSmoke", tone: "stop", label: "No smoking" },
  fire: { icon: "flame", tone: "warn", label: "Fire safety" },
  assembly: { icon: "users", tone: "safe", label: "Assembly point" },
  firstaid: { icon: "cross", tone: "safe", label: "First aid" },
  laptop: { icon: "laptop", tone: "must", label: "Laptop check" },
  info: { icon: "info", tone: "info", label: "Information" },
};


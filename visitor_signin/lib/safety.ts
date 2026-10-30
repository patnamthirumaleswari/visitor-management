import { LOCATION } from "./config";
import type { SafetyBriefing } from "./types";
export { RULE_KINDS } from "./safetyRules";

// Site safety briefing (Visitor Connect): emergency number, assembly point, notes, site rules with
// icons and an optional exit-plan picture. Visitors read it and tick that they will follow it before
// they sign in; admins edit it on /admin/safety. Every save that changes it publishes a new version,
// and each visit records which version the visitor accepted.

/** The starting briefing (from the Visitor Connect design), used until an admin saves their own. */
export function startingBriefing(): SafetyBriefing {
  return {
    enabled: true,
    version: 1,
    emergencyPhone: "+91 90000 12345",
    assemblyPoint: "Main Gate lawn",
    notes: ["If the fire alarm sounds for more than 20 seconds, walk to the assembly point."],
    rules: [
      { kind: "badge", text: "Wear your visitor badge where it can be seen at all times." },
      { kind: "escort", text: "Stay with your host. Do not enter work areas on your own." },
      { kind: "camera", text: "No photos or videos in project rooms, labs or the server room." },
      { kind: "usb", text: "Do not connect USB drives or personal devices to company computers." },
      { kind: "wifi", text: "Use only the guest Wi-Fi network. Your host can give you the password." },
      { kind: "data", text: "Work on screens and whiteboards is confidential. Do not read, copy or share it." },
      { kind: "smoke", text: "Smoking and tobacco are not allowed anywhere on site." },
      { kind: "fire", text: "Know your nearest exit. Do not use the lift when the fire alarm sounds." },
      { kind: "assembly", text: "In an emergency, leave by the nearest exit and go to the assembly point." },
      { kind: "firstaid", text: "First-aid kits are at reception and on every floor." },
    ],
    exitPlan: null,
    updatedAt: new Date(0).toISOString(),
  };
}

/** What the visitor's phone shows: the briefing plus the location name. */
export type BriefingView = SafetyBriefing & { locationName: string };
export const toView = (b: SafetyBriefing): BriefingView => ({ ...b, locationName: LOCATION.name });

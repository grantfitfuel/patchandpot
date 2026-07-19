/**
 * Canonical list of "Grow Anywhere" situations — MUST match the SITUATIONS
 * list in /app/backend/plants_grow_anywhere.py exactly (same ids, same
 * order). The order is the display order on the /grow-anywhere landing
 * page and the filter-chip row on /plants.
 *
 * Each entry carries:
 *  - id       — snake-slug used in URLs (?situation=windowsill) and as
 *               the value stored in each plant's `grow_anywhere` list
 *  - icon     — lucide-react icon component
 *  - section  — grouping bucket on the landing page
 */
import {
  Home, Briefcase, Building2, Sun as SunIcon,
  TreePine, Grip, LayoutGrid, ShoppingBag,
  Trash2, Square, Fence, Droplet,
} from "lucide-react";

// Lucide doesn't ship a dedicated brick/basket icon — we reuse `Grip` for
// both the trailing hanging-basket and the dry-stone wall-crevice slots.
export const SITUATIONS = [
  { id: "windowsill",     icon: Home,        section: "small_indoors" },
  { id: "workplace",      icon: Briefcase,   section: "small_indoors" },
  { id: "balcony",        icon: Building2,   section: "outdoors_small" },
  { id: "rooftop",        icon: SunIcon,     section: "outdoors_small" },
  { id: "shady-corner",   icon: TreePine,    section: "outdoors_small" },
  { id: "hanging-basket", icon: Grip,        section: "creative" },
  { id: "wall-crevice",   icon: Grip,        section: "creative" },
  { id: "vertical-wall",  icon: LayoutGrid,  section: "creative" },
  { id: "grow-bag",       icon: ShoppingBag, section: "bigger" },
  { id: "bucket",         icon: Trash2,      section: "bigger" },
  { id: "crate",          icon: Square,      section: "bigger" },
  { id: "raised-bed",     icon: Fence,       section: "bigger" },
  { id: "water-jar",      icon: Droplet,     section: "no_soil" },
];

export const SITUATION_IDS = SITUATIONS.map((s) => s.id);

export const SITUATION_SECTIONS = [
  { id: "small_indoors",  ids: ["windowsill", "workplace"] },
  { id: "outdoors_small", ids: ["balcony", "rooftop", "shady-corner"] },
  { id: "creative",       ids: ["hanging-basket", "wall-crevice", "vertical-wall"] },
  { id: "bigger",         ids: ["grow-bag", "bucket", "crate", "raised-bed"] },
  { id: "no_soil",        ids: ["water-jar"] },
];

export function getSituation(id) {
  return SITUATIONS.find((s) => s.id === id);
}

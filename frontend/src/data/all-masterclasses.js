// Combined masterclass registry. Keeps the existing API stable while
// adding a second category (per-flower).
import { MASTERCLASSES, MASTERCLASS_ORDER } from "./masterclasses";
import { FLOWER_MASTERCLASSES, FLOWER_MASTERCLASS_ORDER } from "./flower-masterclasses";

export const ALL_MASTERCLASSES = { ...MASTERCLASSES, ...FLOWER_MASTERCLASSES };

export const MASTERCLASS_SECTIONS = [
  {
    key: "foundations",
    label: "Foundation",
    title: "Foundations",
    description: "Three structured courses on the universal skills of growing.",
    order: MASTERCLASS_ORDER,
  },
  {
    key: "flowers",
    label: "By flower",
    title: "Flower Masterclasses",
    description: "Deep dives into specific flowers — choosing varieties, planting, growing, and harvest.",
    order: FLOWER_MASTERCLASS_ORDER,
  },
];

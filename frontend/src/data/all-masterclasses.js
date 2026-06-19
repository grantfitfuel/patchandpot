// Combined masterclass registry. Keeps the existing API stable while
// adding category sections.
import { MASTERCLASSES, MASTERCLASS_ORDER } from "./masterclasses";
import { FLOWER_MASTERCLASSES, FLOWER_MASTERCLASS_ORDER } from "./flower-masterclasses";
import { ARRANGING_MASTERCLASS, ARRANGING_MASTERCLASS_ORDER } from "./arranging-masterclass";

export const ALL_MASTERCLASSES = {
  ...MASTERCLASSES,
  ...ARRANGING_MASTERCLASS,
  ...FLOWER_MASTERCLASSES,
};

export const MASTERCLASS_SECTIONS = [
  {
    key: "foundations",
    label: "Foundation",
    title: "Foundations",
    description: "Four structured courses on the universal skills of growing.",
    order: MASTERCLASS_ORDER,
  },
  {
    key: "arranging",
    label: "Floristry",
    title: "Floristry & Arranging",
    description:
      "Turn home-grown stems into arrangements you'd be proud to put on any table — principles, mechanics, and seasonal recipes.",
    order: ARRANGING_MASTERCLASS_ORDER,
  },
  {
    key: "flowers",
    label: "By flower",
    title: "Flower Masterclasses",
    description:
      "Deep dives into specific flowers — choosing varieties, planting, growing, and harvest.",
    order: FLOWER_MASTERCLASS_ORDER,
  },
];

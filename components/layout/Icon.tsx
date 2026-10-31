import type { CSSProperties } from "react";
export type IconName =
  | "home"
  | "records"
  | "plus"
  | "spark"
  | "user"
  | "menu"
  | "close"
  | "food"
  | "item"
  | "pin"
  | "arrow"
  | "locate"
  | "expand"
  | "logout";
const paths: Record<IconName, string[]> = {
  home: ["M3 10 12 3l9 7", "M5 9v12h5v-7h4v7h5V9"],
  records: ["M5 3h14v18H5z", "M9 8h6M9 12h6M9 16h4"],
  plus: ["M12 5v14M5 12h14"],
  spark: ["m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z"],
  user: ["M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0", "M4 21v-2a8 8 0 0 1 16 0v2"],
  menu: ["M4 6h16M4 12h16M4 18h16"],
  close: ["m6 6 12 12M6 18 18 6"],
  food: ["M5 3v7a3 3 0 0 0 6 0V3M8 3v18M19 3c-3 3-3 7 0 9v9M19 3v9"],
  item: ["m12 3 9 5v9l-9 5-9-5V8z", "m3 8 9 5 9-5M12 13v9M7 5.8l9 5"],
  pin: [
    "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z",
    "M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  ],
  arrow: ["M5 12h14m-6-6 6 6-6 6"],
  locate: [
    "M12 2v3m0 14v3M2 12h3m14 0h3",
    "M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
    "M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0",
  ],
  expand: ["M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"],
  logout: ["M9 3H4v18h5M10 12h11m-5-5 5 5-5 5"],
};
export default function Icon({
  name,
  size = 20,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name].map((d, i) => (
        <path d={d} key={i} />
      ))}
    </svg>
  );
}

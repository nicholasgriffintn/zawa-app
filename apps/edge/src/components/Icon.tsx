import type { SVGProps } from "react";

import type { IconName } from "../lib/icon-names";

import "./Icon.scss";

export type { IconName } from "../lib/icon-names";

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      className={["icon", props.className].filter(Boolean).join(" ")}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      {...props}
    >
      {iconPath(name)}
    </svg>
  );
}

function iconPath(name: IconName) {
  switch (name) {
    case "alert":
      return (
        <>
          <path d="M12 7v6" />
          <path d="M12 17h.01" />
        </>
      );
    case "alert-circle":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </>
      );
    case "arrow-left":
      return (
        <>
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </>
      );
    case "bike":
      return (
        <>
          <circle cx="5.5" cy="17.5" r="3.5" />
          <circle cx="18.5" cy="17.5" r="3.5" />
          <path d="M15 6h2" />
          <path d="m6 17.5 5-7 3 7" />
          <path d="m11 10.5 4 0 3.5 7" />
          <path d="m9 6 2 4.5" />
        </>
      );
    case "bus":
      return (
        <>
          <rect x="4" y="4" width="16" height="13" rx="2" />
          <path d="M4 11h16" />
          <path d="M8 17v2" />
          <path d="M16 17v2" />
          <path d="M8 8h.01" />
          <path d="M16 8h.01" />
          <path d="M7 14h.01" />
          <path d="M17 14h.01" />
        </>
      );
    case "check-circle":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="m8 12 3 3 5-6" />
        </>
      );
    case "check":
      return <path d="m7 12 3 3 7-8" />;
    case "chevron-down":
      return <path d="m6 9 6 6 6-6" />;
    case "chevron-right":
      return <path d="m9 18 6-6-6-6" />;
    case "chevron-up":
      return <path d="m18 15-6-6-6 6" />;
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </>
      );
    case "external-link":
      return (
        <>
          <path d="M15 3h6v6" />
          <path d="M10 14 21 3" />
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </>
      );
    case "map-pin":
      return (
        <>
          <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </>
      );
    case "route":
      return (
        <>
          <circle cx="6" cy="19" r="3" />
          <circle cx="18" cy="5" r="3" />
          <path d="M9 19h4a5 5 0 0 0 0-10h-2a5 5 0 0 1 0-10h4" />
        </>
      );
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </>
      );
    case "signal":
      return (
        <>
          <path d="M5 20v-4" />
          <path d="M12 20v-8" />
          <path d="M19 20V4" />
        </>
      );
    case "star":
      return (
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
      );
    case "train":
      return (
        <>
          <rect x="5" y="3" width="14" height="14" rx="2" />
          <path d="M9 17 7 21" />
          <path d="m15 17 2 4" />
          <path d="M8 8h8" />
          <path d="M8 13h.01" />
          <path d="M16 13h.01" />
        </>
      );
    case "utensils":
      return (
        <>
          <path d="M4 3v8" />
          <path d="M8 3v8" />
          <path d="M4 7h4" />
          <path d="M6 11v10" />
          <path d="M17 3v18" />
          <path d="M17 3c2.2 1.4 3.5 3.7 3.5 6.3V11H17" />
        </>
      );
    case "users":
      return (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
          <path d="M16 3.1a4 4 0 0 1 0 7.8" />
        </>
      );
    case "wifi-off":
      return (
        <>
          <path d="m2 2 20 20" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <path d="M5 13a10 10 0 0 1 5.2-2.9" />
          <path d="M14 10.1A10 10 0 0 1 19 13" />
          <path d="M2 8.8a15 15 0 0 1 5-2.6" />
          <path d="M10.7 5.1A15 15 0 0 1 22 8.8" />
          <path d="M12 20h.01" />
        </>
      );
  }
}

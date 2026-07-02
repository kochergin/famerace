// Typing for React's experimental <ViewTransition> component. The runtime is
// Next's vendored React canary (enabled via experimental.viewTransition in
// next.config.ts); @types/react does not ship this export yet.
import type { ExoticComponent, ReactNode } from "react";

declare module "react" {
  export const unstable_ViewTransition: ExoticComponent<{
    children?: ReactNode;
    /** Optional shared-element name; default participates as a crossfade group. */
    name?: string;
    default?: string;
    enter?: string;
    exit?: string;
    update?: string;
  }>;
}

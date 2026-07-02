import type { MetadataRoute } from "next";

/** PWA installability: FameRace on the home screen (§0B: it's an app-feel product). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FameRace — Back the rise.",
    short_name: "FameRace",
    description: "The internet's talent draft — find rising creators early and back the rise.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0d",
    theme_color: "#0a0a0d",
    icons: [
      { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

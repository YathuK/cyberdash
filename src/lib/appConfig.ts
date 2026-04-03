// How each app should be opened in the Tesla browser
//
// "canvas" = video decoded in JS, rendered to <canvas> (bypasses Tesla video blackout)
// "embed" = loads in an iframe inside CyberDash
// "direct" = navigates the browser tab to the site

export type OpenMode = "canvas" | "embed" | "direct";

const appOpenMode: Record<string, OpenMode> = {
  // Canvas player — bypasses Tesla's <video> element blackout while driving
  youtube: "canvas",

  // Iframe embeddable
  twitch: "embed",
  games: "embed",

  // Must open directly (block iframes, or have DRM that requires native <video>)
  netflix: "direct",
  prime: "direct",
  disney: "direct",
  plex: "direct",
  xbox: "direct",
  nvidia: "direct",
  luna: "direct",
};

export function getOpenMode(icon: string): OpenMode {
  return appOpenMode[icon] || "direct";
}

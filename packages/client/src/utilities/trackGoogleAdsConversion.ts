declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackSignupConversion() {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "conversion", {
      send_to: "AW-18036643783/oEsGCL2InpAcEMevxZhD",
    });
  }
}

/**
 * Shared browser and device detection utilities for session summary emails.
 */

export function parseBrowser(): string {
  const ua = navigator.userAgent;
  let browser = "Unknown";
  let version = "";

  if (/Edg\/(\d+[\.\d]*)/.test(ua)) {
    browser = "Edge";
    version = ua.match(/Edg\/(\d+[\.\d]*)/)?.[1] || "";
  } else if (/Chrome\/(\d+[\.\d]*)/.test(ua) && !/Chromium/.test(ua)) {
    browser = "Chrome";
    version = ua.match(/Chrome\/(\d+[\.\d]*)/)?.[1] || "";
  } else if (/Safari\/(\d+[\.\d]*)/.test(ua) && !/Chrome/.test(ua)) {
    browser = "Safari";
    version = ua.match(/Version\/(\d+[\.\d]*)/)?.[1] || "";
  } else if (/Firefox\/(\d+[\.\d]*)/.test(ua)) {
    browser = "Firefox";
    version = ua.match(/Firefox\/(\d+[\.\d]*)/)?.[1] || "";
  }

  return version ? `${browser} ${version}` : browser;
}

export const getPublicIP = async (): Promise<string> => {
  // api.ipify.org is blocked by CSP — return empty string gracefully
  return '';
};

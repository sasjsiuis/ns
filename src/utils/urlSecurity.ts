import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Normalizes a user-pasted news link (adds https:// if omitted, trims whitespace).
 * Returns null if the input is clearly not a valid HTTP/HTTPS URL.
 */
export function normalizeUserUrl(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  // Reject dangerous schemes immediately
  if (/^(javascript|data|file|ftp|vbscript):/i.test(trimmed)) {
    return null;
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    // Allow pasting domain/path like "natunsylhet24.com/details/62238" or "www.natunsylhet24.com/..."
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(candidate)) {
      candidate = `https://${candidate}`;
    } else {
      return null;
    }
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Checks whether an IPv4 or IPv6 address belongs to loopback, private, link-local,
 * carrier-grade NAT, multicast, or unspecified address ranges.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();

  // Strip IPv4-mapped IPv6 prefix ::ffff:
  const mappedV4 = normalized.startsWith('::ffff:') ? normalized.slice(7) : null;
  if (mappedV4 && net.isIPv4(mappedV4)) {
    return isPrivateOrReservedIp(mappedV4);
  }

  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) return true;
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
    if (a >= 224) return true; // multicast & reserved
    return false;
  }

  if (net.isIPv6(normalized)) {
    if (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb') ||
      normalized.startsWith('ff')
    ) {
      return true;
    }
    return false;
  }

  // Unknown format -> fail closed
  return true;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

/**
 * Validates that a URL is safe for server-side outbound HTTP requests.
 * Checks scheme, hostname allow/block rules, literal IPs, and DNS resolution results.
 */
export async function validateOutboundUrl(rawUrl: string): Promise<URL> {
  const normalized = normalizeUserUrl(rawUrl);
  if (!normalized) {
    throw new Error('অবৈধ লিংক');
  }

  const parsed = new URL(normalized);
  const host = parsed.hostname.toLowerCase();

  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    throw new Error('অনুমোদিত নয় এমন ডোমেইন');
  }

  // Check if host is a literal IP
  const bareHost = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (net.isIP(bareHost)) {
    if (isPrivateOrReservedIp(bareHost)) {
      throw new Error('অভ্যন্তরীণ ঠিকানা অনুমোদিত নয়');
    }
    return parsed;
  }

  // Resolve DNS and confirm every returned IP is public
  const records = await dns.lookup(host, { all: true });
  if (!records || records.length === 0) {
    throw new Error('ওয়েবসাইট খুঁজে পাওয়া যায়নি');
  }

  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new Error('অনুমোদিত নয় এমন নেটওয়ার্ক ঠিকানা');
    }
  }

  return parsed;
}

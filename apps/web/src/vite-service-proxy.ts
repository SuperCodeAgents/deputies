export const viteHmrPath = '/__deputies_vite_hmr';

export type ProxyBypassRequest = {
  headers: {
    host?: string | undefined;
    'x-forwarded-host'?: string | string[] | undefined;
    'x-original-host'?: string | string[] | undefined;
  };
  url?: string | undefined;
};

export function shouldProxyServiceRequest(request: ProxyBypassRequest): boolean {
  return !isViteHmrRequest(request.url) && isServiceRequest(request.headers);
}

export function shouldEnableServicePreviews(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized !== 'false' && normalized !== '0';
}

function isServiceRequest(headers: ProxyBypassRequest['headers']): boolean {
  return [headers.host, headers['x-forwarded-host'], headers['x-original-host']]
    .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
    .some((host) => host.split(',').some((item) => item.trim().startsWith('s-')));
}

function isViteHmrRequest(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url, 'http://deputies-vite.local').pathname === viteHmrPath;
  } catch {
    return false;
  }
}

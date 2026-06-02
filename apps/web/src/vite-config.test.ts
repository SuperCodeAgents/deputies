import { shouldEnableServicePreviews, shouldProxyServiceRequest } from './vite-service-proxy.js';

describe('vite service proxy', () => {
  it('bypasses Deputies Vite HMR requests even under a service host', () => {
    expect(
      shouldProxyServiceRequest({
        url: '/__deputies_vite_hmr?token=hmr-token',
        headers: { 'x-forwarded-host': 's-5173-session-1.deputies.localhost' },
      }),
    ).toBe(false);
  });

  it('proxies service host requests to the API service proxy', () => {
    expect(
      shouldProxyServiceRequest({
        url: '/stable-code-server?reconnection=false',
        headers: { 'x-forwarded-host': 's-8080-session-1.deputies.localhost' },
      }),
    ).toBe(true);
  });

  it('bypasses normal app requests', () => {
    expect(
      shouldProxyServiceRequest({
        url: '/',
        headers: { host: 'deputies.localhost' },
      }),
    ).toBe(false);
  });

  it('enables service previews unless explicitly disabled', () => {
    expect(shouldEnableServicePreviews(undefined)).toBe(true);
    expect(shouldEnableServicePreviews('')).toBe(true);
    expect(shouldEnableServicePreviews('true')).toBe(true);
    expect(shouldEnableServicePreviews('false')).toBe(false);
    expect(shouldEnableServicePreviews('0')).toBe(false);
  });
});

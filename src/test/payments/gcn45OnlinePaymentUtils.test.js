import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// GCN-45 QA. Pure helpers only: no network, no real PayHere script is ever executed.
const freshModule = async () => { vi.resetModules(); return import('../../utils/onlinePayment'); };
const failure = (status, message) => ({ response: { status, data: message ? { message } : {} } });

const clearScripts = () => document.querySelectorAll('script').forEach((s) => s.remove());
beforeEach(() => { delete window.payhere; clearScripts(); });
afterEach(() => { delete window.payhere; clearScripts(); });

it('V1 describes each supported HTTP failure with the message and retry flag the current implementation defines', async () => {
  const { describeOnlinePaymentError } = await freshModule();
  const fallback = 'Payment could not be started.';

  expect(describeOnlinePaymentError(failure(401), fallback)).toEqual({ message: 'Your session has expired. Please sign in again.', retryable: false });
  // Current behaviour: the shared helper (GCN-41) words 403 for medicine orders even when used on appointment payments.
  expect(describeOnlinePaymentError(failure(403, 'ignored by 403'), fallback)).toEqual({ message: 'Only patients can pay for medicine orders.', retryable: false });
  expect(describeOnlinePaymentError(failure(503, 'Gateway is down'), fallback)).toEqual({ message: 'Gateway is down', retryable: true });
  expect(describeOnlinePaymentError(failure(503), fallback)).toEqual({ message: 'The online payment service is unavailable right now. Please try again shortly.', retryable: true });
  for (const status of [400, 404, 409, 422]) {
    expect(describeOnlinePaymentError(failure(status, `Server says ${status}`), fallback)).toEqual({ message: `Server says ${status}`, retryable: false });
    expect(describeOnlinePaymentError(failure(status), fallback)).toEqual({ message: fallback, retryable: false });
  }
  expect(describeOnlinePaymentError(failure(500, 'internal detail'), fallback)).toEqual({ message: fallback, retryable: true });
  expect(describeOnlinePaymentError(new Error('Network Error'), fallback)).toEqual({ message: 'We could not reach the payment service. Check your connection and try again.', retryable: true });
});

it('V2 reuses an existing PayHere SDK, injects the script once, and recovers from a script-loading failure', async () => {
  // 1. An SDK already on the page is reused and nothing is injected.
  const existing = { startPayment: vi.fn() }; window.payhere = existing;
  let mod = await freshModule();
  await expect(mod.loadPayHere()).resolves.toBe(existing);
  expect(document.querySelectorAll('script')).toHaveLength(0);
  delete window.payhere;

  // 2. Two concurrent calls inject exactly one script and both receive the SDK once it loads.
  mod = await freshModule();
  const first = mod.loadPayHere(); const second = mod.loadPayHere();
  const scripts = document.querySelectorAll('script');
  expect(scripts).toHaveLength(1); expect(scripts[0].src).toBe(mod.PAYHERE_SCRIPT_URL);
  const sdk = { startPayment: vi.fn() }; window.payhere = sdk; scripts[0].onload();
  await expect(first).resolves.toBe(sdk); await expect(second).resolves.toBe(sdk);
  expect(document.querySelectorAll('script')).toHaveLength(1);
  delete window.payhere; clearScripts();

  // 3. A script that cannot be reached rejects, removes itself, and a later call can try again.
  mod = await freshModule();
  const unreachable = mod.loadPayHere(); document.querySelector('script').onerror();
  await expect(unreachable).rejects.toThrow('PayHere could not be reached.');
  expect(document.querySelectorAll('script')).toHaveLength(0);
  const retry = mod.loadPayHere(); expect(document.querySelectorAll('script')).toHaveLength(1);
  window.payhere = sdk; document.querySelector('script').onload();
  await expect(retry).resolves.toBe(sdk);
  delete window.payhere; clearScripts();

  // 4. A script that loads without defining the SDK is reported, not treated as success.
  mod = await freshModule();
  const empty = mod.loadPayHere(); document.querySelector('script').onload();
  await expect(empty).rejects.toThrow('PayHere did not load.');
});

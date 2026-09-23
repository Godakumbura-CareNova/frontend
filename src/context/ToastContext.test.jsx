import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './ToastContext';

const Publisher = () => {
  const { showToast } = useToast();
  return (
    <>
      <button type="button" onClick={() => showToast('Saved.')}>Notify</button>
      <button type="button" onClick={() => showToast('Something failed.', 'error')}>Notify error</button>
      <button type="button" onClick={() => showToast('Removed.', 'danger')}>Notify removal</button>
      <button type="button" onClick={() => showToast('   ')}>Notify blank</button>
    </>
  );
};

const renderPublisher = () => render(<ToastProvider><Publisher /></ToastProvider>);

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pops a message over the page and clears it on its own', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPublisher();

    await user.click(screen.getByRole('button', { name: 'Notify' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved.');

    act(() => { vi.advanceTimersByTime(4000); });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('can be dismissed before it times out', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPublisher();

    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await screen.findByRole('status');
    await user.click(screen.getByRole('button', { name: /dismiss notification/i }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('marks a removal in red rather than green', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPublisher();

    await user.click(screen.getByRole('button', { name: 'Notify removal' }));

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Removed.');
    expect(toast).toHaveClass('toast-danger');
    expect(toast).not.toHaveClass('toast-success');
  });

  it('stacks messages and ignores empty ones', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPublisher();

    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await user.click(screen.getByRole('button', { name: 'Notify error' }));
    await user.click(screen.getByRole('button', { name: 'Notify blank' }));

    const toasts = await screen.findAllByRole('status');
    expect(toasts).toHaveLength(2);
    expect(toasts[1]).toHaveTextContent('Something failed.');
  });
});

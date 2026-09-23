import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConsultationFeeSection from './ConsultationFeeSection';
import { ToastProvider } from '../../context/ToastContext';

// Confirmations are toasts now, so the section is mounted under the provider that renders them.
const renderSection = (ui) => render(ui, { wrapper: ToastProvider });

const profile = { specialization: 'Cardiologist', registrationNumber: 'SLMC-1001', consultationFee: 2500 };

describe('ConsultationFeeSection', () => {
  let onSave;

  beforeEach(() => {
    onSave = vi.fn().mockResolvedValue({});
  });

  it('shows the published fee, and that none is set when it is empty', () => {
    const { rerender } = renderSection(<ConsultationFeeSection profile={profile} onSave={onSave} />);
    expect(screen.getByTestId('doctor-consultation-fee')).toHaveTextContent('LKR 2,500.00');
    expect(screen.getByText('per person, per consultation')).toBeInTheDocument();

    rerender(<ConsultationFeeSection profile={{ ...profile, consultationFee: null }} onSave={onSave} />);
    expect(screen.getByText(/no consultation fee set/i)).toBeInTheDocument();
  });

  it('confirms before opening the editor and stays read-only on cancel', async () => {
    const user = userEvent.setup();
    renderSection(<ConsultationFeeSection profile={profile} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /edit fee/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Change your consultation fee?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/consultation fee/i, { selector: 'input' })).not.toBeInTheDocument();
  });

  it('confirms before saving a changed fee', async () => {
    const user = userEvent.setup();
    renderSection(<ConsultationFeeSection profile={profile} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /edit fee/i }));
    await user.click(await screen.findByRole('button', { name: 'Yes, Edit' }));

    const input = screen.getByLabelText(/consultation fee/i, { selector: 'input' });
    expect(input).toHaveValue('2500');
    await user.clear(input);
    await user.type(input, '3500.50');
    await user.click(screen.getByRole('button', { name: /save fee/i }));

    // Nothing is sent until the confirmation is accepted.
    const dialog = await screen.findByRole('dialog', { name: 'Save this consultation fee?' });
    expect(within(dialog).getByText(/LKR 3,500.50/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Yes, Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('3500.50'));
    expect(await screen.findByRole('status')).toHaveTextContent('Consultation fee saved.');
  });

  it('confirms removing the fee when the field is cleared', async () => {
    const user = userEvent.setup();
    renderSection(<ConsultationFeeSection profile={profile} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /edit fee/i }));
    await user.click(await screen.findByRole('button', { name: 'Yes, Edit' }));
    await user.clear(screen.getByLabelText(/consultation fee/i, { selector: 'input' }));
    await user.click(screen.getByRole('button', { name: /save fee/i }));

    const dialog = await screen.findByRole('dialog', { name: 'Remove your consultation fee?' });
    await user.click(within(dialog).getByRole('button', { name: 'Yes, Remove' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(''));
    expect(await screen.findByRole('status')).toHaveTextContent('Consultation fee removed.');
  });

  it('deletes the fee straight from the section header, after confirming', async () => {
    const user = userEvent.setup();
    renderSection(<ConsultationFeeSection profile={profile} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /delete fee/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete your consultation fee?' });
    expect(onSave).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Yes, Delete' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(''));
    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Consultation fee removed.');
    expect(toast).toHaveClass('toast-danger');
  });

  it('offers no delete action when no fee is set', () => {
    renderSection(<ConsultationFeeSection profile={{ ...profile, consultationFee: null }} onSave={onSave} />);

    expect(screen.getByRole('button', { name: /set fee/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /delete fee/i })).not.toBeInTheDocument();
  });

  it('rejects an invalid fee before asking for confirmation', async () => {
    const user = userEvent.setup();
    renderSection(<ConsultationFeeSection profile={profile} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /edit fee/i }));
    await user.click(await screen.findByRole('button', { name: 'Yes, Edit' }));
    const input = screen.getByLabelText(/consultation fee/i, { selector: 'input' });
    await user.clear(input);
    await user.type(input, '12.345');
    await user.click(screen.getByRole('button', { name: /save fee/i }));

    expect(await screen.findByText(/at most 2 decimal places/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps the editor open and shows the message when saving fails', async () => {
    const user = userEvent.setup();
    onSave.mockRejectedValue({ response: { status: 500, data: {} } });
    renderSection(<ConsultationFeeSection profile={profile} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /edit fee/i }));
    await user.click(await screen.findByRole('button', { name: 'Yes, Edit' }));
    await user.click(screen.getByRole('button', { name: /save fee/i }));
    await user.click(await screen.findByRole('button', { name: 'Yes, Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to save your consultation fee.');
    expect(screen.getByLabelText(/consultation fee/i, { selector: 'input' })).toBeInTheDocument();
  });

  it('cannot be edited before the professional profile exists', () => {
    renderSection(<ConsultationFeeSection profile={null} onSave={onSave} />);

    expect(screen.getByRole('button', { name: /set fee/i })).toBeDisabled();
    expect(screen.getByText(/create your professional profile first/i)).toBeInTheDocument();
  });
});

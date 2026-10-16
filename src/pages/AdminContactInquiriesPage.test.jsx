import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminContactInquiriesPage from './AdminContactInquiriesPage';
import { listContactInquiries, markInquiryReviewed } from '../services/pharmacyInformationService';
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../services/pharmacyInformationService', () => ({ listContactInquiries: vi.fn(), markInquiryReviewed: vi.fn() }));
const inquiry = { id: 'test-id', name: 'Visitor', email: 'visitor@example.test', subject: 'Opening hours', message: 'Please confirm your hours.', submittedAtUtc: '2026-10-08T09:00:00Z', reviewedAtUtc: null };
beforeEach(() => { vi.clearAllMocks(); listContactInquiries.mockResolvedValue({ items: [inquiry], page: 1, totalPages: 1 }); });
test('admin can read and mark an inquiry reviewed', async () => {
  markInquiryReviewed.mockResolvedValue({ ...inquiry, reviewedAtUtc: '2026-10-08T10:00:00Z' });
  render(<AdminContactInquiriesPage />);
  const details = screen.getByRole('region', { name: 'Inquiry details' });
  expect(await within(details).findByText('Please confirm your hours.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Mark as reviewed' }));
  expect(await screen.findByText('Inquiry marked as reviewed.')).toBeInTheDocument();
  expect(within(details).getByText('Reviewed', { exact: true })).toBeInTheDocument();
  expect(markInquiryReviewed).toHaveBeenCalledWith('test-id');
});

test('selects messages and filters the current page without another API call', async () => {
  listContactInquiries.mockResolvedValue({ items: [inquiry, { ...inquiry, id: 'second', name: 'Kasun Silva', subject: 'Appointment booking', message: 'A different message', reviewedAtUtc: '2026-10-09T10:00:00Z' }], totalPages: 1 });
  render(<AdminContactInquiriesPage />);
  await userEvent.click(await screen.findByRole('button', { name: /Kasun Silva/ }));
  const details = screen.getByRole('region', { name: 'Inquiry details' });
  expect(within(details).getByText('A different message')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'New', exact: true }));
  expect(screen.queryByRole('button', { name: /Kasun Silva/ })).not.toBeInTheDocument();
  expect(within(details).getByText('Please confirm your hours.')).toBeInTheDocument();
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'All inquiries', exact: true }));
  expect(screen.getByRole('button', { name: /Kasun Silva/ })).toBeInTheDocument();
  expect(listContactInquiries).toHaveBeenCalledTimes(1);
});

test('keeps a failed review available for retry', async () => {
  markInquiryReviewed.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ...inquiry, reviewedAtUtc: '2026-10-09T10:00:00Z' });
  render(<AdminContactInquiriesPage />);
  await userEvent.click(await screen.findByRole('button', { name: 'Mark as reviewed' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to mark this inquiry reviewed');
  expect(within(screen.getByRole('region', { name: 'Inquiry details' })).getByText('Please confirm your hours.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Mark as reviewed' }));
  expect(await screen.findByText('Inquiry marked as reviewed.')).toBeInTheDocument();
  expect(markInquiryReviewed).toHaveBeenCalledTimes(2);
});

test('loads the next server page and disables the boundary buttons', async () => {
  listContactInquiries.mockResolvedValueOnce({ items: [inquiry], totalPages: 2 }).mockResolvedValueOnce({ items: [{ ...inquiry, id: 'page-two', subject: 'Second page' }], totalPages: 2 });
  render(<AdminContactInquiriesPage />);
  await screen.findByRole('button', { name: /Visitor Opening hours/ });
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(await screen.findByRole('heading', { name: 'Second page' })).toBeInTheDocument();
  expect(listContactInquiries).toHaveBeenLastCalledWith(2);
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});
test('failed inquiry loading supports retry', async () => {
  listContactInquiries.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ items: [], totalPages: 0 });
  render(<AdminContactInquiriesPage />);
  await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('No inquiries have been received yet.')).toBeInTheDocument();
});

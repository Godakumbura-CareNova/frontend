import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  await userEvent.click(await screen.findByText('Opening hours — New'));
  expect(screen.getByText('Please confirm your hours.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Mark reviewed' }));
  expect(await screen.findByText('Opening hours — Reviewed')).toBeInTheDocument();
  expect(markInquiryReviewed).toHaveBeenCalledWith('test-id');
});
test('failed inquiry loading supports retry', async () => {
  listContactInquiries.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ items: [], totalPages: 0 });
  render(<AdminContactInquiriesPage />);
  await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('No inquiries have been received yet.')).toBeInTheDocument();
});

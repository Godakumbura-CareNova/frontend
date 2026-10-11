import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HomePage from './HomePage';
import PatientMedicineCataloguePage from './PatientMedicineCataloguePage';
import PatientDoctorSearchPage from './PatientDoctorSearchPage';

// GCN-49 QA: four focused tests for the Public Home Page. HomePage.test.jsx already covers: featured names and the Login/Register
// links, one retry after a failed request, one partial-failure message, and the guest layout (DashboardLayout.test.jsx).
// These add: full content rendering, the loading and total-failure states, retry/recovery sequences, and guest navigation
// into the public medicines and doctors pages. The home service is mocked; the real HomePage and DashboardLayout are rendered.

const { getHomeContent, listMedicines, listCategories, searchDoctors, getDoctorSpecializations } = vi.hoisted(() => ({
  getHomeContent: vi.fn(), listMedicines: vi.fn(), listCategories: vi.fn(), searchDoctors: vi.fn(), getDoctorSpecializations: vi.fn(),
}));
vi.mock('../services/publicContentService', () => ({ getHomeContent }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false, user: null, role: null }) }));
vi.mock('../api/catalogueApi', () => ({ catalogueApi: { listMedicines, listCategories, getMedicine: vi.fn() } }));
vi.mock('../services/doctorService', () => ({ searchDoctors, getDoctorSpecializations, getDoctorPublicProfile: vi.fn() }));

const full = {
  introduction: 'CareNova connects you with pharmacy services.',
  services: [{ title: 'Pharmacy services', description: 'Browse medicines.' }, { title: 'Healthcare professionals', description: 'Find doctors.' }, { title: 'Patient services', description: 'Create an account.' }],
  notices: [{ title: 'Prescription medicines', message: 'A valid prescription is required.' }, { title: 'Holiday hours', message: 'Closed on public holidays.' }],
  featuredMedicines: [{ id: 1, name: 'Vitamin C', categoryName: 'Vitamins', price: 200, availabilityStatus: 'In stock', prescriptionRequired: false }, { id: 2, name: 'Amoxicillin', categoryName: 'Antibiotics', price: 450.5, availabilityStatus: 'Low stock', prescriptionRequired: true }],
  featuredDoctors: [{ doctorId: 'a/b c', fullName: 'Dr Silva', specialization: 'Cardiologist', consultationFee: 4500, availabilityStatus: '3 open slots' }],
  sectionErrors: [],
};
const renderHome = (initial = '/') => render(
  <MemoryRouter initialEntries={[initial]}>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/patient/medicines" element={<PatientMedicineCataloguePage />} />
      <Route path="/patient/doctors" element={<PatientDoctorSearchPage />} />
    </Routes>
  </MemoryRouter>,
);
const main = () => within(screen.getByRole('main'));

describe('GCN-49 Public Home Page (QA)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHomeContent.mockResolvedValue(full);
    listCategories.mockResolvedValue({ data: [] });
    listMedicines.mockResolvedValue({ data: { items: [], page: 1, totalPages: 0 } });
    searchDoctors.mockResolvedValue({ items: [], page: 1, pageSize: 6, totalCount: 0, totalPages: 0 });
    getDoctorSpecializations.mockResolvedValue([]);
  });

  // VT-01: content rendering
  it('VT-01 renders the complete public content for a visitor: introduction, services, notices, and featured cards with correct details and links', async () => {
    const { unmount } = renderHome();

    expect(await screen.findByText('CareNova connects you with pharmacy services.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome to CareNova');
    for (const title of ['Pharmacy services', 'Healthcare professionals', 'Patient services']) expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Prescription medicines' })).toBeInTheDocument();
    expect(screen.getByText('Closed on public holidays.')).toBeInTheDocument();

    const vitamin = screen.getByRole('link', { name: /Vitamin C/ });
    expect(vitamin).toHaveAttribute('href', '/patient/medicines/1');
    expect(within(vitamin).getByText('Vitamins')).toBeInTheDocument();
    expect(within(vitamin).getByText('LKR 200.00')).toBeInTheDocument();
    expect(within(vitamin).queryByText('Prescription required')).not.toBeInTheDocument();
    const amoxicillin = screen.getByRole('link', { name: /Amoxicillin/ });
    expect(within(amoxicillin).getByText('LKR 450.50')).toBeInTheDocument();
    expect(within(amoxicillin).getByText('Prescription required')).toBeInTheDocument();
    expect(within(amoxicillin).getByText('Low stock')).toBeInTheDocument();
    const doctor = screen.getByRole('link', { name: /Dr Silva/ });
    expect(doctor).toHaveAttribute('href', '/patient/doctors/a%2Fb%20c'); // ids are URL-encoded
    expect(within(doctor).getByText('Cardiologist')).toBeInTheDocument();
    expect(within(doctor).getByText('Consultation: LKR 4500.00')).toBeInTheDocument();
    expect(within(doctor).getByText('3 open slots')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse all medicines →' })).toHaveAttribute('href', '/patient/medicines');
    expect(screen.getByRole('link', { name: 'Browse all doctors →' })).toHaveAttribute('href', '/patient/doctors');
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    unmount();

    // honest empty states and markup shown as plain text
    getHomeContent.mockResolvedValue({ ...full, introduction: '<img src=x onerror=alert(1)> Hello', notices: [], featuredMedicines: [], featuredDoctors: [] });
    const { container } = renderHome();
    expect(await screen.findByText(/Hello/)).toHaveTextContent('<img src=x onerror=alert(1)> Hello');
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(screen.getByText('No announcements at the moment.')).toBeInTheDocument();
    expect(screen.getByText('No medicines are available to display yet.')).toBeInTheDocument();
    expect(screen.getByText('No doctors are available to display yet.')).toBeInTheDocument();
  });

  // VT-02: loading and total failure
  it('VT-02 shows a loading state, then on a failed request an error panel with Retry and nothing that pretends the data is empty', async () => {
    let fail;
    getHomeContent.mockReturnValue(new Promise((_, reject) => { fail = reject; }));
    renderHome();

    // loading: status shown, static page frame already usable, no content or error yet
    expect(screen.getByRole('status')).toHaveTextContent('Loading pharmacy information…');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome to CareNova');
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Our services' })).not.toBeInTheDocument();

    fail(Object.assign(new Error('Request failed with status code 503'), { response: { status: 503, data: { message: 'Home page information is unavailable. Please retry.' } } }));

    const panel = await screen.findByRole('alert');
    expect(panel).toHaveTextContent('We couldn’t load the home page information.');
    expect(within(panel).getByRole('button', { name: 'Retry' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    // a failure must not look like "nothing to show" or like loaded content
    for (const misleading of ['Our services', 'Featured medicines', 'Featured doctors', 'Welcome to CareNova pharmacy', 'No medicines are available to display yet.', 'No doctors are available to display yet.', 'No announcements at the moment.'])
      expect(screen.queryByText(misleading)).not.toBeInTheDocument();
    // the visitor can still navigate while the content is unavailable
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByText('Browse and order medicines')).toBeInTheDocument();
  });

  // VT-03: retry and recovery
  it('VT-03 recovers through repeated retries: degraded section, then total failure, then success, with no stale or duplicated content', async () => {
    const user = userEvent.setup();
    getHomeContent
      .mockResolvedValueOnce({ ...full, featuredMedicines: [], sectionErrors: ['Featured medicines are temporarily unavailable.'] })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(full);
    renderHome();

    // 1. degraded: message plus Retry, healthy content kept
    expect(await screen.findByText('Featured medicines are temporarily unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Dr Silva')).toBeInTheDocument();
    expect(screen.queryByText('Vitamin C')).not.toBeInTheDocument();

    // 2. retry fails completely: old content is replaced by the error panel (no stale mix)
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('We couldn’t load the home page information.')).toBeInTheDocument();
    expect(screen.queryByText('Featured medicines are temporarily unavailable.')).not.toBeInTheDocument();
    expect(screen.queryByText('Dr Silva')).not.toBeInTheDocument();
    expect(getHomeContent).toHaveBeenCalledTimes(2);

    // 3. retry succeeds: full content, no errors, nothing duplicated
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Vitamin C')).toBeInTheDocument();
    expect(getHomeContent).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Featured medicines' })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'Our services' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /Vitamin C/ })).toHaveLength(1);
  });

  // VT-04: guest navigation with degraded featured sections
  it('VT-04 lets a guest keep browsing while both featured sections are degraded: Browse-all links, public pages, and the menu back to the home page, which reloads healthy content', async () => {
    const user = userEvent.setup();
    getHomeContent
      .mockResolvedValueOnce({ ...full, featuredMedicines: [], featuredDoctors: [], sectionErrors: ['Featured medicines are temporarily unavailable.', 'Featured doctors are temporarily unavailable.'] })
      .mockResolvedValue(full);
    renderHome();

    // degraded home page: both messages, empty-state text, one Retry, guest controls only
    expect(await screen.findByText('Featured medicines are temporarily unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Featured doctors are temporarily unavailable.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
    const sidebar = within(screen.getByRole('navigation'));
    expect(sidebar.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/');
    expect(sidebar.getByRole('link', { name: 'Medicines' })).toHaveAttribute('href', '/patient/medicines');
    expect(sidebar.getByRole('link', { name: 'Doctors' })).toHaveAttribute('href', '/patient/doctors');

    // guest follows Browse all medicines: the public catalogue page opens and asks the API once
    await user.click(screen.getByRole('link', { name: 'Browse all medicines →' }));
    expect(await screen.findByRole('heading', { name: 'Medicine Catalogue' })).toBeInTheDocument();
    await waitFor(() => expect(listMedicines).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Unable to load/)).not.toBeInTheDocument();

    // the menu's Dashboard entry brings the guest back to the home page (the content is requested again)
    await user.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Dashboard' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Welcome to CareNova/ })).toBeInTheDocument();
    expect(await screen.findByText('Vitamin C')).toBeInTheDocument();
    expect(getHomeContent).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Featured medicines are temporarily unavailable.')).not.toBeInTheDocument();

    // and the doctors route from the home page works the same way
    await user.click(screen.getByRole('link', { name: 'Browse all doctors →' }));
    expect(await screen.findByRole('heading', { name: 'Find a Doctor' })).toBeInTheDocument();
    await waitFor(() => expect(searchDoctors).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

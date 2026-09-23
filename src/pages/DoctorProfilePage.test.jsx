import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import DoctorProfilePage from './DoctorProfilePage';
import { ToastProvider } from '../context/ToastContext';

const { mockGetProfile, mockUpdateProfile, mockUploadPicture, mockGetMyDoctorProfile, mockSaveMyDoctorProfile, mockDeleteMyDoctorProfile, mockSetUser } = vi.hoisted(() => ({
  mockGetProfile: vi.fn(),
  mockDeleteMyDoctorProfile: vi.fn(),
  mockUpdateProfile: vi.fn(),
  mockUploadPicture: vi.fn(),
  mockGetMyDoctorProfile: vi.fn(),
  mockSaveMyDoctorProfile: vi.fn(),
  mockSetUser: vi.fn(),
}));

vi.mock('../api/profileApi', () => ({
  default: { getProfile: mockGetProfile, updateProfile: mockUpdateProfile, uploadProfilePicture: mockUploadPicture },
}));
vi.mock('../services/doctorService', () => ({
  getMyDoctorProfile: mockGetMyDoctorProfile,
  saveMyDoctorProfile: mockSaveMyDoctorProfile,
  deleteMyDoctorProfile: mockDeleteMyDoctorProfile,
}));
vi.mock('../components/doctors/AvailabilityManager', () => ({
  default: ({ hasProfile }) => <div data-testid="availability-manager" data-has-profile={String(hasProfile)} />,
}));
vi.mock('../components/doctors/ConsultationFeeSection', () => ({
  default: ({ profile, onSave }) => (
    <div data-testid="consultation-fee-section" data-fee={String(profile?.consultationFee ?? '')}>
      <button type="button" onClick={() => onSave('3500.50')}>Stub save fee</button>
    </div>
  ),
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { fullName: 'Minadi Pathirana', role: 'Doctor' }, role: 'Doctor', setUser: mockSetUser, logout: vi.fn() }),
}));

const account = {
  fullName: 'Minadi Minradha Pathirana',
  email: 'minadipathirana2003@gmail.com',
  mobileNumber: '0776552986',
  landPhoneNumber: '0112914972',
  address: 'No.134/B-1, Nagahawaththa road, Kelaniya',
  dateOfBirth: '2003-07-03T00:00:00',
  gender: 'Female',
  hasProfilePicture: false,
};

const existingProfile = {
  id: 1,
  specialization: 'General Practitioner',
  registrationNumber: 'SLMC-12345',
  biography: 'Family medicine.',
  consultationFee: 2500,
  qualifications: [{ id: 10, degree: 'MBBS', institution: 'University of Colombo', startYear: 2010, endYear: 2015 }],
  experiences: [{ id: 20, position: 'Senior Medical Officer', organization: 'District General Hospital, Colombo', startYear: 2016, endYear: 2020 }],
  otherDetails: [{ id: 30, title: 'Member, Sri Lanka Medical Association', details: 'Life member', startYear: 2018, endYear: null }],
};

const renderPage = () => render(<BrowserRouter><ToastProvider><DoctorProfilePage /></ToastProvider></BrowserRouter>);

const openEditor = async (user) => {
  await screen.findByRole('button', { name: /edit details/i });
  await user.click(screen.getByRole('button', { name: /edit details/i }));
  await user.click(await screen.findByRole('button', { name: 'Yes, Edit' }));
};

const submitAndConfirm = async (user) => {
  await user.click(screen.getByRole('button', { name: /save changes/i }));
  await user.click(await screen.findByRole('button', { name: 'Yes, Save' }));
};

describe('DoctorProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockResolvedValue(account);
    mockGetMyDoctorProfile.mockResolvedValue(existingProfile);
    mockUpdateProfile.mockImplementation(async (request) => ({ ...account, ...request }));
  });

  it('shows basic information and the existing professional profile', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Doctor Profile' })).toBeInTheDocument();
    expect(screen.getByText('Dr. Minadi Minradha Pathirana')).toBeInTheDocument();
    expect(screen.getByText('Minadi Minradha Pathirana')).toBeInTheDocument();
    expect(screen.getByText('minadipathirana2003@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('July 3, 2003')).toBeInTheDocument();
    expect(screen.getByText('Reg. No. SLMC-12345')).toBeInTheDocument();
    expect(screen.getByTestId('consultation-fee-section')).toHaveAttribute('data-fee', '2500');
    expect(screen.getByTestId('availability-manager')).toHaveAttribute('data-has-profile', 'true');
    expect(screen.getByText('MBBS')).toBeInTheDocument();
    expect(screen.getByText('2010 - 2015')).toBeInTheDocument();
    expect(screen.getByText('Senior Medical Officer')).toBeInTheDocument();
    expect(screen.getByText('Member, Sri Lanka Medical Association')).toBeInTheDocument();
    expect(screen.getByText('Life member')).toBeInTheDocument();
    expect(screen.getByText('2018 - Present')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit details/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/doctor-dashboard');
  });

  it('saves a fee change from the fee section without losing the rest of the profile', async () => {
    const user = userEvent.setup();
    mockSaveMyDoctorProfile.mockImplementation(async (request) => ({ ...existingProfile, ...request }));
    renderPage();
    await screen.findByTestId('consultation-fee-section');

    await user.click(screen.getByRole('button', { name: 'Stub save fee' }));

    await waitFor(() => expect(mockSaveMyDoctorProfile).toHaveBeenCalledTimes(1));
    const sent = mockSaveMyDoctorProfile.mock.calls[0][0];
    expect(sent.consultationFee).toBe(3500.5);
    expect(sent.specialization).toBe('General Practitioner');
    expect(sent.qualifications).toHaveLength(1);
    expect(sent.experiences).toHaveLength(1);
    expect(sent.otherDetails).toHaveLength(1);
    // The account details are not touched by a fee change.
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('adds the row that Add Other asked for once the edit is confirmed', async () => {
    const user = userEvent.setup();
    mockGetMyDoctorProfile.mockResolvedValue({ ...existingProfile, otherDetails: [] });
    renderPage();
    await screen.findByRole('button', { name: /add other/i });

    // From read mode this goes through the edit confirmation first.
    await user.click(screen.getByRole('button', { name: /add other/i }));
    await user.click(await screen.findByRole('button', { name: 'Yes, Edit' }));

    // The editor opens with the empty row ready to fill in, not an empty section.
    expect(await screen.findByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Details (optional)')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Other 1' })).toBeInTheDocument();
  });

  it('drops the pending row when the edit confirmation is cancelled', async () => {
    const user = userEvent.setup();
    mockGetMyDoctorProfile.mockResolvedValue({ ...existingProfile, otherDetails: [] });
    renderPage();
    await screen.findByRole('button', { name: /add other/i });

    await user.click(screen.getByRole('button', { name: /add other/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit your profile?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: /edit details/i }));
    await user.click(await screen.findByRole('button', { name: 'Yes, Edit' }));

    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(screen.getByText(/nothing added yet/i)).toBeInTheDocument();
  });

  it('records the uploaded picture on the professional profile so patients can see it', async () => {
    const user = userEvent.setup();
    mockUploadPicture.mockResolvedValue({
      ...account,
      hasProfilePicture: true,
      profilePictureUrl: 'https://auth.example.com/uploads/profile-pictures/minadi.jpg',
    });
    mockSaveMyDoctorProfile.mockImplementation(async (request) => ({ ...existingProfile, ...request }));
    renderPage();
    await screen.findByRole('button', { name: /profile picture/i });

    const file = new File(['x'], 'minadi.jpg', { type: 'image/jpeg' });
    await user.upload(document.querySelector('input[type="file"]'), file);

    await waitFor(() => expect(mockUploadPicture).toHaveBeenCalledTimes(1));
    // The picture stays in user-auth; only the path is snapshotted here.
    await waitFor(() => expect(mockSaveMyDoctorProfile).toHaveBeenCalledTimes(1));
    expect(mockSaveMyDoctorProfile.mock.calls[0][0].profilePicturePath).toBe('/uploads/profile-pictures/minadi.jpg');
  });

  it('re-syncs the picture path whenever the profile is saved', async () => {
    const user = userEvent.setup();
    const picturePath = '/uploads/profile-pictures/minadi.jpg';
    mockGetProfile.mockResolvedValue({
      ...account,
      hasProfilePicture: true,
      profilePictureUrl: `https://auth.example.com${picturePath}`,
    });
    // Already in sync on load, so the only save is the one the doctor asks for.
    mockGetMyDoctorProfile.mockResolvedValue({ ...existingProfile, profilePicturePath: picturePath });
    mockSaveMyDoctorProfile.mockImplementation(async (request) => ({ ...existingProfile, ...request }));
    renderPage();
    await openEditor(user);
    await submitAndConfirm(user);

    await waitFor(() => expect(mockSaveMyDoctorProfile).toHaveBeenCalledTimes(1));
    expect(mockSaveMyDoctorProfile.mock.calls[0][0].profilePicturePath).toBe(picturePath);
  });

  it('syncs a picture that was uploaded before the profile recorded it', async () => {
    mockGetProfile.mockResolvedValue({
      ...account,
      hasProfilePicture: true,
      profilePictureUrl: 'https://auth.example.com/uploads/profile-pictures/minadi.jpg',
    });
    // Stored profile has no picture path yet, as older rows do.
    mockGetMyDoctorProfile.mockResolvedValue({ ...existingProfile, profilePicturePath: null });
    mockSaveMyDoctorProfile.mockImplementation(async (request) => ({ ...existingProfile, ...request }));
    renderPage();

    await waitFor(() => expect(mockSaveMyDoctorProfile).toHaveBeenCalledTimes(1));
    expect(mockSaveMyDoctorProfile.mock.calls[0][0].profilePicturePath).toBe('/uploads/profile-pictures/minadi.jpg');
  });

  it('does not re-save when the recorded picture already matches', async () => {
    mockGetProfile.mockResolvedValue({
      ...account,
      hasProfilePicture: true,
      profilePictureUrl: 'https://auth.example.com/uploads/profile-pictures/minadi.jpg',
    });
    mockGetMyDoctorProfile.mockResolvedValue({ ...existingProfile, profilePicturePath: '/uploads/profile-pictures/minadi.jpg' });
    renderPage();

    await screen.findByRole('heading', { name: 'Doctor Profile' });
    expect(mockSaveMyDoctorProfile).not.toHaveBeenCalled();
  });

  it('offers to create a profile when none exists yet', async () => {
    mockGetMyDoctorProfile.mockResolvedValue(null);
    renderPage();

    expect(await screen.findByText('Your professional profile is not set up yet.')).toBeInTheDocument();
    expect(screen.getByText('No specialization added yet.')).toBeInTheDocument();
    expect(screen.getByTestId('availability-manager')).toHaveAttribute('data-has-profile', 'false');
    expect(screen.getByText('No other details added yet.')).toBeInTheDocument();
    // The only Create Profile button is the one in the callout, not in the header.
    expect(screen.getAllByRole('button', { name: /create profile/i })).toHaveLength(1);
  });

  it('asks for confirmation before entering edit mode and stays read-only on cancel', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: /edit details/i });

    await user.click(screen.getByRole('button', { name: /edit details/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit your profile?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit details/i })).toBeInTheDocument();
  });

  it('offers an Edit Specialization action that opens the edit confirmation', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: /edit details/i });

    await user.click(screen.getByRole('button', { name: /edit specialization/i }));
    await user.click(await screen.findByRole('button', { name: 'Yes, Edit' }));

    expect(screen.getByLabelText('Specialization', { selector: 'input' })).toHaveValue('General Practitioner');
    expect(screen.queryByRole('button', { name: /edit specialization/i })).not.toBeInTheDocument();
  });

  it('deletes an experience entry from view mode after confirmation and saves immediately', async () => {
    const user = userEvent.setup();
    mockSaveMyDoctorProfile.mockImplementation(async (request) => ({ ...existingProfile, ...request }));
    renderPage();
    await screen.findByText('Senior Medical Officer');

    await user.click(screen.getByRole('button', { name: 'Remove Experience 1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove this experience?' });
    await user.click(within(dialog).getByRole('button', { name: 'Yes, Remove' }));

    await waitFor(() => expect(mockSaveMyDoctorProfile).toHaveBeenCalledTimes(1));
    const sent = mockSaveMyDoctorProfile.mock.calls[0][0];
    expect(sent.experiences).toEqual([]);
    expect(sent.qualifications).toHaveLength(1);
    expect(sent.specialization).toBe('General Practitioner');
    expect(await screen.findByText('Experience removed.')).toBeInTheDocument();
    expect(screen.queryByText('Senior Medical Officer')).not.toBeInTheDocument();
    expect(screen.getByText('MBBS')).toBeInTheDocument();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('deletes an Other entry from view mode after confirmation', async () => {
    const user = userEvent.setup();
    mockSaveMyDoctorProfile.mockImplementation(async (request) => ({ ...existingProfile, ...request }));
    renderPage();
    await screen.findByText('Member, Sri Lanka Medical Association');

    await user.click(screen.getByRole('button', { name: 'Remove Other 1' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Remove this other detail?' })).getByRole('button', { name: 'Yes, Remove' }));

    await waitFor(() => expect(mockSaveMyDoctorProfile).toHaveBeenCalledTimes(1));
    expect(mockSaveMyDoctorProfile.mock.calls[0][0].otherDetails).toEqual([]);
    expect(await screen.findByText('Other detail removed.')).toBeInTheDocument();
  });

  it('keeps the entry when the delete confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('MBBS');

    await user.click(screen.getByRole('button', { name: 'Remove Qualification 1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove this qualification?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('MBBS')).toBeInTheDocument();
    expect(mockSaveMyDoctorProfile).not.toHaveBeenCalled();
  });

  it('shows a retryable error when deleting an entry fails', async () => {
    const user = userEvent.setup();
    mockSaveMyDoctorProfile.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce({ ...existingProfile, qualifications: [] });
    renderPage();
    await screen.findByText('MBBS');

    await user.click(screen.getByRole('button', { name: 'Remove Qualification 1' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Yes, Remove' }));

    expect(await screen.findByText('Failed to remove the qualification.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Yes, Remove' }));

    expect(await screen.findByText('Qualification removed.')).toBeInTheDocument();
    expect(screen.queryByText('MBBS')).not.toBeInTheDocument();
  });

  it('shows Delete Specialization only while editing and deletes the professional profile after confirmation', async () => {
    const user = userEvent.setup();
    mockDeleteMyDoctorProfile.mockResolvedValue(undefined);
    renderPage();
    await screen.findByRole('button', { name: /edit details/i });
    expect(screen.queryByRole('button', { name: /delete specialization/i })).not.toBeInTheDocument();

    await openEditor(user);
    await user.click(screen.getByRole('button', { name: /delete specialization/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete your specialization?' });
    await user.click(within(dialog).getByRole('button', { name: 'Yes, Delete' }));

    await waitFor(() => expect(mockDeleteMyDoctorProfile).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/professional profile has been deleted/i)).toBeInTheDocument();
    expect(screen.getByText('Your professional profile is not set up yet.')).toBeInTheDocument();
    expect(screen.queryByText('MBBS')).not.toBeInTheDocument();
    expect(screen.getByText('Minadi Minradha Pathirana')).toBeInTheDocument();
    expect(mockSaveMyDoctorProfile).not.toHaveBeenCalled();
  });

  it('keeps the profile when the delete dialog is cancelled', async () => {
    const user = userEvent.setup();
    renderPage();
    await openEditor(user);

    await user.click(screen.getByRole('button', { name: /delete specialization/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    expect(mockDeleteMyDoctorProfile).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Specialization', { selector: 'input' })).toHaveValue('General Practitioner');
  });

  it('confirms before creating a profile via Add Qualification when none exists', async () => {
    const user = userEvent.setup();
    mockGetMyDoctorProfile.mockResolvedValue(null);
    renderPage();
    await screen.findByText('Your professional profile is not set up yet.');

    await user.click(screen.getByRole('button', { name: /add qualification/i }));
    await user.click(await screen.findByRole('button', { name: 'Yes, Create' }));

    expect(screen.getByLabelText('Specialization', { selector: 'input' })).toBeInTheDocument();
  });

  // Scenario 1 - valid update is saved (account + professional)
  it('saves account and professional information together and shows the updated profile', async () => {
    const user = userEvent.setup();
    mockSaveMyDoctorProfile.mockImplementation(async (request) => ({
      ...existingProfile,
      ...request,
      qualifications: request.qualifications.map((q, i) => ({ id: 100 + i, ...q })),
      experiences: request.experiences.map((e, i) => ({ id: 200 + i, ...e })),
    }));
    renderPage();
    await openEditor(user);

    const fullName = screen.getByLabelText('Full Name');
    await user.clear(fullName);
    await user.type(fullName, 'Minadi Pathirana');

    const specialization = screen.getByLabelText('Specialization', { selector: 'input' });
    await user.clear(specialization);
    await user.type(specialization, 'Cardiologist');

    await user.click(screen.getByRole('button', { name: /add experience/i }));
    await user.type(screen.getByLabelText('Position', { selector: '#experiences\\[1\\]\\.position' }), 'Consultant Cardiologist');
    await user.type(screen.getByLabelText('Organization', { selector: '#experiences\\[1\\]\\.organization' }), 'National Hospital');
    await user.selectOptions(screen.getByLabelText('Start year', { selector: '#experiences\\[1\\]\\.startYear' }), '2021');
    // End year defaults to "Present"
    expect(screen.getByLabelText('End year', { selector: '#experiences\\[1\\]\\.endYear' })).toHaveValue('present');

    await user.click(screen.getByRole('button', { name: /add other/i }));
    await user.type(screen.getByLabelText('Title', { selector: '#otherDetails\\[1\\]\\.title' }), 'Best Intern Award');
    await user.selectOptions(screen.getByLabelText('Start year', { selector: '#otherDetails\\[1\\]\\.startYear' }), '2016');
    await user.selectOptions(screen.getByLabelText('End year', { selector: '#otherDetails\\[1\\]\\.endYear' }), '2016');

    await submitAndConfirm(user);

    await waitFor(() => expect(mockSaveMyDoctorProfile).toHaveBeenCalledTimes(1));
    expect(mockUpdateProfile).toHaveBeenCalledWith({
      fullName: 'Minadi Pathirana',
      mobileNumber: '0776552986',
      landPhoneNumber: '0112914972',
      address: 'No.134/B-1, Nagahawaththa road, Kelaniya',
      dateOfBirth: '2003-07-03',
      gender: 'Female',
    });
    const sent = mockSaveMyDoctorProfile.mock.calls[0][0];
    expect(sent.specialization).toBe('Cardiologist');
    // The fee is owned by its own section; saving the profile must leave it as it was.
    expect(sent.consultationFee).toBe(2500);
    expect(sent.experiences[1]).toEqual({ position: 'Consultant Cardiologist', organization: 'National Hospital', startYear: 2021, endYear: null });
    expect(sent.otherDetails).toEqual([
      { title: 'Member, Sri Lanka Medical Association', details: 'Life member', startYear: 2018, endYear: null },
      { title: 'Best Intern Award', details: null, startYear: 2016, endYear: 2016 },
    ]);

    expect(await screen.findByText('Your profile has been saved.')).toBeInTheDocument();
    expect(screen.getByText('Dr. Minadi Pathirana')).toBeInTheDocument();
    expect(screen.getByText('2021 - Present')).toBeInTheDocument();
    expect(screen.getByText('Best Intern Award')).toBeInTheDocument();
    expect(mockSetUser).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Minadi Pathirana' }));
    expect(screen.getByRole('button', { name: /edit details/i })).toBeInTheDocument();
  }, 20000);

  // Scenario 2 - invalid information is blocked client-side (both account and professional rules)
  it('shows validation messages and does not call the APIs when fields are invalid', async () => {
    const user = userEvent.setup();
    renderPage();
    await openEditor(user);

    await user.clear(screen.getByLabelText('Mobile Number'));
    await user.clear(screen.getByLabelText('Specialization', { selector: 'input' }));
    await user.clear(screen.getByLabelText('Medical Registration Number'));
    await user.selectOptions(screen.getByLabelText('End year', { selector: '#qualifications\\[0\\]\\.endYear' }), '2005');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('Please correct the highlighted fields before saving.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid Sri Lankan mobile number.')).toBeInTheDocument();
    expect(screen.getByText('Specialization is required.')).toBeInTheDocument();
    expect(screen.getByText('Medical registration number is required.')).toBeInTheDocument();
    expect(screen.getByText('End year must be on or after the start year.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockSaveMyDoctorProfile).not.toHaveBeenCalled();
  });

  // Scenario 2 - server-side validation errors are shown next to the fields
  it('maps server validation errors onto the form', async () => {
    const user = userEvent.setup();
    mockSaveMyDoctorProfile.mockRejectedValue({
      response: {
        status: 400,
        data: {
          message: 'Please correct the highlighted fields.',
          errors: { 'Qualifications[0].Institution': ['Institution must not exceed 150 characters.'] },
        },
      },
    });
    renderPage();
    await openEditor(user);
    await submitAndConfirm(user);

    expect(await screen.findByText('Please correct the highlighted fields.')).toBeInTheDocument();
    expect(screen.getByText('Institution must not exceed 150 characters.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  // Update fails -> error + retry
  it('shows an error with a retry action when saving fails, and retries', async () => {
    const user = userEvent.setup();
    mockSaveMyDoctorProfile
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce(existingProfile);
    renderPage();
    await openEditor(user);
    await submitAndConfirm(user);

    expect(await screen.findByText('Failed to save your professional profile.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Your profile has been saved.')).toBeInTheDocument();
    expect(mockSaveMyDoctorProfile).toHaveBeenCalledTimes(2);
  });

  it('reports an account-details failure while keeping the editor open', async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockRejectedValue({ response: { status: 500, data: { message: 'Account service unavailable.' } } });
    mockSaveMyDoctorProfile.mockResolvedValue(existingProfile);
    renderPage();
    await openEditor(user);
    await submitAndConfirm(user);

    expect(await screen.findByText('Account service unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
  });

  // Scenario 3 - unauthorized update is denied
  it('shows an authorization message when the API denies the update', async () => {
    const user = userEvent.setup();
    mockSaveMyDoctorProfile.mockRejectedValue({ response: { status: 403 } });
    renderPage();
    await openEditor(user);
    await submitAndConfirm(user);

    expect(await screen.findByText('You are not authorized to update this doctor profile.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('removes a qualification row in edit mode and cancel restores the saved profile', async () => {
    const user = userEvent.setup();
    renderPage();
    await openEditor(user);

    await user.click(screen.getByRole('button', { name: 'Remove Qualification 1' }));
    const qualifications = screen.getByRole('region', { name: 'Qualifications' });
    expect(within(qualifications).getByText(/No qualifications yet/)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
    expect(screen.getByText('MBBS')).toBeInTheDocument();
    expect(mockSaveMyDoctorProfile).not.toHaveBeenCalled();
  });

  it('shows a retryable error when the professional profile fails to load', async () => {
    mockGetMyDoctorProfile.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce(existingProfile);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Failed to load your professional profile.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Reg. No. SLMC-12345')).toBeInTheDocument();
  });
});

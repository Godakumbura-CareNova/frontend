import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Stethoscope,
} from 'lucide-react';

import DashboardLayout from '../components/DashboardLayout';
import { getDoctorPublicProfile } from '../services/doctorService';
import { bookAppointment } from '../services/appointmentService';
import './doctorProfile.css';
import './patientDoctors.css';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-LK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const formatTime = (value) =>
  new Date(value).toLocaleTimeString('en-LK', {
    hour: 'numeric',
    minute: '2-digit',
  });

const PatientAppointmentBookingPage = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();

  const [doctor, setDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  const [loadError, setLoadError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [success, setSuccess] = useState(null);

  const loadDoctor = async () => {
    setLoading(true);
    setLoadError('');

    try {
      const data = await getDoctorPublicProfile(doctorId);

      if (!data) {
        setLoadError('Doctor profile could not be found.');
        return;
      }

      setDoctor(data);
    } catch (error) {
      setLoadError(
        error?.response?.data?.message ||
          'Unable to load appointment availability.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctor();
  }, [doctorId]);

  const availableSlots = doctor?.upcomingSlots || [];

  const slotsByDate = useMemo(() => {
    const grouped = {};

    availableSlots.forEach((slot) => {
      const dateKey = new Date(slot.startUtc)
        .toISOString()
        .slice(0, 10);

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }

      grouped[dateKey].push(slot);
    });

    return grouped;
  }, [availableSlots]);

  const availableDates = Object.keys(slotsByDate).sort();

  const dateSlots = selectedDate
    ? slotsByDate[selectedDate] || []
    : [];

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedSlotId(null);
    setValidationError('');
    setBookingError('');
  };

  const handleSlotSelect = (slotId) => {
    setSelectedSlotId(slotId);
    setValidationError('');
    setBookingError('');
  };

  const handleConfirm = async () => {
    if (!doctorId || !selectedDate || !selectedSlotId) {
      setValidationError(
        'Please select a doctor, appointment date, and time slot.',
      );
      return;
    }

    setBooking(true);
    setBookingError('');
    setValidationError('');

    try {
      const appointment = await bookAppointment({
        doctorId,
        slotId: selectedSlotId,
      });

      setSuccess(appointment);
    } catch (error) {
      const status = error?.response?.status;

      if (status === 409) {
        setBookingError(
          error?.response?.data?.message ||
            'This appointment slot is no longer available.',
        );

        await loadDoctor();
        setSelectedDate('');
        setSelectedSlotId(null);
      } else if (status === 400) {
        setBookingError(
          error?.response?.data?.message ||
            'Please check the appointment details.',
        );
      } else {
        setBookingError(
          'Appointment creation failed. Please try again.',
        );
      }
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="dp-page pd-page">
          <p className="dp-status">
            Loading appointment availability...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout>
        <div className="dp-page pd-page">
          <Link
            to={`/patient/doctors/${doctorId}`}
            className="dp-back-link"
          >
            <ArrowLeft size={15} />
            Back to doctor profile
          </Link>

          <div className="dp-card">
            <div className="alert alert-error" role="alert">
              <span>{loadError}</span>

              <button
                type="button"
                className="dp-retry-btn"
                onClick={loadDoctor}
              >
                <RefreshCw size={13} />
                Retry
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (success) {
    return (
      <DashboardLayout>
        <div className="dp-page pd-page">
          <div className="dp-card">
            <div className="pd-empty">
              <CheckCircle2 size={42} />

              <h2>Appointment booked successfully</h2>

              <p>
                Appointment reference:
                {' '}
                <strong>
                  {success.appointmentReference}
                </strong>
              </p>

              <p>
                Doctor:
                {' '}
                <strong>{success.doctorName}</strong>
              </p>

              <p>
                Date:
                {' '}
                <strong>
                  {formatDate(success.appointmentStartUtc)}
                </strong>
              </p>

              <p>
                Time:
                {' '}
                <strong>
                  {formatTime(success.appointmentStartUtc)}
                </strong>
              </p>

              <p>
                Status:
                {' '}
                <strong>{success.status}</strong>
              </p>

              <button
                type="button"
                className="btn btn-green"
                onClick={() =>
                  navigate('/patient/doctors')
                }
              >
                Back to doctors
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="dp-page pd-page">
        <Link
          to={`/patient/doctors/${doctorId}`}
          className="dp-back-link"
        >
          <ArrowLeft size={15} />
          Back to doctor profile
        </Link>

        <header className="dp-hero">
          <div className="dp-hero-text">
            <h1 className="dp-hero-title">
              Book Appointment
            </h1>

            <p className="dp-hero-name">
              <Stethoscope size={15} />
              {' '}
              {doctor?.fullName}
            </p>

            <p className="dp-hero-subtitle">
              Select an available date and consultation time.
            </p>
          </div>
        </header>

        <div className="dp-card">
          {availableDates.length === 0 ? (
            <div className="pd-empty">
              <CalendarDays size={30} />
              <h2>No available appointments</h2>
              <p>
                This doctor currently has no open appointment slots.
              </p>
            </div>
          ) : (
            <>
              <section>
                <h2>
                  <CalendarDays size={18} />
                  {' '}
                  Select appointment date
                </h2>

                <div className="pd-slot-list">
                  {availableDates.map((date) => (
                    <button
                      key={date}
                      type="button"
                      className={`pd-slot ${
                        selectedDate === date
                          ? 'selected'
                          : ''
                      }`}
                      onClick={() =>
                        handleDateSelect(date)
                      }
                    >
                      {formatDate(
                        `${date}T00:00:00Z`,
                      )}
                    </button>
                  ))}
                </div>
              </section>

              {selectedDate && (
                <section>
                  <h2>
                    <Clock3 size={18} />
                    {' '}
                    Select appointment time
                  </h2>

                  <div className="pd-slot-list">
                    {dateSlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        className={`pd-slot ${
                          selectedSlotId === slot.id
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() =>
                          handleSlotSelect(slot.id)
                        }
                      >
                        {formatTime(slot.startUtc)}
                        {' – '}
                        {formatTime(slot.endUtc)}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {validationError && (
                <div
                  className="alert alert-error"
                  role="alert"
                >
                  {validationError}
                </div>
              )}

              {bookingError && (
                <div
                  className="alert alert-error"
                  role="alert"
                >
                  {bookingError}
                </div>
              )}

              <button
                type="button"
                className="btn btn-green"
                disabled={booking}
                onClick={handleConfirm}
              >
                {booking
                  ? 'Booking...'
                  : 'Confirm Appointment'}
              </button>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientAppointmentBookingPage;
import React, { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock,
  Ticket,
  User,
  Mail,
  Phone,
  IndianRupee,
  ArrowLeft,
  MapPin,
  Video,
  GraduationCap,
  Tag,
  Timer,
} from "lucide-react";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "./firebase";
import "./BookingDetails.css";

function BookingDetails({ booking, onBack }) {
  const [programInfo, setProgramInfo] = useState({});
  const [sessionInfo, setSessionInfo] = useState({});
  const [loadingProgram, setLoadingProgram] = useState(true);

  const isCancelled =
    booking?.status?.toLowerCase() === "cancelled";

  useEffect(() => {
    let isActive = true;

    async function loadDetails() {
      setLoadingProgram(true);
      setProgramInfo({});
      setSessionInfo({});

      try {
        if (!booking?.programFirestoreId) return;

        const programRef = doc(
          db,
          "programs",
          booking.programFirestoreId
        );

        const snapshot = await getDoc(programRef);

        if (!snapshot.exists()) return;

        const data = snapshot.data();

        const sessions = Array.isArray(data.sessions)
          ? data.sessions
          : [];

        const matchingSession = sessions.find(
          (session) =>
            String(session.id) === String(booking.sessionId)
        );

        if (isActive) {
          setProgramInfo(data);
          setSessionInfo(matchingSession || {});
        }
      } catch (error) {
        console.error("Error loading booking details:", error);
      } finally {
        if (isActive) setLoadingProgram(false);
      }
    }

    if (booking) {
      loadDetails();
    } else {
      setLoadingProgram(false);
    }

    return () => {
      isActive = false;
    };
  }, [booking?.programFirestoreId, booking?.sessionId]);

  if (!booking) return null;

  const displayValue = (value) => {
    if (value === undefined || value === null || value === "") {
      return "Not available";
    }
    return value;
  };

  const formatDate = (value) => {
    if (!value) return "Not available";

    if (value?.toDate) {
      return value.toDate().toLocaleDateString("en-IN");
    }

    if (value instanceof Date) {
      return value.toLocaleDateString("en-IN");
    }

    if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      const [year, month, day] = value.split("-");
      return `${day}-${month}-${year}`;
    }

    return String(value);
  };

  const formatPrice = (price) => {
    const amount = Number(price);

    return Number.isFinite(amount)
      ? `₹${amount.toLocaleString("en-IN")}`
      : "Not available";
  };

  // Prefer booking data, then use the original program/session data.
  const trainer =
    booking.trainerName ||
    booking.trainer ||
    programInfo.trainer ||
    programInfo.trainerName;

  const category =
    booking.category || programInfo.category;

  const duration =
    booking.duration || programInfo.duration;

  const mode =
    booking.sessionMode ||
    booking.mode ||
    sessionInfo.mode;

  const venue =
    booking.sessionVenue ||
    booking.venue ||
    sessionInfo.venue;

  const meetingInfo =
    booking.sessionMeetingInfo ||
    booking.meetingInfo ||
    booking.meetingLink ||
    sessionInfo.meetingInfo ||
    sessionInfo.meetingLink;

  const startDate =
    booking.sessionStartDate ||
    booking.sessionDate ||
    booking.date ||
    sessionInfo.startDate ||
    sessionInfo.date;

  const endDate =
    booking.sessionEndDate ||
    booking.endDate ||
    sessionInfo.endDate;

  const startTime =
    booking.sessionStartTime ||
    booking.startTime ||
    sessionInfo.startTime;

  const endTime =
    booking.sessionEndTime ||
    booking.endTime ||
    sessionInfo.endTime;

  const batchName =
    booking.sessionName ||
    booking.session ||
    booking.batchName ||
    sessionInfo.name;

  const registrationDeadline =
    booking.sessionRegistrationDeadline ||
    booking.registrationDeadline ||
    sessionInfo.registrationDeadline;

  const bookingDate = booking.bookedAt?.toDate
    ? booking.bookedAt.toDate().toLocaleString("en-IN")
    : formatDate(booking.bookedAt);

  const cancellationDate = booking.cancelledAt
    ? booking.cancelledAt?.toDate
      ? booking.cancelledAt.toDate().toLocaleString("en-IN")
      : formatDate(booking.cancelledAt)
    : "Not available";

  const Field = ({ icon: Icon, label, value }) => (
    <div className="details-field">
      <span>
        {Icon && <Icon size={16} />}
        {label}
      </span>
      <strong>{displayValue(value)}</strong>
    </div>
  );

  return (
    <main className="booking-details-page">
      <header className="booking-details-header">
        <div>
          <span>EVENTORA ACCOUNT</span>
          <h1>Booking Details</h1>
          <p>Complete information about your registration.</p>
        </div>

        <button
          onClick={onBack}
          className="details-back-button"
        >
          <ArrowLeft size={18} />
          Back to My Bookings
        </button>
      </header>

      <section className="booking-details-card">
        <div className="details-status-row">
          <Ticket size={24} />
          <span
            className={
              isCancelled
                ? "details-cancelled"
                : "details-confirmed"
            }
          >
            {booking.status || "Confirmed"}
          </span>
        </div>

        <h2>{booking.programTitle || "Program Details"}</h2>

        <h3>Booking Information</h3>

        <div className="details-booking-id">
          <small>Booking ID</small>
          <strong>{displayValue(booking.id)}</strong>
        </div>

        <div className="details-grid">
          <Field
            icon={CalendarDays}
            label="Booking Date"
            value={bookingDate}
          />
          <Field
            icon={Ticket}
            label="Booking Status"
            value={booking.status}
          />
        </div>

        <h3>Program Information</h3>

        <div className="details-grid">
          <Field
            icon={GraduationCap}
            label="Program Name"
            value={booking.programTitle || programInfo.title}
          />
          <Field
            label="Program Type"
            value={booking.programType || programInfo.type}
          />
          <Field
            icon={Tag}
            label="Category"
            value={category}
          />
          <Field
            icon={Timer}
            label="Duration"
            value={duration}
          />
          <Field
            icon={User}
            label="Trainer"
            value={trainer}
          />
        </div>

        {loadingProgram && (
          <p>Loading additional program information...</p>
        )}

        <h3>Batch Information</h3>

        <div className="details-grid">
          <Field
            label="Batch Name"
            value={batchName}
          />
          <Field
            icon={CalendarDays}
            label="Start Date"
            value={formatDate(startDate)}
          />
          <Field
            icon={CalendarDays}
            label="End Date"
            value={formatDate(endDate)}
          />
          <Field
            icon={Clock}
            label="Start Time"
            value={startTime}
          />
          <Field
            icon={Clock}
            label="End Time"
            value={endTime}
          />
          <Field
            label="Registration Deadline"
            value={formatDate(registrationDeadline)}
          />
        </div>

        <h3>Session Information</h3>

        <div className="details-grid">
          <Field label="Mode" value={mode} />

          {String(mode || "").toLowerCase() === "offline" ? (
            <Field
              icon={MapPin}
              label="Venue"
              value={venue}
            />
          ) : String(mode || "").toLowerCase() === "online" ? (
            <Field
              icon={Video}
              label="Meeting Information"
              value={meetingInfo}
            />
          ) : (
            <>
              <Field
                icon={MapPin}
                label="Venue"
                value={venue}
              />
              <Field
                icon={Video}
                label="Meeting Information"
                value={meetingInfo}
              />
            </>
          )}
        </div>

        <h3>Participant Information</h3>

        <div className="details-grid">
          <Field
            icon={User}
            label="Participant Name"
            value={booking.participantName}
          />
          <Field
            icon={Mail}
            label="Email Address"
            value={booking.email}
          />
          <Field
            icon={Phone}
            label="Mobile Number"
            value={booking.mobile}
          />
        </div>

        <h3>Payment Information</h3>

        <div className="details-price">
          <span>Registration Fee</span>
          <strong>
            <IndianRupee size={20} />
            {formatPrice(booking.price ?? programInfo.price).replace("₹", "")}
          </strong>
          <small>
            Payment information shown for project demonstration.
          </small>
        </div>

        {isCancelled && (
          <div className="details-cancellation">
            <h3>Cancellation Information</h3>

            <p>
              <strong>Cancellation Reason:</strong>{" "}
              {displayValue(booking.cancellationReason)}
            </p>

            <p>
              <strong>Cancelled At:</strong>{" "}
              {cancellationDate}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

export default BookingDetails;
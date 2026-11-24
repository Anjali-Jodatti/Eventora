import { useEffect, useState } from "react";
import {
CalendarDays,
Clock,
Ticket,
XCircle,
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import "./MyBookings.css";
import BookingDetails from "./BookingDetails";

function MyBookings({ onBack, userId }) {
const [bookings, setBookings] = useState([]);
const [selectedBooking, setSelectedBooking] = useState(null);
const [loading, setLoading] = useState(true);
const [loadError, setLoadError] = useState("");

const [cancelMessage, setCancelMessage] = useState("");
const [bookingFilter, setBookingFilter] = useState("All");
const [selectedBookingId, setSelectedBookingId] = useState(null);
const [cancellationReason, setCancellationReason] = useState("");
const [showCancelConfirmation, setShowCancelConfirmation] =
useState(false);
const [cancelError, setCancelError] = useState("");
const [isCancelling, setIsCancelling] = useState(false);

// Load only the signed-in participant's bookings from Firestore.
useEffect(() => {
let active = true;

async function loadBookings() {
  if (!userId) {
    setBookings([]);
    setLoading(false);
    setLoadError("");
    return;
  }

  setLoading(true);
  setLoadError("");

  try {
    const bookingsQuery = query(
      collection(db, "bookings"),
      where("userId", "==", userId)
    );

    const snapshot = await getDocs(bookingsQuery);

// Retrieve program information from Firestore.
const programsSnapshot = await getDocs(
  collection(db, "programs")
);

const allPrograms = programsSnapshot.docs.map((programDoc) => ({
  firestoreId: programDoc.id,
  ...programDoc.data(),
}));

// Combine each booking with its related program and session information.
const userBookings = snapshot.docs.map((bookingDoc) => {
  const bookingData = bookingDoc.data();

  const matchingProgram = allPrograms.find((program) => {
    if (
      bookingData.programFirestoreId &&
      program.firestoreId === bookingData.programFirestoreId
    ) {
      return true;
    }

    return String(program.id) === String(bookingData.programId);
  });

  // Find the session selected when the participant booked.
  const matchingSession = matchingProgram?.sessions?.find(
  (session) => {
    // First try matching by session ID.
    if (
      bookingData.sessionId &&
      String(session.id) === String(bookingData.sessionId)
    ) {
      return true;
    }

    // Fallback for older bookings without session ID.
    return (
      String(session.name || "").trim().toLowerCase() ===
        String(bookingData.sessionName || bookingData.session || "")
          .trim()
          .toLowerCase() &&
      String(session.date || session.startDate || "") ===
        String(bookingData.sessionDate || bookingData.date || "")
    );
  }
);

  return {
    id: bookingDoc.id,
    ...bookingData,
    programInfo: matchingProgram || {},
    sessionInfo: matchingSession || {},
  };
});
    
    // Arrange bookings by program start date.
// Upcoming programs appear first, followed by past programs.
userBookings.sort((a, b) => {
  const dateA = new Date(
    a.sessionStartDate || a.sessionDate || a.date || "9999-12-31"
  ).getTime();

  const dateB = new Date(
    b.sessionStartDate || b.sessionDate || b.date || "9999-12-31"
  ).getTime();

  return dateA - dateB;
});

    if (active) {
      setBookings(userBookings);
    }
  } catch (error) {
    console.error("Error loading bookings:", error);

    if (active) {
      setLoadError(
        "Unable to load bookings. Please check your connection and Firestore rules."
      );
    }
  } finally {
    if (active) {
      setLoading(false);
    }
  }
}

loadBookings();

return () => {
  active = false;
};

}, [userId]);

function openCancellationBox(id) {
setSelectedBookingId(id);
setCancellationReason("");
setCancelError("");
setCancelMessage("");
setShowCancelConfirmation(false);
}

function continueToConfirmation() {
if (!cancellationReason.trim()) {
setCancelError(
"Please enter a reason for cancelling this booking."
);
return;
}

setCancelError("");
setShowCancelConfirmation(true);

}

async function cancelBooking() {
  if (
    !cancellationReason.trim() ||
    !selectedBookingId ||
    isCancelling
  ) {
    return;
  }

  const bookingToCancel = bookings.find(
    (booking) => booking.id === selectedBookingId
  );

  if (!bookingToCancel || bookingToCancel.userId !== userId) {
    setCancelError("You cannot cancel this booking.");
    return;
  }

  if (bookingToCancel.status === "Cancelled") {
    setCancelError("This booking is already cancelled.");
    return;
  }

  if (
    !bookingToCancel.programFirestoreId ||
    !bookingToCancel.sessionId
  ) {
    setCancelError(
      "Program or batch inventory information is missing."
    );
    return;
  }

  setIsCancelling(true);
  setCancelError("");

  const bookingRef = doc(db, "bookings", selectedBookingId);

  const inventoryId =
    `${bookingToCancel.programFirestoreId}__${bookingToCancel.sessionId}`;

  const inventoryRef = doc(db, "seatInventory", inventoryId);

  const cancellationData = {
    status: "Cancelled",
    cancellationReason: cancellationReason.trim(),
    cancelledAt: new Date().toISOString(),
  };

  try {
    await runTransaction(db, async (transaction) => {
      const bookingSnapshot = await transaction.get(bookingRef);
      const inventorySnapshot = await transaction.get(inventoryRef);

      if (!bookingSnapshot.exists()) {
        throw new Error("BOOKING_NOT_FOUND");
      }

      const currentBooking = bookingSnapshot.data();

      if (currentBooking.userId !== userId) {
        throw new Error("NOT_OWNER");
      }

      if (currentBooking.status === "Cancelled") {
        throw new Error("ALREADY_CANCELLED");
      }

      if (!inventorySnapshot.exists()) {
        throw new Error("INVENTORY_NOT_FOUND");
      }

      const inventory = inventorySnapshot.data();
      const currentSeats = Number(inventory.availableSeats);

      if (!Number.isInteger(currentSeats) || currentSeats < 0) {
        throw new Error("INVALID_INVENTORY");
      }

      transaction.update(inventoryRef, {
        availableSeats: currentSeats + 1,
        updatedAt: serverTimestamp(),
      });

      transaction.update(bookingRef, cancellationData);
    });

    setBookings((currentBookings) =>
      currentBookings.map((booking) =>
        booking.id === selectedBookingId
          ? { ...booking, ...cancellationData }
          : booking
      )
    );

    setCancelMessage(
      "Booking cancelled successfully. One seat has been restored."
    );

    setSelectedBookingId(null);
    setCancellationReason("");
    setShowCancelConfirmation(false);

  } catch (error) {
    console.error("Cancellation transaction error:", error);

    const errorMessages = {
      BOOKING_NOT_FOUND: "Booking not found.",
      NOT_OWNER: "You cannot cancel this booking.",
      ALREADY_CANCELLED: "This booking is already cancelled.",
      INVENTORY_NOT_FOUND: "Seat inventory record was not found.",
      INVALID_INVENTORY: "Seat inventory information is invalid.",
    };

    setCancelError(
      errorMessages[error.message] ||
      (error.code === "permission-denied"
        ? "Permission denied. Firestore rules must allow this cancellation and seat restoration."
        : "Unable to cancel the booking. Please try again.")
    );

  } finally {
    setIsCancelling(false);
  }
}

function closeCancellationBox() {
setSelectedBookingId(null);
setCancellationReason("");
setShowCancelConfirmation(false);
setCancelError("");
}

// Get today's date without the time.
const today = new Date();
today.setHours(0, 0, 0, 0);

function getBookingStartDate(booking) {
  const dateValue =
    booking.sessionStartDate ||
    booking.sessionDate ||
    booking.date;

  if (!dateValue) return null;

  // Parse YYYY-MM-DD as a local date.
  const dateString = String(dateValue);

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return null;

  date.setHours(0, 0, 0, 0);
  return date;
}

function getDisplayStatus(booking) {
  // Cancelled bookings must always remain Cancelled.
  if (booking.status === "Cancelled") {
    return "Cancelled";
  }

  const startDate = getBookingStartDate(booking);

  // Past confirmed bookings are displayed as Completed.
  if (
    booking.status === "Confirmed" &&
    startDate !== null &&
    startDate < today
  ) {
    return "Completed";
  }

  return booking.status || "Confirmed";
}

const filteredBookings = bookings.filter((booking) => {
  const status = booking.status || "Confirmed";
  const startDate = getBookingStartDate(booking);

  if (bookingFilter === "All") return true;

  if (bookingFilter === "Upcoming") {
    return (
      status === "Confirmed" &&
      startDate !== null &&
      startDate >= today
    );
  }

  if (bookingFilter === "Past") {
    return (
      status === "Confirmed" &&
      startDate !== null &&
      startDate < today
    );
  }

  if (bookingFilter === "Cancelled") {
    return status === "Cancelled";
  }

  return false;
});

if (selectedBooking) {
  return (
    <BookingDetails
      booking={selectedBooking}
      onBack={() => setSelectedBooking(null)}
    />
  );
}

return (
<main className="my-bookings-page">
<header className="my-bookings-header">
<div>
<span className="bookings-eyebrow">
YOUR EVENTORA ACCOUNT
</span>
<h1>My Bookings</h1>
<p>View and manage your event registrations.</p>
</div>

    <button
      className="bookings-back-button"
      onClick={onBack}
    >
      ← Dashboard
    </button>
  </header>

  <section className="bookings-list">
    <div className="bookings-summary">
      <Ticket size={22} />
      <span>
        You have <strong>{bookings.length}</strong>{" "}
        {bookings.length === 1 ? "booking" : "bookings"}
      </span>
    </div>

    <div className="booking-filters">
  {["All", "Upcoming", "Past", "Cancelled"].map((filter) => (
    <button
      key={filter}
      className={`booking-filter-button ${
        bookingFilter === filter ? "active" : ""
      }`}
      onClick={() => setBookingFilter(filter)}
    >
      {filter === "All" ? "All Bookings" : filter}
    </button>
  ))}
</div>

    {cancelMessage && (
      <p className="booking-cancel-message" role="status">
        {cancelMessage}
      </p>
    )}

    {loading ? (
      <div className="no-bookings">
        <p>Loading your bookings...</p>
      </div>
    ) : loadError ? (
      <div className="no-bookings">
        <p role="alert">{loadError}</p>
        <button
          className="bookings-primary-button"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    ) : filteredBookings.length === 0 ? (
      <div className="no-bookings">
        <CalendarDays size={42} />
        <h2>
  {bookingFilter === "Upcoming"
    ? "No Upcoming Bookings"
    : bookingFilter === "Past"
    ? "No Past Bookings"
    : bookingFilter === "Cancelled"
    ? "No Cancelled Bookings"
    : "No Bookings Yet"}
</h2>
        <p>
          Explore our programs and book your next learning
          experience.
        </p>
        <button
          className="bookings-primary-button"
          onClick={onBack}
        >
          Explore Programs
        </button>
      </div>
    ) : (
      filteredBookings.map((booking) => (
        <article className="booking-item" key={booking.id}>
          <div className="booking-item-top">
            <span className="booking-type">
              {booking.programType || "Program"}
            </span>

            <span
  className={`booking-status ${
    getDisplayStatus(booking) === "Cancelled"
      ? "booking-status-cancelled"
      : getDisplayStatus(booking) === "Completed"
      ? "booking-status-completed"
      : ""
  }`}
>
  {getDisplayStatus(booking)}
</span>
          </div>

          <h2>{booking.programTitle}</h2>
          <div className="booking-program-extra">
  <p>
    <strong>Category:</strong>{" "}
    {booking.category ||
      booking.programInfo?.category ||
      "Not available"}
  </p>

  <p>
    <strong>Duration:</strong>{" "}
    {booking.duration ||
      booking.programInfo?.duration ||
      "Not available"}
  </p>

  <p>
    <strong>Trainer:</strong>{" "}
    {booking.trainerName ||
      booking.programInfo?.trainer ||
      booking.programInfo?.trainerName ||
      "Not available"}
  </p>
</div>
          <button
  className="view-booking-details-button"
  onClick={() => setSelectedBooking(booking)}
>
  View Details
</button>

<div className="booking-item-info">
  <p>
    <CalendarDays size={17} />
    <span>
      <strong>Start date:</strong>{" "}
      {booking.sessionStartDate ||
        booking.sessionDate ||
        booking.sessionInfo?.startDate ||
        booking.sessionInfo?.date ||
        booking.date ||
        "Date not available"}
    </span>
  </p>

  <p>
    <CalendarDays size={17} />
    <span>
      <strong>End date:</strong>{" "}
      {booking.sessionEndDate ||
        booking.sessionInfo?.endDate ||
        "Not available"}
    </span>
  </p>

  <p>
    <Clock size={17} />
    <span>
      <strong>Time:</strong>{" "}
      {booking.sessionStartTime ||
        booking.sessionInfo?.startTime ||
        "Not available"}
      {" – "}
      {booking.sessionEndTime ||
        booking.sessionInfo?.endTime ||
        "Not available"}
    </span>
  </p>

  <p>
    <strong>Batch:</strong>{" "}
    {booking.sessionName ||
      booking.session ||
      booking.sessionInfo?.name ||
      "Default session"}
  </p>

  <p>
    <strong>Mode:</strong>{" "}
    {booking.sessionMode ||
      booking.sessionInfo?.mode ||
      "Not specified"}
  </p>

  <p>
    <strong>
      {(booking.sessionMode || booking.sessionInfo?.mode) === "Offline"
        ? "Venue:"
        : "Meeting link:"}
    </strong>{" "}
    {(booking.sessionMode || booking.sessionInfo?.mode) === "Offline"
      ? booking.sessionVenue ||
        booking.sessionInfo?.venue ||
        "Not provided"
      : booking.sessionMeetingInfo ||
        booking.sessionInfo?.meetingInfo ||
        "Not provided"}
  </p>

  <p>
    <strong>Registration deadline:</strong>{" "}
    {booking.sessionRegistrationDeadline ||
      booking.sessionInfo?.registrationDeadline ||
      "Not available"}
  </p>
</div>

          <div className="booking-item-footer">
            <div>
              <small>Booking ID</small>
              <strong>{booking.id}</strong>
            </div>

            <div>
              <small>Registration fee</small>
              <strong>
                {typeof booking.price === "number"
                  ? `₹${booking.price.toLocaleString("en-IN")}`
                  : booking.price ?? "Not specified"}
              </strong>
            </div>
          </div>

          {booking.status === "Cancelled" &&
            booking.cancellationReason && (
              <p className="saved-cancellation-reason">
                <strong>Cancellation reason:</strong>{" "}
                {booking.cancellationReason}
              </p>
            )}
            
           {booking.status !== "Cancelled" && (
  <button
    className="booking-cancel-button"
    onClick={() => openCancellationBox(booking.id)}
  >
    <XCircle size={17} />
    Cancel Booking
  </button>
)}
     </article>
      ))
    )}
  </section>

  {selectedBookingId !== null && (
    <div className="cancel-modal-overlay">
      <div
        className="cancel-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
      >
        {!showCancelConfirmation ? (
          <>
            <h2 id="cancel-modal-title">
              Reason for Cancellation
            </h2>
            <p>
              Please tell us why you want to cancel this booking.
            </p>

            <label htmlFor="cancellation-reason">
              Cancellation reason
            </label>
            <textarea
              id="cancellation-reason"
              value={cancellationReason}
              onChange={(event) => {
                setCancellationReason(event.target.value);
                setCancelError("");
              }}
              placeholder="Enter your reason here..."
              rows={4}
              maxLength={500}
              required
            />

            <p className="cancellation-character-count">
              {cancellationReason.length}/500 characters
            </p>

            {cancelError && (
              <p className="cancellation-error" role="alert">
                {cancelError}
              </p>
            )}

            <div className="cancel-modal-buttons">
              <button
                className="cancel-modal-confirm"
                onClick={continueToConfirmation}
              >
                Continue
              </button>
              <button
                className="cancel-modal-back"
                onClick={closeCancellationBox}
              >
                Go Back
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="cancel-modal-title">
              Confirm Cancellation
            </h2>
            <p>
              Are you sure you want to cancel this booking?
            </p>

            <div className="cancellation-reason-preview">
              <strong>Your reason:</strong>
              <p>{cancellationReason.trim()}</p>
            </div>

            {cancelError && (
              <p className="cancellation-error" role="alert">
                {cancelError}
              </p>
            )}

            <div className="cancel-modal-buttons">
              <button
                className="cancel-modal-confirm"
                onClick={cancelBooking}
                disabled={isCancelling}
              >
                {isCancelling
                  ? "Cancelling..."
                  : "Yes, Cancel Booking"}
              </button>
              <button
                className="cancel-modal-back"
                onClick={() => {
                  setShowCancelConfirmation(false);
                  setCancelError("");
                }}
                disabled={isCancelling}
              >
                No, Go Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )}
</main>

);
}

export default MyBookings;
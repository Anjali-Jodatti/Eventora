import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import "./AllBookings.css";

function AllBookings({ onBack }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [cancellingId, setCancellingId] = useState("");

  async function loadBookings() {
    setLoading(true);
    setError("");

    try {
      if (!auth.currentUser) {
        setError("Please log in first.");
        return;
      }

      const snapshot = await getDocs(collection(db, "bookings"));

      const records = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      setBookings(records);
    } catch (err) {
      console.error("All Bookings error:", err);
      setError(err.message || "Unable to load bookings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

  async function handleCancelBooking(booking) {
  if (!auth.currentUser) {
    alert("Please log in first.");
    return;
  }

  if (String(booking.status || "Confirmed").toLowerCase() !== "confirmed") {
    alert("Only confirmed bookings can be cancelled.");
    return;
  }

  const reason = window.prompt(
    "Enter the reason for cancelling this booking:"
  );

  if (reason === null) return;

  const trimmedReason = reason.trim();

  if (!trimmedReason) {
    alert("Please enter a cancellation reason.");
    return;
  }

  if (trimmedReason.length > 500) {
    alert("Cancellation reason must be 500 characters or less.");
    return;
  }

  const confirmed = window.confirm(
    "Are you sure you want to cancel this booking? One seat will be restored."
  );

  if (!confirmed) return;

  setCancellingId(booking.id);
  setError("");

  try {
    // Find the correct program document.
    const programsSnapshot = await getDocs(collection(db, "programs"));

    const programDocument = programsSnapshot.docs.find((item) => {
      const data = item.data();

      return (
        item.id === booking.programFirestoreId ||
        String(data.id) === String(booking.programId) ||
        (
          booking.programTitle &&
          data.title === booking.programTitle
        )
      );
    });

    if (!programDocument) {
      throw new Error(
        "The program linked to this booking could not be found."
      );
    }

    const programData = programDocument.data();

    // Resolve the session from the booking information.
    const oldSession =
      booking.session && typeof booking.session === "object"
        ? booking.session
        : {};

    const savedSessionName =
      booking.sessionName ||
      oldSession.name ||
      (typeof booking.session === "string" ? booking.session : "");

    const savedSessionDate =
      booking.sessionDate ||
      oldSession.date ||
      "";

    const sessions = Array.isArray(programData.sessions)
      ? programData.sessions
      : [];

    const matchingSessions = sessions.filter((session) => {
      if (
        booking.sessionId &&
        session.id === booking.sessionId
      ) {
        return true;
      }

      if (
        savedSessionName &&
        session.name === savedSessionName
      ) {
        return true;
      }

      if (
        savedSessionDate &&
        session.date === savedSessionDate
      ) {
        return true;
      }

      return false;
    });

    if (matchingSessions.length !== 1) {
      throw new Error(
        "The correct session could not be identified. Please check the booking's session details."
      );
    }

    const selectedSession = matchingSessions[0];

    const programFirestoreId = programDocument.id;
    const sessionId = selectedSession.id;

    if (!sessionId) {
      throw new Error("The session does not have a valid ID.");
    }

    const bookingRef = doc(db, "bookings", booking.id);

    const inventoryId = `${programFirestoreId}__${sessionId}`;
    const inventoryRef = doc(db, "seatInventory", inventoryId);

    await runTransaction(db, async (transaction) => {
      const bookingSnapshot = await transaction.get(bookingRef);
      const inventorySnapshot = await transaction.get(inventoryRef);

      if (!bookingSnapshot.exists()) {
        throw new Error("This booking no longer exists.");
      }

      const latestBooking = bookingSnapshot.data();

      if (
        String(latestBooking.status || "Confirmed").toLowerCase() !==
        "confirmed"
      ) {
        throw new Error(
          "This booking has already been cancelled or changed."
        );
      }

      if (!inventorySnapshot.exists()) {
        throw new Error(
          "Seat inventory was not found for this session. No cancellation was made."
        );
      }

      const inventory = inventorySnapshot.data();
      const availableSeats = Number(inventory.availableSeats);
      const maxSeats = Number(inventory.maxSeats);

      if (!Number.isInteger(availableSeats) || availableSeats < 0) {
        throw new Error("The available seat count is invalid.");
      }

      if (
        Number.isFinite(maxSeats) &&
        maxSeats > 0 &&
        availableSeats >= maxSeats
      ) {
        throw new Error(
          "The seat count is already at capacity. Please check the inventory."
        );
      }

      // Cancel booking and save resolved IDs for future operations.
      transaction.update(bookingRef, {
        status: "Cancelled",
        cancellationReason: trimmedReason,
        cancelledAt: new Date().toISOString(),
        cancelledBy: auth.currentUser.uid,
        programFirestoreId,
        sessionId,
      });

      // Restore exactly one seat.
      transaction.update(inventoryRef, {
        availableSeats: availableSeats + 1,
        updatedAt: serverTimestamp(),
      });
    });

    // Notify the participant about the cancellation.
    try {
      if (booking.userId) {
        await addDoc(collection(db, "notifications"), {
          userId: booking.userId,
          bookingId: booking.id,
          type: "booking_cancelled",
          title: "Booking Cancelled",
          message: `Your booking for ${programData.title} - ${selectedSession.name} has been cancelled by the administrator.`,
          recipientEmail: booking.email || "",
          programTitle: programData.title || "",
          sessionName: selectedSession.name || "",
          isRead: false,
          channel: "in_app_email_simulation",
          createdAt: serverTimestamp(),
        });

        console.log("Cancellation notification created.");
      }
    } catch (notificationError) {
      console.error(
        "Cancellation notification could not be created:",
        notificationError
      );

      alert(
        "Booking was cancelled, but the participant notification failed: " +
          notificationError.message
      );
    }

    alert("Booking cancelled successfully. One seat has been restored.");

    await loadBookings();
  } catch (err) {
    console.error("Admin cancellation error:", err);
    alert(err.message || "Unable to cancel this booking.");
  } finally {
    setCancellingId("");
  }
}

  const getStatus = (booking) =>
    String(booking.status || "Confirmed").toLowerCase();

  const confirmedCount = bookings.filter(
    (booking) => getStatus(booking) === "confirmed"
  ).length;

  const cancelledCount = bookings.filter(
    (booking) => getStatus(booking) === "cancelled"
  ).length;

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const participant =
        booking.participantName || booking.userName || booking.name || "";
      const email = booking.email || booking.userEmail || "";
      const program =
        booking.programTitle || booking.title || "Program booking";

      const matchesSearch = [participant, email, program, booking.id]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const status = getStatus(booking);

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Confirmed" && status === "confirmed") ||
        (statusFilter === "Cancelled" && status === "cancelled") ||
        (statusFilter === "Other" &&
          status !== "confirmed" &&
          status !== "cancelled");

      return matchesSearch && matchesStatus;
    });
  }, [bookings, search, statusFilter]);

  function statusClass(status) {
    const normalized = String(status || "Confirmed").toLowerCase();

    if (normalized === "confirmed") {
      return "ab-status ab-status-confirmed";
    }

    if (normalized === "cancelled") {
      return "ab-status ab-status-cancelled";
    }

    return "ab-status ab-status-other";
  }

  function formatDate(booking) {
    if (booking.bookedAt?.toDate) {
      return booking.bookedAt.toDate().toLocaleDateString();
    }

    return (
      booking.date ||
      (booking.bookedAt ? String(booking.bookedAt) : "—")
    );
  }

  return (
    <main className="admin-bookings-page">
      <header className="ab-page-header">
        <div>
          <p className="ab-eyebrow">EVENTORA / ADMINISTRATION</p>
          <h1>Booking Management</h1>
          <p className="ab-subtitle">
            Monitor participant registrations and booking status in one place.
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="ab-button ab-button-light"
        >
          ← Dashboard
        </button>
      </header>

      <section className="ab-stats-grid">
        <article className="ab-stat-card">
          <span className="ab-stat-icon ab-icon-purple">▤</span>
          <p>Total bookings</p>
          <strong>{bookings.length}</strong>
          <small>All registration records</small>
        </article>

        <article className="ab-stat-card">
          <span className="ab-stat-icon ab-icon-green">✓</span>
          <p>Confirmed</p>
          <strong className="ab-green-text">{confirmedCount}</strong>
          <small>Confirmed registrations</small>
        </article>

        <article className="ab-stat-card">
          <span className="ab-stat-icon ab-icon-red">×</span>
          <p>Cancelled</p>
          <strong className="ab-red-text">{cancelledCount}</strong>
          <small>Cancelled registrations</small>
        </article>
      </section>

      <section className="ab-panel">
        <div className="ab-list-heading">
          <div>
            <h2>All Registrations</h2>
            <p>
              {filteredBookings.length} of {bookings.length} bookings shown
            </p>
          </div>

          <div className="ab-controls">
            <input
              aria-label="Search bookings"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search participant, email, program..."
              className="ab-search"
            />

            <select
              aria-label="Filter bookings by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="ab-filter"
            >
              <option value="All">All statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="ab-empty-state">
            <span className="ab-loader" />
            <strong>Loading bookings...</strong>
            <p>Fetching registrations from Firestore.</p>
          </div>
        )}

        {!loading && error && (
          <div className="ab-alert-error" role="alert">
            <strong>Unable to load bookings</strong>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && bookings.length === 0 && (
          <div className="ab-empty-state">
            <div className="ab-empty-icon">▤</div>
            <strong>No bookings yet</strong>
            <p>New participant registrations will appear here.</p>
          </div>
        )}

        {!loading &&
          !error &&
          bookings.length > 0 &&
          filteredBookings.length === 0 && (
            <div className="ab-empty-state">
              <strong>No matching bookings</strong>
              <p>Try changing your search or selected status.</p>
            </div>
          )}

        {!loading && !error && filteredBookings.length > 0 && (
          <div className="ab-table-wrap">
            <table className="ab-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Program</th>
                  <th>Booking ID</th>
                  <th>Booking Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredBookings.map((booking) => {
                  const participant =
                    booking.participantName ||
                    booking.userName ||
                    booking.name ||
                    "Not provided";

                  const email =
                    booking.email || booking.userEmail || "Not provided";

                  const program =
                    booking.programTitle ||
                    booking.title ||
                    "Program booking";

                  const status = booking.status || "Confirmed";
                  const isConfirmed = getStatus(booking) === "confirmed";

                  return (
                    <tr key={booking.id}>
                      <td>
                        <div className="ab-participant">
                          <span className="ab-avatar">
                            {participant.charAt(0).toUpperCase()}
                          </span>

                          <span className="ab-participant-details">
                            <strong>{participant}</strong>
                            <small>{email}</small>
                          </span>
                        </div>
                      </td>

                      <td>
                        <strong className="ab-program-title">
                          {program}
                        </strong>

                        {booking.programType && (
                          <small className="ab-secondary-text">
                            {booking.programType}
                          </small>
                        )}
                      </td>

                      <td>
                        <span className="ab-booking-id" title={booking.id}>
                          {booking.id.length > 12
                            ? `${booking.id.slice(0, 12)}...`
                            : booking.id}
                        </span>
                      </td>

                      <td>{formatDate(booking)}</td>

                      <td className="ab-price">
                        {booking.price != null
                          ? `₹${Number(booking.price).toLocaleString("en-IN")}`
                          : "—"}
                      </td>

                      <td>
                        <span className={statusClass(status)}>
                          ● {status}
                        </span>
                      </td>

                      <td>
                        {isConfirmed ? (
                          <button
                            type="button"
                            className="ab-cancel-button"
                            disabled={cancellingId === booking.id}
                            onClick={() => handleCancelBooking(booking)}
                          >
                            {cancellingId === booking.id
                              ? "Cancelling..."
                              : "Cancel"}
                          </button>
                        ) : (
                          <span className="ab-action-disabled">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="ab-footer">
        Eventora Admin Panel · Booking overview
      </footer>
    </main>
  );
}

export default AllBookings;
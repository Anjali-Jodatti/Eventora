import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import "./BookingPage.css";

function BookingPage({ program, onBack, onConfirm, userId }) {
  const [participant, setParticipant] = useState({
    name: "",
    email: "",
    mobile: "",
  });

  const [selectedSession, setSelectedSession] = useState("0");
  const [bookingMessage, setBookingMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [bookingCompleted, setBookingCompleted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const sessions = program.sessions || [];

  function parseBatchDate(value) {
    if (!value) return null;

    let date;

    if (value?.toDate) {
      date = value.toDate();
    } else if (value instanceof Date) {
      date = new Date(value);
    } else if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      date = new Date(`${value}T00:00:00`);
    } else {
      date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) return null;

    date.setHours(0, 0, 0, 0);
    return date;
  }

  function formatDate(value) {
    const date = parseBatchDate(value);

    if (!date) return "Not available";

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatPrice(value) {
    return Number(value || 0).toLocaleString("en-IN");
  }

  function getAvailableSeats(session) {
    const value = session.availableSeats;

    if (value === undefined || value === null || value === "") {
      return Number(session.maxSeats || 0);
    }

    return Number(value);
  }

  function isBatchEligible(session) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = parseBatchDate(
      session.startDate || session.date
    );

    const deadline = parseBatchDate(
      session.registrationDeadline
    );

    const availableSeats = getAvailableSeats(session);

    if (!startDate || startDate < today) return false;
    if (deadline && today > deadline) return false;

    if (
      !Number.isFinite(availableSeats) ||
      availableSeats <= 0
    ) {
      return false;
    }

    return true;
  }

  const eligibleSessions = sessions
    .map((session, index) => ({
      ...session,
      originalIndex: index,
    }))
    .filter(isBatchEligible);

  useEffect(() => {
    const selectedBatchExists = eligibleSessions.some(
      (session) =>
        String(session.originalIndex) === selectedSession
    );

    if (!selectedBatchExists) {
      setSelectedSession(
        eligibleSessions.length > 0
          ? String(eligibleSessions[0].originalIndex)
          : ""
      );
    }
  }, [selectedSession, program.sessions]);

  const selectedSessionData =
    eligibleSessions.find(
      (session) =>
        String(session.originalIndex) === selectedSession
    ) || eligibleSessions[0] || null;

  function handleNextStep() {
    setBookingMessage("");

    if (currentStep === 1 && !selectedSessionData) {
      setBookingMessage("Please select an available batch.");
      return;
    }

    if (currentStep === 2) {
      if (
        !participant.name.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          participant.email.trim()
        ) ||
        !/^[0-9]{10}$/.test(participant.mobile.trim())
      ) {
        setBookingMessage(
          "Please enter a valid name, email and 10-digit mobile number."
        );
        return;
      }
    }

    setCurrentStep((previous) =>
      Math.min(previous + 1, 3)
    );
  }

  function handlePreviousStep() {
    setBookingMessage("");

    setCurrentStep((previous) =>
      Math.max(previous - 1, 1)
    );
  }

  async function handleBooking() {
    if (!termsAccepted) {
      setBookingMessage(
        "Please accept the Terms and Conditions before confirming your booking."
      );
      return;
    }

    if (
      !userId ||
      !auth.currentUser ||
      auth.currentUser.uid !== userId
    ) {
      setBookingMessage("Please log in before booking.");
      return;
    }

    if (isSubmitting || !selectedSessionData) return;

    setIsSubmitting(true);
    setBookingMessage("");

    try {
      const currentUser = auth.currentUser;

      if (!program.firestoreId || !selectedSessionData.id) {
        throw new Error(
          "Program or batch information is missing."
        );
      }

      const inventoryId =
        `${program.firestoreId}__${selectedSessionData.id}`;

      const inventoryRef = doc(
        db,
        "seatInventory",
        inventoryId
      );

      const bookingId =
        `${currentUser.uid}_${program.firestoreId}_${selectedSessionData.id}`;

      const bookingRef = doc(db, "bookings", bookingId);

      console.log("BOOKING PROGRAM DATA:", program);
      console.log("SELECTED SESSION DATA:", selectedSessionData);

      await runTransaction(db, async (transaction) => {
        const inventorySnapshot =
          await transaction.get(inventoryRef);

        const bookingSnapshot =
          await transaction.get(bookingRef);

        if (!inventorySnapshot.exists()) {
          throw new Error("INVALID_SEAT_DATA");
        }

        if (bookingSnapshot.exists()) {
          const existingBooking = bookingSnapshot.data();

          if (existingBooking.status !== "Cancelled") {
            throw new Error("ALREADY_BOOKED");
          }
        }

        const inventory = inventorySnapshot.data();
        const availableSeats = Number(inventory.availableSeats);

        if (
          !Number.isInteger(availableSeats) ||
          availableSeats <= 0
        ) {
          throw new Error("BATCH_FULL");
        }

        transaction.update(inventoryRef, {
          availableSeats: availableSeats - 1,
          updatedAt: serverTimestamp(),
        });

        transaction.set(bookingRef, {
          // Participant information
          userId: currentUser.uid,
          participantName: participant.name.trim(),
          email: participant.email.trim(),
          mobile: participant.mobile.trim(),

          // Program information
          programId: program.id,
          programTitle: program.title,
          programType: program.type || "",
          programFirestoreId: program.firestoreId,
          category: program.category || "",
          duration: program.duration || "",
          trainerName: program.trainer || program.trainerName || "",
          price: Number(program.price || 0),

          // Batch information
          sessionId: selectedSessionData.id,
          session: selectedSessionData.name || "",
          sessionName: selectedSessionData.name || "",

          sessionDate:
            selectedSessionData.startDate ||
            selectedSessionData.date ||
            "",

          sessionStartDate:
            selectedSessionData.startDate ||
            selectedSessionData.date ||
            "",

          sessionEndDate: selectedSessionData.endDate || "",

          sessionStartTime: selectedSessionData.startTime || "",
          sessionEndTime: selectedSessionData.endTime || "",

          sessionMode:
            selectedSessionData.mode ||
            selectedSessionData.sessionMode ||
            "",

          sessionVenue:
            selectedSessionData.venue ||
            selectedSessionData.sessionVenue ||
            "",

          sessionMeetingInfo:
            selectedSessionData.meetingInfo ||
            selectedSessionData.meetingLink ||
            selectedSessionData.sessionMeetingInfo ||
            "",

          sessionRegistrationDeadline:
            selectedSessionData.registrationDeadline || "",

          sessionMaxSeats: Number(
            selectedSessionData.maxSeats ||
            selectedSessionData.availableSeats ||
            0
          ),

          // Booking status and timestamps
          status: "Confirmed",
          bookedAt: serverTimestamp(),
          cancellationReason: "",
          cancelledAt: null,
        });
      });

      // Verify the saved booking document
      const savedBookingSnapshot = await getDoc(bookingRef);

      if (savedBookingSnapshot.exists()) {
        console.log(
          "SAVED BOOKING DATA:",
          savedBookingSnapshot.data()
        );
      } else {
        console.error(
          "Booking document was not found after saving."
        );
      }

      // Create booking confirmation notification
      try {
        await addDoc(collection(db, "notifications"), {
          userId: currentUser.uid,
          bookingId: bookingId,
          type: "booking_confirmed",
          title: "Booking Confirmed!",
          message: `Your booking for ${program.title} - ${selectedSessionData.name} has been confirmed.`,
          recipientEmail: participant.email.trim(),
          programTitle: program.title,
          sessionName: selectedSessionData.name,
          isRead: false,
          channel: "in_app_email_simulation",
          createdAt: serverTimestamp(),
        });

        console.log(
          "Booking notification created successfully."
        );
      } catch (notificationError) {
        console.error(
          "Booking notification could not be created:",
          notificationError
        );
      }

      setBookingCompleted(true);
      setCurrentStep(4);
      setBookingMessage(
        "Your booking has been confirmed!"
      );
    } catch (error) {
      console.error("Booking error:", error);

      const errorMessages = {
        ALREADY_BOOKED:
          "You have already booked this batch.",
        BATCH_FULL:
          "Sorry, this batch is fully booked.",
        INVALID_SEAT_DATA:
          "Batch seat information is invalid. Please contact the administrator.",
      };

      setBookingMessage(
        errorMessages[error.message] ||
        "Unable to save your booking. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderStepIndicator() {
    const steps = [
      "Program & Batch",
      "Participant Details",
      "Booking Summary",
      "Confirmation",
    ];

    return (
      <div className="booking-progress">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = currentStep === stepNumber;
          const isCompleted = currentStep > stepNumber;

          return (
            <div
              key={step}
              className={`progress-step ${
                isActive ? "active" : ""
              } ${isCompleted ? "completed" : ""}`}
            >
              <div className="progress-circle">
                {isCompleted ? "✓" : stepNumber}
              </div>

              <span>{step}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="booking-page">
      <header className="booking-header">
        <div>
          <span className="booking-brand">EVENTORA</span>
          <h2>Book Your Seat</h2>
          <p>Complete your registration in a few simple steps.</p>
        </div>

        {currentStep !== 4 && (
          <button
            className="booking-back-button"
            type="button"
            onClick={
              currentStep === 1
                ? onBack
                : handlePreviousStep
            }
          >
            ← {currentStep === 1 ? "Back to Program" : "Back"}
          </button>
        )}
      </header>

      <main className="booking-container">
        <div className="booking-card">
          {renderStepIndicator()}

          <div className="booking-content">
            {/* STEP 1: PROGRAM AND BATCH */}
            {currentStep === 1 && (
              <section className="booking-section">
                <div className="section-heading">
                  <span className="section-tag">STEP 01</span>
                  <h1>Select Your Program & Batch</h1>
                  <p>
                    Choose your preferred batch to reserve
                    your seat.
                  </p>
                </div>

                <div className="program-summary-card">
                  <div className="program-icon">🎓</div>

                  <div className="program-info">
                    <span className="program-type">
                      {program.type || "PROGRAM"}
                    </span>
                    <h3>{program.title}</h3>
                    <p>
                      Your learning journey starts here.
                    </p>
                  </div>

                  <div className="program-price">
                    <span>Program Fee</span>
                    <strong>
                      ₹{formatPrice(program.price)}
                    </strong>
                  </div>
                </div>

                <div className="batch-selection">
                  <label htmlFor="booking-session">
                    Choose Your Batch
                  </label>

                  {eligibleSessions.length > 0 ? (
                    <>
                      <select
                        id="booking-session"
                        value={selectedSession}
                        onChange={(e) => {
                          setSelectedSession(e.target.value);
                          setBookingMessage("");
                        }}
                      >
                        {eligibleSessions.map((session) => (
                          <option
                            key={
                              session.id ||
                              session.originalIndex
                            }
                            value={String(session.originalIndex)}
                          >
                            {session.name} —{" "}
                            {formatDate(
                              session.startDate || session.date
                            )}
                          </option>
                        ))}
                      </select>

                      {selectedSessionData && (
                        <div className="batch-details-card">
                          <div className="batch-card-heading">
                            <div>
                              <span className="batch-label">
                                SELECTED BATCH
                              </span>
                              <h3>
                                {selectedSessionData.name}
                              </h3>
                            </div>

                            <span className="available-badge">
                              ● Available
                            </span>
                          </div>

                          <div className="batch-details-grid">
                            <div className="batch-detail">
                              <span>📅 Start Date</span>
                              <strong>
                                {formatDate(
                                  selectedSessionData.startDate ||
                                  selectedSessionData.date
                                )}
                              </strong>
                            </div>

                            <div className="batch-detail">
                              <span>📅 End Date</span>
                              <strong>
                                {formatDate(
                                  selectedSessionData.endDate
                                )}
                              </strong>
                            </div>

                            <div className="batch-detail">
                              <span>🕘 Start Time</span>
                              <strong>
                                {selectedSessionData.startTime ||
                                  "Not available"}
                              </strong>
                            </div>

                            <div className="batch-detail">
                              <span>🕔 End Time</span>
                              <strong>
                                {selectedSessionData.endTime ||
                                  "Not available"}
                              </strong>
                            </div>

                            <div className="batch-detail">
                              <span>💻 Mode</span>
                              <strong>
                                {selectedSessionData.mode ||
                                  "Not specified"}
                              </strong>
                            </div>

                            <div className="batch-detail">
                              <span>💺 Available Seats</span>
                              <strong>
                                {getAvailableSeats(
                                  selectedSessionData
                                )}
                              </strong>
                            </div>

                            <div className="batch-detail">
                              <span>⏳ Registration Deadline</span>
                              <strong>
                                {selectedSessionData.registrationDeadline
                                  ? formatDate(
                                      selectedSessionData.registrationDeadline
                                    )
                                  : "Not specified"}
                              </strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="no-batches">
                      <span>📅</span>
                      <h3>No Batches Available</h3>
                      <p>
                        There are currently no batches open
                        for registration. Please check again later.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="booking-primary-button"
                  disabled={!selectedSessionData}
                  onClick={handleNextStep}
                >
                  Continue to Participant Details →
                </button>
              </section>
            )}

            {/* STEP 2: PARTICIPANT DETAILS */}
            {currentStep === 2 && (
              <section className="booking-section">
                <div className="section-heading">
                  <span className="section-tag">STEP 02</span>
                  <h1>Participant Details</h1>
                  <p>
                    Enter your information to complete
                    your registration.
                  </p>
                </div>

                <div className="participant-form">
                  <div className="form-field">
                    <label htmlFor="participant-name">
                      Full Name
                    </label>
                    <input
                      id="participant-name"
                      type="text"
                      value={participant.name}
                      onChange={(e) =>
                        setParticipant({
                          ...participant,
                          name: e.target.value,
                        })
                      }
                      placeholder="Enter your full name"
                      autoComplete="name"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="participant-email">
                      Email Address
                    </label>
                    <input
                      id="participant-email"
                      type="email"
                      value={participant.email}
                      onChange={(e) =>
                        setParticipant({
                          ...participant,
                          email: e.target.value,
                        })
                      }
                      placeholder="Enter your email address"
                      autoComplete="email"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="participant-mobile">
                      Mobile Number
                    </label>
                    <input
                      id="participant-mobile"
                      type="tel"
                      inputMode="numeric"
                      value={participant.mobile}
                      onChange={(e) =>
                        setParticipant({
                          ...participant,
                          mobile: e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 10),
                        })
                      }
                      placeholder="Enter your 10-digit mobile number"
                      maxLength={10}
                      autoComplete="tel"
                    />
                    <small>
                      Enter a valid 10-digit mobile number.
                    </small>
                  </div>
                </div>

                <div className="form-note">
                  <span>🔒</span>
                  Your personal information is used only
                  for booking and registration purposes.
                </div>

                <button
                  type="button"
                  className="booking-primary-button"
                  onClick={handleNextStep}
                >
                  Continue to Booking Summary →
                </button>
              </section>
            )}

            {/* STEP 3: BOOKING SUMMARY */}
            {currentStep === 3 && (
              <section className="booking-section">
                <div className="section-heading">
                  <span className="section-tag">STEP 03</span>
                  <h1>Review Your Booking</h1>
                  <p>
                    Please verify your details before
                    confirming your seat.
                  </p>
                </div>

                <div className="summary-card">
                  <div className="summary-heading">
                    <span>🎓</span>
                    <h3>Program Details</h3>
                  </div>

                  <div className="summary-row">
                    <span>Program Name</span>
                    <strong>{program.title}</strong>
                  </div>

                  <div className="summary-row">
                    <span>Program Type</span>
                    <strong>{program.type || "Program"}</strong>
                  </div>

                  <div className="summary-row">
                    <span>Selected Batch</span>
                    <strong>
                      {selectedSessionData?.name}
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>Batch Date</span>
                    <strong>
                      {formatDate(
                        selectedSessionData?.startDate ||
                        selectedSessionData?.date
                      )}
                    </strong>
                  </div>

                  <div className="summary-divider" />

                  <div className="summary-heading">
                    <span>👤</span>
                    <h3>Participant Details</h3>
                  </div>

                  <div className="summary-row">
                    <span>Full Name</span>
                    <strong>{participant.name}</strong>
                  </div>

                  <div className="summary-row">
                    <span>Email Address</span>
                    <strong>{participant.email}</strong>
                  </div>

                  <div className="summary-row">
                    <span>Mobile Number</span>
                    <strong>{participant.mobile}</strong>
                  </div>

                  <div className="summary-divider" />

                  <div className="total-amount">
                    <div>
                      <span>Total Booking Amount</span>
                      <small>One participant · One seat</small>
                    </div>

                    <strong>
                      ₹{formatPrice(program.price)}
                    </strong>
                  </div>

                  <div className="booking-terms">
                    <label>
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => {
                          setTermsAccepted(e.target.checked);
                          setBookingMessage("");
                        }}
                      />

                      <span>
                        I have read and agree to the Terms and
                        Conditions. I understand that this is a
                        mock registration and no real payment
                        will be collected.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="summary-actions">
                  <button
                    type="button"
                    className="booking-secondary-button"
                    onClick={handlePreviousStep}
                  >
                    ← Edit Details
                  </button>

                  <button
                    type="button"
                    className="booking-primary-button"
                    onClick={handleBooking}
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? "Confirming Booking..."
                      : "Confirm My Booking →"}
                  </button>
                </div>
              </section>
            )}

            {/* STEP 4: CONFIRMATION */}
            {currentStep === 4 && bookingCompleted && (
              <section className="booking-success">
                <div className="success-icon">✓</div>

                <span className="section-tag">
                  REGISTRATION COMPLETE
                </span>

                <h1>Booking Confirmed!</h1>

                <p>
                  Congratulations! Your seat has been
                  successfully reserved.
                </p>

                <div className="confirmation-card">
                  <div className="confirmation-status">
                    <span>BOOKING STATUS</span>
                    <strong>✓ Confirmed</strong>
                  </div>

                  <div className="summary-row">
                    <span>Program</span>
                    <strong>{program.title}</strong>
                  </div>

                  <div className="summary-row">
                    <span>Participant</span>
                    <strong>{participant.name}</strong>
                  </div>

                  <div className="summary-row">
                    <span>Email</span>
                    <strong>{participant.email}</strong>
                  </div>

                  <div className="summary-row">
                    <span>Batch</span>
                    <strong>
                      {selectedSessionData?.name}
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>Amount</span>
                    <strong>
                      ₹{formatPrice(program.price)}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="booking-primary-button"
                  onClick={onConfirm}
                >
                  Go to My Bookings →
                </button>
              </section>
            )}

            {bookingMessage && (
              <div
                className="booking-alert"
                role="status"
                aria-live="polite"
              >
                <span>ⓘ</span>
                {bookingMessage}
              </div>
            )}
          </div>
        </div>

        {currentStep !== 4 && (
          <div className="booking-footer-note">
            <span>🔒</span>
            Secure registration powered by Eventora
          </div>
        )}
      </main>
    </div>
  );
}

export default BookingPage;
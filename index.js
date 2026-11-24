const { setGlobalOptions } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

setGlobalOptions({
  maxInstances: 10,
});

function getTodayInIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function validDate(value) {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value);
}

exports.createProgramBooking = onCall(
  { region: "asia-south1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Please log in before booking."
      );
    }

    const userId = request.auth.uid;
    const {
      programId,
      sessionIndex,
      participant,
    } = request.data || {};

    if (
      programId === undefined ||
      !Number.isFinite(Number(programId)) ||
      !Number.isInteger(sessionIndex) ||
      sessionIndex < 0
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid program or batch selection."
      );
    }

    const name = String(participant?.name || "").trim();
    const email = String(participant?.email || "").trim();
    const mobile = String(participant?.mobile || "").trim();

    if (
      !name ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^[0-9]{10}$/.test(mobile)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Please provide valid participant details."
      );
    }

    const numericProgramId = Number(programId);

    try {
      const programQuery = db.collection("programs")
        .where("id", "==", numericProgramId);

      const bookingQuery = db.collection("bookings")
        .where("userId", "==", userId)
        .where("programId", "==", numericProgramId)
        .where("status", "==", "Confirmed");

      const bookingRef = db.collection("bookings").doc();

      const result = await db.runTransaction(async (transaction) => {
        // Read the program and existing bookings before writing.
        const programSnapshot = await transaction.get(programQuery);
        const existingBookings = await transaction.get(bookingQuery);

        if (programSnapshot.empty) {
          throw new HttpsError(
            "not-found",
            "PROGRAM_NOT_FOUND"
          );
        }

        if (programSnapshot.size !== 1) {
          throw new HttpsError(
            "failed-precondition",
            "Multiple program documents have the same program ID."
          );
        }

        const programDoc = programSnapshot.docs[0];
        const programRef = programDoc.ref;
        const program = programDoc.data();

        if (program.isPublished !== true) {
          throw new HttpsError(
            "failed-precondition",
            "PROGRAM_UNPUBLISHED"
          );
        }

        const sessions = Array.isArray(program.sessions)
          ? program.sessions
          : [];

        if (sessionIndex >= sessions.length) {
          throw new HttpsError(
            "not-found",
            "BATCH_NOT_FOUND"
          );
        }

        const session = sessions[sessionIndex];

        // Prevent duplicate confirmed bookings for this batch.
        const duplicate = existingBookings.docs.some((doc) => {
          const booking = doc.data();

          if (
            booking.sessionIndex !== undefined &&
            booking.sessionIndex !== null
          ) {
            return Number(booking.sessionIndex) === sessionIndex;
          }

          return (
            (booking.sessionName || booking.session) ===
            session.name
          );
        });

        if (duplicate) {
          throw new HttpsError(
            "already-exists",
            "ALREADY_BOOKED"
          );
        }

        const today = getTodayInIndia();

        const startDate = session.startDate || session.date;
        const deadline = session.registrationDeadline;

        if (!validDate(startDate) || startDate < today) {
          throw new HttpsError(
            "failed-precondition",
            "BATCH_CLOSED"
          );
        }

        if (
          deadline &&
          (!validDate(deadline) || today > deadline)
        ) {
          throw new HttpsError(
            "failed-precondition",
            "REGISTRATION_CLOSED"
          );
        }

        const maxSeats = Number(session.maxSeats);

        const availableSeats =
          session.availableSeats === undefined ||
          session.availableSeats === null ||
          session.availableSeats === ""
            ? maxSeats
            : Number(session.availableSeats);

        if (
          !Number.isInteger(maxSeats) ||
          maxSeats < 0 ||
          !Number.isInteger(availableSeats) ||
          availableSeats < 0 ||
          availableSeats > maxSeats
        ) {
          throw new HttpsError(
            "failed-precondition",
            "INVALID_SEAT_DATA"
          );
        }

        if (availableSeats === 0) {
          throw new HttpsError(
            "failed-precondition",
            "BATCH_FULL"
          );
        }

        const remainingSeats = availableSeats - 1;

        const updatedSessions = sessions.map((item, index) => {
          if (index !== sessionIndex) return item;

          return {
            ...item,
            availableSeats: remainingSeats,
          };
        });

        const bookingDate = startDate;

        const bookingData = {
          participantName: name,
          email,
          mobile,

          userId,
          programId: numericProgramId,
          programTitle: program.title || "",
          programType: program.type || "",
          price: Number(program.price) || 0,

          session: session.name || "",
          sessionName: session.name || "",
          sessionIndex,

          sessionDate: bookingDate,
          sessionStartDate: bookingDate,
          sessionEndDate: session.endDate || "",

          sessionStartTime: session.startTime || "",
          sessionEndTime: session.endTime || "",

          sessionMode: session.mode || "",
          sessionVenue: session.venue || "",
          sessionMeetingInfo: session.meetingInfo || "",

          sessionMaxSeats: maxSeats,
          sessionAvailableSeatsAfterBooking: remainingSeats,

          sessionRegistrationDeadline:
            session.registrationDeadline || "",

          date: bookingDate,
          bookedAt: new Date(),
          status: "Confirmed",
        };

        // Both operations commit together.
        transaction.update(programRef, {
          sessions: updatedSessions,
        });

        transaction.create(bookingRef, bookingData);

        return {
          bookingId: bookingRef.id,
          remainingSeats,
        };
      });

      return {
        success: true,
        message: "Booking confirmed successfully!",
        ...result,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      console.error("createProgramBooking error:", error);

      throw new HttpsError(
        "internal",
        "Unable to complete your booking. Please try again."
      );
    }
  }
);
import { useEffect } from "react";
import {
  CalendarDays,
  Clock,
  BookOpen,
  Users,
  MapPin,
  Video,
} from "lucide-react";
import "./EventDetails.css";

function EventDetails({ program, onBack, onBook }) {
  const sessions = Array.isArray(program.sessions)
    ? program.sessions
    : [];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const formatDate = (date) => {
    if (!date) return "Date not available";

    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) return date;

    return parsedDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (time) => {
    if (!time) return "Time not available";

    const [hours, minutes] = time.split(":");
    const parsedTime = new Date();
    parsedTime.setHours(Number(hours), Number(minutes), 0, 0);

    return parsedTime.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="event-details-page">
      <header className="details-header">
        <h2>Program Details</h2>
        <button type="button" className="back-button" onClick={onBack}>
          Dashboard
        </button>
      </header>

      <div className="details-card">
        <img
          src={program.image}
          alt={program.title}
          className="details-image"
        />

        <div className="details-content">
          <div className="details-status-row">
            <span className="details-category">{program.type}</span>

            <button
              type="button"
              className="details-book-button"
              onClick={onBook}
              disabled={!sessions.length && Number(program.seats ?? 0) <= 0}
            >
              Book Your Seat
            </button>
          </div>

          <h1>{program.title}</h1>

          <p>
            {program.description ||
              "Discover new skills, learn from experts, and connect with other participants."}
          </p>

          <div className="details-info">
            <p><strong>Category:</strong> {program.category}</p>
            <p><strong>Duration:</strong> {program.duration}</p>
            <p><strong>Trainer:</strong> {program.trainer || "Expert Instructor"}</p>
            <p>
              <strong>Price:</strong>{" "}
              {`₹${Number(program.price || 0).toLocaleString("en-IN")}`}
            </p>
          </div>

          <div className="participant-sessions">
            <h2>
              <BookOpen size={22} />
              Available Batches
            </h2>

            {sessions.length > 0 ? (
              <div className="participant-session-list">
                {sessions.map((session, index) => {
                  const remainingSeats = Number(
                    session.availableSeats ?? session.maxSeats ?? 0
                  );

                  return (
                    <div className="participant-session-card" key={session.id || index}>
                      <h3>
                        Batch {index + 1}: {session.name}
                      </h3>

                      <p>
                        <CalendarDays size={17} />
                        <strong>Start:</strong> {formatDate(session.startDate || session.date)}
                      </p>

                      <p>
                        <CalendarDays size={17} />
                        <strong>End:</strong> {formatDate(session.endDate || session.startDate || session.date)}
                      </p>

                      <p>
                        <Clock size={17} />
                        <strong>Time:</strong>{" "}
                        {formatTime(session.startTime)} – {formatTime(session.endTime)}
                      </p>

                      <p>
                        <Users size={17} />
                        <strong>Available seats:</strong> {remainingSeats}
                      </p>

                      <p>
                        <CalendarDays size={17} />
                        <strong>Registration deadline:</strong>{" "}
                        {formatDate(session.registrationDeadline)}
                      </p>

                      <p>
                        {session.mode === "Offline" ? (
                          <MapPin size={17} />
                        ) : (
                          <Video size={17} />
                        )}
                        <strong>{session.mode === "Offline" ? "Venue:" : "Online meeting:"}</strong>{" "}
                        {session.mode === "Offline"
                          ? session.venue || "Venue not provided"
                          : session.meetingInfo || "Meeting link will be provided"}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="no-sessions-message">
                Batch details have not been added yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventDetails;
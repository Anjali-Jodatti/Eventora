import { useEffect, useState } from "react";
import {
  collection,
  doc,
  query,
  where,
  runTransaction,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import "./CreateProgram.css";

const emptySession = {
  name: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  maxSeats: "",
  availableSeats: "",
  registrationDeadline: "",
  mode: "Online",
  venue: "",
  meetingInfo: "",
};

function CreateProgram({ onBack, onSaved }) {
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    title: "",
    type: "Workshop",
    category: "",
    duration: "",
    mode: "Online",
    trainer: "",
    price: "",
    image: "",
    isPublished: true,
  });

  const [sessions, setSessions] = useState([{ ...emptySession }]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const snapshot = await getDocs(collection(db, "categories"));

setCategories(
  snapshot.docs
    .filter((item) => item.data().isActive !== false)
    .map((item) => item.data())
);
      } catch (err) {
        console.error("Category loading error:", err);
      }
    };

    loadCategories();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSessionChange = (index, field, value) => {
    setSessions((prev) =>
      prev.map((session, i) =>
        i === index ? { ...session, [field]: value } : session
      )
    );
  };

  const addSession = () => {
    setSessions((prev) => [
      ...prev,
      {
        ...emptySession,
        id: `session-${Date.now()}`,
      },
    ]);
  };

  const removeSession = (index) => {
    if (sessions.length === 1) return;
    setSessions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (
      form.price === "" ||
      !Number.isFinite(Number(form.price)) ||
      Number(form.price) < 0
    ) {
      setError("Enter a valid program price.");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const batchNumber = i + 1;
      const availableSeats = Number(session.availableSeats);
const maxSeats = Number(session.maxSeats);

if (
  session.availableSeats === "" ||
  !Number.isInteger(availableSeats) ||
  availableSeats < 0 ||
  availableSeats > maxSeats
) {
  setError(
    `Batch ${batchNumber}: Available seats must be between 0 and maximum seats.`
  );
  return;
}

      if (
        !session.name.trim() ||
        !session.startDate ||
        !session.endDate ||
        !session.startTime ||
        !session.endTime ||
        !session.maxSeats ||
        !session.registrationDeadline
      ) {
        setError(
          `Please complete all required details for Batch ${batchNumber}.`
        );
        return;
      }

      if (session.startDate < today) {
        setError(`Batch ${batchNumber}: Start date cannot be in the past.`);
        return;
      }

      if (session.endDate < session.startDate) {
        setError(
          `Batch ${batchNumber}: End date cannot be before start date.`
        );
        return;
      }

      if (
        session.startDate === session.endDate &&
        session.endTime <= session.startTime
      ) {
        setError(
          `Batch ${batchNumber}: End time must be later than start time.`
        );
        return;
      }

      if (
        session.registrationDeadline > session.startDate ||
        session.registrationDeadline < today
      ) {
        setError(
          `Batch ${batchNumber}: Registration deadline must be today or later and cannot be after the start date.`
        );
        return;
      }

      if (
        !Number.isInteger(Number(session.maxSeats)) ||
        Number(session.maxSeats) < 1
      ) {
        setError(
          `Batch ${batchNumber}: Maximum seats must be at least 1.`
        );
        return;
      }

      if (session.mode === "Offline" && !session.venue.trim()) {
        setError(`Batch ${batchNumber}: Please enter the venue.`);
        return;
      }

      if (session.mode === "Online" && !session.meetingInfo.trim()) {
        setError(
          `Batch ${batchNumber}: Please enter the online meeting information.`
        );
        return;
      }
    }

    try {
      setSaving(true);

      const earliestStartDate = [...sessions]
        .map((session) => session.startDate)
        .sort()[0];

      const savedSessions = sessions.map((session, index) => ({
        id: session.id || `session-${index + 1}`,
        name: session.name.trim(),
        startDate: session.startDate,
        endDate: session.endDate,
        date: session.startDate,
        startTime: session.startTime,
        endTime: session.endTime,
       maxSeats: Number(session.maxSeats),
availableSeats: Number(session.availableSeats),
        registrationDeadline: session.registrationDeadline,
        mode: session.mode,
        venue: session.venue.trim(),
        meetingInfo: session.meetingInfo.trim(),
      }));

      const programRef = await addDoc(collection(db, "programs"), {
  ...form,
  id: Date.now(),
  date: earliestStartDate,
  price: Number(form.price),
  sessions: savedSessions,
  createdAt: new Date(),
});

for (const session of savedSessions) {
  await setDoc(
    doc(db, "seatInventory", `${programRef.id}__${session.id}`),
    {
      programId: programRef.id,
      sessionId: session.id,
      maxSeats: session.maxSeats,
      availableSeats: session.availableSeats,
      updatedAt: new Date(),
    }
  );
}

      setMessage("Program and batches created successfully!");
      onSaved?.();

      setForm({
        title: "",
        type: "Workshop",
        category: "",
        duration: "",
        mode: "Online",
        trainer: "",
        price: "",
        image: "",
        isPublished: true,
      });

      setSessions([{ ...emptySession }]);
    } catch (err) {
      console.error("Program creation error:", err);
      setError("Unable to create program. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="create-program-page">
      <div className="create-program-header">
        <div>
          <h1>Create New Program</h1>
          <p>Add program details and manage its batches.</p>
        </div>

        <button type="button" className="cp-back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
          Program Management
        </button>
      </div>

      <form className="create-program-form" onSubmit={handleSubmit}>
        <section className="cp-section">
          <h2>Program Details</h2>

          <div className="cp-grid">
            <div className="cp-field">
              <label>Program Title *</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Enter program title"
                required
              />
            </div>

            <div className="cp-field">
              <label>Program Type *</label>
              <select name="type" value={form.type} onChange={handleChange}>
                <option>Workshop</option>
                <option>Training</option>
                <option>Event</option>
              </select>
            </div>

            <div className="cp-field">
              <label>Category *</label>
              <input
                name="category"
                list="cp-categories"
                value={form.category}
                onChange={handleChange}
                placeholder="Select or enter category"
                required
              />
              <datalist id="cp-categories">
                {categories.map((category, index) => (
                  <option
                    key={index}
                    value={
                      category.name ||
                      category.title ||
                      category.category
                    }
                  />
                ))}
              </datalist>
            </div>

            <div className="cp-field">
              <label>Duration *</label>
              <input
                name="duration"
                value={form.duration}
                onChange={handleChange}
                placeholder="Example: 2 Days"
                required
              />
            </div>

            <div className="cp-field">
              <label>Default Program Mode *</label>
              <select name="mode" value={form.mode} onChange={handleChange}>
                <option>Online</option>
                <option>Offline</option>
              </select>
            </div>

            <div className="cp-field">
              <label>Trainer / Speaker *</label>
              <input
                name="trainer"
                value={form.trainer}
                onChange={handleChange}
                placeholder="Enter trainer name"
                required
              />
            </div>

            <div className="cp-field">
              <label>Price (₹) *</label>
              <input
                type="number"
                name="price"
                min="0"
                value={form.price}
                onChange={handleChange}
                placeholder="Enter price"
                required
              />
            </div>

            <div className="cp-field cp-full-width">
              <label>Image URL or Image Path</label>
              <input
                type="text"
                name="image"
                value={form.image}
                onChange={handleChange}
                placeholder="/rtm-trainer-2.png"
              />
            </div>
          </div>

          <label className="cp-publish-option">
            <input
              type="checkbox"
              name="isPublished"
              checked={form.isPublished}
              onChange={handleChange}
            />
            Publish this program
          </label>
        </section>

        <section className="cp-section">
          <div className="cp-session-heading">
            <div>
              <h2>Program Batches</h2>
              <p>
                Add one or more batches with their own schedule, capacity and
                registration details.
              </p>
            </div>

            <button
              type="button"
              className="cp-add-session-btn"
              onClick={addSession}
            >
              <Plus size={17} />
              Add Batch
            </button>
          </div>

          {sessions.map((session, index) => (
            <div className="cp-session-card" key={session.id || index}>
              <div className="cp-session-title">
                <h3>Batch {index + 1}</h3>

                {sessions.length > 1 && (
                  <button
                    type="button"
                    className="cp-remove-session"
                    onClick={() => removeSession(index)}
                    aria-label={`Remove batch ${index + 1}`}
                  >
                    <Trash2 size={17} />
                    Remove
                  </button>
                )}
              </div>

              <div className="cp-grid">
                <div className="cp-field">
                  <label>Batch Name *</label>
                  <input
                    value={session.name}
                    onChange={(e) =>
                      handleSessionChange(index, "name", e.target.value)
                    }
                    placeholder="Example: Morning Batch"
                    required
                  />
                </div>

                <div className="cp-field">
                  <label>Batch Mode *</label>
                  <select
                    value={session.mode}
                    onChange={(e) =>
                      handleSessionChange(index, "mode", e.target.value)
                    }
                  >
                    <option>Online</option>
                    <option>Offline</option>
                  </select>
                </div>

                <div className="cp-field">
                  <label>Start Date *</label>
                  <input
                    type="date"
                    value={session.startDate}
                    onChange={(e) =>
                      handleSessionChange(index, "startDate", e.target.value)
                    }
                    required
                  />
                </div>

                <div className="cp-field">
                  <label>End Date *</label>
                  <input
                    type="date"
                    min={session.startDate || undefined}
                    value={session.endDate}
                    onChange={(e) =>
                      handleSessionChange(index, "endDate", e.target.value)
                    }
                    required
                  />
                </div>

                <div className="cp-field">
                  <label>Start Time *</label>
                  <input
                    type="time"
                    value={session.startTime}
                    onChange={(e) =>
                      handleSessionChange(index, "startTime", e.target.value)
                    }
                    required
                  />
                </div>

                <div className="cp-field">
                  <label>End Time *</label>
                  <input
                    type="time"
                    value={session.endTime}
                    onChange={(e) =>
                      handleSessionChange(index, "endTime", e.target.value)
                    }
                    required
                  />
                </div>

                <div className="cp-field">
                  <label>Maximum Seats *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={session.maxSeats}
                    onChange={(e) =>
                      handleSessionChange(index, "maxSeats", e.target.value)
                    }
                    placeholder="Enter batch capacity"
                    required
                  />
                </div>

                <div className="cp-field">
  <label>Available Seats *</label>
  <input
    type="number"
    min="0"
    max={session.maxSeats || undefined}
    step="1"
    value={session.availableSeats}
    onChange={(e) =>
      handleSessionChange(
        index,
        "availableSeats",
        e.target.value
      )
    }
    placeholder="Enter available seats"
    required
  />
</div>

                <div className="cp-field">
                  <label>Registration Deadline *</label>
                  <input
                    type="date"
                    max={session.startDate || undefined}
                    value={session.registrationDeadline}
                    onChange={(e) =>
                      handleSessionChange(
                        index,
                        "registrationDeadline",
                        e.target.value
                      )
                    }
                    required
                  />
                </div>

                {session.mode === "Offline" ? (
                  <div className="cp-field cp-full-width">
                    <label>Venue / Location *</label>
                    <input
                      type="text"
                      value={session.venue}
                      onChange={(e) =>
                        handleSessionChange(index, "venue", e.target.value)
                      }
                      placeholder="Example: Seminar Hall, Bengaluru"
                      required
                    />
                  </div>
                ) : (
                  <div className="cp-field cp-full-width">
                    <label>Online Meeting Link *</label>
                    <input
                      type="url"
                      value={session.meetingInfo}
                      onChange={(e) =>
                        handleSessionChange(
                          index,
                          "meetingInfo",
                          e.target.value
                        )
                      }
                      placeholder="https://meet.google.com/..."
                      required
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>

        {error && <p className="cp-error">{error}</p>}
        {message && <p className="cp-success">{message}</p>}

        <div className="cp-form-actions">
          <button type="button" className="cp-cancel-btn" onClick={onBack}>
            Cancel
          </button>

          <button
            type="submit"
            className="cp-save-btn"
            disabled={saving}
          >
            <Save size={18} />
            {saving ? "Saving..." : "Save Program"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateProgram;
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import "./AdminPrograms.css";
import AdminCategories from "./AdminCategories";
import { Tags } from "lucide-react";
import CreateProgram from "./CreateProgram";

const emptyProgram = {
  title: "",
  type: "Workshop",
  category: "",
  date: "",
  duration: "1 day",
  mode: "Online",
  trainer: "",
  price: "",
  image: "",
  isPublished: true,
  sessions: [
    {
      id: "session-1",
      name: "Main Session",
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
    },
  ],
};

function normalizeSessionDate(value) {
  if (!value) return "";

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value).trim().toLowerCase();
  }

  return [
    parsedDate.getFullYear(),
    String(parsedDate.getMonth() + 1).padStart(2, "0"),
    String(parsedDate.getDate()).padStart(2, "0"),
  ].join("-");
}

function bookingMatchesSession(booking, program, session, sessionId) {
  // Prefer the exact Firestore program ID when the booking has it.
  if (booking.programFirestoreId) {
    if (booking.programFirestoreId !== program.firestoreId) return false;
  } else if (Number(booking.programId) !== Number(program.id)) {
    return false;
  }

  // The newest booking format has an exact session ID.
  if (booking.sessionId) {
    return booking.sessionId === sessionId;
  }

  // Older formats identify the session by its name or date.
  const bookingSessionName = String(
    booking.sessionName || booking.session || ""
  ).trim().toLowerCase();

  const sessionName = String(session.name || "").trim().toLowerCase();

  if (bookingSessionName && sessionName &&
      bookingSessionName === sessionName) {
    return true;
  }

  const bookingDate =
    booking.sessionDate ||
    booking.sessionStartDate ||
    booking.date;

  const sessionDate =
    session.startDate ||
    session.date ||
    program.date;

  if (bookingDate && sessionDate) {
    return (
      normalizeSessionDate(bookingDate) ===
      normalizeSessionDate(sessionDate)
    );
  }

  return false;
}
function getSessionCapacity(program) {
  return (program.sessions || []).reduce(
    (total, session) => total + (Number(session.maxSeats) || 0),
    0
  );
}

function getSessionAvailableSeats(program) {
  return (program.sessions || []).reduce((total, session) => {
    const hasStoredSeats =
      session.availableSeats !== undefined &&
      session.availableSeats !== null &&
      session.availableSeats !== "";

    const available = hasStoredSeats
      ? Number(session.availableSeats)
      : Number(session.maxSeats || 0);

    return total + (Number.isFinite(available) ? available : 0);
  }, 0);
}

function AdminPrograms({ onBack }) {
  const [programs, setPrograms] = useState([]);
  const [managedCategories, setManagedCategories] = useState([]);
  const [form, setForm] = useState(emptyProgram);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [modeFilter, setModeFilter] = useState("All");
  const [activeProgramTab, setActiveProgramTab] = useState("published");
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  async function loadPrograms() {
    setLoading(true);
    setError("");

    try {
      const snapshot = await getDocs(collection(db, "programs"));

      const items = snapshot.docs.map((item) => ({
        ...item.data(),
        firestoreId: item.id,
      }));

      items.sort((a, b) => Number(a.id) - Number(b.id));
      setPrograms(items);
    } catch (err) {
      console.error("Error loading programs:", err);
      setError("Unable to load programs. Check your Firestore rules.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const snapshot = await getDocs(collection(db, "categories"));

      const items = snapshot.docs.map((item) => ({
        id: item.id,
        name: item.data().name || "",
      }));

      setManagedCategories(items);
    } catch (err) {
      console.error("Error loading categories:", err);
      setError("Unable to load categories. Check Firestore rules.");
    }
  }

  async function syncSeatInventory() {
    const confirmed = window.confirm(
      "Create missing seat inventory records for all program sessions? Existing inventory records will not be changed."
    );

    if (!confirmed) return;

    setError("");
    setMessage("");
    setSaving(true);

    try {
      const [bookingSnapshot, inventorySnapshot] = await Promise.all([
        getDocs(collection(db, "bookings")),
        getDocs(collection(db, "seatInventory")),
      ]);

      const bookings = bookingSnapshot.docs.map((item) => item.data());

      const existingInventoryIds = new Set(
        inventorySnapshot.docs.map((item) => item.id)
      );

      let createdCount = 0;
      let skippedCount = 0;

      for (const program of programs) {
        const sessions = program.sessions?.length
          ? program.sessions
          : [
              {
                id: "session-1",
                name: "Main Session",
                startDate: program.date || "",
                date: program.date || "",
                maxSeats: 0,
              },
            ];

        for (let index = 0; index < sessions.length; index++) {
          const session = sessions[index];
          const sessionId = session.id || `session-${index + 1}`;
          const inventoryId = `${program.firestoreId}__${sessionId}`;

          // Never overwrite an existing inventory record.
          if (existingInventoryIds.has(inventoryId)) {
            skippedCount++;
            continue;
          }

          const maxSeats = Number(session.maxSeats);

          if (!Number.isInteger(maxSeats) || maxSeats < 1) {
            console.warn(
              "Skipping session with invalid capacity:",
              program.title,
              session.name
            );
            continue;
          }

          const confirmedBookings = bookings.filter((booking) => {
            return (
              String(booking.status || "").toLowerCase() === "confirmed" &&
              bookingMatchesSession(
                booking,
                program,
                session,
                sessionId
              )
            );
          }).length;

          const availableSeats = Math.max(
            0,
            maxSeats - confirmedBookings
          );

          await setDoc(doc(db, "seatInventory", inventoryId), {
            programId: program.firestoreId,
            sessionId,
            maxSeats,
            availableSeats,
            updatedAt: serverTimestamp(),
          });

          existingInventoryIds.add(inventoryId);
          createdCount++;
        }
      }

      setMessage(
        `Seat inventory sync completed. Created: ${createdCount}. Existing records preserved: ${skippedCount}.`
      );
    } catch (err) {
      console.error("Seat inventory sync failed:", err);
      setError(
        "Unable to sync seat inventory. Check your admin permissions and Firestore rules."
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadPrograms();
    loadCategories();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function handleSessionChange(index, field, value) {
    setForm((previous) => ({
      ...previous,
      sessions: previous.sessions.map((session, i) =>
        i === index ? { ...session, [field]: value } : session
      ),
    }));
  }

  function addSession() {
    setForm((previous) => ({
      ...previous,
      sessions: [
        ...previous.sessions,
        {
          id: `session-${Date.now()}`,
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
        },
      ],
    }));
  }

  function removeSession(index) {
    setForm((previous) => ({
      ...previous,
      sessions: previous.sessions.filter((_, i) => i !== index),
    }));
  }

  function startEdit(program) {
    setEditingId(program.firestoreId);

    const oldSessions = program.sessions?.length
      ? program.sessions
      : [
          {
            name: "Main Session",
            date: program.date || "",
            startTime: "",
            endTime: "",
            maxSeats: "",
          },
        ];

    setForm({
      title: program.title || "",
      type: program.type || "Workshop",
      category: program.category || "",
      date: program.date || "",
      duration: program.duration || "1 day",
      mode: program.mode || "Online",
      trainer: program.trainer || "",
      price: String(program.price ?? ""),
      isPublished: program.isPublished !== false,
      image: program.image || "",

      sessions: oldSessions.map((session, index) => {
        const maxSeats = Number(session.maxSeats ?? 0);

        const hasStoredAvailableSeats =
          session.availableSeats !== undefined &&
          session.availableSeats !== null &&
          session.availableSeats !== "";

        return {
          id: session.id || `session-${index + 1}`,
          name: session.name || "",
          startDate: session.startDate || session.date || "",
          endDate:
            session.endDate ||
            session.startDate ||
            session.date ||
            "",
          startTime: session.startTime || "",
          endTime: session.endTime || "",
          maxSeats: String(session.maxSeats ?? ""),
          availableSeats: hasStoredAvailableSeats
            ? Number(session.availableSeats)
            : maxSeats,
          registrationDeadline: session.registrationDeadline || "",
          mode: session.mode || program.mode || "Online",
          venue: session.venue || "",
          meetingInfo: session.meetingInfo || "",
        };
      }),
    });

    setShowProgramForm(true);
    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function resetForm() {
    setForm({
      ...emptyProgram,
      sessions: [{ ...emptyProgram.sessions[0] }],
    });
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (
      !form.title.trim() ||
      !form.category.trim() ||
      !form.date.trim() ||
      !form.trainer.trim() ||
      form.price === ""
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    if (
      !Number.isFinite(Number(form.price)) ||
      Number(form.price) < 0
    ) {
      setError("Enter a valid non-negative program price.");
      return;
    }

    if (!form.sessions.length) {
      setError("Please add at least one program batch.");
      return;
    }

   for (let i = 0; i < form.sessions.length; i++) {
      const batch = form.sessions[i];

      if (
        !batch.name.trim() ||
        !batch.startDate ||
        !batch.endDate ||
        !batch.startTime ||
        !batch.endTime ||
        batch.maxSeats === "" ||
        !batch.registrationDeadline
      ) {
        setError(`Please complete all required fields in Batch ${i + 1}.`);
        return;
      }

      if (
        batch.endDate < batch.startDate ||
        (batch.startDate === batch.endDate &&
          batch.endTime <= batch.startTime)
      ) {
        setError(`Please check the dates and times in Batch ${i + 1}.`);
        return;
      }

      const maxSeats = Number(batch.maxSeats);
      const availableSeats = Number(batch.availableSeats);

      if (
        batch.registrationDeadline > batch.startDate ||
        !Number.isInteger(maxSeats) ||
        maxSeats < 1
      ) {
        setError(
          `Please check the deadline and seat capacity in Batch ${i + 1}.`
        );
        return;
      }

      if (
        batch.availableSeats === "" ||
        !Number.isInteger(availableSeats) ||
        availableSeats < 0 ||
        availableSeats > maxSeats
      ) {
        setError(
          `Batch ${i + 1}: Available seats must be between 0 and maximum seats.`
        );
        return;
      }

      if (batch.mode === "Offline" && !batch.venue.trim()) {
        setError(`Please enter the venue for Batch ${i + 1}.`);
        return;
      }

      if (batch.mode === "Online" && !batch.meetingInfo.trim()) {
        setError(`Please enter the meeting link for Batch ${i + 1}.`);
        return;
      }
   }

    const savedSessions = form.sessions.map((session, index) => {
      const maxSeats = Number(session.maxSeats);

      const hasStoredAvailableSeats =
        session.availableSeats !== undefined &&
        session.availableSeats !== null &&
        session.availableSeats !== "";

      const availableSeats = hasStoredAvailableSeats
        ? Number(session.availableSeats)
        : maxSeats;

      return {
        id: session.id || `session-${index + 1}`,
        name: session.name.trim(),
        startDate: session.startDate,
        endDate: session.endDate,
        date: session.startDate,
        startTime: session.startTime,
        endTime: session.endTime,
        maxSeats,
        availableSeats,
        registrationDeadline: session.registrationDeadline,
        mode: session.mode,
        venue: (session.venue || "").trim(),
        meetingInfo: (session.meetingInfo || "").trim(),
      };
    });

    const programData = {
      title: form.title.trim(),
      type: form.type,
      category: form.category.trim(),
      date: form.date.trim(),
      duration: form.duration.trim(),
      mode: form.mode,
      trainer: form.trainer.trim(),
      price: Number(form.price),
      image: form.image.trim(),
      isPublished: form.isPublished,
      sessions: savedSessions,
    };

    setSaving(true);

    try {
      if (editingId) {
        await updateDoc(doc(db, "programs", editingId), programData);
        setMessage("Program updated successfully.");
      } else {
        const nextId =
          programs.reduce(
            (highest, program) =>
              Math.max(highest, Number(program.id) || 0),
            0
          ) + 1;

        await addDoc(collection(db, "programs"), {
          ...programData,
          id: nextId,
        });

        setMessage("Program added successfully.");
      }

      resetForm();
      setShowProgramForm(false);
      await loadPrograms();
    } catch (err) {
      console.error("Error saving program:", err);
      setError("Unable to save the program. Check your Firestore rules.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(program) {
    const nextStatus = program.isPublished === false;

    setError("");
    setMessage("");

    try {
      await updateDoc(doc(db, "programs", program.firestoreId), {
        isPublished: nextStatus,
      });

      setMessage(
        nextStatus
          ? "Program published successfully."
          : "Program unpublished successfully."
      );

      await loadPrograms();
    } catch (err) {
      console.error("Error changing publication status:", err);
      setError("Unable to change publication status. Please try again.");
    }
  }

  async function handleDelete(program) {
    const confirmed = window.confirm(
      `Delete "${program.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await deleteDoc(doc(db, "programs", program.firestoreId));
      setMessage("Program deleted successfully.");

      if (editingId === program.firestoreId) resetForm();

      await loadPrograms();
    } catch (err) {
      console.error("Error deleting program:", err);
      setError("Unable to delete the program. Check your Firestore rules.");
    }
  }

  const categories = [
    ...new Set([
      ...managedCategories.map((category) => category.name),
      ...programs.map((program) => program.category).filter(Boolean),
    ]),
  ].sort();

  const visiblePrograms = programs.filter((program) => {
    const matchesSearch = [
      program.title || "",
      program.category || "",
      program.trainer || "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesType =
      typeFilter === "All" || program.type === typeFilter;

    const matchesCategory =
      categoryFilter === "All" || program.category === categoryFilter;

    const matchesMode =
      modeFilter === "All" || program.mode === modeFilter;

    return matchesSearch && matchesType && matchesCategory && matchesMode;
  });

  const publishedPrograms = visiblePrograms.filter(
    (program) => program.isPublished !== false
  );

  const unpublishedPrograms = visiblePrograms.filter(
    (program) => program.isPublished === false
  );

  const totalSeats = programs.reduce(
    (total, program) => total + getSessionAvailableSeats(program),
    0
  );

  if (showCreatePage) {
    return (
      <CreateProgram
        onBack={() => setShowCreatePage(false)}
        onSaved={loadPrograms}
      />
    );
  }

  if (showCategoryForm) {
    return (
      <AdminCategories
        onBack={async () => {
          setShowCategoryForm(false);
          await loadCategories();
        }}
      />
    );
  }

  return (
    <main className="admin-programs-page">
      <header className="ap-page-header">
        <div>
          <p className="ap-eyebrow">EVENTORA / ADMINISTRATION</p>
          <h1>Program Management</h1>
          <p className="ap-subtitle">
            Create, organize, and manage your events, workshops and training.
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="ap-button ap-button-light"
        >
          ← Dashboard
        </button>
      </header>

      <section className="ap-stats-grid">
        <article className="ap-stat-card">
          <span className="ap-stat-icon ap-icon-purple">▦</span>
          <p>Total programs</p>
          <strong>{programs.length}</strong>
        </article>

        <article className="ap-stat-card">
          <span className="ap-stat-icon ap-icon-blue">♧</span>
          <p>Remaining batch seats</p>
          <strong>{totalSeats.toLocaleString("en-IN")}</strong>
        </article>

        <article className="ap-stat-card">
          <span className="ap-stat-icon ap-icon-pink">✦</span>
          <p>Program types</p>
          <strong>
            {new Set(programs.map((p) => p.type).filter(Boolean)).size}
          </strong>
        </article>
      </section>

      {showProgramForm && (
        <section className="ap-panel ap-category-panel">
          <div className="ap-panel-heading">
            <div>
              <h2>
                {editingId ? "Edit Program Details" : "Create a New Program"}
              </h2>
              <p>
                Enter the program information below. Fields marked * are
                required.
              </p>
            </div>

            {editingId && (
              <span className="ap-editing-pill">Editing program</span>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="ap-form-grid">
              <label className="ap-field">
                <span>Program Name *</span>
                <input
                  name="title"
                  type="text"
                  placeholder="Enter program name"
                  value={form.title}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="ap-field">
                <span>Category *</span>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="ap-field">
                <span>Program Date *</span>
                <input
                  name="date"
                  type="text"
                  placeholder="e.g. Oct 24, 2026"
                  value={form.date}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="ap-field">
                <span>Duration</span>
                <input
                  name="duration"
                  type="text"
                  placeholder="e.g. 1 day or 3 weeks"
                  value={form.duration}
                  onChange={handleChange}
                />
              </label>

              <label className="ap-field">
                <span>Trainer / Speaker *</span>
                <input
                  name="trainer"
                  type="text"
                  placeholder="Enter trainer name"
                  value={form.trainer}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="ap-field">
                <span>Price in ₹ *</span>
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Enter price"
                  value={form.price}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="ap-field">
                <span>Program Type *</span>
                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                >
                  <option>Workshop</option>
                  <option>Training</option>
                  <option>Event</option>
                </select>
              </label>

              <label className="ap-field">
                <span>Delivery Mode *</span>
                <select
                  name="mode"
                  value={form.mode}
                  onChange={handleChange}
                >
                  <option>Online</option>
                  <option>Offline</option>
                </select>
              </label>

              <label className="ap-field">
                <span>Publication Status *</span>
                <select
                  name="isPublished"
                  value={form.isPublished ? "true" : "false"}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      isPublished: event.target.value === "true",
                    }))
                  }
                >
                  <option value="true">Published</option>
                  <option value="false">Unpublished</option>
                </select>
              </label>

              <label className="ap-field">
                <span>Image URL</span>
                <input
                  name="image"
                  type="url"
                  placeholder="Paste image URL (optional)"
                  value={form.image}
                  onChange={handleChange}
                />
              </label>
            </div>

            <div className="ap-sessions-section">
              <h3>Program Batches</h3>
              <p>
                Edit existing batches or add new batches for participants.
                Capacity is managed separately for each batch.
              </p>

              {form.sessions.map((session, index) => (
                <div className="ap-session-card" key={session.id || index}>
                  <h4>Batch {index + 1}</h4>

                  <label className="ap-field">
                    <span>Batch Name *</span>
                    <input
                      value={session.name}
                      onChange={(e) =>
                        handleSessionChange(index, "name", e.target.value)
                      }
                      placeholder="Example: Morning Batch"
                      required
                    />
                  </label>

                  <label className="ap-field">
                    <span>Batch Mode *</span>
                    <select
                      value={session.mode}
                      onChange={(e) =>
                        handleSessionChange(index, "mode", e.target.value)
                      }
                    >
                      <option>Online</option>
                      <option>Offline</option>
                    </select>
                  </label>

                  <label className="ap-field">
                    <span>Start Date *</span>
                    <input
                      type="date"
                      value={session.startDate}
                      onChange={(e) =>
                        handleSessionChange(index, "startDate", e.target.value)
                      }
                      required
                    />
                  </label>

                  <label className="ap-field">
                    <span>End Date *</span>
                    <input
                      type="date"
                      min={session.startDate || undefined}
                      value={session.endDate}
                      onChange={(e) =>
                        handleSessionChange(index, "endDate", e.target.value)
                      }
                      required
                    />
                  </label>

                  <label className="ap-field">
                    <span>Start Time *</span>
                    <input
                      type="time"
                      value={session.startTime}
                      onChange={(e) =>
                        handleSessionChange(index, "startTime", e.target.value)
                      }
                      required
                    />
                  </label>

                  <label className="ap-field">
                    <span>End Time *</span>
                    <input
                      type="time"
                      value={session.endTime}
                      onChange={(e) =>
                        handleSessionChange(index, "endTime", e.target.value)
                      }
                      required
                    />
                  </label>

                  <label className="ap-field">
                    <span>Maximum Seats *</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={session.maxSeats}
                      onChange={(e) =>
                        handleSessionChange(index, "maxSeats", e.target.value)
                      }
                      required
                    />
                  </label>

                 <label className="ap-field">
  <span>Available Seats *</span>
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
  <small>
    Enter the number of seats currently available for booking.
  </small>
</label>

                  <label className="ap-field">
                    <span>Registration Deadline *</span>
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
                  </label>

                  {session.mode === "Offline" ? (
                    <label className="ap-field">
                      <span>Venue / Location *</span>
                      <input
                        value={session.venue}
                        onChange={(e) =>
                          handleSessionChange(index, "venue", e.target.value)
                        }
                        placeholder="Enter venue address"
                        required
                      />
                    </label>
                  ) : (
                    <label className="ap-field">
                      <span>Online Meeting Link *</span>
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
                    </label>
                  )}

                  {form.sessions.length > 1 && (
                    <button
                      type="button"
                      className="ap-button-small ap-delete-button"
                      onClick={() => removeSession(index)}
                    >
                      Remove Batch
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="ap-button ap-button-light"
                onClick={addSession}
              >
                + Add Another Batch
              </button>
            </div>

            <div className="ap-form-actions">
              <button
                type="submit"
                disabled={saving}
                className="ap-button ap-button-primary"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Program"
                    : "Create Program"}
              </button>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowProgramForm(false);
                  setError("");
                  setMessage("");
                }}
                disabled={saving}
                className="ap-button ap-button-light"
              >
                Cancel
              </button>
            </div>
          </form>

          {error && (
            <p className="ap-alert ap-alert-error" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="ap-alert ap-alert-success" role="status">
              ✓ {message}
            </p>
          )}
        </section>
      )}

      <section className="ap-panel">
        <div className="ap-list-heading">
          <div>
            <h2>Program Management</h2>
            <p>{programs.length} programs in your Eventora catalog</p>
          </div>

          <div className="ap-heading-actions">
            <button
              type="button"
              className="ap-create-program-btn"
              onClick={() => {
                setShowCreatePage(true);
                setMessage("");
                setError("");
              }}
            >
              + Create New Program
            </button>

            <button
              type="button"
              className="ap-add-category-btn"
              onClick={() => setShowCategoryForm(true)}
            >
              <Tags size={18} />
              <span>Add Category</span>
            </button>
          <button
  type="button"
  className="ap-sync-inventory-btn"
  onClick={syncSeatInventory}
  disabled={saving || loading || programs.length === 0}
>
  <span className="ap-sync-icon">⟳</span>
  <span>
    {saving ? "Syncing Inventory..." : "Sync Seat Inventory"}
  </span>
</button>
           
          </div>
        </div>

        <div className="ap-status-tabs">
          <button
            type="button"
            className={`ap-status-tab ${
              activeProgramTab === "published" ? "active" : ""
            }`}
            onClick={() => setActiveProgramTab("published")}
          >
            Published ({publishedPrograms.length})
          </button>

          <button
            type="button"
            className={`ap-status-tab ${
              activeProgramTab === "unpublished" ? "active" : ""
            }`}
            onClick={() => setActiveProgramTab("unpublished")}
          >
            Unpublished ({unpublishedPrograms.length})
          </button>
        </div>

        <div className="ap-program-controls">
          <input
            className="ap-search"
            type="search"
            placeholder="Search title, category, trainer..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search programs"
          />

          <select
            className="ap-filter"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            aria-label="Filter by program type"
          >
            <option value="All">All types</option>
            <option value="Event">Event</option>
            <option value="Workshop">Workshop</option>
            <option value="Training">Training</option>
          </select>

          <select
            className="ap-filter"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="Filter by category"
          >
            <option value="All">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            className="ap-filter"
            value={modeFilter}
            onChange={(event) => setModeFilter(event.target.value)}
            aria-label="Filter by delivery mode"
          >
            <option value="All">All modes</option>
            <option value="Online">Online</option>
            <option value="Offline">Offline</option>
          </select>

          <button
            type="button"
            className="ap-button ap-button-light"
            onClick={() => {
              setSearch("");
              setTypeFilter("All");
              setCategoryFilter("All");
              setModeFilter("All");
            }}
          >
            Reset filters
          </button>
        </div>

        {loading ? (
          <div className="ap-empty-state">Loading programs...</div>
        ) : (
          <>
            {activeProgramTab === "published" && (
              <div className="ap-status-section">
                <div className="ap-status-heading">
                  <div>
                    <h2>Published Programs</h2>
                    <p>Programs currently available to participants.</p>
                  </div>

                  <span className="ap-status-count ap-published-count">
                    {publishedPrograms.length}
                  </span>
                </div>

                {publishedPrograms.length === 0 ? (
                  <div className="ap-empty-state">
                    No published programs match your filters.
                  </div>
                ) : (
                  <div className="ap-table-wrap">
                    <table className="ap-table">
                      <thead>
                        <tr>
                          <th>Program</th>
                          <th>Type / Mode</th>
                          <th>Date</th>
                          <th>Price</th>
                          <th>Seats (Available / Total)</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {publishedPrograms.map((program) => (
                          <tr key={program.firestoreId}>
                            <td>
                              <div className="ap-program-title">
                                {program.title}
                              </div>
                              <div className="ap-secondary-text">
                                {program.category || "Uncategorized"} ·{" "}
                                {program.trainer || "No trainer"}
                              </div>
                            </td>

                            <td>
                              <span className="ap-type-badge">
                                {program.type || "Program"}
                              </span>
                              <div className="ap-mode-text">
                                {program.mode || "Not specified"}
                              </div>
                            </td>

                            <td>{program.date || "—"}</td>

                            <td className="ap-price-cell">
                              ₹
                              {Number(program.price || 0).toLocaleString(
                                "en-IN"
                              )}
                            </td>

                            <td>
                              {getSessionAvailableSeats(program)} /{" "}
                              {getSessionCapacity(program)}
                            </td>

                            <td>
                              <span className="ap-published-label">
                                Published
                              </span>
                            </td>

                            <td>
                              <div className="ap-row-actions">
                                <button
                                  type="button"
                                  onClick={() => togglePublish(program)}
                                  className="ap-button-small ap-unpublish-button"
                                >
                                  Unpublish
                                </button>

                                <button
                                  type="button"
                                  onClick={() => startEdit(program)}
                                  className="ap-button-small ap-edit-button"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDelete(program)}
                                  className="ap-button-small ap-delete-button"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeProgramTab === "unpublished" && (
              <div className="ap-status-section">
                <div className="ap-status-heading">
                  <div>
                    <h2>Unpublished Programs</h2>
                    <p>Programs hidden from participants until published.</p>
                  </div>

                  <span className="ap-status-count ap-unpublished-count">
                    {unpublishedPrograms.length}
                  </span>
                </div>

                {unpublishedPrograms.length === 0 ? (
                  <div className="ap-empty-state">
                    No unpublished programs match your filters.
                  </div>
                ) : (
                  <div className="ap-table-wrap">
                    <table className="ap-table">
                      <thead>
                        <tr>
                          <th>Program</th>
                          <th>Type / Mode</th>
                          <th>Date</th>
                          <th>Price</th>
                          <th>Seats (Available / Total)</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {unpublishedPrograms.map((program) => (
                          <tr key={program.firestoreId}>
                            <td>
                              <div className="ap-program-title">
                                {program.title}
                              </div>
                              <div className="ap-secondary-text">
                                {program.category || "Uncategorized"} ·{" "}
                                {program.trainer || "No trainer"}
                              </div>
                            </td>

                            <td>
                              <span className="ap-type-badge">
                                {program.type || "Program"}
                              </span>
                              <div className="ap-mode-text">
                                {program.mode || "Not specified"}
                              </div>
                            </td>

                            <td>{program.date || "—"}</td>

                            <td className="ap-price-cell">
                              ₹
                              {Number(program.price || 0).toLocaleString(
                                "en-IN"
                              )}
                            </td>

                            <td>
                              {getSessionAvailableSeats(program)} /{" "}
                              {getSessionCapacity(program)}
                            </td>

                            <td>
                              <span className="ap-unpublished-label">
                                Unpublished
                              </span>
                            </td>

                            <td>
                              <div className="ap-row-actions">
                                <button
                                  type="button"
                                  onClick={() => togglePublish(program)}
                                  className="ap-button-small ap-publish-button"
                                >
                                  Publish
                                </button>

                                <button
                                  type="button"
                                  onClick={() => startEdit(program)}
                                  className="ap-button-small ap-edit-button"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDelete(program)}
                                  className="ap-button-small ap-delete-button"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {error && !showProgramForm && (
        <p className="ap-alert ap-alert-error" role="alert">
          {error}
        </p>
      )}

      {message && !showProgramForm && (
        <p className="ap-alert ap-alert-success" role="status">
          ✓ {message}
        </p>
      )}
    </main>
  );
}


export default AdminPrograms;
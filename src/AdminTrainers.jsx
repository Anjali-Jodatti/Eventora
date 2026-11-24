import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Users,
  Search,
  UserRound,
} from "lucide-react";

import { db } from "./firebase";
import "./AdminTrainers.css";

const emptyTrainer = {
  name: "",
  photo: "",
  designation: "",
  organization: "",
  bio: "",
  expertise: "",
  programIds: [],
};

function AdminTrainers({ onBack }) {
  const [trainers, setTrainers] = useState([]);
  const [programs, setPrograms] = useState([]);

  const [form, setForm] = useState(emptyTrainer);

  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [trainerSnapshot, programSnapshot] = await Promise.all([
        getDocs(collection(db, "trainers")),
        getDocs(collection(db, "programs")),
      ]);

      setTrainers(
        trainerSnapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
          programIds: item.data().programIds || [],
        }))
      );

      setPrograms(
        programSnapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))
      );
    } catch (err) {
      console.error("Error loading trainer data:", err);
      setError(`Unable to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleProgramSelection(programId) {
    setForm((previous) => {
      const alreadySelected = previous.programIds.includes(programId);

      return {
        ...previous,
        programIds: alreadySelected
          ? previous.programIds.filter((id) => id !== programId)
          : [...previous.programIds, programId],
      };
    });
  }

  function openCreateForm() {
    setForm(emptyTrainer);
    setEditingId(null);
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function startEditing(trainer) {
    setForm({
      name: trainer.name || "",
      photo: trainer.photo || "",
      designation: trainer.designation || "",
      organization: trainer.organization || "",
      bio: trainer.bio || "",
      expertise: trainer.expertise || "",
      programIds: trainer.programIds || [],
    });

    setEditingId(trainer.id);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function cancelForm() {
    setForm(emptyTrainer);
    setEditingId(null);
    setShowForm(false);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!form.name.trim()) {
      setError("Please enter the trainer's name.");
      return;
    }

    if (!form.designation.trim()) {
      setError("Please enter the trainer's designation.");
      return;
    }

    if (!form.bio.trim()) {
      setError("Please enter a trainer biography.");
      return;
    }

    if (!form.expertise.trim()) {
      setError("Please enter areas of expertise.");
      return;
    }

    const trainerData = {
      name: form.name.trim(),
      photo: form.photo.trim(),
      designation: form.designation.trim(),
      organization: form.organization.trim(),
      bio: form.bio.trim(),
      expertise: form.expertise.trim(),
      programIds: form.programIds,
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);

    try {
      if (editingId) {
        await updateDoc(
          doc(db, "trainers", editingId),
          trainerData
        );

        setTrainers((previous) =>
          previous.map((trainer) =>
            trainer.id === editingId
              ? { ...trainer, ...trainerData }
              : trainer
          )
        );

        setMessage("Trainer details updated successfully.");
      } else {
        const trainerRef = await addDoc(
          collection(db, "trainers"),
          {
            ...trainerData,
            createdAt: new Date().toISOString(),
          }
        );

        setTrainers((previous) => [
          ...previous,
          {
            id: trainerRef.id,
            ...trainerData,
          },
        ]);

        setMessage("Trainer added successfully.");
      }

      setForm(emptyTrainer);
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      console.error("Trainer save error:", err);
      setError(`Unable to save trainer: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(trainer) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${trainer.name}?`
    );

    if (!confirmed) return;

    setDeletingId(trainer.id);
    setError("");
    setMessage("");

    try {
      await deleteDoc(doc(db, "trainers", trainer.id));

      setTrainers((previous) =>
        previous.filter((item) => item.id !== trainer.id)
      );

      setMessage(`${trainer.name} deleted successfully.`);
    } catch (err) {
      console.error("Trainer delete error:", err);
      setError(`Unable to delete trainer: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  function getAssignedPrograms(programIds = []) {
    return programs.filter((program) =>
      programIds.includes(program.id)
    );
  }

  const filteredTrainers = trainers.filter((trainer) => {
    const searchText = search.toLowerCase();

    return (
      (trainer.name || "").toLowerCase().includes(searchText) ||
      (trainer.designation || "").toLowerCase().includes(searchText) ||
      (trainer.organization || "").toLowerCase().includes(searchText) ||
      (trainer.expertise || "").toLowerCase().includes(searchText)
    );
  });

  return (
<main className={`at-page ${showForm ? "at-form-page" : ""}`}>
      {/* Header */}
      <header className="at-header">
  <div>
    <p className="at-eyebrow">EVENTORA / ADMINISTRATION</p>
    <h1>{showForm
      ? editingId ? "Edit Trainer" : "Add New Trainer"
      : "Trainer & Speaker Management"}
    </h1>
    <p>
      {showForm
        ? "Enter the trainer's professional information."
        : "Manage trainer profiles, expertise and program assignments."}
    </p>
  </div>

  <button
    type="button"
    className="at-button at-back"
    onClick={showForm ? cancelForm : onBack}
  >
    <ArrowLeft size={17} />
    {showForm ? " Trainers" : " Dashboard"}
  </button>
</header>

      {/* Statistics */}
        {!showForm && (
  <section className="at-stats">
        <div className="at-stat-card">
          <div className="at-stat-icon">
            <Users size={23} />
          </div>
          <div>
            <span>Total Trainers</span>
            <h2>{trainers.length}</h2>
          </div>
        </div>

        <div className="at-stat-card">
          <div className="at-stat-icon">
            <UserRound size={23} />
          </div>
          <div>
            <span>Available Programs</span>
            <h2>{programs.length}</h2>
          </div>
        </div>
      </section>
      )}

      {/* Messages */}
      {error && (
        <p className="at-alert at-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="at-alert at-success" role="status">
          {message}
        </p>
      )}

      {/* Form */}
      {showForm && (
        <section className="at-panel at-form-panel">
          <div className="at-panel-heading">
            <div>
              <h2>
                {editingId ? "Edit Trainer" : "Add New Trainer"}
              </h2>
              <p>Enter the trainer's professional information.</p>
            </div>

            <button
              type="button"
              className="at-icon-button"
              onClick={cancelForm}
              disabled={saving}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="at-form-grid">

              <div className="at-field">
                <label>Trainer Name *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div className="at-field">
                <label>Designation *</label>
                <input
                  name="designation"
                  value={form.designation}
                  onChange={handleChange}
                  placeholder="Example: Senior Developer"
                  required
                />
              </div>

              <div className="at-field">
                <label>Organization</label>
                <input
                  name="organization"
                  value={form.organization}
                  onChange={handleChange}
                  placeholder="Company or organization"
                />
              </div>

              <div className="at-field">
                <label>Photo URL</label>
                <input
                  name="photo"
                  type="url"
                  value={form.photo}
                  onChange={handleChange}
                  placeholder="https://example.com/photo.jpg"
                />
              </div>

              <div className="at-field at-full-width">
                <label>Biography *</label>
                <textarea
                  name="bio"
                  value={form.bio}
                  onChange={handleChange}
                  placeholder="Write a short professional biography..."
                  rows={4}
                  required
                />
              </div>

              <div className="at-field at-full-width">
                <label>Areas of Expertise *</label>
                <input
                  name="expertise"
                  value={form.expertise}
                  onChange={handleChange}
                  placeholder="Example: React, JavaScript, Firebase"
                  required
                />
                <small>Separate multiple expertise areas with commas.</small>
              </div>

            </div>

            {/* Program Assignment */}
            <div className="at-assignment">
              <h3>Assign Programs</h3>
              <p>Select one or more programs for this trainer.</p>

              {programs.length === 0 ? (
                <p className="at-no-programs">
                  No programs available.
                </p>
              ) : (
                <div className="at-program-options">
                  {programs.map((program) => (
                    <label
                      className="at-program-option"
                      key={program.id}
                    >
                      <input
                        type="checkbox"
                        checked={form.programIds.includes(program.id)}
                        onChange={() =>
                          handleProgramSelection(program.id)
                        }
                      />

                      <span>{program.title || "Untitled Program"}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="at-form-actions">
              <button
                type="button"
                className="at-button at-cancel"
                onClick={cancelForm}
                disabled={saving}
              >
                <X size={17} />
                Cancel
              </button>

              <button
                type="submit"
                className="at-button at-primary"
                disabled={saving}
              >
                <Save size={17} />
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Trainer"
                    : "Save Trainer"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Trainer List */}
       {!showForm && (
  <section className="at-panel">
        <div className="at-list-heading">
          <div>
            <h2>All Trainers</h2>
            <p>{trainers.length} trainers in your directory</p>
          </div>

          <button
            type="button"
            className="at-button at-primary"
            onClick={openCreateForm}
            disabled={showForm}
          >
            <Plus size={18} />
            Add Trainer
          </button>
        </div>

        <div className="at-search">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search trainers, designation or expertise..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loading ? (
          <p className="at-empty">Loading trainers...</p>
        ) : filteredTrainers.length === 0 ? (
          <div className="at-empty">
            <Users size={38} />
            <h3>No trainers found</h3>
            <p>Add a trainer or change your search.</p>
          </div>
        ) : (
          <div className="at-trainer-grid">
            {filteredTrainers.map((trainer) => {
              const assignedPrograms = getAssignedPrograms(
                trainer.programIds
              );

              return (
                <article className="at-trainer-card" key={trainer.id}>

                  <div className="at-trainer-top">
                    <div className="at-avatar">
                      {trainer.photo ? (
                        <img
                          src={trainer.photo}
                          alt={trainer.name}
                        />
                      ) : (
                        <UserRound size={34} />
                      )}
                    </div>

                    <div className="at-trainer-heading">
                      <h3>{trainer.name}</h3>
                      <p>{trainer.designation}</p>
                      <span>
                        {trainer.organization || "Independent"}
                      </span>
                    </div>
                  </div>

                  <div className="at-trainer-bio">
                    {trainer.bio}
                  </div>

                  <div className="at-expertise">
                    <strong>Expertise</strong>
                    <p>{trainer.expertise}</p>
                  </div>

                  <div className="at-assigned-programs">
                    <strong>
                      Assigned Programs ({assignedPrograms.length})
                    </strong>

                    {assignedPrograms.length > 0 ? (
                      <ul>
                        {assignedPrograms.map((program) => (
                          <li key={program.id}>
                            {program.title || "Untitled Program"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No programs assigned.</p>
                    )}
                  </div>

                  <div className="at-card-actions">
                    <button
                      type="button"
                      className="at-edit"
                      onClick={() => startEditing(trainer)}
                      disabled={saving || deletingId !== null}
                    >
                      <Pencil size={16} />
                      Edit
                    </button>

                    <button
                      type="button"
                      className="at-delete"
                      onClick={() => handleDelete(trainer)}
                      disabled={deletingId !== null || saving}
                    >
                      <Trash2 size={16} />
                      {deletingId === trainer.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>

                </article>
              );
            })}
          </div>
        )}
      </section>
      )}
    </main>
  );
}

export default AdminTrainers;
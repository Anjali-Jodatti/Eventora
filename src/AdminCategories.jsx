import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import {
  Tags,
  ArrowLeft,
  Save,
  X,
  Trash2,
  Folder,
  Pencil,
} from "lucide-react";
import { db } from "./firebase";
import "./AdminCategories.css";

function AdminCategories({ onBack }) {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadCategories() {
    try {
      const snapshot = await getDocs(collection(db, "categories"));

      setCategories(
  snapshot.docs.map((item) => ({
    id: item.id,
    name: item.data().name || "",
    description: item.data().description || "",
    isActive: item.data().isActive !== false,
  }))
);
        
    } catch (err) {
      console.error("Error loading categories:", err);
      setError(`Unable to load categories: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function handleSave(event) {
    event.preventDefault();

    const name = newCategory.trim();
    const categoryDescription = description.trim();

    setError("");
    setMessage("");

    if (!name) {
      setError("Please enter a category name.");
      return;
    }

    if (
      categories.some(
        (category) =>
          category.name.trim().toLowerCase() === name.toLowerCase()
      )
    ) {
      setError("This category already exists.");
      return;
    }

    setSaving(true);

    try {
      const categoryRef = await addDoc(collection(db, "categories"), {
  name,
  description: categoryDescription,
  isActive: true,
  createdAt: new Date().toISOString(),
});

      setCategories((previous) => [
        ...previous,
        {
          id: categoryRef.id,
          name,
          description: categoryDescription,
           isActive: true,
        },
      ]);

      setNewCategory("");
      setDescription("");
      setMessage(`Category "${name}" saved successfully.`);
    } catch (err) {
      console.error("Error saving category:", err);
      setError(`Unable to save category: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  function startEditing(category) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditDescription(category.description);
    setError("");
    setMessage("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
    setError("");
  }

  async function handleUpdate(event, category) {
    event.preventDefault();

    const name = editName.trim();
    const categoryDescription = editDescription.trim();

    setError("");
    setMessage("");

    if (!name) {
      setError("Please enter a category name.");
      return;
    }

    const duplicate = categories.some(
      (item) =>
        item.id !== category.id &&
        item.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      setError("Another category already has this name.");
      return;
    }

    setSaving(true);

    try {
      await updateDoc(doc(db, "categories", category.id), {
        name,
        description: categoryDescription,
        updatedAt: new Date().toISOString(),
      });

      setCategories((previous) =>
        previous.map((item) =>
          item.id === category.id
            ? {
                ...item,
                name,
                description: categoryDescription,
              }
            : item
        )
      );

      setEditingId(null);
      setEditName("");
      setEditDescription("");

      setMessage(`Category "${name}" updated successfully.`);
    } catch (err) {
      console.error("Error updating category:", err);
      setError(`Unable to update category: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleCategory(category) {
  const newStatus = !category.isActive;

  setError("");
  setMessage("");
  setSaving(true);

  try {
    await updateDoc(doc(db, "categories", category.id), {
      isActive: newStatus,
      updatedAt: new Date().toISOString(),
    });

    setCategories((previous) =>
      previous.map((item) =>
        item.id === category.id
          ? { ...item, isActive: newStatus }
          : item
      )
    );

    setMessage(
      `"${category.name}" is now ${
        newStatus ? "Active" : "Inactive"
      }.`
    );
  } catch (err) {
    console.error("Error changing category status:", err);
    setError(`Unable to update category status: ${err.message}`);
  } finally {
    setSaving(false);
  }
}

  async function handleDelete(category) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${category.name}"?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");
    setDeletingId(category.id);

    try {
      const programSnapshot = await getDocs(
        collection(db, "programs")
      );

      const linkedPrograms = programSnapshot.docs.filter(
        (item) =>
          (item.data().category || "").trim().toLowerCase() ===
          category.name.trim().toLowerCase()
      );

      if (linkedPrograms.length > 0) {
        setError(
          `"${category.name}" is used by ${linkedPrograms.length} program(s). Change those programs to another category before deleting it.`
        );
        return;
      }

      await deleteDoc(doc(db, "categories", category.id));

      setCategories((previous) =>
        previous.filter((item) => item.id !== category.id)
      );

      setMessage(`Category "${category.name}" deleted successfully.`);
    } catch (err) {
      console.error("Error deleting category:", err);
      setError(`Unable to delete category: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  function handleCancel() {
    setNewCategory("");
    setDescription("");
    cancelEditing();
    setError("");
    setMessage("");

    if (onBack) {
      onBack();
    }
  }

  return (
    <main className="ac-page">
      <header className="ac-header">
        <div>
          <p className="ac-eyebrow">EVENTORA / ADMINISTRATION</p>
          <h1>Add New Category</h1>
          <p>Create and manage categories for your programs.</p>
        </div>

        <button
          type="button"
          className="ac-button ac-back"
          onClick={handleCancel}
        >
          <ArrowLeft size={17} />
          Back to Programs
        </button>
      </header>

      <section className="ac-panel">
        <h2>
          <Tags size={21} />
          Category Details
        </h2>

        <form className="ac-add-form" onSubmit={handleSave}>
          <label htmlFor="categoryName">Category Name *</label>

          <input
            id="categoryName"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            placeholder="e.g. Technology"
            maxLength={60}
            required
          />

          <label htmlFor="categoryDescription">
            Description (optional)
          </label>

          <textarea
            id="categoryDescription"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Enter a short category description"
            rows={3}
          />

          <div className="ac-form-actions">
            <button
              type="submit"
              className="ac-button ac-primary"
              disabled={saving || loading}
            >
              <Save size={17} />
              {saving ? "Saving..." : "Save Category"}
            </button>

            <button
              type="button"
              className="ac-button ac-cancel"
              onClick={handleCancel}
              disabled={saving}
            >
              <X size={17} />
              Cancel
            </button>
          </div>
        </form>
      </section>

      <section className="ac-panel ac-category-list-panel">
        <div className="ac-category-list-heading">
          <div>
            <h2>
              <Tags size={21} />
              Existing Categories
            </h2>
            <p>View and manage your program categories.</p>
          </div>

          <span className="ac-category-count">
            {categories.length}{" "}
            {categories.length === 1 ? "Category" : "Categories"}
          </span>
        </div>

        {error && (
          <p className="ac-alert ac-error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="ac-alert ac-success" role="status">
            {message}
          </p>
        )}

        {loading ? (
          <p className="ac-empty">Loading categories...</p>
        ) : categories.length === 0 ? (
          <div className="ac-empty">
            <Folder size={32} />
            <p>No categories yet. Add your first category above.</p>
          </div>
        ) : (
          <div className="ac-category-list">
            {categories.map((category) => (
              <article
                className="ac-category-item"
                key={category.id}
              >
                <div className="ac-category-icon">
                  <Folder size={21} />
                </div>

                {editingId === category.id ? (
                  <form
                    className="ac-category-info"
                    onSubmit={(event) =>
                      handleUpdate(event, category)
                    }
                  >
                    <input
                      value={editName}
                      onChange={(event) =>
                        setEditName(event.target.value)
                      }
                      placeholder="Category name"
                      maxLength={60}
                      required
                    />

                    <textarea
                      value={editDescription}
                      onChange={(event) =>
                        setEditDescription(event.target.value)
                      }
                      placeholder="Category description"
                      rows={2}
                    />

                    <div className="ac-form-actions">
                      <button
                        type="submit"
                        className="ac-button ac-primary"
                        disabled={saving}
                      >
                        <Save size={16} />
                        {saving ? "Saving..." : "Save Changes"}
                      </button>

                      <button
                        type="button"
                        className="ac-button ac-cancel"
                        onClick={cancelEditing}
                        disabled={saving}
                      >
                        <X size={16} />
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="ac-category-info">
  <h3>{category.name}</h3>
  <p>
    {category.description || "No description provided"}
  </p>

  <span
    className={`ac-category-status ${
      category.isActive ? "active" : "inactive"
    }`}
  >
    {category.isActive ? "Active" : "Inactive"}
  </span>
</div>
                  
                )}

                {editingId !== category.id && (
                  <div className="ac-category-actions">
                    <button
  type="button"
  className="ac-toggle-category"
  onClick={() => handleToggleCategory(category)}
  disabled={saving || deletingId !== null}
>
  {category.isActive ? "Deactivate" : "Activate"}
</button>

                    <button
                      type="button"
                      className="ac-edit-category"
                      onClick={() => startEditing(category)}
                      disabled={deletingId !== null || saving}
                      title="Edit category"
                    >
                      <Pencil size={17} />
                      Edit
                    </button>

                    <button
                      type="button"
                      className="ac-delete-category"
                      onClick={() => handleDelete(category)}
                      disabled={deletingId !== null || saving}
                      aria-label={`Delete ${category.name}`}
                      title="Delete category"
                    >
                      <Trash2 size={17} />
                      {deletingId === category.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default AdminCategories;
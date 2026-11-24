import { useEffect, useState } from "react";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { User, Mail, Phone, ArrowLeft, Save } from "lucide-react";
import "./ParticipantProfile.css";

function ParticipantProfile({ onBack }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const user = auth.currentUser;

        if (!user) {
          setError("Please log in to view your profile.");
          return;
        }

        setName(user.displayName || "");
        setEmail(user.email || "");

        const userRef = doc(db, "users", user.uid);
        const userSnapshot = await getDoc(userRef);

        if (userSnapshot.exists()) {
          const userData = userSnapshot.data();
          setName(userData.name || user.displayName || "");
          setMobile(userData.mobile || "");
        }
      } catch (err) {
        console.error("Profile loading error:", err);
        setError("Unable to load your profile.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const user = auth.currentUser;

    if (!user) {
      setError("Please log in again.");
      return;
    }

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!/^[0-9]{10}$/.test(mobile.trim())) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setSaving(true);

    try {
      await updateProfile(user, {
        displayName: name.trim(),
      });

      await setDoc(
        doc(db, "users", user.uid),
        {
          name: name.trim(),
          email: user.email || "",
          mobile: mobile.trim(),
        },
        { merge: true }
      );

      setMessage("Profile updated successfully!");
    } catch (err) {
      console.error("Profile update error:", err);
      setError("Unable to update your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="profile-loading">
        Loading your profile...
      </div>
    );
  }

  return (
    <main className="participant-profile-page">
      <div className="profile-card">
        <button
          type="button"
          className="profile-back-button"
          onClick={onBack}
        >
          <ArrowLeft size={18} />
          Dashboard
        </button>

        <div className="profile-heading">
          <div className="profile-avatar">
            <User size={32} />
          </div>
          <h1>My Profile</h1>
          <p>View and update your personal information.</p>
        </div>

        {message && (
          <p className="profile-success" role="status">
            {message}
          </p>
        )}

        {error && (
          <p className="profile-error" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label htmlFor="profile-name">Full Name</label>
          <div className="profile-input-wrapper">
            <User size={18} />
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your full name"
              required
            />
          </div>

          <label htmlFor="profile-email">Email Address</label>
          <div className="profile-input-wrapper profile-input-disabled">
            <Mail size={18} />
            <input
              id="profile-email"
              type="email"
              value={email}
              disabled
            />
          </div>

          <label htmlFor="profile-mobile">Mobile Number</label>
          <div className="profile-input-wrapper">
            <Phone size={18} />
            <input
              id="profile-mobile"
              type="tel"
              value={mobile}
              onChange={(event) =>
                setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))
              }
              placeholder="Enter 10-digit mobile number"
              maxLength={10}
              required
            />
          </div>

          <button
            type="submit"
            className="profile-save-button"
            disabled={saving}
          >
            <Save size={18} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default ParticipantProfile;
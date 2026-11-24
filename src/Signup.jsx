import { useState } from "react";
import { Link } from "react-router-dom";
import {
  UserRound,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import "./Signup.css";

import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

function Signup({ onSignup, onLoginClick }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

 async function handleSubmit(event) {
  event.preventDefault();

  setError("");
  setSuccess("");

  if (formData.name.trim().length < 2) {
    setError("Please enter your full name.");
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
    setError("Please enter a valid email address.");
    return;
  }

  if (!/^\d{10}$/.test(formData.mobile)) {
    setError("Enter a valid 10-digit mobile number.");
    return;
  }

  if (formData.password.length < 8) {
    setError("Password must contain at least 8 characters.");
    return;
  }

  if (formData.password !== formData.confirmPassword) {
    setError("Passwords do not match.");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      formData.email.trim(),
      formData.password
    );

    await updateProfile(userCredential.user, {
      displayName: formData.name.trim(),
    });

    await setDoc(doc(db, "users", userCredential.user.uid), {
      name: formData.name.trim(),
      email: formData.email.trim(),
      mobile: formData.mobile,
      role: "participant",
      createdAt: new Date().toISOString(),
    });

    alert("Signup successful! Your Eventora account has been created.");
    setSuccess("Account created successfully!");

    if (onSignup) {
      onSignup({
        name: formData.name.trim(),
        email: formData.email.trim(),
        mobile: formData.mobile,
      });
    }
  } catch (error) {
    console.error("Signup error:", error.code, error.message);

    if (error.code === "auth/email-already-in-use") {
      setError("This email is already registered. Please log in.");
    } else if (error.code === "auth/invalid-email") {
      setError("Please enter a valid email address.");
    } else if (error.code === "auth/weak-password") {
      setError("Please choose a stronger password.");
    } else if (
      error.code === "permission-denied" ||
      error.code === "firestore/permission-denied"
    ) {
      setError(
        "Your account may have been created, but Firestore could not save your details. Please check the database permissions."
      );
    } else {
      setError("Signup failed: " + error.message);
    }
  }
}

  return (
    <main className="signup-page">
  <header className="signup-topbar">
    <div className="signup-brand">
      <span className="signup-brand-icon">E</span>
      <span>EventSphere</span>
    </div>

    <button
      type="button"
      className="signup-dashboard-button"
      onClick={() => {
        if (onLoginClick) {
          onLoginClick();
        }
      }}
    >
      Login
    </button>
  </header>

  <section className="signup-card">

        <div className="signup-heading">
          <p className="signup-eyebrow">YOUR NEXT EXPERIENCE STARTS HERE</p>
          <h1>Create Account</h1>
          <p>Join EventSphere and discover something new.</p>
        </div>

        <form onSubmit={handleSubmit} className="signup-form">
          <label htmlFor="signup-name">Full Name</label>
          <div className="signup-input-wrap">
            <UserRound size={19} />
            <input
              id="signup-name"
              name="name"
              type="text"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={handleChange}
              autoComplete="name"
              required
            />
          </div>

          <label htmlFor="signup-email">Email Address</label>
          <div className="signup-input-wrap">
            <Mail size={19} />
            <input
              id="signup-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </div>

          <label htmlFor="signup-mobile">Mobile Number</label>
          <div className="signup-input-wrap">
            <Phone size={19} />
            <input
              id="signup-mobile"
              name="mobile"
              type="tel"
              placeholder="10-digit mobile number"
              value={formData.mobile}
              onChange={handleChange}
              autoComplete="tel"
              inputMode="numeric"
              maxLength={10}
              required
            />
          </div>

          <label htmlFor="signup-password">Password</label>
          <div className="signup-input-wrap">
            <Lock size={19} />
            <input
            id="signup-password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="At least 8 characters"
            value={formData.password}
            onChange={handleChange}
            autoComplete="new-password"
            required
            />
            <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
           </button>
          </div>

          <label htmlFor="signup-confirm-password">
            Confirm Password
          </label>
          <div className="signup-input-wrap">
            <Lock size={19} />
            <input
            id="signup-confirm-password"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Re-enter your password"
            value={formData.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            required
             />
            <button
            type="button"
            className="password-toggle"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            aria-label={
            showConfirmPassword ? "Hide confirm password" : "Show confirm password"
            }
            >
              {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          </div>


          {error && <p className="signup-error" role="alert">{error}</p>}
          {success && <p className="signup-success" role="status">{success}</p>}

          <button type="submit" className="signup-submit">
            Create Account <ArrowRight size={18} />
          </button>
        </form>

        <p className="signup-login-text">
          Already have an account?{" "}
          {onLoginClick ? (
            <button type="button" onClick={onLoginClick}>
              Log in
            </button>
          ) : (
            <Link to="/login">Log in</Link>
          )}
        </p>

        <p className="signup-footer">
          Discover. Learn. Connect.
        </p>
      </section>
    </main>
  );
}

export default Signup;


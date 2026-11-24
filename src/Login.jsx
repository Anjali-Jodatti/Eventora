import { useState } from "react";
import { Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import "./Login.css";

function Login({ onLogin, onSignupClick }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      alert("Login successful! Welcome to EventSphere.");

      if (onLogin) {
        onLogin({
          email: userCredential.user.email,
          uid: userCredential.user.uid,
        });
      }
    } catch (error) {
      console.error("Login error:", error.code, error.message);

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        setError("Your email address or password is incorrect.");
      } else if (error.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (error.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Login failed. Please try again.");
      }
    }
  }

  return (
    <main className="login-page">
      <header className="login-topbar">
        <div className="login-brand">
          <span className="login-brand-icon">E</span>
          <span>EventSphere</span>
        </div>

        <button
          type="button"
          className="login-dashboard-button"
          onClick={() => {
            if (onLogin) {
              onLogin();
            }
          }}
        >
          Back to Events
        </button>
      </header>

      <section className="login-card">
        <div className="login-heading">
          <p className="login-eyebrow">WELCOME BACK</p>
          <h1>Login</h1>
          <p>Log in to manage your event registrations.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email Address</label>

          <div className="login-input-wrap">
            <Mail size={19} />
            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              required
            />
          </div>

          <label htmlFor="login-password">Password</label>

          <div className="login-input-wrap">
            <Lock size={19} />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
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

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="login-submit">
            Log In <ArrowRight size={18} />
          </button>
        </form>

        <p className="login-signup-text">
          Don't have an account?{" "}
          <button type="button" onClick={onSignupClick}>
            Create Account
          </button>
        </p>

        <p className="login-footer">Discover. Learn. Connect.</p>
      </section>
    </main>
  );
}

export default Login;
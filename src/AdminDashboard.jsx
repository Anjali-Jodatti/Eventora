import { useEffect,  useState } from "react";
import { signOut } from "firebase/auth";
import {
  LayoutDashboard,
  CalendarDays,
  Ticket,
  Users,
  ClipboardList,
  LogOut,
  ArrowRight,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { auth, db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import "./AdminDashboard.css";
import AdminPrograms from "./AdminPrograms";
import AdminTrainers from "./AdminTrainers";
import RegistrationsByProgram from "./RegistrationsByProgram";
import RegistrationsByType from "./RegistrationsByType";
import MonthlyBookingTrend from "./MonthlyBookingTrend";

function AdminDashboard({ programCount, onViewBookings }) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPrograms, setShowPrograms] = useState(false);
  const [showTrainers, setShowTrainers] = useState(false);
const [dashboardData, setDashboardData] = useState({
  programs: [],
  totalBookings: 0,
  confirmedBookings: 0,
  cancelledBookings: 0,
  availableSeats: 0,
   registrationValue: 0,
});

const [dashboardLoading, setDashboardLoading] = useState(true);

useEffect(() => {
  async function loadDashboardData() {
    try {
      const [programSnapshot, bookingSnapshot, inventorySnapshot] =
        await Promise.all([
          getDocs(collection(db, "programs")),
          getDocs(collection(db, "bookings")),
          getDocs(collection(db, "seatInventory")),
        ]);

      const programs = programSnapshot.docs.map((item) => ({
        ...item.data(),
        firestoreId: item.id,
      }));

      const bookings = bookingSnapshot.docs.map((item) => item.data());

      const inventory = inventorySnapshot.docs.map((item) => item.data());

      setDashboardData({
        programs,
        totalBookings: bookings.length,
        confirmedBookings: bookings.filter(
          (booking) =>
            String(booking.status || "Confirmed").toLowerCase() ===
            "confirmed"
        ).length,
        cancelledBookings: bookings.filter(
          (booking) =>
            String(booking.status || "").toLowerCase() === "cancelled"
        ).length,
        availableSeats: inventory.reduce(
          (total, item) => total + (Number(item.availableSeats) || 0),
          0
        ),
        registrationValue: bookings
  .filter(
    (booking) =>
      String(booking.status || "Confirmed").toLowerCase() ===
      "confirmed"
  )
  .reduce(
    (total, booking) =>
      total +
      (Number(
        String(booking.price || 0).replace(/[^\d.-]/g, "")
      ) || 0),
    0
  ),
      });
    } catch (error) {
      console.error("Dashboard data error:", error);
    } finally {
      setDashboardLoading(false);
    }
  }

  loadDashboardData();
}, []);

const today = new Date();

const todayString = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");

const upcomingPrograms = dashboardData.programs.filter(
  (program) =>
    program.isPublished !== false &&
    (program.sessions || []).some(
      (session) => session.startDate && session.startDate >= todayString
    )
).length;

  if (showPrograms) {
    return <AdminPrograms onBack={() => setShowPrograms(false)} />;
  }

  if (showTrainers) {
    return <AdminTrainers onBack={() => setShowTrainers(false)} />;
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      setShowLogoutConfirm(false);
      alert("You have logged out successfully.");
    } catch (error) {
      console.error("Logout error:", error);
      alert("Unable to log out. Please try again.");
    }
  }

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <CalendarDays size={27} />
          <span>Eventora</span>
        </div>

        <div className="admin-sidebar-label">ADMIN MENU</div>

        <button className="admin-menu-item active">
          <LayoutDashboard size={19} />
          Dashboard
        </button>

        <button
          className="admin-menu-item"
          onClick={() => setShowPrograms(true)}
        >
          <CalendarDays size={19} />
          Manage Programs
        </button>

        <button
          className="admin-menu-item"
          onClick={() => setShowTrainers(true)}
        >
          <UserRound size={19} />
          Manage Trainers
        </button>

        <button
          className="admin-menu-item"
          onClick={onViewBookings}
        >
          <ClipboardList size={19} />
          All Bookings
        </button>

        <button
          className="admin-menu-item"
          onClick={() => setShowLogoutConfirm(true)}
        >
          <LogOut size={19} />
          Logout
        </button>

        <div className="admin-sidebar-bottom">
          <div className="admin-account">
            <ShieldCheck size={21} />
            <div>
              <strong>Administrator</strong>
              <span>{auth.currentUser?.email}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-breadcrumb">Eventora / Dashboard</p>
            <h1>Admin Dashboard</h1>
          </div>

          <span className="admin-role-badge">
            <ShieldCheck size={16} />
            Admin
          </span>
        </header>

        <section className="admin-welcome">
          <div>
            <p className="admin-eyebrow">ADMINISTRATION</p>
            <h2>
              Welcome back,{" "}
              {auth.currentUser?.displayName ||
                auth.currentUser?.email?.split("@")[0] ||
                "Admin"}
              !
            </h2>
            <p>
              Manage your programs and monitor event registrations
              from one place.
            </p>
          </div>

          <div className="admin-welcome-icon">
            <LayoutDashboard size={42} />
          </div>
        </section>

        <div className="admin-stats">
  <div className="admin-stat-card">
    <div className="admin-stat-icon">
      <CalendarDays />
    </div>
    <div>
      <h3>Total Programs</h3>
      <p>{dashboardLoading ? "..." : dashboardData.programs.length}</p>
    </div>
  </div>

  <div className="admin-stat-card">
    <div className="admin-stat-icon">
      <CalendarDays />
    </div>
    <div>
      <h3>Upcoming Programs</h3>
      <p>{dashboardLoading ? "..." : upcomingPrograms}</p>
    </div>
  </div>

  <div className="admin-stat-card">
    <div className="admin-stat-icon">
      <Ticket />
    </div>
    <div>
      <h3>Total Bookings</h3>
      <p>{dashboardLoading ? "..." : dashboardData.totalBookings}</p>
    </div>
  </div>

  <div className="admin-stat-card">
    <div className="admin-stat-icon">
      <ShieldCheck />
    </div>
    <div>
      <h3>Confirmed Bookings</h3>
      <p>{dashboardLoading ? "..." : dashboardData.confirmedBookings}</p>
    </div>
  </div>

  <div className="admin-stat-card">
    <div className="admin-stat-icon">
      <ClipboardList />
    </div>
    <div>
      <h3>Cancelled Bookings</h3>
      <p>{dashboardLoading ? "..." : dashboardData.cancelledBookings}</p>
    </div>
  </div>

  <div className="admin-stat-card">
    <div className="admin-stat-icon">
      <Users />
    </div>
    <div>
      <h3>Available Seats</h3>
      <p>{dashboardLoading ? "..." : dashboardData.availableSeats}</p>
    </div>
  </div>

  <div className="admin-stat-card">
  <div className="admin-stat-icon">
    <Ticket />
  </div>
  <div>
    <h3>Registration Value</h3>
    <p>
      {dashboardLoading
        ? "..."
        : `₹${dashboardData.registrationValue.toLocaleString("en-IN")}`}
    </p>
  </div>
</div>
</div>
<RegistrationsByProgram />
<RegistrationsByType />
<MonthlyBookingTrend />

        <section className="admin-quick-actions">
          <div className="admin-section-heading">
            <div>
              <h2>Quick Actions</h2>
              <p>Choose what you want to manage.</p>
            </div>
          </div>

          <button
            className="admin-action-card"
            onClick={() => setShowPrograms(true)}
          >
            <span className="admin-action-icon">
              <CalendarDays size={25} />
            </span>

            <span className="admin-action-text">
              <strong>Manage Programs</strong>
              <small>Add, edit, and delete event programs.</small>
            </span>

            <ArrowRight size={20} />
          </button>

          <button
            className="admin-action-card"
            onClick={() => setShowTrainers(true)}
          >
            <span className="admin-action-icon">
              <UserRound size={25} />
            </span>

            <span className="admin-action-text">
              <strong>Manage Trainers</strong>
              <small>Add trainers, update profiles, and assign programs.</small>
            </span>

            <ArrowRight size={20} />
          </button>

          <button
            className="admin-action-card"
            onClick={onViewBookings}
          >
            <span className="admin-action-icon">
              <ClipboardList size={25} />
            </span>

            <span className="admin-action-text">
              <strong>View All Bookings</strong>
              <small>Review registrations made by participants.</small>
            </span>

            <ArrowRight size={20} />
          </button>
        </section>

        <footer className="admin-footer">
          Eventora Admin Panel · Discover. Learn. Connect.
        </footer>
      </main>

      {showLogoutConfirm && (
        <div className="admin-modal-overlay">
          <div
            className="admin-logout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-logout-title"
          >
            <h2 id="admin-logout-title">Confirm Logout</h2>
            <p>Are you sure you want to log out of Eventora?</p>

            <div className="admin-modal-actions">
              <button
                className="admin-confirm-logout"
                onClick={handleLogout}
              >
                Yes, Logout
              </button>

              <button
                className="admin-cancel-logout"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import {
  CalendarDays,
  Search,
  MapPin,
  Clock3,
  Users,
  ArrowRight,
  Laptop,
  BriefcaseBusiness,
  BrainCircuit,
  ChartNoAxesCombined,
  GraduationCap,
  Menu,
  X,
  Megaphone,
  Wallet,
  Palette,
} from "lucide-react";
import "./App.css";
import EventDetails from "./EventDetails";
import MyBookings from "./MyBookings";
import ParticipantProfile from "./ParticipantProfile";
import Signup from "./Signup";
import Login from "./Login";
import BookingPage from "./BookingPage";
import AllBookings from "./AllBookings";
import AdminDashboard from "./AdminDashboard";
import Notifications from "./Notifications";

const initialPrograms = [
  {
    id: 1,
    title: "React & Modern Web Development",
    type: "Workshop",
    category: "Technology",
    date: "Oct 24, 2026",
    duration: "1 day",
    mode: "Online",
    trainer: "Alex Morgan",
    price: 999,
    seats: 12,
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 2,
    title: "Digital Marketing Masterclass",
    type: "Training",
    category: "Business",
    date: "Oct 28, 2026",
    duration: "3 days",
    mode: "Offline",
    trainer: "Sarah Johnson",
    price: 2499,
    seats: 25,
    image:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 3,
    title: "Data Analytics with Python",
    type: "Workshop",
    category: "Data Analytics",
    date: "Nov 5, 2026",
    duration: "2 days",
    mode: "Online",
    trainer: "Michael Chen",
    price: 1499,
    seats: 18,
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 4,
    title: "Leadership & Career Growth",
    type: "Training",
    category: "Career Development",
    date: "Nov 12, 2026",
    duration: "2 days",
    mode: "Offline",
    trainer: "Priya Sharma",
    price: 1999,
    seats: 10,
    image:
      "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 5,
    title: "Artificial Intelligence Essentials",
    type: "Event",
    category: "AI/ML",
    date: "Nov 18, 2026",
    duration: "1 day",
    mode: "Online",
    trainer: "Daniel Lee",
    price: 799,
    seats: 30,
    image:
      "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 6,
    title: "Business Communication Skills",
    type: "Workshop",
    category: "Soft Skills",
    date: "Nov 22, 2026",
    duration: "1 day",
    mode: "Offline",
    trainer: "Emma Wilson",
    price: 699,
    seats: 16,
    image:
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80",
  },
];

function getProgramTotalSeats(program) {
  return (program.sessions || []).reduce(
    (total, session) =>
      total + Number(session.maxSeats || 0),
    0
  );
}

function getProgramAvailableSeats(program) {
  return (program.sessions || []).reduce(
    (total, session) => {
      const value = session.availableSeats;

      const available =
        value === undefined || value === null || value === ""
          ? Number(session.maxSeats || 0)
          : Number(value);

      return total + (Number.isFinite(available) ? available : 0);
    },
    0
  );
}

const categoryIcons = {
  Technology: Laptop,
  Business: BriefcaseBusiness,
  "Data Analytics": ChartNoAxesCombined,
  "AI/ML": BrainCircuit,
  "Career Development": GraduationCap,
  "Digital Marketing": Megaphone,
  "Soft Skills": Users,
  "Finance & Accounting": Wallet,
  "Design & Creativity": Palette,
};

function App() {
const [programs, setPrograms] = useState(initialPrograms);
const [categories, setCategories] = useState([
  { name: "All Programs", icon: GraduationCap },
]);

async function loadCategories() {
  try {
    const snapshot = await getDocs(collection(db, "categories"));

    const firestoreCategories = snapshot.docs
  .filter((item) => item.data().isActive !== false)
  .map((item) => ({
    name: item.data().name,
    icon: categoryIcons[item.data().name] || GraduationCap,
  }))
  .filter((category) => category.name);

    setCategories([
      { name: "All Programs", icon: GraduationCap },
      ...firestoreCategories,
    ]);
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}
async function loadPrograms() {
  try {
    // Load programs
    const snapshot = await getDocs(collection(db, "programs"));

    // Load live seat inventory
    const inventorySnapshot = await getDocs(
      collection(db, "seatInventory")
    );

    // Create a lookup for live seat counts
    const inventoryMap = {};

    inventorySnapshot.docs.forEach((item) => {
      inventoryMap[item.id] = item.data();
    });

      const items = snapshot.docs
  .filter((item) => {
    const isNumericId = /^\d+$/.test(item.id);

    if (!isNumericId) return true;

    const numericProgramId = String(item.data().id);

    const hasLongIdDuplicate = snapshot.docs.some((other) => {
      return (
        !/^\d+$/.test(other.id) &&
        String(other.data().id) === numericProgramId
      );
    });

    return !hasLongIdDuplicate;
  })
  .map((item) => {
          const data = item.data();
      const id = Number(data.id) || Number(item.id);

      const fallback = initialPrograms.find(
        (program) => program.id === id
      );

      const sessions = (
        Array.isArray(data.sessions) ? data.sessions : []
      ).map((session) => {
        const inventoryId = `${item.id}__${session.id}`;
        const inventory = inventoryMap[inventoryId];

        return {
          ...session,
          availableSeats:
            inventory && inventory.availableSeats !== undefined
              ? Number(inventory.availableSeats)
              : Number(
                  session.availableSeats ?? session.maxSeats ?? 0
                ),
        };
      });
     
      return {
        ...fallback,
        ...data,
        id,
        firestoreId: item.id,
        duration: data.duration || fallback?.duration || "1 day",
        image: data.image || fallback?.image || "",
        price: Number(data.price ?? fallback?.price ?? 0),
        sessions,
      };
    });

    items.sort((a, b) => a.id - b.id);

    setPrograms(items);
  } catch (error) {
    console.error("Error loading homepage programs:", error);
  }
}

const [selectedProgram, setSelectedProgram] = useState(null);
const [showMyBookings, setShowMyBookings] = useState(false);
const [showParticipantProfile, setShowParticipantProfile] = useState(false);
const [showNotifications, setShowNotifications] = useState(false);
const [showAllBookings, setShowAllBookings] = useState(false);
const [authPage, setAuthPage] = useState("home");
const [currentUser, setCurrentUser] = useState(null);
const [userRole, setUserRole] = useState(null);

const [authLoading, setAuthLoading] = useState(true);
const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
const [bookingProgram, setBookingProgram] = useState(null);

useEffect(() => {
  loadPrograms();
  loadCategories();
}, []);

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setCurrentUser(null);
      setUserRole(null);
      setAuthLoading(false);
      return;
    }

    setCurrentUser(user);

    try {
      const userDoc = await getDoc(
        doc(db, "users", user.uid)
      );

      if (userDoc.exists()) {
        setUserRole(userDoc.data().role || null);
      } else {
        setUserRole(null);
      }
    } catch (error) {
      console.error("Unable to load user role:", error);
      setUserRole(null);
    } finally {
      setAuthLoading(false);
    }
  });

  return () => unsubscribe();
}, []);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Programs");
  const [type, setType] = useState("All Types");
  const [mode, setMode] = useState("All Modes");
  const [sort, setSort] = useState("date");
  const [menuOpen, setMenuOpen] = useState(false);

  const filteredPrograms = programs
  .filter((program) => {
    // Hide unpublished programs.
    const isPublished = program.isPublished !== false;

    // Hide programs whose dates have already passed.
    const programDate = new Date(program.date);
    programDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isUpcoming =
      !Number.isNaN(programDate.getTime()) &&
      programDate >= today;

    const matchesSearch =
      (program.title || "")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (program.trainer || "")
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesCategory =
      category === "All Programs" ||
      program.category === category;

    const matchesType =
      type === "All Types" || program.type === type;

    const matchesMode =
      mode === "All Modes" || program.mode === mode;

    return (
      isPublished &&
      isUpcoming &&
      matchesSearch &&
      matchesCategory &&
      matchesType &&
      matchesMode
    );
  })
  .sort((a, b) => {
    if (sort === "price-low") return a.price - b.price;
    if (sort === "price-high") return b.price - a.price;

    if (sort === "date-latest") {
      return new Date(b.date) - new Date(a.date);
    }

    return new Date(a.date) - new Date(b.date);
  });
    const formatPrice = (price) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);

   if (authLoading) {
   return <div className="app-loading">Loading EventSphere...</div>;
    }

     if (authPage === "login") {
    return (
    <Login
      onLogin={() => {
        setAuthPage("home");
        setShowMyBookings(false);
      }}
      onSignupClick={() => setAuthPage("signup")}
    />
    );
   }

    if (authPage === "signup") {
  return (
    <Signup
      onSignup={() => {
        setAuthPage("home");
        setShowMyBookings(false);
      }}
      onLoginClick={() => setAuthPage("login")}
    />
  );
   }

    // Protect the booking page: login is required.
  if (bookingProgram && !currentUser) {
  setBookingProgram(null);
  setAuthPage("login");
  return null;
}

if (bookingProgram) {
  if (!currentUser) {
    setBookingProgram(null);
    setAuthPage("login");
    return null;
  }

 return (
  <BookingPage
    program={bookingProgram}
    userId={currentUser.uid}
    onBack={async () => {
      setBookingProgram(null);
      await loadPrograms();
    }}
    onConfirm={() => {
      setBookingProgram(null);
      setShowMyBookings(true);
    }}
  />
);
}

// Protect My Bookings: login is required.
if (showMyBookings && !currentUser) {
  setShowMyBookings(false);
  setAuthPage("login");
  return null;
}

// Show All Bookings only to admin.
if (showAllBookings) {
  if (currentUser && userRole === "admin") {
    return (
      <AllBookings
        onBack={() => setShowAllBookings(false)}
      />
    );
  }

  return (
    <div className="app-loading">
      <p>
        Admin access required.
        Current role: {userRole || "Loading role..."}
      </p>

      <button
        type="button"
        onClick={() => setShowAllBookings(false)}
        className="button button-primary"
      >
        Back to Eventora
      </button>
    </div>
  );
}

if (showMyBookings) {
  return (
    <MyBookings
      userId={currentUser.uid}
      onBack={() => setShowMyBookings(false)}
    />
  );
}

// Show participant notifications.
if (showNotifications) {
  return (
    <Notifications
      userId={currentUser.uid}
      onBack={() => setShowNotifications(false)}
    />
  );
}

if (showParticipantProfile) {
  if (currentUser && userRole === "participant") {
    return (
      <ParticipantProfile
        onBack={() => setShowParticipantProfile(false)}
      />
    );
  }

  return (
    <div className="app-loading">
      <p>Participant access required.</p>
      <button
        type="button"
        onClick={() => setShowParticipantProfile(false)}
        className="button button-primary"
      >
        Back to Eventora
      </button>
    </div>
  );
}

if (selectedProgram) {
  const latestSelectedProgram =
    programs.find(
      (program) =>
        String(program.id) === String(selectedProgram.id)
    ) || selectedProgram;

  return (
    <EventDetails
      program={latestSelectedProgram}
      onBack={() => setSelectedProgram(null)}
      onBook={() => {
        if (!currentUser) {
          setAuthPage("login");
          return;
        }

        setBookingProgram(latestSelectedProgram);
      }}
    />
  );
}

// Show the Admin Dashboard instead of the Home Page.
if (currentUser && userRole === "admin") {
  return (
    <AdminDashboard
      programCount={programs.length}
      onViewBookings={() => setShowAllBookings(true)}
    />
  );
}

 return (
    <div className="app-shell">
      <header className="navbar">
        <a className="brand" href="#home">
          <span className="brand-icon">
            <CalendarDays size={25} />
          </span>
          <span>Event<span className="brand-highlight">Sphere</span></span>
        </a>

        <button
          className="mobile-menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>

          <nav className={`nav-links ${menuOpen ? "nav-open" : ""}`}>
          <a className="nav-active" href="#home" onClick={() => setMenuOpen(false)}>Home</a>
          <a href="#programs" onClick={() => setMenuOpen(false)}>Explore Programs</a>
        {currentUser && userRole === "participant" && (
  <button
    className="nav-bookings-button"
    onClick={() => {
      setMenuOpen(false);
      setAuthPage("home");
      setShowMyBookings(true);
      setShowNotifications(false);
    }}
  >
    My Bookings
  </button>
)}

{currentUser && userRole === "participant" && (
  <button
    className="nav-bookings-button"
    onClick={() => {
      setMenuOpen(false);
      setAuthPage("home");
      setShowMyBookings(false);
      setShowParticipantProfile(false);
      setShowNotifications(true);
    }}
  >
    Notifications
  </button>
)}

{currentUser && userRole === "participant" && (
  <button
    className="nav-bookings-button"
    onClick={() => {
      setMenuOpen(false);
      setAuthPage("home");
      setShowMyBookings(false);
      setShowParticipantProfile(true);
    }}
  >
    My Profile
  </button>
)}

{currentUser && userRole === "admin" && (
  <button
    className="nav-bookings-button"
    onClick={() => {
      setMenuOpen(false);
      setAuthPage("home");
      setShowParticipantProfile(false);
      setShowMyBookings(false);
      setShowAllBookings(true);
    }}
  >
    All Bookings
  </button>
)}      
         
          <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
        </nav>

        <div className="nav-actions">
  {currentUser ? (
    <>

 <span className="welcome-user">
  Welcome, {currentUser.displayName || currentUser.email?.split("@")[0]}
</span>

<span className="user-role">
  {userRole
    ? userRole.charAt(0).toUpperCase() + userRole.slice(1)
    : ""}
</span>
      

      
      <button
  className="button button-primary"
  onClick={() => setShowLogoutConfirm(true)}
>
  Logout
</button>
    </>
  ) : (
    <>
      <button
        className="button button-outline"
        onClick={() => setAuthPage("login")}
      >
        Log In
      </button>

      <button
        className="button button-primary"
        onClick={() => setAuthPage("signup")}
      >
        Get Started <ArrowRight size={16} />
      </button>
    </>
  )}
   </div>
   </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-content">
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              LEARN SOMETHING NEW
            </span>
            <h1>
              Discover experiences.
              <br />
              <span>Unlock your potential.</span>
            </h1>
            <p>
              Explore inspiring events, practical workshops, and expert-led
              training programs designed to move your career forward.
            </p>

            <form
              className="hero-search"
              onSubmit={(event) => {
                event.preventDefault();
                document.getElementById("programs")?.scrollIntoView({
                  behavior: "smooth",
                });
              }}
            >
              <Search size={21} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="What would you like to learn?"
                aria-label="Search programs"
              />
              <button type="submit">Explore <ArrowRight size={17} /></button>
            </form>

            <div className="hero-proof">
              <div className="avatar-stack">
                <span>A</span><span>S</span><span>R</span><span>M</span>
              </div>
              <p><strong>Learn alongside others</strong><br />Find your next opportunity today</p>
            </div>
          </div>

          <div className="hero-visual">
            <img
              src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=85"
              alt="Professionals attending a conference"
            />
            <div className="floating-card floating-top">
              <span className="floating-icon"><CalendarDays size={20} /></span>
              <div><strong>Learn by doing</strong><small>Practical experiences</small></div>
            </div>
            <div className="floating-card floating-bottom">
              <span className="online-indicator" />
              <div><strong>Expert-led programs</strong><small>Discover new skills</small></div>
            </div>
          </div>
        </section>

<section className="stats-strip">
            <div><strong>Live learning</strong><span>Practical, engaging programs</span></div>
          <div><strong>Expert mentors</strong><span>Learn from industry professionals</span></div>
          <div><strong>Flexible formats</strong><span>Online and offline options</span></div>
          <div><strong>One destination</strong><span>Events, workshops and training</span></div>
        </section>

        <section className="program-section" id="programs">
          <div className="section-heading">
            <div>
              <span className="section-kicker">YOUR NEXT OPPORTUNITY</span>
              <h2>Explore programs</h2>
              <p>Find the right experience to learn, connect, and grow.</p>
            </div>
            <span className="program-count">{filteredPrograms.length} programs found</span>
          </div>

          <div className="category-list" id="categories">
           {categories.map(({ name, icon: Icon }) => (
              <button
                key={name}
                className={`category-chip ${category === name ? "category-selected" : ""}`}
                onClick={() => setCategory(name)}
              >
                <Icon size={17} /> {name}
              </button>
            ))}
          </div>

          <div className="filter-row">
            <label className="filter-search">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search programs or trainers"
              />
            </label>

            <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter by program type">
              <option>All Types</option>
              <option>Event</option>
              <option>Workshop</option>
              <option>Training</option>
            </select>

            <select value={mode} onChange={(event) => setMode(event.target.value)} aria-label="Filter by mode">
              <option>All Modes</option>
              <option>Online</option>
              <option>Offline</option>
            </select>

            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort programs">
              <option value="date">Sort by date</option>
              <option value="date-latest">Latest Date First</option>
              <option value="price-low">Price: Low to high</option>
              <option value="price-high">Price: High to low</option>
            </select>
          </div>

          <div className="program-grid">
            {filteredPrograms.map((program) => (
              <article className="program-card" key={program.id}>
                <div className="program-image">
                  <img src={program.image} alt={program.title} loading="lazy" />
                  <span className={`program-type type-${program.type.toLowerCase()}`}>
                    {program.type}
                  </span>
                  <span className="seat-badge">
  {getProgramAvailableSeats(program)} /{" "}
  {getProgramTotalSeats(program)} seats available
</span>
                        </div>

                <div className="program-card-body">
                 
                  <div className="program-card-labels">
  <span className="program-category">
    {program.category}
  </span>

  <span
    className={`registration-status ${
      getProgramAvailableSeats(program) > 0
        ? "status-open"
        : "status-full"
    }`}
  >
    {getProgramAvailableSeats(program) > 0
      ? "Registration Open"
      : "Fully Booked"}
  </span>
</div>
                  
<h3>{program.title}</h3>

                  <div className="program-meta">
                    <span><CalendarDays size={15} /> {program.date}</span>
                    <span><Clock3 size={15} /> {program.duration}</span>
                    <span>
                      <MapPin size={15} />
                      {program.mode === "Online" ? "Online" : "Offline venue"}
                    </span>
                    <span><Users size={15} /> {program.trainer}</span>
                  </div>

                  <div className="program-card-footer">
                    <div><small>Registration fee</small><strong>{formatPrice(program.price)}</strong></div>
                    <button
                      className="card-action"
                      onClick={() => setSelectedProgram(program)}
                      aria-label={`View ${program.title}`}
                    >
                      <ArrowRight size={19} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {filteredPrograms.length === 0 && (
            <div className="empty-state">
              <Search size={32} />
              <h3>No programs found</h3>
              <p>Try another search or change your filters.</p>
              <button
                className="button button-primary"
                onClick={() => {
                  setSearch("");
                  setCategory("All Programs");
                  setType("All Types");
                  setMode("All Modes");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        <section className="cta-banner">
          <div>
            <span className="section-kicker">KEEP GROWING</span>
            <h2>Your next big opportunity starts here.</h2>
            <p>Explore new skills, meet experts, and take the next step.</p>
          </div>
          <a href="#programs" className="button button-light">Explore programs <ArrowRight size={17} /></a>
        </section>

        <section className="about-section" id="about">
  <div className="about-container">

    <div className="about-heading">
      <span className="section-kicker">GET TO KNOW US</span>
      <h2>About Eventora</h2>
      <p>
        Discover opportunities, develop skills and connect
        with learning experiences that inspire growth.
      </p>
    </div>

    <div className="about-intro">
      <div className="about-image">
        <img
          src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1000&q=80"
          alt="People attending a professional event"
        />
      </div>

      <div className="about-content">
        <span className="about-label">WHO WE ARE</span>
        <h3>Discover. Learn. Connect. Grow.</h3>
        <p>
          Eventora is an online event, workshop and training
          booking application that brings learning opportunities
          together in one place.
        </p>
        <p>
          Participants can explore upcoming programs, discover
          trainers, view session details and reserve their seats
          conveniently.
        </p>
      </div>
    </div>

    <div className="about-mission-grid">
      <div className="about-info-card">
        <h3>Our Mission</h3>
        <p>
          To make event discovery and registration simple,
          convenient and accessible.
        </p>
      </div>

      <div className="about-info-card">
        <h3>Our Vision</h3>
        <p>
          To create a platform where people discover meaningful
          learning experiences and develop their skills.
        </p>
      </div>
    </div>

    <div className="about-heading">
      <span className="section-kicker">WHY EVENTORA</span>
      <h2>Why Choose Us?</h2>
    </div>

    <div className="about-feature-grid">
      <div className="about-feature-card">
        <h3>Easy Discovery</h3>
        <p>Explore events, workshops and training programs.</p>
      </div>

      <div className="about-feature-card">
        <h3>Flexible Learning</h3>
        <p>Find online and offline learning opportunities.</p>
      </div>

      <div className="about-feature-card">
        <h3>Simple Booking</h3>
        <p>Select sessions and reserve available seats.</p>
      </div>

      <div className="about-feature-card">
        <h3>Booking Tracking</h3>
        <p>View booking history and in-app notifications.</p>
      </div>
    </div>

    <div className="about-heading">
      <span className="section-kicker">SIMPLE AND CONVENIENT</span>
      <h2>How Eventora Works</h2>
    </div>

    <div className="about-steps-grid">
      <div className="about-step-card">
        <span>01</span>
        <h3>Explore Programs</h3>
        <p>Browse available events and workshops.</p>
      </div>

      <div className="about-step-card">
        <span>02</span>
        <h3>Choose a Session</h3>
        <p>Check dates, timings and seat availability.</p>
      </div>

      <div className="about-step-card">
        <span>03</span>
        <h3>Book Your Seat</h3>
        <p>Enter your details and confirm your booking.</p>
      </div>

      <div className="about-step-card">
        <span>04</span>
        <h3>Track Your Booking</h3>
        <p>View your bookings and notifications.</p>
      </div>
    </div>

    <div className="about-platform">
      <div className="about-heading">
        <span className="section-kicker">OUR PLATFORM</span>
        <h2>Everything in One Place</h2>
      </div>

      <div className="about-platform-grid">
        <span>Participant Dashboard</span>
        <span>Program Management</span>
        <span>Trainer Management</span>
        <span>Booking Management</span>
        <span>Notifications</span>
        <span>Admin Dashboard & Reports</span>
      </div>
    </div>

    <div className="about-faq">
      <div className="about-heading">
        <span className="section-kicker">NEED HELP?</span>
        <h2>Frequently Asked Questions</h2>
      </div>

      <details>
        <summary>How do I register for a program?</summary>
        <p>Log in, explore programs, choose a session and confirm your booking.</p>
      </details>

      <details>
        <summary>Can I view my previous bookings?</summary>
        <p>Yes. Open My Bookings from your participant dashboard.</p>
      </details>

      <details>
        <summary>Can I cancel a booking?</summary>
        <p>Booking cancellation is available according to the application's cancellation process.</p>
      </details>

      <details>
        <summary>How do I check available seats?</summary>
        <p>Available seats are displayed in the program details.</p>
      </details>

      <details>
        <summary>Are online and offline programs available?</summary>
        <p>Yes. You can explore programs offered in both formats.</p>
      </details>
    </div>

  </div>
</section>

      </main>

      <footer className="footer">
        <a className="brand" href="#home">
          <span className="brand-icon"><CalendarDays size={22} /></span>
          <span>Event<span className="brand-highlight">Sphere</span></span>
        </a>
        <p>Discover. Learn. Connect. Grow.</p>
        <span>© 2026 EventSphere · Project prototype</span>
      </footer>
      {showLogoutConfirm && (
  <div className="logout-modal-overlay">
    <div
      className="logout-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-title"
    >
      <h2 id="logout-title">Confirm Logout</h2>
      <p>Are you sure you want to logout?</p>

      <div className="logout-modal-buttons">
        <button
          className="button button-primary"
          onClick={async () => {
            try {
              await signOut(auth);
              setShowLogoutConfirm(false);
              setShowMyBookings(false);
              setAuthPage("home");
              alert("You have logged out successfully.");
            } catch (error) {
              console.error("Logout error:", error);
              alert("Unable to log out. Please try again.");
            }
          }}
        >
          Yes
        </button>

        <button
          className="button button-outline"
          onClick={() => setShowLogoutConfirm(false)}
        >
          No
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

export default App;
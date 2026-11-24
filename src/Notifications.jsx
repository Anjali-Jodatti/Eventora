import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { Bell, CheckCircle, Mail, ArrowLeft } from "lucide-react";
import { db } from "./firebase";
import "./Notifications.css";

function Notifications({ userId, onBack }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const items = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        items.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
          const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
          return dateB - dateA;
        });

        setNotifications(items);
        setLoading(false);
        setError("");
      },
      (err) => {
        console.error("Notification loading error:", err);
        setError("Unable to load notifications. Please try again.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = async (notificationId) => {
    try {
      await updateDoc(doc(db, "notifications", notificationId), {
        isRead: true,
      });
    } catch (err) {
      console.error("Unable to mark notification as read:", err);
      alert("Unable to update notification. Please try again.");
    }
  };

  const unreadCount = notifications.filter(
    (item) => item.isRead !== true
  ).length;

  return (
    <div className="notifications-page">
     <div className="notifications-container">

  <div className="notifications-topbar">

    <div className="notifications-heading">
      <span className="notifications-kicker">
        YOUR UPDATES
      </span>

      <h1>
        <Bell size={27} />
        Notifications
      </h1>

      <p>Stay updated about your bookings and programs.</p>
    </div>

    <button className="notifications-back" onClick={onBack}>
      <ArrowLeft size={18} />
      Back to Events
    </button>

  </div>

  <div className="unread-count">
    {unreadCount} unread
  </div>
  
        {loading ? (
          <div className="notifications-empty">
            Loading notifications...
          </div>
        ) : error ? (
          <div className="notifications-empty">
            {error}
          </div>
        ) : notifications.length === 0 ? (
          <div className="notifications-empty">
            <Mail size={40} />
            <h3>No notifications yet</h3>
            <p>
              Booking confirmations and updates will appear here.
            </p>
          </div>
        ) : (
          <div className="notifications-list">
            {notifications.map((item) => (
              <article
                className={`notification-card ${
                  item.isRead ? "notification-read" : "notification-unread"
                }`}
                key={item.id}
              >
                <div className="notification-icon">
                  {item.type === "booking_cancelled" ? (
                    <Mail size={22} />
                  ) : (
                    <CheckCircle size={22} />
                  )}
                </div>

                <div className="notification-content">
                  <div className="notification-title-row">
                    <h3>{item.title || "Eventora Notification"}</h3>
                    {!item.isRead && (
                      <span className="notification-new">New</span>
                    )}
                  </div>

                  <p>{item.message || "You have a new update."}</p>

                  {item.createdAt?.toDate && (
                    <span className="notification-date">
                      {item.createdAt.toDate().toLocaleString("en-IN")}
                    </span>
                  )}

                  {!item.isRead && (
                    <button
                      className="notification-read-button"
                      onClick={() => markAsRead(item.id)}
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="notification-disclaimer">
          These are in-app notifications with simulated email details.
          They do not represent emails sent to your inbox.
        </p>
      </div>
    </div>
  );
}

export default Notifications;
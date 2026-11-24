import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { db } from "./firebase";
import "./MonthlyBookingTrend.css";

function MonthlyBookingTrend() {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMonthlyBookings() {
      try {
        const snapshot = await getDocs(collection(db, "bookings"));

        const now = new Date();
        const months = [];

        // Prepare the last six calendar months.
        for (let i = 5; i >= 0; i--) {
          const date = new Date(
            now.getFullYear(),
            now.getMonth() - i,
            1
          );

          months.push({
            year: date.getFullYear(),
            month: date.getMonth(),
            monthName: date.toLocaleString("en-IN", {
              month: "short",
              year: "numeric",
            }),
            bookings: 0,
          });
        }

        snapshot.docs.forEach((item) => {
          const booking = item.data();

          if (!booking.bookedAt) return;

          const bookingDate =
            typeof booking.bookedAt.toDate === "function"
              ? booking.bookedAt.toDate()
              : new Date(booking.bookedAt);

          if (isNaN(bookingDate.getTime())) return;

          const matchingMonth = months.find(
            (month) =>
              month.year === bookingDate.getFullYear() &&
              month.month === bookingDate.getMonth()
          );

          if (matchingMonth) {
            matchingMonth.bookings += 1;
          }
        });

        setChartData(
          months.map(({ monthName, bookings }) => ({
            month: monthName,
            bookings,
          }))
        );
      } catch (error) {
        console.error("Monthly booking trend error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadMonthlyBookings();
  }, []);

  return (
    <section className="monthly-booking-chart-card">
      <div className="monthly-booking-chart-heading">
        <h2>Monthly Booking Trend</h2>
        <p>Bookings made over the last six months</p>
      </div>

      {loading ? (
        <p className="monthly-booking-message">Loading chart...</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar
              dataKey="bookings"
              name="Total Bookings"
              fill="#6366f1"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

export default MonthlyBookingTrend;
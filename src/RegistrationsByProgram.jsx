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
import "./RegistrationsByProgram.css";

function RegistrationsByProgram() {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadChartData() {
      try {
        const [programSnapshot, bookingSnapshot] = await Promise.all([
          getDocs(collection(db, "programs")),
          getDocs(collection(db, "bookings")),
        ]);

        const bookings = bookingSnapshot.docs.map((item) => item.data());

        const data = programSnapshot.docs.map((item) => {
          const program = item.data();

          const registrationCount = bookings.filter((booking) => {
            const status = String(
              booking.status || "Confirmed"
            ).toLowerCase();

            if (status !== "confirmed") return false;

            // Prefer the exact Firestore program document ID.
            if (booking.programFirestoreId) {
              return booking.programFirestoreId === item.id;
            }

            // Fallback for older booking records.
            if (booking.programId) {
              return (
                booking.programId === item.id ||
                booking.programId === program.id
              );
            }

            // Final fallback: match by program title.
            return (
              String(booking.programTitle || "").trim().toLowerCase() ===
              String(program.title || "").trim().toLowerCase()
            );
          }).length;

          return {
            programName: program.title || "Untitled Program",
            registrations: registrationCount,
          };
        });

        setChartData(data);
      } catch (error) {
        console.error("Registration chart error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadChartData();
  }, []);

  return (
    <section className="registration-chart-card">
      <div className="registration-chart-heading">
        <h2>Registrations by Program</h2>
        <p>Confirmed registrations for each program</p>
      </div>

      {loading ? (
        <p className="registration-chart-message">
          Loading chart...
        </p>
      ) : chartData.length === 0 ? (
        <p className="registration-chart-message">
          No programs available to display.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={chartData}
            margin={{ top: 15, right: 20, left: 0, bottom: 65 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="programName"
              angle={-25}
              textAnchor="end"
              interval={0}
              height={80}
              tick={{ fontSize: 11 }}
            />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar
              dataKey="registrations"
              name="Confirmed Registrations"
              fill="#4f46e5"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

export default RegistrationsByProgram;
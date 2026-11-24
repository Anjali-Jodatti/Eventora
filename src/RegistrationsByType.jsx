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
import "./RegistrationsByType.css";

function RegistrationsByType() {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadChartData() {
      try {
        const [programSnapshot, bookingSnapshot] = await Promise.all([
          getDocs(collection(db, "programs")),
          getDocs(collection(db, "bookings")),
        ]);

        const programs = programSnapshot.docs.map((item) => ({
          ...item.data(),
          firestoreId: item.id,
        }));

        const bookings = bookingSnapshot.docs.map((item) => item.data());

        const types = ["Event", "Workshop", "Training"];

        const data = types.map((type) => {
          const registrations = bookings.filter((booking) => {
            if (
              String(booking.status || "Confirmed").toLowerCase() !==
              "confirmed"
            ) {
              return false;
            }

            const program = programs.find((item) => {
              if (booking.programFirestoreId) {
                return booking.programFirestoreId === item.firestoreId;
              }

              if (booking.programId) {
                return (
                  booking.programId === item.firestoreId ||
                  booking.programId === item.id
                );
              }

              return (
                String(booking.programTitle || "").trim().toLowerCase() ===
                String(item.title || "").trim().toLowerCase()
              );
            });

            return (
              String(program?.type || booking.programType || "")
                .trim()
                .toLowerCase() === type.toLowerCase()
            );
          }).length;

          return {
            programType: type,
            registrations,
          };
        });

        setChartData(data);
      } catch (error) {
        console.error("Registration type chart error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadChartData();
  }, []);

  return (
    <section className="registration-type-chart-card">
      <div className="registration-type-chart-heading">
        <h2>Registrations by Program Type</h2>
        <p>Confirmed registrations grouped by program type</p>
      </div>

      {loading ? (
        <p className="registration-type-message">Loading chart...</p>
      ) : chartData.length === 0 ? (
        <p className="registration-type-message">
          No registration data available.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="programType" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar
              dataKey="registrations"
              name="Confirmed Registrations"
              fill="#0891b2"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

export default RegistrationsByType;
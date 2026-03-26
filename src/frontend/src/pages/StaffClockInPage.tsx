import { useNavigate } from "@/utils/router";
import { ArrowLeft, CheckCircle, Clock, UserCheck, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface StaffMember {
  id?: string;
  name: string;
  mobile: string;
  role: string;
  baseSalary?: string;
}

interface ClockInEntry {
  staffName: string;
  mobile: string;
  timestamp: string;
  date: string;
  clockOutTime?: string;
}

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function getTimeStr(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function StaffClockInPage() {
  const navigate = useNavigate();
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [clockLog, setClockLog] = useState<ClockInEntry[]>([]);
  const [pin, setPin] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const scanLineRef = useRef<HTMLDivElement>(null);
  const today = getTodayStr();
  function doClockOut(entry: ClockInEntry) {
    const updated = clockLog.map((e) => {
      if (
        e.staffName === entry.staffName &&
        e.date === entry.date &&
        e.timestamp === entry.timestamp
      ) {
        return { ...e, clockOutTime: new Date().toISOString() };
      }
      return e;
    });
    setClockLog(updated);
    localStorage.setItem("clikmate_clock_in_log", JSON.stringify(updated));
    window.dispatchEvent(
      new StorageEvent("storage", { key: "clikmate_clock_in_log" }),
    );
    toast.success(`✅ ${entry.staffName} clocked out!`);
  }

  useEffect(() => {
    try {
      const members = JSON.parse(
        localStorage.getItem("clikmate_staff_members") || "[]",
      );
      setStaffMembers(members);
    } catch {
      setStaffMembers([]);
    }
    try {
      const log = JSON.parse(
        localStorage.getItem("clikmate_clock_in_log") || "[]",
      );
      setClockLog(log);
    } catch {
      setClockLog([]);
    }
  }, []);

  const todayLog = clockLog.filter((e) => e.date === today);

  function doClockIn(member: StaffMember) {
    const entry: ClockInEntry = {
      staffName: member.name,
      mobile: member.mobile,
      timestamp: new Date().toISOString(),
      date: today,
    };
    const newLog = [...clockLog, entry];
    setClockLog(newLog);
    localStorage.setItem("clikmate_clock_in_log", JSON.stringify(newLog));
    window.dispatchEvent(
      new StorageEvent("storage", { key: "clikmate_clock_in_log" }),
    );
    setSuccessMsg(
      `${member.name} Clocked In at ${getTimeStr(entry.timestamp)}`,
    );
    setShowSuccess(true);
    toast.success(`✅ ${member.name} clocked in!`);
    setTimeout(() => setShowSuccess(false), 3000);
  }

  function handlePinClockIn() {
    if (!pin || pin.length < 1) return;
    const member = staffMembers.find(
      (m) => m.mobile === pin || (m.id && m.id === pin),
    );
    if (member) {
      doClockIn(member);
      setPin("");
    } else {
      toast.error(`No staff found with ID/PIN: ${pin}`);
    }
  }

  return (
    <div
      data-ocid="clockin.page"
      style={{
        minHeight: "100vh",
        background: "#0a0f1e",
        color: "#e2e8f0",
        fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          type="button"
          data-ocid="clockin.back.button"
          onClick={() => navigate("/pos")}
          style={{
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "6px 10px",
            color: "rgba(255,255,255,0.7)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 13,
          }}
        >
          <ArrowLeft size={15} /> Back to POS
        </button>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: "linear-gradient(135deg,#06b6d4,#7c3aed)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            color: "white",
            fontSize: 16,
          }}
        >
          C
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "white" }}>
            Staff Clock-In Station
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            ClikMate Smart Online Service Center
          </div>
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(6,182,212,0.1)",
            border: "1px solid rgba(6,182,212,0.3)",
            borderRadius: 20,
            padding: "4px 12px",
            fontSize: 13,
            color: "#06b6d4",
          }}
        >
          <Clock size={14} />
          {new Date().toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </div>
      </div>

      {/* Main */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "32px 24px",
          gap: 28,
        }}
      >
        {/* Success overlay */}
        {showSuccess && (
          <div
            data-ocid="clockin.success_state"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 999,
              gap: 16,
            }}
          >
            <div
              style={{
                background: "rgba(16,185,129,0.15)",
                border: "2px solid rgba(16,185,129,0.5)",
                borderRadius: 20,
                padding: "40px 60px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                backdropFilter: "blur(20px)",
              }}
            >
              <CheckCircle size={64} color="#10b981" />
              <div
                style={{
                  color: "white",
                  fontWeight: 700,
                  fontSize: 22,
                  textAlign: "center",
                }}
              >
                ✅ {successMsg}
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
                Status: Present
              </div>
            </div>
          </div>
        )}

        {/* Clock-In Terminal Card */}
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          {/* Scanner visual */}
          <div
            style={{
              background:
                "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(124,58,237,0.15))",
              padding: "24px 28px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              position: "relative",
              overflow: "hidden",
              height: 100,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            {/* Animated scan line */}
            <style>{`
              @keyframes scanLine {
                0% { top: 10px; opacity: 0.8; }
                50% { opacity: 1; }
                100% { top: 80px; opacity: 0.8; }
              }
            `}</style>
            <div
              ref={scanLineRef}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: 2,
                background:
                  "linear-gradient(90deg, transparent, #06b6d4, transparent)",
                animation: "scanLine 1.8s ease-in-out infinite alternate",
                boxShadow: "0 0 8px #06b6d4",
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                position: "relative",
                zIndex: 1,
              }}
            >
              <UserCheck size={24} color="#06b6d4" />
              <div>
                <div style={{ color: "white", fontWeight: 700, fontSize: 16 }}>
                  Clock-In Terminal
                </div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                  Tap your name or enter Staff ID
                </div>
              </div>
            </div>
          </div>

          {/* PIN Entry */}
          <div
            style={{
              padding: "20px 28px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <label
              htmlFor="pin-input"
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase" as const,
              }}
            >
              Enter Staff ID / PIN
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                id="pin-input"
                data-ocid="clockin.input"
                type="text"
                maxLength={4}
                placeholder="e.g. 0101"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handlePinClockIn()}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  color: "white",
                  fontSize: 20,
                  letterSpacing: 6,
                  fontWeight: 700,
                  outline: "none",
                  textAlign: "center" as const,
                }}
              />
              <button
                type="button"
                data-ocid="clockin.submit_button"
                onClick={handlePinClockIn}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg,#06b6d4,#7c3aed)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  letterSpacing: 0.5,
                }}
              >
                CLOCK IN
              </button>
            </div>
          </div>

          {/* Staff quick-tap list */}
          {staffMembers.length > 0 && (
            <div style={{ padding: "16px 28px 20px" }}>
              <div
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: "uppercase" as const,
                  marginBottom: 10,
                }}
              >
                Quick Tap
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {staffMembers.map((member, i) => (
                  <button
                    key={member.mobile + member.name}
                    type="button"
                    data-ocid={`clockin.item.${i + 1}`}
                    onClick={() => doClockIn(member)}
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 10,
                      padding: "10px 14px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      textAlign: "left" as const,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "rgba(6,182,212,0.15)";
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        "rgba(6,182,212,0.4)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "rgba(255,255,255,0.07)";
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        "rgba(255,255,255,0.1)";
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "linear-gradient(135deg,#06b6d4,#7c3aed)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: 700,
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div
                        style={{
                          color: "white",
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        {member.name}
                      </div>
                      <div
                        style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}
                      >
                        {member.role || "Staff"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {staffMembers.length === 0 && (
            <div
              style={{
                padding: "20px 28px",
                textAlign: "center" as const,
                color: "rgba(255,255,255,0.3)",
                fontSize: 13,
              }}
            >
              No staff members added yet. Use Staff ID / PIN above.
            </div>
          )}
        </div>

        {/* Today's Attendance Log */}
        <div
          data-ocid="clockin.table"
          style={{
            width: "100%",
            maxWidth: 640,
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Users size={16} color="#06b6d4" />
            <span style={{ fontWeight: 700, color: "white", fontSize: 14 }}>
              Today's Attendance Log
            </span>
            <span
              style={{
                marginLeft: "auto",
                background: "rgba(6,182,212,0.15)",
                border: "1px solid rgba(6,182,212,0.3)",
                borderRadius: 12,
                padding: "2px 10px",
                fontSize: 12,
                color: "#06b6d4",
                fontWeight: 600,
              }}
            >
              {todayLog.length} Present
            </span>
          </div>
          {todayLog.length === 0 ? (
            <div
              data-ocid="clockin.empty_state"
              style={{
                padding: 32,
                textAlign: "center" as const,
                color: "rgba(255,255,255,0.3)",
                fontSize: 14,
              }}
            >
              No clock-ins recorded today yet.
            </div>
          ) : (
            <table
              style={{ width: "100%", borderCollapse: "collapse" as const }}
            >
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  {["Name", "Mobile", "Time In", "Status"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 16px",
                        textAlign: "left" as const,
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: 0.5,
                        borderBottom: "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayLog.map((entry, i) => (
                  <tr
                    key={entry.timestamp}
                    data-ocid={`clockin.row.${i + 1}`}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 16px",
                        color: "white",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {entry.staffName}
                    </td>
                    <td
                      style={{
                        padding: "10px 16px",
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 12,
                      }}
                    >
                      {entry.mobile}
                    </td>
                    <td
                      style={{
                        padding: "10px 16px",
                        color: "#06b6d4",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {getTimeStr(entry.timestamp)}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {entry.clockOutTime ? (
                        <div>
                          <span
                            style={{
                              background: "rgba(16,185,129,0.15)",
                              border: "1px solid rgba(16,185,129,0.3)",
                              borderRadius: 20,
                              padding: "2px 10px",
                              fontSize: 11,
                              color: "#10b981",
                              fontWeight: 600,
                              display: "block",
                            }}
                          >
                            ✓ Clocked Out
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: "rgba(255,255,255,0.4)",
                              marginTop: 2,
                              display: "block",
                            }}
                          >
                            {getTimeStr(entry.clockOutTime)}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => doClockOut(entry)}
                          style={{
                            padding: "4px 12px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            background: "rgba(239,68,68,0.15)",
                            color: "#f87171",
                            border: "1px solid rgba(239,68,68,0.3)",
                            cursor: "pointer",
                          }}
                        >
                          Clock Out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

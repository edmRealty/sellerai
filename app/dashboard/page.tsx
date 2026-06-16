"use client";

import React, { useEffect, useState } from "react";

const TASKS = [
  "Install lockbox",
  "Prepare for showings",
  "Yard sign (yes / no)",
  "Offers",
  "Prepare for closing",
  "Walkthrough",
  "Closing day",
  "After closing"
];

const STORAGE_KEY = "seller_ai_listing";
const TASKS_KEY = "seller_ai_tasks";

export default function DashboardPage() {
  const [listing, setListing] = useState<any>(null);
  const [tasks, setTasks] = useState<Record<string, "todo" | "done">>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setListing(JSON.parse(raw));
    const t = localStorage.getItem(TASKS_KEY);
    if (t) setTasks(JSON.parse(t));
  }, []);

  const toggleTask = (task: string) => {
    setTasks((prev) => {
      const next: Record<string, "todo" | "done"> = {
        ...prev,
        [task]: prev[task] === "done" ? "todo" : "done"
      };
      localStorage.setItem(TASKS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const nextTask = TASKS.find((task) => tasks[task] !== "done");

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <h1>Seller Dashboard</h1>
      <p style={{ color: "#64748b" }}>
        {listing?.address || "No active listing"}
      </p>

      <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0", marginTop: 20 }}>
        <h2>Next Task</h2>
        <p style={{ fontWeight: 600 }}>{nextTask || "All tasks complete"}</p>
      </div>

      <div style={{ marginTop: 24, background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
        <h2>Task List</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          {TASKS.map((task) => (
            <label key={task} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" checked={tasks[task] === "done"} onChange={() => toggleTask(task)} />
              <span style={{ textDecoration: tasks[task] === "done" ? "line-through" : "none" }}>{task}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

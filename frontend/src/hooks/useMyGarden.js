import { useCallback, useEffect, useState } from "react";

const KEY = "patchpot.garden.v1";
const TASKS_KEY = "patchpot.tasks.v1";

export function useMyGarden() {
  const [plants, setPlants] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(plants));
  }, [plants]);

  const addPlant = useCallback((plant) => {
    setPlants((prev) =>
      prev.find((p) => p.id === plant.id) ? prev : [...prev, { ...plant, added_at: new Date().toISOString() }]
    );
  }, []);

  const removePlant = useCallback((id) => {
    setPlants((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const has = useCallback((id) => plants.some((p) => p.id === id), [plants]);

  return { plants, addPlant, removePlant, has };
}

export function useCompletedTasks(monthKey) {
  const [completed, setCompleted] = useState(() => {
    try {
      const all = JSON.parse(localStorage.getItem(TASKS_KEY) || "{}");
      return all[monthKey] || {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(TASKS_KEY) || "{}");
      all[monthKey] = completed;
      localStorage.setItem(TASKS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn("useCompletedTasks: persist failed", e);
    }
  }, [completed, monthKey]);

  // refresh state when monthKey changes
  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(TASKS_KEY) || "{}");
      setCompleted(all[monthKey] || {});
    } catch {
      setCompleted({});
    }
  }, [monthKey]);

  const toggle = useCallback((taskId) => {
    setCompleted((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  }, []);

  return { completed, toggle };
}

import { useCallback, useEffect, useState } from "react";

const KEY = "patchpot.masterclass.v1";

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch (e) { console.warn("masterclass-progress: parse failed", e); return {}; }
}

function writeAll(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch (e) { console.warn("masterclass-progress: write failed", e); }
}

export function useMasterclassProgress(slug) {
  const [completed, setCompleted] = useState(() => {
    const all = readAll();
    return all[slug] || {};
  });

  useEffect(() => {
    const all = readAll();
    setCompleted(all[slug] || {});
  }, [slug]);

  useEffect(() => {
    const all = readAll();
    all[slug] = completed;
    writeAll(all);
  }, [slug, completed]);

  const toggle = useCallback((lessonSlug) => {
    setCompleted((prev) => ({ ...prev, [lessonSlug]: !prev[lessonSlug] }));
  }, []);

  const isDone = useCallback((lessonSlug) => !!completed[lessonSlug], [completed]);

  const completedCount = Object.values(completed).filter(Boolean).length;

  return { completed, toggle, isDone, completedCount };
}

export function useAllMasterclassProgress() {
  const [snapshot, setSnapshot] = useState(readAll);
  useEffect(() => {
    const onStorage = () => setSnapshot(readAll());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return snapshot;
}

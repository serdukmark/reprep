import React, { useEffect } from "react";
import { BookOpen } from "lucide-react";
import { labels } from "./api";
export function Badge({ state }: { state: string }) {
  return <span className={"badge " + state}>{labels[state] || state}</span>;
}
export function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <BookOpen size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}

export function mayLeave() {
  return window.dispatchEvent(
    new Event("reprep:navigate", { cancelable: true }),
  );
}
export function useUnsaved(dirty: boolean) {
  useEffect(() => {
    const leave = (e: Event) => {
      if (
        dirty &&
        !confirm("Есть несохранённые изменения. Уйти и потерять их?")
      )
        e.preventDefault();
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("reprep:navigate", leave);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("reprep:navigate", leave);
      window.removeEventListener("beforeunload", unload);
    };
  }, [dirty]);
}

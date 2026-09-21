import { closingConfirmation } from "./max";
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
const dirtyEditors = new Set<symbol>();
const leaveEditor = (e: Event) => {
  if (
    dirtyEditors.size &&
    !confirm("Есть несохранённые изменения. Уйти и потерять их?")
  )
    e.preventDefault();
};
const unloadEditor = (e: BeforeUnloadEvent) => {
  if (dirtyEditors.size) {
    e.preventDefault();
    e.returnValue = "";
  }
};
export function useUnsaved(dirty: boolean) {
  useEffect(() => {
    const id = Symbol();
    if (dirty) dirtyEditors.add(id);
    closingConfirmation(dirtyEditors.size > 0);
    window.addEventListener("reprep:navigate", leaveEditor);
    window.addEventListener("beforeunload", unloadEditor);
    return () => {
      dirtyEditors.delete(id);
      closingConfirmation(dirtyEditors.size > 0);
      if (!dirtyEditors.size) {
        window.removeEventListener("reprep:navigate", leaveEditor);
        window.removeEventListener("beforeunload", unloadEditor);
      }
    };
  }, [dirty]);
}

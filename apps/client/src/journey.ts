import { useEffect, useState } from "react";
import { api } from "./api";

export type Journey = {
  calculated_at: string;
  rules_version: string;
  data_status: "available" | "empty" | "insufficient_data";
  streak: {
    count: number | null;
    eligible_count: number;
    pending_count: number;
    excluded_count: number;
  };
  week: {
    starts_at: string;
    ends_at: string;
    time_zone: string;
    total: number;
    submitted: number;
    on_time: number;
    complete: boolean;
  };
};

export function useJourney(relationship: string) {
  const [state, setState] = useState<{
    relationship: string;
    data: Journey | null;
    error: string;
  }>({ relationship, data: null, error: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const data = await api<Journey>(
          `/relationships/${encodeURIComponent(relationship)}/learning-journey`,
        );
        if (live) setState({ relationship, data, error: "" });
      } catch (e) {
        if (live)
          setState({ relationship, data: null, error: (e as Error).message });
      } finally {
        pending = false;
      }
    };
    setState({ relationship, data: null, error: "" });
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [relationship, retry]);
  return {
    data: state.relationship === relationship ? state.data : null,
    error: state.relationship === relationship ? state.error : "",
    retry: () => setRetry((n) => n + 1),
  };
}

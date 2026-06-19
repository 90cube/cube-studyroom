// Provider: calls useStudyStore() exactly once and shares it via Context.
// Every component must consume useStudy() — never call useStudyStore() directly.

import { createContext, useContext, type ReactNode } from "react";
import { useStudyStore, type StudyStore } from "@/store/useStudyStore";
import { useTopic } from "@/topics/TopicContext";

const StudyContext = createContext<StudyStore | null>(null);

export function StudyStoreProvider({ children }: { children: ReactNode }) {
  const topic = useTopic();
  const store = useStudyStore(topic.curriculum, topic.storageNs);
  return (
    <StudyContext.Provider value={store}>{children}</StudyContext.Provider>
  );
}

/** Access the single shared study store. */
export function useStudy(): StudyStore {
  const ctx = useContext(StudyContext);
  if (!ctx) {
    throw new Error("useStudy must be used within <StudyStoreProvider>");
  }
  return ctx;
}

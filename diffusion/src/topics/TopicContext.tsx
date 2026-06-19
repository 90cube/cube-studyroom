import { createContext, useContext, type ReactNode } from "react";
import type { Topic } from "@/topics/registry";

const TopicContext = createContext<Topic | null>(null);

export function TopicProvider({ topic, children }: { topic: Topic; children: ReactNode }) {
  return <TopicContext.Provider value={topic}>{children}</TopicContext.Provider>;
}

/** The active topic for the current `/:topic/*` route. */
export function useTopic(): Topic {
  const topic = useContext(TopicContext);
  if (!topic) throw new Error("useTopic must be used within a TopicProvider");
  return topic;
}

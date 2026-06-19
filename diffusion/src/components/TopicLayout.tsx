// Layout for /:topic/* routes: resolves the topic from the URL and provides the
// topic context + its scoped study store + the app shell (which renders <Outlet/>).

import { Navigate, useParams } from "react-router-dom";
import { TOPIC_BY_SLUG } from "@/topics/registry";
import { TopicProvider } from "@/topics/TopicContext";
import { StudyStoreProvider } from "@/store/StudyStoreProvider";
import { AppShell } from "@/components/AppShell";

export function TopicLayout() {
  const { topic: slug } = useParams();
  const topic = slug ? TOPIC_BY_SLUG[slug] : undefined;

  if (!topic) return <Navigate to="/" replace />;

  return (
    <TopicProvider topic={topic}>
      <StudyStoreProvider>
        <AppShell />
      </StudyStoreProvider>
    </TopicProvider>
  );
}

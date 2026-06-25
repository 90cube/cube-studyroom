// Entry wiring: route table only. No business logic.

import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "@/pages/HomePage";
import { TopicLayout } from "@/components/TopicLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { PartDetailPage } from "@/pages/PartDetailPage";
import { TimelinePage } from "@/pages/TimelinePage";
import { ReviewPage } from "@/pages/ReviewPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/:topic" element={<TopicLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="part/:slug" element={<PartDetailPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="timeline" element={<TimelinePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

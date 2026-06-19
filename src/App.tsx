// Entry wiring: route table only. No business logic.

import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { DashboardPage } from "@/pages/DashboardPage";
import { PartDetailPage } from "@/pages/PartDetailPage";
import { TimelinePage } from "@/pages/TimelinePage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="part/:slug" element={<PartDetailPage />} />
        <Route path="timeline" element={<TimelinePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

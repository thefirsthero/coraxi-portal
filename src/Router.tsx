import { Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/app-layout";
import { ProtectedRoute } from "./components/protected-route";
import NotMatch from "./pages/NotMatch";
import Portal from "./pages/Portal";
import Sample from "./pages/Sample";
import ComingSoon from "./pages/ComingSoon";
import AdminLogin from "./pages/AdminLogin";
import AdminPortals from "./pages/AdminPortals";

export default function Router() {
  return (
    <Routes>
      <Route path="admin/login" element={<AdminLogin />} />
      <Route element={<AppLayout />}>
        <Route path="" element={<Portal />} />
        <Route
          path="admin/portals"
          element={
            <ProtectedRoute>
              <AdminPortals />
            </ProtectedRoute>
          }
        />
        <Route path="pages">
          <Route path="sample" element={<Sample />} />
          <Route path="feature" element={<ComingSoon />} />
        </Route>
        <Route path="*" element={<NotMatch />} />
      </Route>
    </Routes>
  );
}

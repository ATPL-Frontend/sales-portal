import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { AuthProvider, useAuth } from "../features/auth/AuthProvider";
import { LoginPage } from "../features/auth/LoginPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { ThreeFPricePage } from "../features/prices/ThreeFPricePage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { RolesPage } from "../features/team/RolesPage";
import { UsersPage } from "../features/team/UsersPage";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
      Loading workspace…
    </div>
  );
}

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword && location.pathname !== "/settings")
    return <Navigate to="/settings" replace />;
  return <Outlet />;
}

function RequireSuperAdmin() {
  const { user } = useAuth();
  return user?.isSuperAdmin ? <Outlet /> : <Navigate to="/" replace />;
}

function RequirePriceRead() {
  const { user } = useAuth();
  return user?.isSuperAdmin || user?.permissions.includes("prices:read") ? (
    <Outlet />
  ) : (
    <Navigate to="/" replace />
  );
}

function PublicOnly() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? (
    <Navigate to={user.mustChangePassword ? "/settings" : "/"} replace />
  ) : (
    <Outlet />
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route element={<RequirePriceRead />}>
            <Route path="/price-list/3f" element={<ThreeFPricePage />} />
          </Route>
          <Route element={<RequireSuperAdmin />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/roles" element={<RolesPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

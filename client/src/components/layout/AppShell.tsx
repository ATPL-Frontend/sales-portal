import {
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  ListFilter,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import { Brand } from "../ui/Brand";
import { ScrollToTop } from "../ui/ScrollToTop";
import { ThemeToggle } from "../ui/ThemeToggle";

type NavItem = { to: string; label: string; icon: LucideIcon };
const commonLinks: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutGrid },
];
const adminLinks: NavItem[] = [
  { to: "/users", label: "Team members", icon: Users },
  { to: "/roles", label: "Roles & access", icon: Shield },
];
const pageNames: Record<string, string> = {
  "/price-list/3f": "3F Cable Prices",
  "/": "Overview",
  "/users": "Team members",
  "/roles": "Roles & access",
  "/settings": "Settings",
};

function NavItemLink({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate: () => void;
}) {
  // const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex min-h-10 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors ${isActive ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`
      }
    >
      {/* <Icon size={18} strokeWidth={1.8} /> */}
      {item.label}
    </NavLink>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(
    pathname.startsWith("/price-list"),
  );
  const hasPriceAccess = Boolean(
    user?.isSuperAdmin || user?.permissions.includes("prices:read"),
  );
  const closeMenu = () => setMobileOpen(false);

  async function signOut() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          onClick={closeMenu}
          className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white px-2 py-4 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-2 pb-8">
          <Brand />
          <button
            type="button"
            onClick={closeMenu}
            aria-label="Close menu"
            className="rounded-lg p-2 text-slate-500 lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        <nav aria-label="Main navigation" className="flex-1 space-y-6">
          <div className="space-y-1">
            <div className="mb-3 px-3.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Workspace
            </div>
            {commonLinks.map((item) => (
              <NavItemLink key={item.to} item={item} onNavigate={closeMenu} />
            ))}
            {hasPriceAccess && (
              <div>
                <button
                  type="button"
                  aria-expanded={priceOpen}
                  onClick={() => setPriceOpen((open) => !open)}
                  className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${pathname.startsWith("/price-list") ? "text-slate-900" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}
                >
                  <ListFilter size={18} strokeWidth={1.8} />
                  <span className="flex-1 text-left">Price List</span>
                  <ChevronDown
                    size={15}
                    className={`transition-transform ${priceOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {priceOpen && (
                  <div className="mt-1 space-y-1 pl-5">
                    <NavItemLink
                      item={{
                        to: "/price-list/3f",
                        label: "3F Holdings",
                        icon: ChevronRight,
                      }}
                      onNavigate={closeMenu}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          {user?.isSuperAdmin && (
            <div className="space-y-1">
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Administration
              </div>
              {adminLinks.map((item) => (
                <NavItemLink key={item.to} item={item} onNavigate={closeMenu} />
              ))}
            </div>
          )}
        </nav>

        <div className="space-y-1 border-t border-slate-100 pt-4">
          <NavItemLink
            item={{ to: "/settings", label: "Settings", icon: Settings }}
            onNavigate={closeMenu}
          />
          <button
            onClick={() => void signOut()}
            className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut size={18} strokeWidth={1.8} /> Sign out
          </button>
          <div className="flex items-center gap-3 px-3 pt-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
              {user?.fullName?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-slate-800">
                {user?.fullName}
              </div>
              <div className="truncate text-[11px] text-slate-400">
                {user?.email}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-200/70 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="-ml-2 rounded-lg p-2 text-slate-600 lg:hidden"
            >
              <Menu size={21} />
            </button>
            <span className="hidden sm:inline">Workspace</span>
            <ChevronRight size={15} className="hidden sm:inline" />
            <span className="font-medium text-slate-800">
              {pageNames[pathname] || "Workspace"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
            <ThemeToggle />
          </div>
        </header>
        <main className="w-full max-w-7xl flex-1 self-center p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      <ScrollToTop />
    </div>
  );
}

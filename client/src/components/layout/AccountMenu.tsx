import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../features/auth/AuthProvider";
import { UserAvatar } from "../ui/UserAvatar";

export function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on route changes.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;

    function handleClick(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);

    try {
      await logout();
    } catch {
      // AuthProvider clears the local session.
    }

    navigate("/login", { replace: true });
  }

  const name = user?.fullName || "My Account";

  return (
    <div ref={menuRef} className="relative">
      {/* Account button */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="
          flex h-11 items-center gap-2
          rounded-xl px-1.5
          transition-colors
          hover:bg-slate-100
          lg:px-3
        "
      >
        <UserAvatar name={name} imageUrl={user?.avatarUrl} />

        <span
          className="
            hidden max-w-36 truncate text-sm
            font-medium text-slate-800 lg:block
          "
        >
          {name}
        </span>

        <ChevronDown
          size={16}
          className={`
            hidden text-slate-500
            transition-transform lg:block
            ${open ? "rotate-180" : ""}
          `}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="
            absolute right-0 top-full z-50
            mt-2 w-64 overflow-hidden
            rounded-2xl border border-slate-200
            bg-white p-2 shadow-xl
            shadow-black/10
          "
        >
          {/* Account information */}
          <div className="flex items-center gap-3 px-3 py-3">
            <UserAvatar name={name} imageUrl={user?.avatarUrl} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {name}
              </p>

              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>

          <div className="my-2 border-t border-slate-100" />

          <Link
            to="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="
              flex items-center gap-3
              rounded-xl px-3 py-2.5
              text-sm text-slate-700
              transition-colors
              hover:bg-slate-100
            "
          >
            <UserRound size={17} />
            Profile
          </Link>

          <Link
            to="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="
              flex items-center gap-3
              rounded-xl px-3 py-2.5
              text-sm text-slate-700
              transition-colors
              hover:bg-slate-100
            "
          >
            <Settings size={17} />
            Settings
          </Link>

          <div className="my-2 border-t border-slate-100" />

          <button
            type="button"
            role="menuitem"
            onClick={() => void handleSignOut()}
            className="
              flex w-full items-center gap-3
              rounded-xl px-3 py-2.5
              text-left text-sm
              text-red-600
              transition-colors
              hover:bg-red-50
            "
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

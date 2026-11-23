import { PageHeader } from "../../components/ui/PageHeader";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { useAuth } from "../auth/AuthProvider";

export function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div>
      <PageHeader
        title="My Profile"
        description="View your account information."
      />

      <div
        className="
          max-w-2xl rounded-2xl
          border border-slate-200 bg-white
          p-6 sm:p-8
        "
      >
        <div className="flex items-center gap-4">
          <UserAvatar
            name={user.fullName}
            imageUrl={user.avatarUrl}
            size="lg"
          />

          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900">
              {user.fullName}
            </h2>

            <p className="truncate text-sm text-slate-500">{user.email}</p>
          </div>
        </div>

        <div className="mt-8 divide-y divide-slate-100">
          <div className="py-4">
            <p className="text-xs text-slate-500">Full name</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {user.fullName}
            </p>
          </div>

          <div className="py-4">
            <p className="text-xs text-slate-500">Email address</p>
            <p className="mt-1 break-all text-sm font-medium text-slate-900">
              {user.email}
            </p>
          </div>

          <div className="py-4">
            <p className="text-xs text-slate-500">Assigned roles</p>
            <p className="mt-1 text-sm font-medium capitalize text-slate-900">
              {user.roles.map((role) => role.replaceAll("_", " ")).join(", ") ||
                "Not assigned"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

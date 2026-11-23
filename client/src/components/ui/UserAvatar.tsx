type UserAvatarProps = {
  name?: string;
  imageUrl?: string | null;
  size?: "sm" | "lg";
};

export function UserAvatar({
  name = "Account",
  imageUrl,
  size = "sm",
}: UserAvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const sizeClass = size === "lg" ? "h-20 w-20 text-xl" : "h-9 w-9 text-xs";

  return (
    <div
      className={`flex shrink-0 items-center justify-center
        overflow-hidden rounded-full
        bg-slate-200 text-slate-800
        font-semibold ${sizeClass}`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className="h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        initials || "A"
      )}
    </div>
  );
}

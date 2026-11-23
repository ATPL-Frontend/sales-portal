import bcrypt from "bcryptjs";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "../config/db.js";
import { env } from "../config/env.js";
import { authenticate } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { getByEmail, getUser, publicUser } from "../services/users.js";
import { HttpError } from "../utils/errors.js";
export const authRouter = Router();
const secureCookie = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." },
});
authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = z
    .object({ email: z.string().email(), password: z.string().min(1) })
    .parse(req.body);
  const user = await getByEmail(email.toLowerCase().trim());
  if (
    !user ||
    !user.is_active ||
    !(await bcrypt.compare(password, user.password_hash))
  )
    throw new HttpError(401, "Incorrect email or password");
  const token = jwt.sign({}, env.JWT_SECRET, {
    subject: String(user.id),
    expiresIn: "8h",
    algorithm: "HS256",
  });
  res.cookie("access_token", token, {
    ...secureCookie,
    maxAge: 8 * 60 * 60 * 1000,
  });
  await audit(user.id, "auth.login");
  res.json({ user: await publicUser(user) });
});
authRouter.post("/logout", (_req, res) => {
  res.clearCookie("access_token", secureCookie);
  res.json({ message: "Signed out" });
});
authRouter.get("/me", authenticate, async (req, res) => {
  res.json({ user: await publicUser(req.authUser!) });
});
// The authenticated user can update their own display name.
authRouter.patch("/profile", authenticate, async (req, res) => {
  const { fullName } = z
    .object({
      fullName: z.string().trim().min(2).max(140),
    })
    .parse(req.body);

  await db.execute("UPDATE users SET full_name=? WHERE id=?", [
    fullName,
    req.authUser!.id,
  ]);
  await audit(
    req.authUser!.id,
    "user.profile_updated",
    "user",
    String(req.authUser!.id),
    {
      fields: ["fullName"],
    },
  );
  const user = await getUser(req.authUser!.id);
  if (!user) throw new HttpError(404, "Account not found");
  res.json({ message: "Name updated", user: await publicUser(user) });
});
authRouter.post("/change-password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    })
    .parse(req.body);
  if (!(await bcrypt.compare(currentPassword, req.authUser!.password_hash)))
    throw new HttpError(400, "Current password is incorrect");
  if (currentPassword === newPassword)
    throw new HttpError(400, "Use a different password");
  await db.execute(
    "UPDATE users SET password_hash=?, must_change_password=FALSE WHERE id=?",
    [await bcrypt.hash(newPassword, 12), req.authUser!.id],
  );
  await audit(req.authUser!.id, "auth.password_changed");
  res.json({ message: "Password updated successfully" });
});

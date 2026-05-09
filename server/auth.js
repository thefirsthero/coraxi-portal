import jwt from "jsonwebtoken";

const COOKIE_NAME = "coraxi_portal_auth";
const DEFAULT_EXPIRES_IN = "7d";

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return secret;
}

export function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
  });
}

export function getAuthCookieName() {
  return COOKIE_NAME;
}

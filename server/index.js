import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { clearAuthCookie, getAuthCookieName, setAuthCookie, signToken, verifyToken } from "./auth.js";
import { pool, query } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(cookieParser());

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

const createUpdateTimestampFunctionSql = `
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';
`;

const createPortalSitesTableSql = `
CREATE TABLE IF NOT EXISTS public.portal_sites (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL UNIQUE,
  image TEXT NOT NULL DEFAULT '/images/default-app.svg',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

const createPortalSitesIndexesSql = `
CREATE INDEX IF NOT EXISTS idx_portal_sites_is_active ON public.portal_sites(is_active);
CREATE INDEX IF NOT EXISTS idx_portal_sites_sort_order ON public.portal_sites(sort_order);
`;

const createPortalSitesTriggerSql = `
DROP TRIGGER IF EXISTS update_portal_sites_updated_at ON public.portal_sites;
CREATE TRIGGER update_portal_sites_updated_at
BEFORE UPDATE ON public.portal_sites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
`;

async function ensureSchema() {
  await query(createUpdateTimestampFunctionSql);
  await query(createPortalSitesTableSql);
  await query(createPortalSitesIndexesSql);
  await query(createPortalSitesTriggerSql);
}

function getAuthUser(req) {
  const token = req.cookies?.[getAuthCookieName()];

  if (!token) {
    return null;
  }

  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getAuthUser(req);

  if (!user || !user.userId || !user.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.user = user;
  next();
}

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const userResult = await query(
      `
      SELECT id, email, password_hash
      FROM public.users
      WHERE lower(email) = lower($1)
      LIMIT 1
      `,
      [email],
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
    });

    setAuthCookie(res, token);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const user = getAuthUser(req);

  if (!user || !user.userId || !user.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.json({
    user: {
      id: user.userId,
      email: user.email,
    },
  });
});

app.get("/api/portals", async (_req, res) => {
  try {
    const result = await query(
      `
      SELECT id, title, description, href, image
      FROM public.portal_sites
      WHERE is_active = true
      ORDER BY sort_order ASC, id ASC
      `,
    );
    return res.json({ portals: result.rows });
  } catch (err) {
    console.error("GET /api/portals error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/admin/portals", requireAuth, async (_req, res) => {
  try {
    const result = await query(
      `
      SELECT id, title, description, href, image, is_active, sort_order, created_at, updated_at
      FROM public.portal_sites
      ORDER BY sort_order ASC, id ASC
      `,
    );
    return res.json({ portals: result.rows });
  } catch (err) {
    console.error("GET /api/admin/portals error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/admin/portals", requireAuth, async (req, res) => {
  try {
    const { title, description, href, image, is_active, sort_order } = req.body ?? {};

    if (!title || !href) {
      return res.status(400).json({ error: "Title and href are required" });
    }

    const result = await query(
      `
      INSERT INTO public.portal_sites (title, description, href, image, is_active, sort_order, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, title, description, href, image, is_active, sort_order, created_at, updated_at
      `,
      [
        title,
        description ?? "",
        href,
        image ?? "/images/default-app.svg",
        Boolean(is_active ?? true),
        Number.isInteger(sort_order) ? sort_order : 0,
        req.user.userId,
      ],
    );

    return res.status(201).json({ portal: result.rows[0] });
  } catch (err) {
    console.error("POST /api/admin/portals error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/admin/portals/:id", requireAuth, async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const { title, description, href, image, is_active, sort_order } = req.body ?? {};

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    if (!title || !href) {
      return res.status(400).json({ error: "Title and href are required" });
    }

    const result = await query(
      `
      UPDATE public.portal_sites
      SET title = $1,
          description = $2,
          href = $3,
          image = $4,
          is_active = $5,
          sort_order = $6
      WHERE id = $7
      RETURNING id, title, description, href, image, is_active, sort_order, created_at, updated_at
      `,
      [
        title,
        description ?? "",
        href,
        image ?? "/images/default-app.svg",
        Boolean(is_active ?? true),
        Number.isInteger(sort_order) ? sort_order : 0,
        id,
      ],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Portal entry not found" });
    }

    return res.json({ portal: result.rows[0] });
  } catch (err) {
    console.error("PUT /api/admin/portals/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/admin/portals/:id", requireAuth, async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const result = await query(
      `
      DELETE FROM public.portal_sites
      WHERE id = $1
      `,
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Portal entry not found" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/portals/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(__dirname, "../dist");
  app.use(express.static(distPath));
  app.get("*path", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Unhandled Express error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number.parseInt(process.env.PORT || "8787", 10);

async function startServer() {
  try {
    await ensureSchema();
    app.listen(port, () => {
      console.log(`API server listening on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to initialize database schema:", err);
    process.exit(1);
  }
}

startServer();

process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});

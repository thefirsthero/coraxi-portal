import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import multer from "multer";
import { clearAuthCookie, getAuthCookieName, setAuthCookie, signToken, verifyToken } from "./auth.js";
import { pool, query } from "./db.js";
import { defaultPortals, resolvePortalImage } from "./portal-seed.js";

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

const createPortalImageColumnsSql = `
ALTER TABLE public.portal_sites
  ADD COLUMN IF NOT EXISTS image_data BYTEA,
  ADD COLUMN IF NOT EXISTS image_mime_type TEXT;
`;

const createPortalSitesTriggerSql = `
DROP TRIGGER IF EXISTS update_portal_sites_updated_at ON public.portal_sites;
CREATE TRIGGER update_portal_sites_updated_at
BEFORE UPDATE ON public.portal_sites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
`;

const imageMimeByExtension = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function ensurePortalSeedData() {
  for (let i = 0; i < defaultPortals.length; i += 1) {
    const item = defaultPortals[i];
    const image = item.image ?? resolvePortalImage(item.image, item.href);
    await query(
      `
      INSERT INTO public.portal_sites (title, description, href, image, is_active, sort_order, created_by)
      VALUES ($1, $2, $3, $4, true, $5, NULL)
      ON CONFLICT (href)
      DO UPDATE
      SET title = EXCLUDED.title,
          description = EXCLUDED.description,
          image = EXCLUDED.image,
          is_active = true,
          sort_order = EXCLUDED.sort_order
      `,
      [item.title, item.description, item.href, image, i],
    );
  }
}

function getLocalImageRelativePath(imageValue) {
  if (typeof imageValue !== "string") {
    return null;
  }

  const trimmed = imageValue.trim();

  if (!trimmed || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return null;
  }

  const normalized = trimmed.replace(/^\/+/, "");

  if (normalized.includes("..")) {
    return null;
  }

  if (!(normalized.startsWith("images/") || normalized.startsWith("avatars/"))) {
    return null;
  }

  return normalized;
}

async function readFirstExistingFile(candidates) {
  for (const candidate of candidates) {
    try {
      const content = await fs.readFile(candidate);
      return { content, path: candidate };
    } catch {
      // Ignore missing files and continue.
    }
  }

  return null;
}

function resolveMimeTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return imageMimeByExtension[ext] ?? "application/octet-stream";
}

async function ensureUploadedImagesFromRepoAssets() {
  const result = await query(
    `
    SELECT id, image
    FROM public.portal_sites
    WHERE image_data IS NULL
    `,
  );

  let importedCount = 0;

  for (const row of result.rows) {
    const relativeImagePath = getLocalImageRelativePath(row.image);

    if (!relativeImagePath) {
      continue;
    }

    const candidates = [
      path.resolve(__dirname, "../public", relativeImagePath),
      path.resolve(__dirname, "../dist", relativeImagePath),
    ];

    const match = await readFirstExistingFile(candidates);

    if (!match) {
      continue;
    }

    await query(
      `
      UPDATE public.portal_sites
      SET image_data = $1,
          image_mime_type = $2
      WHERE id = $3
      `,
      [match.content, resolveMimeTypeFromPath(match.path), row.id],
    );

    importedCount += 1;
  }

  if (importedCount > 0) {
    console.log(`Imported ${importedCount} portal images from local assets into DB.`);
  }
}

async function ensureSchema() {
  await query(createUpdateTimestampFunctionSql);
  await query(createPortalSitesTableSql);
  await query(createPortalSitesIndexesSql);
  await query(createPortalImageColumnsSql);
  await query(createPortalSitesTriggerSql);
  await ensurePortalSeedData();
  await ensureUploadedImagesFromRepoAssets();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }

    cb(null, true);
  },
});

function parseBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return defaultValue;
}

function parseInteger(value, defaultValue = 0) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return defaultValue;
}

function mapPortalRow(row) {
  const hasUploadedImage = Boolean(row.has_uploaded_image);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    href: row.href,
    image: hasUploadedImage ? `/api/portals/${row.id}/image` : row.image,
    has_uploaded_image: hasUploadedImage,
    is_active: row.is_active,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
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

app.get("/api/portals/:id/image", async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const result = await query(
      `
      SELECT image_data, image_mime_type
      FROM public.portal_sites
      WHERE id = $1 AND is_active = true
      LIMIT 1
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row || !row.image_data) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.setHeader("Content-Type", row.image_mime_type || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(row.image_data);
  } catch (err) {
    console.error("GET /api/portals/:id/image error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/portals", async (_req, res) => {
  try {
    const result = await query(
      `
      SELECT id, title, description, href, image, is_active, sort_order, created_at, updated_at,
             (image_data IS NOT NULL) AS has_uploaded_image
      FROM public.portal_sites
      WHERE is_active = true
      ORDER BY sort_order ASC, id ASC
      `,
    );
    return res.json({ portals: result.rows.map(mapPortalRow) });
  } catch (err) {
    console.error("GET /api/portals error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/admin/portals", requireAuth, async (_req, res) => {
  try {
    const result = await query(
      `
      SELECT id, title, description, href, image, is_active, sort_order, created_at, updated_at,
             (image_data IS NOT NULL) AS has_uploaded_image
      FROM public.portal_sites
      ORDER BY sort_order ASC, id ASC
      `,
    );
    return res.json({ portals: result.rows.map(mapPortalRow) });
  } catch (err) {
    console.error("GET /api/admin/portals error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/admin/portals", requireAuth, upload.single("imageFile"), async (req, res) => {
  try {
    const { title, description, href, image, is_active, sort_order } = req.body ?? {};
    const imageFile = req.file;

    if (!title || !href) {
      return res.status(400).json({ error: "Title and href are required" });
    }

    const resolvedImage = resolvePortalImage(image, href);
    const hasUploadedImage = Boolean(imageFile?.buffer);

    const result = await query(
      `
      INSERT INTO public.portal_sites
        (title, description, href, image, image_data, image_mime_type, is_active, sort_order, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, title, description, href, image, is_active, sort_order, created_at, updated_at,
                (image_data IS NOT NULL) AS has_uploaded_image
      `,
      [
        title,
        description ?? "",
        href,
        resolvedImage,
        hasUploadedImage ? imageFile.buffer : null,
        hasUploadedImage ? imageFile.mimetype : null,
        parseBoolean(is_active, true),
        parseInteger(sort_order, 0),
        req.user.userId,
      ],
    );

    return res.status(201).json({ portal: mapPortalRow(result.rows[0]) });
  } catch (err) {
    console.error("POST /api/admin/portals error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/admin/portals/:id", requireAuth, upload.single("imageFile"), async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const { title, description, href, image, is_active, sort_order } = req.body ?? {};
    const imageFile = req.file;

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    if (!title || !href) {
      return res.status(400).json({ error: "Title and href are required" });
    }

    const resolvedImage = resolvePortalImage(image, href);
    const hasNewUploadedImage = Boolean(imageFile?.buffer);

    const result = await query(
      `
      UPDATE public.portal_sites
      SET title = $1,
          description = $2,
          href = $3,
          image = $4,
          image_data = CASE WHEN $8 THEN $5 ELSE image_data END,
          image_mime_type = CASE WHEN $8 THEN $6 ELSE image_mime_type END,
          is_active = $9,
          sort_order = $10
      WHERE id = $7
      RETURNING id, title, description, href, image, is_active, sort_order, created_at, updated_at,
                (image_data IS NOT NULL) AS has_uploaded_image
      `,
      [
        title,
        description ?? "",
        href,
        resolvedImage,
        hasNewUploadedImage ? imageFile.buffer : null,
        hasNewUploadedImage ? imageFile.mimetype : null,
        id,
        hasNewUploadedImage,
        parseBoolean(is_active, true),
        parseInteger(sort_order, 0),
      ],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Portal entry not found" });
    }

    return res.json({ portal: mapPortalRow(result.rows[0]) });
  } catch (err) {
    console.error("PUT /api/admin/portals/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/admin/portals/:id/image", requireAuth, async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const existing = await query(
      `
      SELECT href
      FROM public.portal_sites
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({ error: "Portal entry not found" });
    }

    const fallbackImage = resolvePortalImage(null, existing.rows[0].href);

    const result = await query(
      `
      UPDATE public.portal_sites
      SET image_data = NULL,
          image_mime_type = NULL,
          image = $2
      WHERE id = $1
      RETURNING id, title, description, href, image, is_active, sort_order, created_at, updated_at,
                (image_data IS NOT NULL) AS has_uploaded_image
      `,
      [id, fallbackImage],
    );

    return res.json({ portal: mapPortalRow(result.rows[0]) });
  } catch (err) {
    console.error("DELETE /api/admin/portals/:id/image error:", err);
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
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Image file is too large (max 5MB)" });
  }

  if (err?.message === "Only image files are allowed") {
    return res.status(400).json({ error: err.message });
  }

  console.error("Unhandled Express error:", err);
  return res.status(500).json({ error: "Internal server error" });
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

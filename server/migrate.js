import { query, pool } from "./db.js";

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

const createIndexesSql = `
CREATE INDEX IF NOT EXISTS idx_portal_sites_is_active ON public.portal_sites(is_active);
CREATE INDEX IF NOT EXISTS idx_portal_sites_sort_order ON public.portal_sites(sort_order);
`;

const createTriggerSql = `
DROP TRIGGER IF EXISTS update_portal_sites_updated_at ON public.portal_sites;
CREATE TRIGGER update_portal_sites_updated_at
BEFORE UPDATE ON public.portal_sites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
`;

async function runMigration() {
  await query(createUpdateTimestampFunctionSql);
  await query(createPortalSitesTableSql);
  await query(createIndexesSql);
  await query(createTriggerSql);

  console.log("Migration completed");
}

runMigration()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

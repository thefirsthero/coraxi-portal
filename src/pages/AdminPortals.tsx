import { FormEvent, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

type PortalItem = {
  id: number;
  title: string;
  description: string;
  href: string;
  image: string;
  has_uploaded_image: boolean;
  is_active: boolean;
  sort_order: number;
};

type PortalPayload = {
  title: string;
  description: string;
  href: string;
  is_active: boolean;
  sort_order: number;
};

const emptyForm: PortalPayload = {
  title: "",
  description: "",
  href: "",
  is_active: true,
  sort_order: 0,
};

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data?.error || "Request failed";
  } catch {
    return "Request failed";
  }
}

export default function AdminPortals() {
  const { logout, user } = useAuth();

  const [items, setItems] = useState<PortalItem[]>([]);
  const [form, setForm] = useState<PortalPayload>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageInputKey, setImageInputKey] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editingItem = editingId ? items.find((item) => item.id === editingId) ?? null : null;

  async function loadPortals() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/portals", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const data = await response.json();
      setItems(data.portals ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPortals();
  }, []);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setImageInputKey((prev) => prev + 1);
  }

  function startEdit(item: PortalItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description,
      href: item.href,
      is_active: item.is_active,
      sort_order: item.sort_order,
    });
    setImageFile(null);
    setImageInputKey((prev) => prev + 1);
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingId ? `/api/admin/portals/${editingId}` : "/api/admin/portals";
      const method = editingId ? "PUT" : "POST";

      const payload = new FormData();
      payload.append("title", form.title);
      payload.append("description", form.description);
      payload.append("href", form.href);
      payload.append("is_active", String(form.is_active));
      payload.append("sort_order", String(form.sort_order));

      if (imageFile) {
        payload.append("imageFile", imageFile);
      }

      const response = await fetch(url, {
        method,
        credentials: "include",
        body: payload,
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      await loadPortals();
      startCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save portal");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number) {
    const confirmed = window.confirm("Delete this portal entry?");
    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/admin/portals/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      await loadPortals();
      if (editingId === id) {
        startCreate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete portal");
    }
  }

  async function onRemoveUploadedImage() {
    if (!editingId) {
      return;
    }

    const confirmed = window.confirm("Remove uploaded image and switch back to favicon?");
    if (!confirmed) {
      return;
    }

    setRemovingImage(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/portals/${editingId}/image`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      await loadPortals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove image");
    } finally {
      setRemovingImage(false);
    }
  }

  async function onLogout() {
    await logout();
    window.location.assign("/admin/login");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin Portal Manager</h1>
          <p className="text-sm text-muted-foreground">
            Logged in as {user?.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={startCreate}>
            New Entry
          </Button>
          <Button variant="outline" onClick={onLogout}>
            Log out
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form onSubmit={onSave} className="grid grid-cols-1 gap-3 rounded-lg border p-4 md:grid-cols-2">
        <div className="space-y-1 md:col-span-1">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-1 md:col-span-1">
          <label htmlFor="href" className="text-sm font-medium">
            URL (href)
          </label>
          <Input
            id="href"
            value={form.href}
            onChange={(e) => setForm((prev) => ({ ...prev, href: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-1 md:col-span-1">
          {editingItem ? (
            <div className="mb-2 rounded-md border bg-muted/20 p-2">
              <p className="text-xs font-medium">
                Current image: {editingItem.has_uploaded_image ? "Uploaded to DB" : "External/fallback"}
              </p>
              <img
                src={editingItem.image}
                alt={`${editingItem.title} preview`}
                className="mt-2 h-12 w-12 rounded object-cover"
              />
            </div>
          ) : null}

          <label htmlFor="imageFile" className="text-sm font-medium">
            Replace Image (optional)
          </label>
          <Input
            key={imageInputKey}
            id="imageFile"
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to use the website favicon automatically.
          </p>

          {editingItem?.has_uploaded_image ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onRemoveUploadedImage}
              disabled={removingImage}
              className="mt-2"
            >
              {removingImage ? "Removing..." : "Remove Uploaded Image"}
            </Button>
          ) : null}
        </div>

        <div className="space-y-1 md:col-span-1">
          <label htmlFor="sortOrder" className="text-sm font-medium">
            Sort Order
          </label>
          <Input
            id="sortOrder"
            type="number"
            value={form.sort_order}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                sort_order: Number.parseInt(e.target.value || "0", 10),
              }))
            }
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <Input
            id="description"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
          />
          Active (visible on public portal)
        </label>

        <div className="md:col-span-2 flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Entry" : "Create Entry"}
          </Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={startCreate}>
              Cancel Edit
            </Button>
          ) : null}
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left">
              <th className="p-3">Title</th>
              <th className="p-3">URL</th>
              <th className="p-3">Order</th>
              <th className="p-3">Active</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={5}>
                  Loading entries...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={5}>
                  No portal entries yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="p-3">{item.title}</td>
                  <td className="p-3 max-w-[280px] truncate">{item.href}</td>
                  <td className="p-3">{item.sort_order}</td>
                  <td className="p-3">{item.is_active ? "Yes" : "No"}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => startEdit(item)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(item.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

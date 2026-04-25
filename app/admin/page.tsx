"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Phone } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type PostItem = {
  id: number;
  item_type: "lost" | "found";
  message: string;
  location: string;
  contact: string;
  user_id: string;
  resolved: boolean;
  created_at: string;
};

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "admin@example.com";

const AdminPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");
  const [status, setStatus] = useState("");

  const isEmailAdmin = (email?: string | null) => {
    return Boolean(email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  };

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setStatus("Unable to load posts.");
      return;
    }

    setPosts((data as PostItem[]) ?? []);
  };

  const formatLocation = (location: string) => {
    return location
      .trim()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentUser = session?.user ?? null;
      const admin = isEmailAdmin(currentUser?.email);
      setUser(currentUser);
      setIsAdmin(admin);

      if (admin) {
        await fetchPosts();
      }

      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      const admin = isEmailAdmin(currentUser?.email);
      setUser(currentUser);
      setIsAdmin(admin);

      if (admin) {
        fetchPosts();
      } else {
        setPosts([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatus("Failed to log out.");
      return;
    }

    router.push("/");
  };

  const handleDelete = async (postId: number) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) {
      setStatus("Failed to delete post.");
      return;
    }

    setPosts((current) => current.filter((post) => post.id !== postId));
    setStatus("Post deleted.");
  };

  const handleResolve = async (postId: number) => {
    const { error } = await supabase.from("posts").update({ resolved: true }).eq("id", postId);
    if (error) {
      setStatus("Failed to mark as resolved.");
      return;
    }

    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, resolved: true } : post))
    );
    setStatus("Post marked as resolved.");
  };

  useEffect(() => {
    if (!status) return;

    const timeout = window.setTimeout(() => {
      setStatus("");
    }, 4000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [status]);

  const filteredPosts = posts.filter((post) => {
    if (filter === "active") return !post.resolved;
    if (filter === "resolved") return post.resolved;
    return true;
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="rounded-4xl bg-gray-100 p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-600">Checking admin access...</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="rounded-4xl bg-gray-100 p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-medium text-slate-950">Not Authorized</h1>
          <p className="mt-3 text-sm text-slate-600">You do not have permission to view this page.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-12">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <section className="rounded-4xl bg-gray-100 p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Admin Dashboard</p>
              <h1 className="mt-2 text-2xl font-medium text-slate-950">Manage all posts</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-3xl bg-gray-100 px-4 py-3 text-sm font-medium text-slate-700">
                Total posts: {posts.length}
              </div>
              <button
                onClick={handleLogout}
                className="rounded-3xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-200 cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            View every submission, including resolved items. Admins can delete posts or mark them resolved.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {(["all", "active", "resolved"] as const).map((option) => {
              const label = option === "all" ? "All Posts" : option === "active" ? "Active Posts" : "Resolved Posts";
              return (
                <button
                  key={option}
                  onClick={() => setFilter(option)}
                  className={`rounded-3xl px-4 py-2 text-sm font-semibold transition ${
                    filter === option
                      ? "bg-slate-950 text-white"
                      : "bg-gray-100 text-slate-700 hover:bg-gray-200"
                  } cursor-pointer`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {status && (
          <div className="rounded-3xl bg-gray-100 px-4 py-3 text-sm text-slate-700 shadow-sm">
            {status}
          </div>
        )}

        <section className="space-y-4">
          {filteredPosts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-gray-100 p-6 text-sm text-slate-500 shadow-sm">
              No posts match this filter.
            </div>
          ) : (
            filteredPosts.map((post) => (
              <article
                key={post.id}
                className={`rounded-3xl border border-slate-200 bg-gray-100 p-6 shadow-sm transition hover:shadow-md ${
                  post.resolved ? "opacity-70 bg-gray-50" : ""
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                          post.item_type === "lost"
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {post.item_type === "lost" ? "LOST" : "FOUND"}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          post.resolved ? "bg-green-100 text-green-700" : "bg-gray-100 text-slate-700"
                        }`}
                      >
                        {post.resolved ? "Resolved" : "Active"}
                      </span>
                    </div>
                    <p className="text-base font-medium text-slate-950">{post.message}</p>
                    <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <span className="inline-flex items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2">
                        <MapPin className="h-4 w-4 text-gray-500" aria-hidden="true" />
                        <span>{formatLocation(post.location)}</span>
                      </span>
                      <a
                        href={`tel:${post.contact}`}
                        className="inline-flex items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2 text-blue-700 transition hover:bg-gray-100 cursor-pointer"
                      >
                        <Phone className="h-4 w-4 text-gray-500" aria-hidden="true" />
                        <span>{post.contact}</span>
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:items-end">
                    <span className="text-sm text-slate-500">Post ID {post.id}</span>
                    <div className="flex flex-wrap gap-2">
                      {!post.resolved && (
                        <button
                          onClick={() => handleResolve(post.id)}
                          className="rounded-3xl bg-green-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-400 cursor-pointer"
                        >
                          Mark as Resolved
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="rounded-3xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
};

export default AdminPage;

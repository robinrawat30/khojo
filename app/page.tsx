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
  image_url?: string;
};

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase() ?? "admin@example.com";

const page = () => {
  const router = useRouter();
  const [view, setView] = useState<"home" | "lost" | "found">("home");
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const timeAgo = (dateString: string) => {
    const now = new Date();
    const postDate = new Date(dateString);
    const diffInMs = now.getTime() - postDate.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? "" : "s"} ago`;
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;
    return `${diffInDays} day${diffInDays === 1 ? "" : "s"} ago`;
  };

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel("posts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          setPosts((current) => [payload.new as PostItem, ...current]);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const isAdminUser = (email?: string | null) => {
    return Boolean(email && email.toLowerCase() === ADMIN_EMAIL);
  };

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser && isAdminUser(currentUser.email)) {
        router.push("/admin");
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser && isAdminUser(currentUser.email)) {
          router.push("/admin");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router]);

  async function fetchPosts() {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (error.message?.includes("could not find the table 'public.posts'")) {
        setStatus(
          "Supabase table not found. Create a `posts` table in your Supabase project and reload the app."
        );
      } else {
        setStatus("Unable to load the feed.");
      }
      return;
    }

    setPosts((data as PostItem[]) ?? []);
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim() || !location.trim() || !contact.trim()) {
      setStatus("Tell us what happened, where it happened, and how to contact you.");
      return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setStatus("You must be logged in to create a post.");
      return;
    }

    setLoading(true);

    let imageUrl: string | null = null;
    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
      if (!imageUrl) {
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase.from("posts").insert([
      {
        item_type: view,
        message: message.trim(),
        location: location.trim(),
        contact: contact.trim(),
        user_id: user.id,
        resolved: false,
        image_url: imageUrl,
      },
    ]);

    if (error) {
      if (error.message?.includes("could not find the table 'public.posts'")) {
        setStatus(
          "Supabase table not found. Create a `posts` table in your Supabase project before posting."
        );
      } else {
        setStatus(error.message || "Unable to publish the post.");
      }
    } else {
      setStatus(`${view === "lost" ? "Lost" : "Found"} post published.`);
      setMessage("");
      setLocation("");
      setContact("");
      setImageFile(null);
      setImagePreview(null);
      setView("home");
    }

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      setStatus("Failed to sign in with Google.");
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatus("Failed to sign out.");
    }
  };

  const handleResolve = async (postId: number) => {
    const { error } = await supabase.from("posts").update({ resolved: true }).eq("id", postId);
    if (error) {
      setStatus("Failed to mark as resolved.");
    } else {
      setPosts((current) =>
        current.map((post) => (post.id === postId ? { ...post, resolved: true } : post))
      );
      setStatus("Post marked as resolved.");
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setStatus("Please select an image file.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setStatus("Image must be smaller than 5MB.");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(fileName, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage.from("posts").getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error) {
      console.error("Image upload failed:", error);
      setStatus("Failed to upload image. Check browser console for details. Make sure the 'posts' bucket exists in Supabase Storage.");
      return null;
    }
  };

  const currentAction = view === "lost" ? "Report a lost item" : view === "found" ? "Report a found item" : "";

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-slate-950">Khojo</h1>
            <p className="text-slate-600">Lost & Found for your campus</p>
          </div>
          <button
            onClick={handleGoogleLogin}
            className="w-full rounded-3xl bg-blue-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-blue-500 cursor-pointer"
          >
            Continue with Google
          </button>
          {status && (
            <p className="rounded-3xl bg-red-100 px-4 py-3 text-sm text-red-700 text-center">{status}</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-slate-900 px-4 py-6 sm:px-6 sm:py-8 lg:px-12 lg:py-10">
      <div className="mx-auto w-full max-w-3xl space-y-8 sm:space-y-10">
        <header className="rounded-4xl bg-gray-100 p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-950">Khojo</h1>
              <p className="text-sm text-slate-600">Lost & Found for your campus</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {user ? (
                <>
                  <span className="text-xs sm:text-sm text-slate-700 truncate">{user.user_metadata?.full_name || "User"}</span>
                  <button
                    onClick={handleLogout}
                    className="w-full sm:w-auto rounded-3xl bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 cursor-pointer"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={handleGoogleLogin}
                  className="w-full sm:w-auto rounded-3xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
                >
                  Continue with Google
                </button>
              )}
            </div>
          </div>
        </header>

        <section className="rounded-4xl bg-gray-100 p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-4 sm:gap-6">
            <div>
              <h2 className="text-lg sm:text-2xl font-medium text-slate-950">{currentAction || "What would you like to do?"}</h2>
              <p className="mt-2 text-xs sm:text-sm leading-6 text-slate-600">
                Choose lost or found to create a brief report for your campus community.
              </p>
            </div>
            {view === "home" ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 md:flex md:gap-4 md:w-auto">
                <button
                  type="button"
                  onClick={() => setView("lost")}
                  className="rounded-3xl bg-red-500 px-4 py-3 sm:px-6 sm:py-4 text-sm sm:text-base font-semibold text-white transition hover:bg-red-400 cursor-pointer"
                >
                  Lost
                </button>
                <button
                  type="button"
                  onClick={() => setView("found")}
                  className="rounded-3xl bg-green-500 px-4 py-3 sm:px-6 sm:py-4 text-sm sm:text-base font-semibold text-white transition hover:bg-green-400 cursor-pointer"
                >
                  Found
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setView("home")}
                className="w-full rounded-3xl border border-slate-200 bg-gray-100 px-4 py-3 sm:px-6 sm:py-4 text-sm sm:text-base font-semibold text-slate-900 transition hover:bg-gray-50 cursor-pointer md:w-auto"
              >
                Back to home
              </button>
            )}
          </div>

          {view !== "home" && (
            <form onSubmit={handleSubmit} className="mt-6 sm:mt-8 space-y-6">
              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-medium text-slate-700" htmlFor="message">
                  Message
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  placeholder={view === "lost" ? "Describe the item and where you lost it." : "Describe the item you found and where."}
                  className="w-full rounded-3xl border border-slate-200 bg-gray-50 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 resize-none"
                />
              </div>

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-xs sm:text-sm font-medium text-slate-700" htmlFor="location">
                    Location
                  </label>
                  <input
                    id="location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Library, dorm, cafeteria..."
                    className="w-full rounded-3xl border border-slate-200 bg-gray-50 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 truncate"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs sm:text-sm font-medium text-slate-700" htmlFor="contact">
                    Contact phone
                  </label>
                  <input
                    id="contact"
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    placeholder="Your phone or campus number"
                    className="w-full rounded-3xl border border-slate-200 bg-gray-50 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 truncate"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-medium text-slate-700" htmlFor="image">
                  Image (optional)
                </label>
                <input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="w-full rounded-3xl border border-slate-200 bg-gray-50 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
                <p className="text-xs text-slate-500">Upload photo (optional but recommended)</p>
                {imagePreview && (
                  <div className="relative mt-3">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-2xl"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="absolute top-2 right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-400"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs sm:text-sm text-slate-600">Upload an image to help others identify the item.</p>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-3xl bg-slate-950 px-4 py-3 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 cursor-pointer"
                >
                  {loading ? "Saving..." : `Publish ${view === "lost" ? "lost" : "found"}`}
                </button>
              </div>
            </form>
          )}

          {status && (
            <p className="rounded-3xl bg-gray-100 px-4 py-3 text-xs sm:text-sm text-slate-700 shadow-sm">{status}</p>
          )}
        </section>

        <section className="space-y-6">
          <div className="rounded-4xl bg-gray-100 p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div>
                <h2 className="text-lg sm:text-2xl font-medium text-slate-950">Recent campus reports</h2>
                <p className="mt-2 text-xs sm:text-sm leading-6 text-slate-600">
                  Latest lost and found posts appear here first.
                </p>
              </div>
              <div className="flex justify-center sm:justify-start">
                <span className="rounded-3xl bg-gray-100 px-4 py-2 text-xs sm:text-sm text-slate-700">
                  {posts.length} post{posts.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {posts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-gray-100 p-6 text-sm text-slate-500 shadow-sm">
                No posts yet. Create the first campus report.
              </div>
            ) : (
              posts.map((post) => (
                <article key={post.id} className={`rounded-3xl border border-slate-200 bg-gray-100 shadow-md transition hover:shadow-lg hover:scale-[1.02] overflow-hidden ${post.resolved ? 'opacity-60' : ''}`}>
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="Post"
                      className="w-full h-64 object-cover"
                    />
                  )}
                  <div className="p-8 space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                          post.item_type === "lost"
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {post.item_type === "lost" ? "LOST" : "FOUND"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">{timeAgo(post.created_at)}</span>
                        {post.resolved && (
                          <span className="inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-green-100 text-green-700">
                            RESOLVED
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-base font-medium leading-6 text-slate-950">{post.message}</p>
                    <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:flex-wrap">
                      <span className="inline-flex items-center gap-2 rounded-2xl bg-gray-50 px-4 py-2">
                        <MapPin className="h-4 w-4 text-gray-500" aria-hidden="true" />
                        <span>{post.location}</span>
                      </span>
                      <a
                        href={`tel:${post.contact}`}
                        className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-2 font-medium text-blue-700 transition hover:bg-blue-100 cursor-pointer"
                      >
                        <Phone className="h-4 w-4 text-gray-500" aria-hidden="true" />
                        <span>{post.contact}</span>
                      </a>
                    </div>
                    {user && post.user_id === user.id && !post.resolved && (
                      <button
                        onClick={() => handleResolve(post.id)}
                        className="rounded-3xl bg-green-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-400"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default page;

import { redirect } from "next/navigation";

export default async function ClientPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const auth = typeof params.auth === "string" ? params.auth.trim() : "";

  if (!auth) {
    redirect("/");
  }

  const nextParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (key === "auth") {
      return;
    }

    if (typeof value === "string") {
      nextParams.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => nextParams.append(key, item));
    }
  });

  const query = nextParams.toString();
  redirect(query ? `/c/${encodeURIComponent(auth)}?${query}` : `/c/${encodeURIComponent(auth)}`);
}

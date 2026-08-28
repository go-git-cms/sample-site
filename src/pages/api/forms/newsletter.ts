import type { APIRoute } from "astro";
import { decodeBody, submitForm } from "~/lib/forms";

export const prerender = false;

// The newsletter endpoint. Same two answers as the contact form, but the
// no-JavaScript redirect returns to the page the visitor was reading rather
// than a dedicated thank-you: the signup is a footnote on an article, and
// bouncing someone off the thing they were reading to say "thanks" is a worse
// trade than a banner when they come back.
export const POST: APIRoute = async ({ request, redirect }) => {
  // `consent` is a checkbox: HTML omits an unchecked box entirely, so absence
  // is the only signal and it has to become an explicit false here — otherwise
  // "didn't tick the box" arrives as "didn't answer" and the required check
  // reports the wrong thing.
  const { data, wantsJson } = await decodeBody(request, { booleans: ["consent"] });
  const result = await submitForm("newsletter", data);

  if (wantsJson) {
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 422,
      headers: { "Content-Type": "application/json" },
    });
  }
  const back = new URL(request.headers.get("Referer") || "/articles/", request.url);
  back.searchParams.set(result.ok ? "subscribed" : "subscribeError", result.ok ? "1" : (result.errors[0]?.message ?? "1"));
  return redirect(back.pathname + back.search, 303);
};

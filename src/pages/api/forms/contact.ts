import type { APIRoute } from "astro";
import { decodeBody, submitForm } from "~/lib/forms";

export const prerender = false;

// The contact form's endpoint.
//
// It answers two ways on purpose. A native form post gets a 303 — to /thanks on
// success, or back to /contact with the failure in the query string — so the
// form works with JavaScript switched off. A `fetch` that asks for JSON gets
// the per-field errors, which is what lets the page mark the offending inputs
// without a round trip through the URL.
export const POST: APIRoute = async ({ request, redirect }) => {
  const { data, wantsJson } = await decodeBody(request, { numbers: ["budget"] });

  // The honeypot is forwarded rather than stripped: it is the CMS that decides
  // what a filled-in decoy means, and it records such a submission as spam and
  // answers normally so a bot learns nothing from the response.
  const result = await submitForm("contact", data);

  if (wantsJson) {
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 422,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (result.ok) return redirect("/thanks/", 303);

  // No JavaScript: carry the first message back in the URL. Field-level marks
  // need the JSON path — this is the floor, not the good experience.
  const first = result.errors[0]?.message ?? "Something went wrong.";
  return redirect(`/contact/?error=${encodeURIComponent(first)}`, 303);
};

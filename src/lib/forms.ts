// Posting the site's forms to the CMS content API.
//
// ── Why this goes through the site rather than straight from the browser ────
//
// The content API accepts a plain cross-origin `<form method="post">` — CORS
// reflects the origin and a urlencoded post is a simple request, so a static
// site genuinely can point a form at it. This site does not, for two reasons:
//
//  1. A native post that succeeds is answered with `303 Location: /thanks`, and
//     a browser resolves that against the ORIGIN IT POSTED TO. Cross-origin,
//     that is the CMS's host, not this site's. (The API only accepts rooted
//     paths there — an absolute one would be an open redirect on a public
//     unauthenticated endpoint, which is a phishing primitive.) Posting
//     same-origin makes the redirect land where the visitor expects.
//  2. It keeps the CMS's origin, the repository name and any credential out of
//     the page source. None of them are secrets, but a form's markup is not
//     where a site should be publishing its infrastructure either.
//
// The cost is that this needs a server, which this site has (Astro SSR). A
// static site would post directly and handle the response with `fetch`.

/** Where the CMS answers. */
const API_URL = process.env.CMS_API_URL || "http://localhost:8080";

/**
 * Which repository's content API to post to, as `owner/repo`. The forms live in
 * that repository's `go-git-cms.yml`, so this is the address of the config, not
 * a credential.
 *
 * The default is this monorepo, where the starter actually lives. Copy it out
 * and CMS_REPO is the one variable you must set: the CMS answers "no such
 * repository", which is accurate and says nothing about where to fix it, so it
 * is worth knowing in advance.
 */
const REPO = process.env.CMS_REPO || "go-git-cms/gogitcms";

/**
 * Which project on that repository. This starter is one project inside a
 * monorepo, so it must say which — omitting it on a repository carrying several
 * is ambiguous and the API says so rather than guessing.
 */
const PROJECT = process.env.CMS_PROJECT || "sample-site";

/** Which branch. Omitted means the repository's default. */
const REF = process.env.CMS_REF || "";

/** One field that failed validation, as the API reports it. */
export type FieldError = { path: string; message: string };

export type SubmitResult =
  | { ok: true }
  | { ok: false; errors: FieldError[] };

export function formEndpoint(form: string): string {
  const url = new URL(`/api/content/v1/${REPO}/forms/${encodeURIComponent(form)}`, API_URL);
  if (PROJECT) url.searchParams.set("project", PROJECT);
  if (REF) url.searchParams.set("ref", REF);
  return url.toString();
}

/**
 * submitForm forwards a submission and normalizes the answer.
 *
 * It posts JSON rather than replaying the urlencoded body, so the values arrive
 * with the types the form declares — the API will coerce a urlencoded body too,
 * but a checkbox is the case worth being deliberate about: HTML omits an
 * unchecked box entirely, and this is where that becomes an explicit `false`.
 */
export async function submitForm(form: string, data: Record<string, unknown>): Promise<SubmitResult> {
  let res: Response;
  try {
    res = await fetch(formEndpoint(form), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    // The CMS is unreachable. Reported against the form as a whole rather than
    // a field, because nothing the visitor typed is wrong.
    return {
      ok: false,
      errors: [{ path: "", message: "We couldn't reach the server. Please try again in a moment." }],
    };
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* a non-JSON body is handled by the status check below */
  }

  if (res.ok && body?.ok === true) return { ok: true };

  // A validation failure comes back as the submit result — `ok: false` with an
  // errors array whose entries carry the dotted field `path`. Those messages are
  // passed through untouched: the config author wrote them, and this file has no
  // business improving them.
  //
  // The `path` check is load-bearing, not defensive. The content API answers a
  // request it could not even route — an unknown repository, an unknown ref —
  // with a GraphQL-shaped envelope, `{data: null, errors: [{message,
  // extensions}]}`, on the REST surface as well as the GraphQL one. Testing only
  // for `Array.isArray(body.errors)` matches that too, and the visitor is then
  // shown "no such repository" as though they had typed it wrong.
  const fieldErrors: FieldError[] = Array.isArray(body?.errors)
    ? body.errors.filter((e: unknown): e is FieldError =>
        typeof e === "object" && e !== null && typeof (e as FieldError).path === "string",
      )
    : [];
  if (body?.ok === false && fieldErrors.length > 0) {
    return { ok: false, errors: fieldErrors };
  }
  if (res.status === 429) {
    return { ok: false, errors: [{ path: "", message: "That's a few too many, too quickly. Try again shortly." }] };
  }

  // Everything else is the operator's problem, not the visitor's: an
  // unconnected repository, a misconfigured project, a form the config no longer
  // declares. The API says exactly which — "no such repository" — and that is
  // the wrong sentence to put in front of someone who just wanted to send a
  // message. It goes to the server log, where whoever can fix it will look, and
  // the visitor gets something true and actionable instead.
  console.error(
    `[forms] ${form} submission failed: ${res.status} ${body?.code ?? ""} ${body?.message ?? ""}`.trim(),
  );
  return {
    ok: false,
    errors: [{ path: "", message: "Something went wrong on our end. Please try again in a moment." }],
  };
}

/**
 * decodeBody turns a posted form body into the map submitForm sends.
 *
 * `declaredBooleans` names the checkbox fields. HTML omits an unchecked box
 * from the body entirely, so absence is the only signal there is — and absence
 * means false here, not "not supplied".
 */
export async function decodeBody(
  request: Request,
  opts: { booleans?: string[]; numbers?: string[] } = {},
): Promise<{ data: Record<string, unknown>; wantsJson: boolean }> {
  const form = await request.formData();
  const data: Record<string, unknown> = {};

  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue; // no file fields on this site
    if (key.startsWith("_")) continue; // control fields (_redirect), never a value
    if (value === "") continue; // an empty optional field is "not answered"
    data[key] = value;
  }
  for (const name of opts.numbers ?? []) {
    if (typeof data[name] === "string") {
      const n = Number(data[name]);
      if (Number.isFinite(n)) data[name] = n;
    }
  }
  for (const name of opts.booleans ?? []) {
    data[name] = form.get(name) !== null;
  }

  // A `fetch` submission asks for JSON; a native form post does not, and gets a
  // redirect instead. This is the whole of the progressive enhancement.
  const wantsJson = (request.headers.get("Accept") || "").includes("application/json");
  return { data, wantsJson };
}

// CMS build configuration for the sample-site starter.
//
// This site is Astro in static mode, so preview is the *sidecar* case: the
// editor asks a sidecar process to build the site with the draft applied, and
// shows the result. There is no preview code in any template — the whole
// integration is this file plus preview.config.json.
//
// ── Two environments, one file ────────────────────────────────────────────
//
// Locally nothing is exported and the editor asks: it talks to a CMS on
// localhost and stops on the workspace and repository pickers. That is the
// right default for a machine whose database is its own.
//
// On CI — the /admin build inside Dockerfile.sample-site — the same defaults
// would be silently wrong rather than merely unhelpful: a bundle is built once
// and shipped, so an unset API_URL bakes `localhost:8080` into an editor served
// from a public origin. So CI must be explicit, and `required` below fails the
// build naming the variable instead of producing that bundle. `CI` is set by
// the Dockerfile's editor step and by every runner worth the name.

const CI = Boolean(process.env.CI);

// A value CI must supply. Locally its absence is meaningful — the editor asks —
// so it stays undefined, and defineFor drops empty keys from the build rather
// than baking in "".
function required(name, { because }) {
  const value = process.env[name];
  if (CI && !value) {
    throw new Error(
      `examples/sample-site/cms.config.mjs: ${name} must be set when CI is set — ${because}. ` +
        `Off CI it is optional; see the header of this file for what happens without it.`,
    );
  }
  return value || undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default {
  // Where the CMS API lives. Whatever CI sets is baked in — the SPA reads it at
  // module scope, so there is no runtime override for a built bundle.
  API_URL:
    required("GITCMS_API_URL", {
      because: "a built bundle calls this URL from the browser and cannot be repointed later",
    }) ?? "http://localhost:8080",

  // Which workspace and repository the editor opens. Ids in one database, so
  // they are environment data, never repository data.
  WORKSPACE_ID: required("GITCMS_WORKSPACE_ID", {
    because: "a shipped editor must open its own workspace rather than offer a picker",
  }),
  REPOSITORY_ID: required("GITCMS_REPOSITORY_ID", {
    because: "a shipped editor must open its own repository rather than offer a picker",
  }),

  // Pin the editor to the `sample-site` project from the repository manifest
  // (go-git-cms.yml at the monorepo root). A NAME from the manifest, the same
  // in every database, so the committed default is correct on CI too. If you
  // copied this starter out into its own repository, the project comes from
  // your own go-git-cms.yml instead — set GITCMS_PROJECT to its name.
  //
  // It must be a name: the editor resolves the lock with `p.name === locked`,
  // so a project *id* matches nothing and every page load lands on the
  // ConfigError screen. Cheaper to refuse it here.
  PROJECT: (() => {
    const name = process.env.GITCMS_PROJECT || "sample-site";
    if (UUID.test(name)) {
      throw new Error(
        `examples/sample-site/cms.config.mjs: GITCMS_PROJECT is "${name}", which is a uuid. ` +
          `The project lock matches on the manifest name — pass "sample-site", not the project's id.`,
      );
    }
    return name;
  })(),

  // Mounted under Astro's public/ at /admin/. This sets both the asset URLs and
  // the paths the SPA's router writes, so it has to match where the site
  // actually serves it — the Caddyfile's /admin handle.
  BASE_PATH: "/admin/",

  plugins: [
    [
      // A relative path rather than a package: see the file for why Astro SSG
      // has no published engine plugin yet.
      "./cms-plugins/preview-astro-static.mjs",
      {
        // Where the sidecar is listening. The local default is the port
        // docker-compose.preview.yml publishes for this example; a deployed
        // editor points at its own sidecar service via CMS_PREVIEW_SIDECAR,
        // which Dockerfile.sample-site also feeds into the CSP so the header
        // cannot drift from the URL baked in here.
        sidecar: process.env.CMS_PREVIEW_SIDECAR || "http://127.0.0.1:4326",

        // The session token the sidecar prints at startup. Read it from the
        // environment rather than committing it — it is what stops any page in
        // any of your browser tabs from driving a process that runs builds.
        token: process.env.CMS_PREVIEW_TOKEN ?? "paste-the-token-the-sidecar-printed",

        // Must match a key under `sites` in preview.config.json. Naming a site
        // is the only thing the CMS gets to say about what runs.
        site: "profile",

        // Collection name -> the URL one of its documents lives at.
        //
        // Both templates interpolate `slug`, because that is what the routes are
        // built from (src/pages/articles/[slug].astro reads `data.slug`, not the
        // filename). A collection missing from this map gets no Preview button,
        // which is deliberate: a button that sometimes 404s teaches people to
        // distrust preview. `home` and `about` are absent for the opposite
        // reason — they are singletons at fixed URLs, and would need no template.
        collections: {
          articles: "/articles/{{fields.slug}}/",
          projects: "/projects/{{fields.slug}}/",
        },

        label: "Preview",
      },
    ],
  ],
};

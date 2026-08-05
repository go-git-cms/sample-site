// CMS build configuration for the sample-site starter.
//
// This site is Astro in *server* mode (astro.config.mjs), so preview is the
// SSR middleware case: the editor's Preview pane iframes the running site with
// a signed draft payload, src/middleware.ts puts the draft on Astro.locals,
// and src/lib/content.ts composes it over the content files before the page
// renders. The plugin below only needs to know where the site answers and
// which URL each document lives at.
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
      "@go-git-cms/preview",
      {
        // Where the running site answers. Locally that is `astro dev` on :4340
        // (.claude/launch.json's `sample-site` entry). A deployed editor sets
        // CMS_PREVIEW_SERVER to the site's own public origin — usually the very
        // origin /admin is served from, since this site runs the middleware —
        // and Dockerfile.sample-site feeds the same value into the /admin CSP
        // so the header cannot drift from the URL baked in here.
        baseUrl: process.env.CMS_PREVIEW_SERVER || "http://localhost:4340",

        // Collection name -> the URL one of its documents lives at.
        //
        // The wildcard templates interpolate `slug`, because that is what the
        // routes are built from (src/pages/articles/[slug].astro reads
        // `fields.slug`, not the filename). A collection missing from this map
        // gets no Preview button, which is deliberate: a button that sometimes
        // 404s teaches people to distrust preview. The singletons live at
        // fixed URLs, so their entries are plain paths.
        collections: {
          articles: "/articles/{{fields.slug}}/",
          projects: "/projects/{{fields.slug}}/",
          home: "/",
          about: "/about/",
        },

        label: "Preview",
      },
    ],
  ],
};

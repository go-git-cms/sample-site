// CMS build configuration for the sample-site starter.
//
// This site is Astro in static mode, so preview is the *sidecar* case: the
// editor asks a sidecar process to build the site with the draft applied, and
// shows the result. There is no preview code in any template — the whole
// integration is this file plus preview.config.json.

export default {
  API_URL: "http://localhost:8080",

  plugins: [
    [
      // A relative path rather than a package: see the file for why Astro SSG
      // has no published engine plugin yet.
      "./cms-plugins/preview-astro-static.mjs",
      {
        // Where the sidecar is listening — the port docker-compose.preview.yml
        // publishes for this example. Each engine gets its own, so several
        // sidecars can run side by side.
        sidecar: "http://127.0.0.1:4326",

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

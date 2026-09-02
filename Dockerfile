# syntax=docker/dockerfile:1

# The sample site (examples/sample-site): Astro SSR on Node, fronted by Caddy —
# the same shape as Dockerfile.website. The site is `output: "server"`
# (astro.config.mjs): pages read their content files per request, which is what
# lets the @gogitcms/preview-astro middleware compose an unsaved CMS draft
# over the real file. Caddy terminates the edge, serves the hashed client
# assets (and the /admin editor when one is built) straight off disk, and
# proxies everything else to the Node server.
#
#   docker build -f Dockerfile.sample-site -t gitcms-sample-site .
#   docker run -p 8080:8080 -e CMS_PREVIEW_SECRET=... gitcms-sample-site
#
# No BuildKit mounts anywhere in this file, on purpose: Railway's builder
# rejects `--mount=type=secret` at parse time and requires service-specific ids
# on cache mounts, so this file uses neither and builds unmodified there.
#
# Before deploying for real, set `site` in examples/sample-site/astro.config.mjs
# to the actual origin — canonical URLs, Open Graph and the RSS feed all derive
# from it. And set CMS_PREVIEW_SECRET at *runtime* (it is a secret, so it is
# deliberately not a build ARG — an ARG bakes into a layer): the preview
# middleware verifies signed draft payloads with it, and without one it accepts
# unsigned payloads, which lets anyone inject content into rendered pages.

# --- Build ------------------------------------------------------------------
# Pinned to BUILDPLATFORM: the output is JavaScript, so building it natively
# avoids emulating node on a cross-arch build.
# Node 22 because corepack has to install the pnpm pinned in package.json
# ("packageManager"), and that pnpm needs a newer Node than 20 provides.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
RUN corepack enable
WORKDIR /src

# The whole workspace rather than examples/sample-site alone: the install and
# build steps below run through `pnpm --filter`, which needs the workspace
# manifest and the root lockfile. The site's own @gogitcms dependencies are
# *published* ones (`*`, not `workspace:` — the site is mirrored out to a
# standalone repository), so they come from the registry like any other.
COPY . .
# A read:packages credential. Nothing the site itself installs needs one, but
# `deploy` below re-resolves the *whole* workspace before it prunes,
# and apps/docs depends on @go-git-cms/plugin-mdx, which lives on GitHub
# Packages and refuses anonymous reads. So this build needs one after all — set
# NPM_TOKEN as a build variable on Railway.
#
# A build-arg rather than a BuildKit secret because Railway's builder rejects
# `--mount=type=secret` at parse time. That is a real downgrade — the value is
# readable by anything that can read this *stage* — so it is written and deleted
# inside each RUN that needs it, and the runtime stage below copies artifacts
# out rather than inheriting the layer. Never push a build stage (`--target`)
# or a registry build cache from this file anywhere public, and scope the
# credential to read:packages and nothing else.
#
# `docker build --check` flags this as SecretsUsedInArgOrEnv. Expected, and
# not fixable here — the mount it wants is the thing Railway cannot parse.
#
# Declared after COPY . . so rotating it does not invalidate that layer.
#
# The RUNs below read it with `printenv NPM_TOKEN` rather than "$NPM_TOKEN":
# BuildKit substitutes Dockerfile variables into a RUN before it prints the
# instruction, so a plain reference puts the credential in clear text in the
# build log. Escaping the dollar does not help — the shell then reads the
# literal name. See the longer note in Dockerfile.docs.
ARG NPM_TOKEN=

# --trust-lockfile skips pnpm's supply-chain verification pass, which re-applies
# minimumReleaseAge/trustPolicy to every entry in the lockfile — all ~2000 of
# them, one registry metadata fetch each, filter or no filter. Sound here
# because the lockfile is our own committed one and the install is frozen:
# nothing is being resolved, so there is no new version for the policy to catch.
#
# The scope mapping comes from the repo's own .npmrc, which COPY . . brings in.
# It deliberately carries no credential: a project-level .npmrc outranks the
# user-level file written here and would silently replace it.
RUN set -eu; \
    { printf '//npm.pkg.github.com/:_authToken='; printenv NPM_TOKEN || true; } > /root/.npmrc; \
    pnpm install --frozen-lockfile --trust-lockfile \
      --filter @gogitcms/example-sample-site...; \
    rm -f /root/.npmrc

# The self-hosted editor, served at /admin (examples/sample-site/cms.config.mjs).
#
# Opt-in, keyed on GITCMS_API_URL: a bundle calls that origin from the browser
# and cannot be repointed afterwards, so there is no honest default and an image
# built without one simply has no /admin (the Caddyfile's /admin handle answers
# 404). That keeps a plain `docker build -f Dockerfile.sample-site .` cheap —
# the editor needs the whole SPA toolchain installed, which the site alone does
# not.
#
# CMS_PREVIEW_SERVER is where the editor's Preview pane loads the site — with
# middleware preview that is the site's own public origin, since this very
# image runs the middleware. It is baked into the bundle here and echoed into
# the /admin CSP at runtime (see the Caddyfile), one value for both so the
# header cannot drift from the URL the pane actually loads.
#
# None of these is a secret — the ids appear in the editor's own URLs — and on
# Railway each declared ARG is filled from the service variable of the same
# name. The stamp pass afterwards cache-busts app.js/app.css in the emitted
# index.html; the Caddyfile serves that shell no-store, which is what makes a
# rebuilt bundle actually reach browsers (see scripts/stamp-admin.mjs).
ARG GITCMS_API_URL=
ARG GITCMS_WORKSPACE_ID=
ARG GITCMS_REPOSITORY_ID=
ARG GITCMS_PROJECT=
ARG CMS_PREVIEW_SERVER=
RUN if [ -n "$GITCMS_API_URL" ]; then \
      set -eu; \
      pnpm install --frozen-lockfile --trust-lockfile \
        --filter @gogitcms/editor...; \
      cd examples/sample-site; \
      GITCMS_API_URL="$GITCMS_API_URL" \
      GITCMS_WORKSPACE_ID="$GITCMS_WORKSPACE_ID" \
      GITCMS_REPOSITORY_ID="$GITCMS_REPOSITORY_ID" \
      GITCMS_PROJECT="$GITCMS_PROJECT" \
      CMS_PREVIEW_SERVER="$CMS_PREVIEW_SERVER" \
      CI=1 \
        node ../../apps/editor/bin/gogitcms-editor.mjs build --out public/admin --no-tty; \
      node scripts/stamp-admin.mjs public/admin; \
    else \
      echo "GITCMS_API_URL unset — skipping the /admin editor build"; \
    fi

# Runs after the editor build on purpose: Astro copies public/ into dist/client,
# so public/admin has to exist by now or it never reaches the image.
RUN pnpm --filter @gogitcms/example-sample-site build

# Prune to production dependencies. Astro bundles the application code (the
# preview packages are `noExternal`, so they land in the bundle too) but leaves
# genuine runtime dependencies — marked, gray-matter, yaml — external, so
# node_modules still ships, just without vite, typescript and the rest of the
# build chain.
# This step is why NPM_TOKEN exists here: `deploy` re-resolves every importer in
# the workspace before it prunes, apps/docs among them, so it reaches GitHub
# Packages for plugin-mdx even though nothing in this image uses it.
#
# auto-install-peers=false keeps `deploy` from resolving peer ranges of its own
# accord while it re-resolves the workspace; the site's own @gogitcms packages
# are ordinary published dependencies, so --prod carries them across as-is.
# (Not usable on the frozen installs above: a frozen install refuses any
# autoInstallPeers that differs from the value recorded in the lockfile.)
RUN set -eu; \
    { printf '//npm.pkg.github.com/:_authToken='; printenv NPM_TOKEN || true; } > /root/.npmrc; \
    pnpm --filter @gogitcms/example-sample-site deploy --prod --legacy \
      --trust-lockfile --config.auto-install-peers=false /out; \
    rm -f /root/.npmrc; \
    cp -r examples/sample-site/dist /out/dist

# --- Runtime ----------------------------------------------------------------
# Caddy in front of the Astro server rather than exposing Node directly: it
# compresses, sets the security headers in one place, and serves the hashed
# client assets (and /admin) straight off disk so Node only ever handles the
# SSR render. Both run under supervision of a small shell entrypoint, which is
# enough for two processes that must die together.
FROM node:22-alpine
# bash is for the entrypoint's `wait -n`, which busybox ash does not implement —
# see the comment in examples/sample-site/docker-entrypoint.sh.
RUN apk add --no-cache bash caddy tini

WORKDIR /app
COPY --from=build /out ./
COPY examples/sample-site/Caddyfile /etc/caddy/Caddyfile
COPY examples/sample-site/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# PORT is Caddy's, the port the container publishes. ASTRO_PORT is the loopback
# port Caddy proxies to, and the entrypoint passes it to Node *as* PORT, because
# that is the only variable the standalone adapter reads — see the comment in
# docker-entrypoint.sh. HOST keeps Node on loopback, so Caddy is the only thing
# that can talk to it.
ENV HOST=127.0.0.1 \
    ASTRO_PORT=4321 \
    PORT=8080 \
    NODE_ENV=production

# Re-declared because the build stage's ARG does not cross a FROM, and promoted
# to ENV because the value is needed at *runtime* too: the Caddyfile puts the
# preview origin in the /admin CSP's connect-src and frame-src, and a Preview
# pane the CSP does not admit fails on the first click. One source for both, so
# the header cannot drift from the URL compiled into the editor. The API origin
# needs no ENV: docker-entrypoint.sh derives it (and the ws origins) from
# GITCMS_API_URL, which Railway injects at runtime too — set CMS_API_ORIGIN
# explicitly when running somewhere that doesn't.
ARG CMS_PREVIEW_SERVER=
ENV CMS_PREVIEW_SERVER=$CMS_PREVIEW_SERVER

EXPOSE 8080

# Unprivileged. The node image ships a `node` user; Caddy binds 8080, not 80,
# so it needs no capability to do it.
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/healthz" >/dev/null 2>&1 || exit 1

# tini reaps the two children so a crashed Node doesn't leave a zombie behind
# Caddy, and so SIGTERM from the platform actually stops both.
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]

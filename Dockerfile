# syntax=docker/dockerfile:1

# The sample site (examples/sample-site): Astro SSR on Node, fronted by Caddy —
# the same shape as Dockerfile.website. The site is `output: "server"`
# (astro.config.mjs): pages read their content files per request, which is what
# lets the @go-git-cms/preview-astro middleware compose an unsaved CMS draft
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

# The whole workspace rather than examples/sample-site alone: the site imports
# @go-git-cms/preview-astro (and its preview-ssr/preview-core chain) as
# workspace dependencies, and pnpm needs the lockfile and workspace manifest to
# resolve them.
COPY . .
# GitHub Packages auth comes in with the context: COPY . . above includes the
# repo's .npmrc (registry mapping + token — .dockerignore admits it on purpose,
# see the note there), and pnpm reads it from /src as workspace config. A plain
# COPY rather than the secret mount the other Dockerfiles use, because Railway's
# builder rejects `--mount=type=secret` at parse time. The token therefore sits
# in this build stage's layers — which the runtime stage below never inherits,
# so the shipped image carries the pruned /out and nothing else.
RUN pnpm install --frozen-lockfile --filter @go-git-cms/example-sample-site...

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
      pnpm install --frozen-lockfile --filter @go-git-cms/gitcms-ide...; \
      cd examples/sample-site; \
      GITCMS_API_URL="$GITCMS_API_URL" \
      GITCMS_WORKSPACE_ID="$GITCMS_WORKSPACE_ID" \
      GITCMS_REPOSITORY_ID="$GITCMS_REPOSITORY_ID" \
      GITCMS_PROJECT="$GITCMS_PROJECT" \
      CMS_PREVIEW_SERVER="$CMS_PREVIEW_SERVER" \
      CI=1 \
        node ../../apps/gitcms-ide/bin/gitcms-ide.mjs build --out public/admin --no-tty; \
      node scripts/stamp-admin.mjs public/admin; \
    else \
      echo "GITCMS_API_URL unset — skipping the /admin editor build"; \
    fi

# Runs after the editor build on purpose: Astro copies public/ into dist/client,
# so public/admin has to exist by now or it never reaches the image.
RUN pnpm --filter @go-git-cms/example-sample-site build

# Prune to production dependencies. Astro bundles the application code (the
# preview packages are `noExternal`, so they land in the bundle too) but leaves
# genuine runtime dependencies — marked, gray-matter, yaml — external, so
# node_modules still ships, just without vite, typescript and the rest of the
# build chain.
RUN pnpm --filter @go-git-cms/example-sample-site deploy --prod --legacy /out \
 && cp -r examples/sample-site/dist /out/dist

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

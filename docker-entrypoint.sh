#!/bin/bash
# Runs Caddy and the Astro SSR server side by side, after deriving the origins
# the Caddyfile's CSPs interpolate.
#
# Two processes, no supervisor: if either dies the container should die too, so
# the platform restarts it rather than serving a half-working site. `wait -n`
# returns as soon as the first one exits, and the trap takes the other down with
# it. tini (the ENTRYPOINT) reaps them.
#
# bash, not /bin/sh: `wait -n` is a bashism, and the busybox ash that /bin/sh
# resolves to in the alpine image does not implement it — it waits for *every*
# child and then returns 129 rather than the first one's status. Under `set -e`
# that ends the script while both processes are still running; without it, a
# crashed Node would leave Caddy serving a half-working site, which is the exact
# failure this file exists to prevent.
set -eu

term() {
	# Kill the whole process group rather than the two pids, so a Node that
	# spawned something doesn't leave it behind.
	trap - TERM INT
	kill 0
}
trap term TERM INT

# Scheme-and-host only: as a CSP source, a path reads as a prefix restriction
# and a trailing slash breaks matching.
origin() {
	printf '%s' "${1%/}" | sed -E 's#^(https?://[^/]+).*#\1#'
}

# A CSP source matches on scheme as well as host, so "https://api.example.com"
# does not authorise "wss://api.example.com" — and the editor's live
# collaboration opens exactly that. The symptom is a console full of "Refused
# to connect to wss://…" and collaboration that silently never starts.
ws_origin() {
	printf '%s' "${1%/}" | sed -e 's#^https://#wss://#' -e 's#^http://#ws://#'
}

# Derived from GITCMS_API_URL when not set explicitly: Railway injects service
# variables at runtime as well as build time, so the variable that configured
# the /admin bundle also configures the CSP that has to admit it — one value,
# nothing to drift. CMS_API_ORIGIN exists for deployments that build and run
# with different variable sets.
if [ -z "${CMS_API_ORIGIN:-}" ] && [ -n "${GITCMS_API_URL:-}" ]; then
	CMS_API_ORIGIN="$(origin "$GITCMS_API_URL")"
fi
export CMS_API_ORIGIN="${CMS_API_ORIGIN:-}"

# CMS_COLLAB_ORIGIN is for deployments that run the collab service on its own
# hostname; unset, collab is on the API and the first entry covers it.
CMS_WS_ORIGINS=""
if [ -n "${CMS_API_ORIGIN:-}" ]; then
	CMS_WS_ORIGINS="$(ws_origin "$CMS_API_ORIGIN")"
fi
if [ -n "${CMS_COLLAB_ORIGIN:-}" ]; then
	# Both forms: the origin itself for any ordinary request the editor makes
	# to it, and the ws form for the socket.
	CMS_WS_ORIGINS="$CMS_WS_ORIGINS ${CMS_COLLAB_ORIGIN%/} $(ws_origin "$CMS_COLLAB_ORIGIN")"
fi
export CMS_WS_ORIGINS

# The origin the /admin Preview pane loads pages from — this site itself, in
# the usual deployment, in which case 'self' already admits it and the derived
# value can stay empty. Set CMS_PREVIEW_SERVER (build and runtime) when the
# pane should load a different deployment of the site.
CMS_PREVIEW_ORIGIN=""
if [ -n "${CMS_PREVIEW_SERVER:-}" ]; then
	CMS_PREVIEW_ORIGIN="$(origin "$CMS_PREVIEW_SERVER")"
fi
export CMS_PREVIEW_ORIGIN

# External CMS editors allowed to iframe the site's pages for preview, on top
# of the same-origin /admin the Caddyfile always admits. Space-separated
# origins, passed straight into the content CSP's frame-ancestors.
export CMS_EDITOR_ORIGINS="${CMS_EDITOR_ORIGINS:-}"

if [ -z "${CMS_PREVIEW_SECRET:-}" ]; then
	echo "WARNING: CMS_PREVIEW_SECRET is unset — the preview middleware will accept" >&2
	echo "unsigned draft payloads, which lets anyone inject content into rendered pages." >&2
fi

caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &

# PORT is Caddy's — the platform injects it and the Caddyfile binds it. The
# @astrojs/node standalone server reads PORT too, and it takes precedence over
# the `server.port` in astro.config.mjs, so inheriting it here would point both
# processes at the same port: Caddy binds it first, Node then fails with
# EADDRINUSE. Overriding it for this one process is what makes ASTRO_PORT, which
# the Caddyfile already proxies to, the value Node actually listens on.
PORT="${ASTRO_PORT:-4321}" node /app/dist/server/entry.mjs &

# Whichever exits first ends the container; propagate its status so a crash is
# visible as a non-zero exit rather than a clean stop.
wait -n
status=$?
term
exit "$status"

#!/bin/sh
# Derives the CSP origins the Caddyfile interpolates, then execs Caddy.
#
# One process, so none of the supervision the website/docs entrypoints need —
# no bash, no tini, no `wait -n`. `exec` makes Caddy PID 1, so the platform's
# SIGTERM reaches it directly. busybox sh is enough for everything here.
set -eu

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

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile

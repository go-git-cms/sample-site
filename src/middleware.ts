import type { MiddlewareHandler } from 'astro';
import { previewMiddleware } from '@go-git-cms/preview-astro';

// CMS draft mode (SSR). Verifies the signed preview payload from the editor,
// puts it on Astro.locals.preview, parks it in the __cms_preview cookie so
// in-site navigation keeps the draft, and sets the cache headers that keep a
// preview response out of every cache (including Vercel's CDN cache).
//
// CMS_PREVIEW_SECRET must match the value the CMS signs payloads with. When it
// is unset (local dev) unsigned payloads are accepted, with a console warning.
const preview = previewMiddleware({
  secret: import.meta.env.CMS_PREVIEW_SECRET,
});

export const onRequest: MiddlewareHandler = (context, next) =>
  preview(
    {
      request: context.request,
      url: originalUrl(context.request, context.url),
      locals: context.locals as unknown as Record<string, unknown>,
    },
    next
  );

/**
 * Recover the original query string. On Vercel the adapter's internal router
 * replaces it with `?x_astro_path=...` before the middleware runs, so a
 * payload carried on the page URL would be invisible here; the original
 * path+query survives in the x-forwarded-uri header.
 */
function originalUrl(request: Request, url: URL): URL {
  if (url.searchParams.has('__cms_preview')) return url;
  const forwarded = request.headers.get('x-forwarded-uri');
  const q = forwarded?.indexOf('?') ?? -1;
  if (forwarded && q !== -1 && forwarded.includes('__cms_preview')) {
    return new URL(url.pathname + forwarded.slice(q), url.origin);
  }
  return url;
}

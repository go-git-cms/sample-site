import type { APIContext } from "astro";
import { previewEntryRoute } from "@go-git-cms/preview-astro";

// Enter preview mode: verifies the payload, parks it in the __cms_preview
// cookie and redirects to ?redirect=<path>. The CMS iframe loads this first
// when the payload is too large to carry inline on the page URL, and it is
// also the link a share-a-preview flow would use.
const enter = previewEntryRoute({
  secret: import.meta.env.CMS_PREVIEW_SECRET,
});

export function GET(context: APIContext) {
  return enter({ request: context.request, url: context.url });
}

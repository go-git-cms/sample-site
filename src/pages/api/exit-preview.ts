import { exitPreviewRoute } from "@go-git-cms/preview-astro";

// Leave preview mode: clears the parked cookie and lands on the homepage, so
// "back to the published site" is one link rather than a cookie-clearing chore.
const exit = exitPreviewRoute();

export function GET() {
  return exit();
}

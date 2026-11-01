import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page is generated fresh on each request (force-dynamic), so no page cache (R2) is needed.
export default defineCloudflareConfig({});

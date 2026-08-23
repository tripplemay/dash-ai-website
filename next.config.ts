import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // SQLite is a runtime data volume, never a deploy artifact. Production
  // points DASH_AUTH_DB at /opt/dash-pr/dash-auth.db outside the release tree.
  outputFileTracingExcludes: {
    "/*": [
      "./*.db",
      "./*.db-*",
      "./**/*.db",
      "./**/*.db-*",
      "./public/**/*",
      "./src/**/*",
      "./*.md",
      "./**/*.md",
    ],
  },
  async redirects() {
    return [
      { source: "/:locale(zh|en)", destination: "/:locale/workspace", permanent: true },
      { source: "/:locale(zh|en)/course/present", destination: "/:locale/presentations/course", permanent: true },
      { source: "/:locale(zh|en)/course/wizard", destination: "/:locale/courses/wizard", permanent: true },
      { source: "/:locale(zh|en)/course/:slug", destination: "/:locale/courses/:slug", permanent: true },
      { source: "/:locale(zh|en)/course", destination: "/:locale/courses", permanent: true },
      { source: "/:locale(zh|en)/player", destination: "/:locale/presentations/screen", permanent: true },
      { source: "/:locale(zh|en)/guide", destination: "/:locale/help/guide", permanent: true },
      { source: "/:locale(zh|en)/brand", destination: "/:locale/help/brand", permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);

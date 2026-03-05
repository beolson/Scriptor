import type { NextConfig } from "next";

// NOTE: Security headers (CSP, X-Frame-Options, HSTS, X-Content-Type-Options)
// cannot be set via Next.js with output:"export". Configure them at the
// CDN/hosting layer (e.g. Cloudflare, GitHub Pages custom headers, Netlify _headers).
const nextConfig: NextConfig = {
	output: "export",
	basePath: process.env.GITHUB_ACTIONS ? "/Scriptor" : "",
	trailingSlash: true,
	images: {
		unoptimized: true,
	},
};

export default nextConfig;

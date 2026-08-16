const path = require("path")
const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  sassOptions: {
    includePaths: [path.join(__dirname, 'src')],
  },
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@modules": path.resolve(__dirname, "src/modules"),
      "@lib": path.resolve(__dirname, "src/lib"),
      "@pages": path.resolve(__dirname, "src/pages"),
    }
    return config
  },
  images: {
    // Product photography ships at quality 100 everywhere (2026-08-16 — the
    // old mix of 50–90 looked visibly compressed on retina screens); 75 stays
    // allowed for decorative images that don't pass an explicit quality.
    // Listing the values now is also what Next 16 will require.
    qualities: [75, 100],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      ...(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ? [{
        // Note: needed to serve images from /public folder
        protocol: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL.startsWith('https') ? 'https' : 'http',
        hostname: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL.replace(/^https?:\/\//, ''),
      }] : []),
      ...(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ? [{
        // Note: only needed when using local-file for product media
        protocol: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL.startsWith('https') ? 'https' : 'http',
        hostname: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL.replace(/^https?:\/\//, ''),
      }] : []),
      { // Note: can be removed after deleting demo products
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      { // Note: can be removed after deleting demo products
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      { // Note: can be removed after deleting demo products
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
        {
          protocol: "https",
          hostname: "bucket-production-2be7.up.railway.app",
        },
      ...(process.env.NEXT_PUBLIC_MINIO_ENDPOINT ? [{ // Note: needed when using MinIO bucket storage for media
        protocol: "https",
        hostname: process.env.NEXT_PUBLIC_MINIO_ENDPOINT,
      }] : []),
      { // Sanity CDN for content images
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
    ],
  }
}

module.exports = nextConfig

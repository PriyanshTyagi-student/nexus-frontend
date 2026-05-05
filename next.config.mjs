/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  images: {
    unoptimized: true,
  },
}

export default nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mvga/sdk', '@mvga/ui'],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      {
        source: '/wallet',
        destination: 'https://app.mvga.io',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;

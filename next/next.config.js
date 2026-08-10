/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@laoma/shared'],
  async redirects() {
    return [
      {
        source: '/',
        destination: '/client',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;

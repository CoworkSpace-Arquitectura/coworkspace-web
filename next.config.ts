import type { NextConfig } from 'next';

// Sitio estático: se compila a HTML/JS y habla con el API Gateway desde el navegador
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;

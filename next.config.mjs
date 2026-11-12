/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native/wasm-backed model tooling must run from node_modules, not the bundle.
  serverExternalPackages: ['@gltf-transform/core', '@gltf-transform/extensions', 'draco3dgltf', 'meshoptimizer'],
};
export default nextConfig;

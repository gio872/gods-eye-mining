# God’s Eye Mining on Hostinger

## Hostinger Node.js Web App

Repository: gio872/gods-eye-mining
Branch: gem-core
Framework: Vite
Node.js: 24.x
Build command: npm run build
Start command: npm start
Output directory: dist
Host: 0.0.0.0

After deployment, verify /api/health and then open the main application URL.

Keep server-only provider credentials in normal environment variables. Client-exposed keys are GOOGLE_MAPS_API_KEY and CESIUM_ION_TOKEN and should be restricted at the provider.

## Hostinger VPS

Use Node 24.x. Run npm ci, npm run build and npm start. For a long-running VPS process, PM2 can supervise server/hostinger-start.mjs, with NGINX/HTTPS in front of the Node port.
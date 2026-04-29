const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/anthropic',
    createProxyMiddleware({
      target: 'https://api.anthropic.com',
      changeOrigin: true,
      pathRewrite: { '^/anthropic': '' },
    })
  );
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://ehsapi.fldata.com',
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
    })
  );
};
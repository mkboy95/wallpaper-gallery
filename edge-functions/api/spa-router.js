export default function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // 检查是否为静态资源
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.webp', 
    '.ico', '.svg', '.json', '.txt', '.xml', '.woff', '.woff2',
    '.ttf', '.eot'
  ];
  
  const isStaticResource = staticExtensions.some(ext => 
    pathname.toLowerCase().endsWith(ext)
  );
  
  // 如果是静态资源，直接返回
  if (isStaticResource) {
    return fetch(request);
  }
  
  // 如果是 API 路径，直接返回
  if (pathname.startsWith('/api/')) {
    return fetch(request);
  }
  
  // 否则返回 index.html
  return new Response(
    `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>壁纸画廊</title>
  <script type="module" src="/assets/index.js"></script>
  <link rel="stylesheet" href="/assets/index.css">
</head>
<body>
  <div id="app"></div>
</body>
</html>`,
    {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      },
      status: 200
    }
  );
}
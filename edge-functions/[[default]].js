export default async function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)
  const pathname = url.pathname

  const staticExtensions = [
    '.js',
    '.css',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.ico',
    '.svg',
    '.json',
    '.txt',
    '.xml',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.br',
    '.gz',
  ]

  const isStaticResource = staticExtensions.some(ext =>
    pathname.toLowerCase().endsWith(ext),
  )

  if (isStaticResource || pathname.startsWith('/assets/') || pathname.startsWith('/favicon') || pathname.startsWith('/lottie/')) {
    const response = await fetch(request)
    return response
  }

  if (pathname.startsWith('/api/')) {
    return fetch(request)
  }

  return fetch(new URL('/index.html', request.url))
}

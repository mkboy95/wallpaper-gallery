export default async function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)
  const pathname = url.pathname

  const targetPath = pathname.replace(/^\/360-wallpaper/, '')
  const targetUrl = `http://wallpaper.apc.360.cn${targetPath}${url.search}`
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })
  const data = await response.text()
  return new Response(data, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
    status: response.status,
  })
}

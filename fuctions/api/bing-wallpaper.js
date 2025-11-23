export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'GET') {
    return new Response(null, { status: 405 });
  }

  try {
    const url = new URL(request.url);
    const theme = url.searchParams.get('theme') || 'dark';
    
    // 尝试从KV缓存获取
    const cached = await env.KV_BING.get(`bing-${theme}`);
    if (cached) {
      return new Response(cached, {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 从Bing API获取图片
    const bingResponse = await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=en-US');
    const data = await bingResponse.json();
    const imageUrl = `https://www.bing.com${data.images[0].url}`;
    
    const result = { url: imageUrl, copyright: data.images[0].copyright };
    
    // 缓存到KV (24小时)
    await env.KV_BING.put(`bing-${theme}`, JSON.stringify(result), { expirationTtl: 86400 });
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // 如果Bing API失败，返回默认背景
    const fallback = {
      url: theme === 'dark' 
        ? 'https://images.unsplash.com/photo-1505506874110-6a7a69069a08?ixlib=rb-4.0.3&w=1200'
        : 'https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?ixlib=rb-4.0.3&w=1200'
    };
    
    return new Response(JSON.stringify(fallback), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
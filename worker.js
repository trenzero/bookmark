export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // CORS 处理
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    // API 路由
    if (pathname.startsWith('/api/')) {
      return handleAPIRequest(request, env, ctx);
    }

    // 静态文件服务
    return serveStaticFiles(request, env, ctx);
  }
};

async function handleAPIRequest(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  try {
    // 书签管理 API
    if (pathname === '/api/bookmarks' && method === 'GET') {
      return await getBookmarks(request, env);
    }
    
    if (pathname === '/api/bookmarks' && method === 'POST') {
      return await createBookmark(request, env);
    }
    
    if (pathname.startsWith('/api/bookmarks/') && method === 'PUT') {
      return await updateBookmark(request, env);
    }
    
    if (pathname.startsWith('/api/bookmarks/') && method === 'DELETE') {
      return await deleteBookmark(request, env);
    }

    // 分类管理 API
    if (pathname === '/api/categories' && method === 'GET') {
      return await getCategories(request, env);
    }

    // 数据导入导出
    if (pathname === '/api/export' && method === 'GET') {
      return await exportData(request, env);
    }
    
    if (pathname === '/api/import' && method === 'POST') {
      return await importData(request, env);
    }

    // Bing 背景图片
    if (pathname === '/api/bing-image' && method === 'GET') {
      return await getBingImage(env);
    }

    return new Response(JSON.stringify({ error: 'API endpoint not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 获取书签列表
async function getBookmarks(request, env) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const limit = parseInt(url.searchParams.get('limit')) || 20;
  const categoryId = url.searchParams.get('categoryId');
  const tagId = url.searchParams.get('tagId');
  const offset = (page - 1) * limit;

  let query = `
    SELECT b.*, c.name as category_name, 
           GROUP_CONCAT(t.name) as tags,
           GROUP_CONCAT(t.id) as tag_ids,
           GROUP_CONCAT(t.color) as tag_colors
    FROM bookmarks b
    LEFT JOIN categories c ON b.category_id = c.id
    LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
    LEFT JOIN tags t ON bt.tag_id = t.id
  `;
  
  let whereClauses = ['1=1'];
  let params = [];

  if (categoryId) {
    whereClauses.push('b.category_id = ?');
    params.push(categoryId);
  }

  if (tagId) {
    whereClauses.push('bt.tag_id = ?');
    params.push(tagId);
  }

  query += ` WHERE ${whereClauses.join(' AND ')} `;
  query += ` GROUP BY b.id ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const bookmarks = await env.DB.prepare(query).bind(...params).all();

  // 获取总数用于分页
  const countQuery = `
    SELECT COUNT(DISTINCT b.id) as total
    FROM bookmarks b
    LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
    WHERE ${whereClauses.join(' AND ')}
  `;
  const countResult = await env.DB.prepare(countQuery).bind(...params.slice(0, -2)).first();

  return new Response(JSON.stringify({
    bookmarks: bookmarks.results,
    pagination: {
      page,
      limit,
      total: countResult.total,
      pages: Math.ceil(countResult.total / limit)
    }
  }), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// 创建书签
async function createBookmark(request, env) {
  const data = await request.json();
  
  const result = await env.DB.prepare(`
    INSERT INTO bookmarks (title, url, description, category_id, is_public, user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    data.title,
    data.url,
    data.description || '',
    data.categoryId || null,
    data.isPublic ? 1 : 0,
    'default' // 在实际应用中应从认证信息获取
  ).run();

  // 处理标签
  if (data.tags && data.tags.length > 0) {
    for (const tagId of data.tags) {
      await env.DB.prepare(`
        INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id)
        VALUES (?, ?)
      `).bind(result.meta.last_row_id, tagId).run();
    }
  }

  return new Response(JSON.stringify({ 
    success: true, 
    id: result.meta.last_row_id 
  }), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// 数据导出
async function exportData(request, env) {
  const [bookmarks, categories, tags] = await Promise.all([
    env.DB.prepare("SELECT * FROM bookmarks").all(),
    env.DB.prepare("SELECT * FROM categories").all(),
    env.DB.prepare("SELECT * FROM tags").all()
  ]);

  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    bookmarks: bookmarks.results,
    categories: categories.results,
    tags: tags.results
  };

  return new Response(JSON.stringify(exportData), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="bookmarks-export.json"',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// 获取 Bing 每日图片
async function getBingImage(env) {
  // 尝试从 KV 缓存获取
  const cached = await env.KV.get('bing_image', { type: 'json' });
  
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 从 Bing 获取新图片
  const response = await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=en-US');
  const data = await response.json();
  const imageUrl = `https://www.bing.com${data.images[0].url}`;
  
  const imageData = {
    url: imageUrl,
    copyright: data.images[0].copyright,
    title: data.images[0].title
  };

  // 缓存 24 小时
  await env.KV.put('bing_image', JSON.stringify(imageData), {
    expirationTtl: 86400
  });

  return new Response(JSON.stringify(imageData), {
    headers: { 'Content-Type': 'application/json' }
  });
}
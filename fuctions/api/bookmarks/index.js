export async function onRequest(context) {
  const { request, env } = context;
  const { method } = request;

  try {
    switch (method) {
      case 'GET':
        const url = new URL(request.url);
        const category = url.searchParams.get('category');
        const isPrivate = url.searchParams.get('private');
        
        let query = 'SELECT * FROM bookmarks WHERE 1=1';
        const params = [];
        
        if (category && category !== 'all') {
          query += ' AND category = ?';
          params.push(category);
        }
        
        if (isPrivate !== null) {
          query += ' AND is_private = ?';
          params.push(parseInt(isPrivate));
        }
        
        query += ' ORDER BY created_at DESC';
        
        const { results } = await env.DB.prepare(query).bind(...params).all();
        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json' }
        });

      case 'POST':
        const data = await request.json();
        const { title, url: bookmarkUrl, description, category: bookmarkCategory, is_private } = data;
        
        if (!title || !bookmarkUrl) {
          return new Response(JSON.stringify({ error: 'Title and URL are required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const { success } = await env.DB.prepare(
          'INSERT INTO bookmarks (title, url, description, category, is_private) VALUES (?, ?, ?, ?, ?)'
        ).bind(title, bookmarkUrl, description || '', bookmarkCategory || '', is_private ? 1 : 0).run();

        if (success) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          throw new Error('Failed to insert bookmark');
        }

      default:
        return new Response(null, { status: 405 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
export async function onRequest(context) {
  const { request, env, params } = context;
  const { id } = params;
  const { method } = request;

  try {
    switch (method) {
      case 'GET':
        const bookmark = await env.DB.prepare(
          'SELECT * FROM bookmarks WHERE id = ?'
        ).bind(id).first();
        
        if (bookmark) {
          return new Response(JSON.stringify(bookmark), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ error: 'Bookmark not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

      case 'PUT':
        const updateData = await request.json();
        const { title, url, description, category, is_private } = updateData;
        
        const updateResult = await env.DB.prepare(
          'UPDATE bookmarks SET title = ?, url = ?, description = ?, category = ?, is_private = ? WHERE id = ?'
        ).bind(title, url, description || '', category || '', is_private ? 1 : 0, id).run();
        
        if (updateResult.success) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          throw new Error('Failed to update bookmark');
        }

      case 'DELETE':
        const deleteResult = await env.DB.prepare(
          'DELETE FROM bookmarks WHERE id = ?'
        ).bind(id).run();
        
        if (deleteResult.success) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          throw new Error('Failed to delete bookmark');
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
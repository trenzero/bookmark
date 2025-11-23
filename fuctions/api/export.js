export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'GET') {
    return new Response(null, { status: 405 });
  }

  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM bookmarks ORDER BY created_at DESC'
    ).all();
    
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      bookmarks: results
    };
    
    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="bookmarks-export.json"'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
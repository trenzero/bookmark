export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  try {
    const data = await request.json();
    const bookmarks = data.bookmarks || data;
    
    if (!Array.isArray(bookmarks)) {
      return new Response(JSON.stringify({ error: 'Invalid data format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let imported = 0;
    let errors = 0;

    for (const bookmark of bookmarks) {
      try {
        const { title, url, description, category, is_private } = bookmark;
        
        if (title && url) {
          await env.DB.prepare(
            'INSERT INTO bookmarks (title, url, description, category, is_private) VALUES (?, ?, ?, ?, ?)'
          ).bind(
            title, 
            url, 
            description || '', 
            category || '', 
            is_private ? 1 : 0
          ).run();
          imported++;
        }
      } catch (error) {
        console.error('Failed to import bookmark:', error);
        errors++;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      imported, 
      errors,
      message: `Successfully imported ${imported} bookmarks with ${errors} errors`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
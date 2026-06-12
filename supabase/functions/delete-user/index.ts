// Supabase Edge Function: delete-user
// Securely deletes the authenticated user from auth.users.
// All related data is cleaned up via ON DELETE CASCADE foreign keys.
// Called from the mobile app via supabase.functions.invoke("delete-user")

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // 1. Verify the caller is authenticated
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create an admin client with the service_role key
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Get the authenticated user from the JWT
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Parse request body for optional confirmation
  const body = await req.json().catch(() => ({}));
  const targetUserId = body.userId ?? user.id;

  // 3. Verify the user is only deleting themselves (or could add admin check here)
  if (targetUserId !== user.id) {
    return new Response(JSON.stringify({ error: "You can only delete your own account" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Delete the user from auth.users
  // All related data is cleaned up automatically via ON DELETE CASCADE
  const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ message: "Account deleted successfully" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

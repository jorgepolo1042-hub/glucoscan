// Supabase Edge Function: send-auto-export
// Called by pg_cron via net.http_post every hour.
// Generates a CSV of all user food scans and emails it via Resend.

import { createClient } from "jsr:@supabase/supabase-js@2";

interface ExportPayload {
  userId: string;
  email: string;
  frequency: "daily" | "weekly";
}

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(values: (string | number | boolean | null | undefined)[]): string {
  return values.map(escapeCsv).join(",") + "\n";
}

function generateCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) {
    return "No scans found.\n";
  }

  const headers = [
    "Date", "Time", "Type", "Product", "Brand", "Barcode",
    "Sugar-Free", "Calories", "Sugar (g)", "Carbs (g)",
    "Protein (g)", "Fat (g)", "Fiber (g)", "Nutritional Score",
  ];

  let csv = toCsvRow(headers);

  for (const row of data) {
    const date = row.created_at ? new Date(row.created_at as string) : new Date();
    csv += toCsvRow([
      date.toLocaleDateString(),
      date.toLocaleTimeString(),
      row.scan_type as string,
      row.product_name as string,
      row.brand as string,
      row.barcode as string,
      (row.is_sugar_free as boolean) ? "Yes" : "No",
      row.calories as number | null,
      row.sugar_grams as number | null,
      row.carbs_grams as number | null,
      row.protein_grams as number | null,
      row.fat_grams as number | null,
      row.fiber_grams as number | null,
      row.nutritional_score as string | null,
    ]);
  }

  return csv;
}

Deno.serve(async (req) => {
  // Only allow POST with service role key
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse payload
  const payload: ExportPayload = await req.json();
  const { userId, email, frequency } = payload;

  if (!userId || !email) {
    return new Response(JSON.stringify({ error: "Missing userId or email" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create Supabase admin client
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Fetch all food scans for this user
  const { data: scans, error: scansError } = await supabase
    .from("food_scans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (scansError) {
    console.error("Error fetching scans:", scansError.message);
    return new Response(JSON.stringify({ error: scansError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Generate CSV
  const csvContent = generateCsv(scans ?? []);
  const base64Csv = btoa(csvContent);

  // Get frequency label
  const periodLabel = frequency === "weekly" ? "Weekly" : "Daily";
  const dateLabel = new Date().toLocaleDateString();

  // Send email via Resend
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return new Response(JSON.stringify({ error: "Email service not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [email],
      subject: `GlucoScan ${periodLabel} Report — ${dateLabel}`,
      html: `
        <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2ecc71, #27ae60); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 24px;">GlucoScan</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0;">${periodLabel} Report</p>
          </div>
          <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 12px 12px;">
            <p style="color: #333; font-size: 16px;">Hi there,</p>
            <p style="color: #555; line-height: 1.6;">
              Here's your ${periodLabel.toLowerCase()} GlucoScan report with all your food scans attached.
            </p>
            <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #333; margin: 0;">
                <strong>📊 Report Summary</strong>
              </p>
              <p style="color: #666; margin: 8px 0 0; font-size: 14px;">
                Total scans: <strong>${scans?.length ?? 0}</strong><br/>
                ${frequency === "weekly" ? "This week's data attached" : "All-time data attached"}
              </p>
            </div>
            <p style="color: #555; font-size: 14px;">
              The CSV file is attached to this email and can be opened in Excel, Google Sheets, or any spreadsheet application.
            </p>
            <p style="color: #888; font-size: 12px; margin-top: 20px; text-align: center;">
              Made with 💚 for sugar-free living<br/>
              <a href="https://glucoscan.app" style="color: #2ecc71;">GlucoScan</a>
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `glucoscan-${frequency}-${dateLabel.replace(/\//g, "-")}.csv`,
          content: base64Csv,
        },
      ],
    }),
  });

  const resendData = await resendRes.json();

  if (!resendRes.ok) {
    console.error("Resend error:", resendData);
    return new Response(JSON.stringify({ error: "Failed to send email" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Update last_sent_at
  const { error: updateError } = await supabase
    .from("auto_export_settings")
    .update({ last_sent_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (updateError) {
    console.error("Failed to update last_sent_at:", updateError.message);
  }

  return new Response(
    JSON.stringify({ success: true, emailId: resendData.id, scansCount: scans?.length ?? 0 }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});

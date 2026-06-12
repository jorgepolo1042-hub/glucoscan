import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import * as MailComposer from "expo-mail-composer";
import { getRecentScans } from "./scanService";
import { getStreakData } from "./streakService";
import type { FoodScan } from "../types/database.types";
import type { StreakEntry } from "./streakService";

// ── CSV helpers ─────────────────────────────────────────

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

// ── Generate CSV content ────────────────────────────────

function generateScansCsv(scans: FoodScan[]): string {
  let csv = "";

  csv += toCsvRow([
    "Date", "Time", "Type", "Product", "Brand", "Barcode",
    "Sugar-Free", "Calories", "Sugar (g)", "Carbs (g)",
    "Protein (g)", "Fat (g)", "Fiber (g)", "Nutritional Score", "Ingredients",
  ]);

  for (const scan of scans) {
    const date = new Date(scan.created_at);
    csv += toCsvRow([
      date.toLocaleDateString(),
      date.toLocaleTimeString(),
      scan.scan_type,
      scan.product_name,
      scan.brand,
      scan.barcode,
      scan.is_sugar_free ? "Yes" : "No",
      scan.calories,
      scan.sugar_grams,
      scan.carbs_grams,
      scan.protein_grams,
      scan.fat_grams,
      scan.fiber_grams,
      scan.nutritional_score,
      scan.ingredients,
    ]);
  }

  return csv;
}

function generateStreaksCsv(
  entries: { date: string; is_sugar_free: boolean; notes: string | null }[]
): string {
  let csv = "";
  csv += toCsvRow(["Date", "Sugar-Free", "Notes"]);
  for (const entry of entries) {
    csv += toCsvRow([entry.date, entry.is_sugar_free ? "Yes" : "No", entry.notes]);
  }
  return csv;
}

// ── Date range ──────────────────────────────────────────

export type DateRangePreset = "7d" | "30d" | "90d" | "all" | "custom";

export interface DateRange {
  preset: DateRangePreset;
  startDate?: string; // ISO string, only for "custom"
  endDate?: string;   // ISO string, only for "custom"
}

export const DATE_RANGE_LABELS: Record<DateRangePreset, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
  custom: "Custom",
};

function getDateRangeStart(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function filterScansByDate(scans: FoodScan[], range: DateRange): FoodScan[] {
  if (range.preset === "all") return scans;

  let startStr: string;
  if (range.preset === "custom" && range.startDate) {
    startStr = range.startDate;
  } else if (range.preset === "custom") {
    // Custom selected but no date entered — show all
    return scans;
  } else {
    const days = range.preset === "7d" ? 7 : range.preset === "30d" ? 30 : 90;
    startStr = getDateRangeStart(days);
  }

  const start = new Date(startStr).getTime();
  // If start is invalid, show all
  if (isNaN(start)) return scans;
  const end = range.endDate ? new Date(range.endDate).getTime() : Infinity;

  return scans.filter((s) => {
    const t = new Date(s.created_at).getTime();
    return t >= start && t <= end;
  });
}

function filterStreakEntriesByDate(
  entries: StreakEntry[],
  range: DateRange
): StreakEntry[] {
  if (range.preset === "all") return entries;

  let startStr: string;
  if (range.preset === "custom" && range.startDate) {
    startStr = range.startDate;
  } else if (range.preset === "custom") {
    return entries; // no date entered — show all
  } else {
    const days = range.preset === "7d" ? 7 : range.preset === "30d" ? 30 : 90;
    startStr = getDateRangeStart(days);
  }

  const start = new Date(startStr).getTime();
  if (isNaN(start)) return entries;
  const end = range.endDate ? new Date(range.endDate).getTime() : Infinity;

  return entries.filter((e) => {
    const t = new Date(e.date).getTime();
    return t >= start && t <= end;
  });
}

// ── Compute stats shared by all export formats ─────────

interface ReportStats {
  totalScans: number;
  sugarFreeScans: number;
  sugarScans: number;
  sugarFreeRate: number;
  daysTracked: number;
  currentStreak: number;
  longestStreak: number;
  avgCaloriesPerScan: number | null;
  avgSugarGPerScan: number | null;
}

function computeStats(
  scans: FoodScan[],
  streakData: { currentStreak: number; longestStreak: number; streakHistory: StreakEntry[] }
): ReportStats {
  const totalScans = scans.length;
  const sugarFreeScans = scans.filter((s) => s.is_sugar_free).length;
  const sugarScans = totalScans - sugarFreeScans;
  const sugarFreeRate = totalScans > 0 ? Math.round((sugarFreeScans / totalScans) * 100) : 0;

  const scansWithCalories = scans.filter((s) => s.calories != null);
  const avgCaloriesPerScan =
    scansWithCalories.length > 0
      ? Math.round(
          scansWithCalories.reduce((sum, s) => sum + (s.calories ?? 0), 0) /
            scansWithCalories.length
        )
      : null;

  const scansWithSugar = scans.filter((s) => s.sugar_grams != null);
  const avgSugarGPerScan =
    scansWithSugar.length > 0
      ? Math.round(
          (scansWithSugar.reduce((sum, s) => sum + (s.sugar_grams ?? 0), 0) /
            scansWithSugar.length) *
            10
        ) / 10
      : null;

  return {
    totalScans,
    sugarFreeScans,
    sugarScans,
    sugarFreeRate,
    daysTracked: streakData.streakHistory.length,
    currentStreak: streakData.currentStreak,
    longestStreak: streakData.longestStreak,
    avgCaloriesPerScan,
    avgSugarGPerScan,
  };
}

// ── Generate SVG bar chart (scan distribution) ──────────

function scanDistributionSvg(stats: ReportStats): string {
  const barWidth = 500;
  const barHeight = 36;
  const greenWidth = stats.totalScans > 0 ? (stats.sugarFreeScans / stats.totalScans) * barWidth : 0;
  const redWidth = barWidth - greenWidth;
  const radius = 6;

  return `
  <div style="margin: 20px 0;">
    <svg width="${barWidth}" height="60" viewBox="0 0 ${barWidth} 60">
      <defs>
        <linearGradient id="greenGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#2ecc71"/>
          <stop offset="100%" stop-color="#27ae60"/>
        </linearGradient>
        <linearGradient id="redGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#e74c3c"/>
          <stop offset="100%" stop-color="#c0392b"/>
        </linearGradient>
      </defs>
      ${
        greenWidth > 0
          ? `<rect x="0" y="12" width="${greenWidth}" height="${barHeight}" rx="${radius}" ry="${radius}" fill="url(#greenGrad)" />`
          : ""
      }
      ${
        redWidth > 0
          ? `<rect x="${greenWidth}" y="12" width="${redWidth}" height="${barHeight}" rx="${radius}" ry="${radius}" fill="url(#redGrad)" />`
          : ""
      }
      <text x="${barWidth / 2}" y="35" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">
        ${stats.sugarFreeRate}% sugar-free (${stats.sugarFreeScans} / ${stats.totalScans})
      </text>
    </svg>
    <div style="display:flex;justify-content:center;gap:30px;font-size:13px;margin-top:4px;">
      <span><span style="color:#2ecc71;">●</span> Sugar-Free: ${stats.sugarFreeScans}</span>
      <span><span style="color:#e74c3c;">●</span> Contains Sugar: ${stats.sugarScans}</span>
    </div>
  </div>`;
}

// ── Generate SVG weekly trend chart (scans per day of week) ─

interface DayStats {
  label: string;
  total: number;
  sugarFree: number;
  sugar: number;
  rate: number; // sugar-free percentage
}

function weeklyTrendSvg(scans: FoodScan[]): string {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fullNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Aggregate scans by day of week
  const dayBuckets: DayStats[] = dayNames.map((label, i) => ({
    label,
    total: 0,
    sugarFree: 0,
    sugar: 0,
    rate: 0,
  }));

  for (const s of scans) {
    const d = new Date(s.created_at);
    const dayIndex = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const bucket = dayBuckets[dayIndex];
    bucket.total++;
    if (s.is_sugar_free) {
      bucket.sugarFree++;
    } else {
      bucket.sugar++;
    }
  }

  // Compute rates
  for (const b of dayBuckets) {
    b.rate = b.total > 0 ? Math.round((b.sugarFree / b.total) * 100) : 0;
  }

  // Find max for scaling
  const maxScans = Math.max(...dayBuckets.map((b) => b.total), 1);

  const chartWidth = 560;
  const chartHeight = 240;
  const barAreaTop = 10;
  const barAreaBottom = 40;
  const barAreaHeight = chartHeight - barAreaBottom - barAreaTop;
  const colWidth = chartWidth / 7;
  const barWidth = Math.min(colWidth - 14, 56);
  const barPadding = (colWidth - barWidth) / 2;

  // Build bars
  const bars = dayBuckets
    .map((b, i) => {
      const x = i * colWidth + barPadding;
      const greenH = b.total > 0 ? (b.sugarFree / maxScans) * barAreaHeight : 0;
      const redH = b.total > 0 ? (b.sugar / maxScans) * barAreaHeight : 0;
      const greenY = barAreaTop + barAreaHeight - greenH;
      const redY = greenY - redH;

      return `
      <!-- ${fullNames[i]}: ${b.total} scans, ${b.rate}% sugar-free -->
      ${
        redH > 0
          ? `<rect x="${x}" y="${redY}" width="${barWidth}" height="${redH}" rx="3" ry="3" fill="url(#trendRed)" />`
          : ""
      }
      ${
        greenH > 0
          ? `<rect x="${x}" y="${greenY}" width="${barWidth}" height="${greenH}" rx="3" ry="3" fill="url(#trendGreen)" />`
          : ""
      }
      <!-- Day label -->
      <text x="${x + barWidth / 2}" y="${chartHeight - 8}" text-anchor="middle" fill="#888" font-size="11">${b.label}</text>
      <!-- Rate label on top -->
      ${
        b.total > 0
          ? `<text x="${x + barWidth / 2}" y="${greenY - 6}" text-anchor="middle" fill="#aaa" font-size="9">${b.rate}%</text>`
          : ""
      }`;
    })
    .join("\n");

  // Y-axis labels
  const ySteps = [0, 25, 50, 75, 100];
  const yLabels = ySteps
    .map((pct) => {
      const val = Math.round((pct / 100) * maxScans);
      const y = barAreaTop + barAreaHeight - (pct / 100) * barAreaHeight;
      return `<text x="-4" y="${y + 3}" text-anchor="end" fill="#666" font-size="9">${val}</text>`;
    })
    .join("\n");

  const gridlines = ySteps
    .map((pct) => {
      const y = barAreaTop + barAreaHeight - (pct / 100) * barAreaHeight;
      return `<line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="#2c2c2c" stroke-width="1" />`;
    })
    .join("\n");

  return `
  <svg width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}">
    <defs>
      <linearGradient id="trendGreen" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#1a8a44"/>
        <stop offset="100%" stop-color="#2ecc71"/>
      </linearGradient>
      <linearGradient id="trendRed" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#a0322a"/>
        <stop offset="100%" stop-color="#e74c3c"/>
      </linearGradient>
    </defs>
    <!-- Gridlines -->
    ${gridlines}
    <!-- Bars -->
    ${bars}
    <!-- Y-axis label -->
    <text x="-4" y="${barAreaTop + 3}" text-anchor="end" fill="#666" font-size="9">${maxScans}</text>
    <text x="-4" y="${barAreaTop + barAreaHeight + 3}" text-anchor="end" fill="#666" font-size="9">0</text>
  </svg>
  <div style="display:flex;justify-content:center;gap:24px;font-size:12px;margin-top:4px;">
    <span><span style="color:#2ecc71;">▬</span> Sugar-Free</span>
    <span><span style="color:#e74c3c;">▬</span> Contains Sugar</span>
  </div>`;
}

// ── Generate SVG streak calendar (last 30/60 days) ──────

function streakCalendarSvg(entries: StreakEntry[]): string {
  const daysToShow = 60;
  const cellSize = 14;
  const cellGap = 3;
  const cols = 10; // 10 columns of 6 days each = 60 days

  // Build a map of date -> is_sugar_free for quick lookup
  const entryMap = new Map<string, boolean>();
  for (const e of entries) {
    entryMap.set(e.date, e.is_sugar_free);
  }

  // Generate the last N days
  const today = new Date();
  const dayCells: string[] = [];
  for (let i = daysToShow - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const monthDay = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;

    const entry = entryMap.get(dateStr);
    let fill: string;
    if (entry === true) {
      fill = "#2ecc71";
    } else if (entry === false) {
      fill = "#e74c3c";
    } else {
      fill = "#2c2c2c";
    }

    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * (cellSize + cellGap);
    const y = row * (cellSize + cellGap);

    dayCells.push(`
      <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="3" ry="3" fill="${fill}">
        <title>${dateStr}: ${entry === true ? "Sugar-Free ✅" : entry === false ? "Not sugar-free 🍬" : "No data"}</title>
      </rect>
    `);
  }

  // Add day-of-week labels
  const labels = ["Mon", "Wed", "Fri"];
  const labelYs = [0, 2, 4].map(
    (r) => r * (cellSize + cellGap) + cellSize / 2 + 4
  );

  const totalWidth = cols * (cellSize + cellGap) + 40;
  const totalHeight = Math.ceil(daysToShow / cols) * (cellSize + cellGap) + 30;

  return `
  <svg width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
    ${labelYs
      .map(
        (ly, i) =>
          `<text x="0" y="${ly}" fill="#888" font-size="10">${labels[i]}</text>`
      )
      .join("")}
    ${dayCells.join("")}
    <text x="0" y="${totalHeight - 4}" fill="#888" font-size="9">Last ${daysToShow} days</text>
    <rect x="${totalWidth - 70}" y="${totalHeight - 18}" width="10" height="10" rx="2" fill="#2c2c2c" />
    <text x="${totalWidth - 56}" y="${totalHeight - 8}" fill="#888" font-size="9">No data</text>
    <rect x="${totalWidth - 40}" y="${totalHeight - 18}" width="10" height="10" rx="2" fill="#2ecc71" />
    <text x="${totalWidth - 26}" y="${totalHeight - 8}" fill="#888" font-size="9">✅</text>
    <rect x="${totalWidth - 105}" y="${totalHeight - 18}" width="10" height="10" rx="2" fill="#e74c3c" />
    <text x="${totalWidth - 91}" y="${totalHeight - 8}" fill="#888" font-size="9">🍬</text>
  </svg>`;
}

// ── Generate PDF report HTML ────────────────────────────

export async function exportDataAsPdf(userId: string, dateRange?: DateRange): Promise<void> {
  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (!isSharingAvailable) {
    throw new Error("Sharing is not available on this device");
  }

  const [scans, streakData] = await Promise.all([
    getRecentScans(99999),
    getStreakData(userId),
  ]);

  const range = dateRange ?? { preset: "all" };
  const filteredScans = filterScansByDate(scans, range);

  const stats = computeStats(filteredScans, streakData);
  const generatedDate = new Date().toLocaleString();

  // Latest 20 scans for the table
  const recentTableScans = filteredScans.slice(0, 20);

  // Build the HTML (use allScans for weekly trend, filtered for stats/table)
  const html = buildPdfHtml(stats, filteredScans, recentTableScans, streakData.streakHistory, generatedDate);

  const { uri } = await Print.printToFileAsync({ html });

  // Copy to a shareable location
  const cacheDir = (FileSystem as unknown as { cacheDirectory: string }).cacheDirectory ?? "";
  const destPath = `${cacheDir}glucoscan-report.pdf`;
  await FileSystem.copyAsync({ from: uri, to: destPath });

  await Sharing.shareAsync(destPath, {
    mimeType: "application/pdf",
    dialogTitle: "Share GlucoScan Report",
    UTI: "com.adobe.pdf",
  });
}

function buildPdfHtml(
  stats: ReportStats,
  allScans: FoodScan[],
  recentScans: FoodScan[],
  streakEntries: StreakEntry[],
  generatedDate: string
): string {
  const scanChart = scanDistributionSvg(stats);
  const streakChart = streakCalendarSvg(streakEntries);
  const weeklyChart = weeklyTrendSvg(allScans);

  // Build scans table rows
  const tableRows = recentScans
    .map((s) => {
      const date = new Date(s.created_at);
      const dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      const status = s.is_sugar_free
        ? '<span style="color:#2ecc71;">✅ Sugar-Free</span>'
        : '<span style="color:#e74c3c;">🍬 Contains Sugar</span>';
      const sugar = s.sugar_grams != null ? `${s.sugar_grams}g` : "—";
      const calories = s.calories != null ? `${s.calories}` : "—";
      return `<tr>
        <td>${dateStr}</td>
        <td>${s.product_name || s.barcode || "Unknown"}</td>
        <td style="text-align:center;">${sugar}</td>
        <td style="text-align:center;">${calories}</td>
        <td>${status}</td>
      </tr>`;
    })
    .join("\n");

  const avgCalHtml =
    stats.avgCaloriesPerScan != null
      ? `<div class="stat-box"><span class="stat-number">${stats.avgCaloriesPerScan}</span><span class="stat-label">Avg Calories / Scan</span></div>`
      : "";

  const avgSugarHtml =
    stats.avgSugarGPerScan != null
      ? `<div class="stat-box"><span class="stat-number">${stats.avgSugarGPerScan}g</span><span class="stat-label">Avg Sugar / Scan</span></div>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 16px; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, Helvetica, Arial, sans-serif;
      background: #121212;
      color: #eee;
      padding: 20px;
      margin: 0;
    }
    .header {
      text-align: center;
      padding-bottom: 16px;
      border-bottom: 2px solid #2ecc71;
      margin-bottom: 24px;
    }
    .header h1 {
      color: #2ecc71;
      margin: 0 0 4px;
      font-size: 26px;
      letter-spacing: -0.5px;
    }
    .header p {
      color: #888;
      margin: 0;
      font-size: 12px;
    }
    .section-title {
      color: #2ecc71;
      font-size: 16px;
      font-weight: 700;
      margin: 28px 0 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .stats-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
    }
    .stat-box {
      background: #1e1e1e;
      border-radius: 10px;
      padding: 14px 18px;
      min-width: 120px;
      text-align: center;
      flex: 1;
    }
    .stat-number {
      display: block;
      color: #fff;
      font-size: 24px;
      font-weight: 800;
    }
    .stat-label {
      display: block;
      color: #888;
      font-size: 11px;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stat-number.green { color: #2ecc71; }
    .stat-number.red { color: #e74c3c; }
    .chart-container {
      background: #1e1e1e;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      margin: 12px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      background: #1e1e1e;
      border-radius: 10px;
      overflow: hidden;
    }
    th {
      background: #2c2c2c;
      color: #aaa;
      padding: 8px 10px;
      text-align: left;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #2c2c2c;
      color: #ddd;
    }
    tr:last-child td { border-bottom: none; }
    .footer {
      text-align: center;
      color: #555;
      font-size: 10px;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #2c2c2c;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>GlucoScan Report</h1>
    <p>Generated ${generatedDate}</p>
  </div>

  <!-- Summary Stats -->
  <div class="stats-grid">
    <div class="stat-box">
      <span class="stat-number">${stats.totalScans}</span>
      <span class="stat-label">Total Scans</span>
    </div>
    <div class="stat-box">
      <span class="stat-number green">${stats.sugarFreeRate}%</span>
      <span class="stat-label">Sugar-Free Rate</span>
    </div>
    <div class="stat-box">
      <span class="stat-number">${stats.daysTracked}</span>
      <span class="stat-label">Days Tracked</span>
    </div>
    <div class="stat-box">
      <span class="stat-number green">${stats.currentStreak}</span>
      <span class="stat-label">Current Streak</span>
    </div>
    <div class="stat-box">
      <span class="stat-number">${stats.longestStreak}</span>
      <span class="stat-label">Longest Streak</span>
    </div>
    ${avgCalHtml}
    ${avgSugarHtml}
  </div>

  <!-- Scan Distribution Chart -->
  <div class="section-title">Scan Distribution</div>
  <div class="chart-container">
    ${scanChart}
  </div>

  <!-- Weekly Trend -->
  <div class="section-title">Weekly Trend (Scans per Day)</div>
  <div class="chart-container">
    ${weeklyChart}
  </div>

  <!-- Streak Calendar -->
  <div class="section-title">Streak Calendar (Last 60 Days)</div>
  <div class="chart-container">
    ${streakChart}
  </div>

  <!-- Recent Scans Table -->
  <div class="section-title">Recent Scans (Last ${recentScans.length})</div>
  <div style="overflow-x:auto;">
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Product</th>
          <th style="text-align:center;">Sugar</th>
          <th style="text-align:center;">Cal</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows || '<tr><td colspan="5" style="text-align:center;color:#666;padding:20px;">No scans yet</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="footer">
    GlucoScan — Made with 💚 for sugar-free living
  </div>
</body>
</html>`;
}

// ── TXT export ──────────────────────────────────────────

function generateTxtReport(
  stats: ReportStats,
  scans: FoodScan[],
  streakEntries: StreakEntry[],
  generatedDate: string
): string {
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════");
  lines.push("           GLUCOSCAN DATA REPORT");
  lines.push("═══════════════════════════════════════════");
  lines.push(`Generated: ${generatedDate}`);
  lines.push("");

  // ── Summary ──
  lines.push("─── SUMMARY ───");
  lines.push(`Total Scans:            ${stats.totalScans}`);
  lines.push(`Sugar-Free Scans:       ${stats.sugarFreeScans}`);
  lines.push(`Scans with Sugar:       ${stats.sugarScans}`);
  lines.push(`Sugar-Free Rate:        ${stats.sugarFreeRate}%`);
  lines.push(`Days Tracked:           ${stats.daysTracked}`);
  lines.push(`Current Streak:         ${stats.currentStreak} days`);
  lines.push(`Longest Streak:         ${stats.longestStreak} days`);
  if (stats.avgCaloriesPerScan != null) {
    lines.push(`Avg Calories / Scan:    ${stats.avgCaloriesPerScan}`);
  }
  if (stats.avgSugarGPerScan != null) {
    lines.push(`Avg Sugar / Scan:       ${stats.avgSugarGPerScan}g`);
  }
  lines.push("");

  // ── Distribution Bar (ASCII) ──
  lines.push("─── SCAN DISTRIBUTION ───");
  const barWidth = 30;
  const greenBars = stats.totalScans > 0 ? Math.round((stats.sugarFreeScans / stats.totalScans) * barWidth) : 0;
  const redBars = barWidth - greenBars;
  const greenBar = "🟩".repeat(greenBars);
  const redBar = "🟥".repeat(redBars);
  lines.push(`  ${greenBar}${redBar}  ${stats.sugarFreeRate}%`);
  lines.push(`  🟩 Sugar-Free: ${stats.sugarFreeScans}  🟥 Contains Sugar: ${stats.sugarScans}`);
  lines.push("");

  // ── Streak Calendar (ASCII) ──
  lines.push("─── STREAK HISTORY (Last 30 Days) ───");
  const entryMap = new Map<string, boolean>();
  for (const e of streakEntries) {
    entryMap.set(e.date, e.is_sugar_free);
  }
  const today = new Date();
  let calRow = "";
  let calDateRow = "";
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = entryMap.get(dateStr);
    if (entry === true) calRow += "✅";
    else if (entry === false) calRow += "🍬";
    else calRow += "⬜";
    if (i % 7 === 0 && i < 29) {
      calRow += "\n";
    }
  }
  lines.push(calRow);
  lines.push("  ✅ Sugar-Free  🍬 Has Sugar  ⬜ No Data");
  lines.push("");

  // ── Recent Scans ──
  lines.push("─── RECENT SCANS ───");
  const recentScans = scans.slice(0, 15);
  for (const s of recentScans) {
    const date = new Date(s.created_at);
    const dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    const status = s.is_sugar_free ? "✅" : "🍬";
    const name = s.product_name || s.barcode || "Unknown";
    const sugar = s.sugar_grams != null ? `${s.sugar_grams}g` : "—";
    const cal = s.calories != null ? `${s.calories}cal` : "—";
    lines.push(`  ${dateStr}  ${status}  ${name.padEnd(25).slice(0, 25)}  Sugar: ${sugar.padEnd(6)}  Cal: ${cal}`);
  }
  if (recentScans.length === 0) {
    lines.push("  No scans yet.");
  }
  if (scans.length > 15) {
    lines.push(`  ... and ${scans.length - 15} more scans`);
  }
  lines.push("");

  // ── Streak Entries ──
  if (streakEntries.length > 0) {
    lines.push("─── STREAK ENTRIES ───");
    for (const e of streakEntries.slice(0, 30)) {
      const status = e.is_sugar_free ? "✅ Sugar-Free" : "🍬 Has Sugar";
      const notes = e.notes ? ` — ${e.notes}` : "";
      lines.push(`  ${e.date}  ${status}${notes}`);
    }
    if (streakEntries.length > 30) {
      lines.push(`  ... and ${streakEntries.length - 30} more entries`);
    }
  }
  lines.push("");
  lines.push("═══════════════════════════════════════════");
  lines.push("  GlucoScan — Made with 💚 for sugar-free living");
  lines.push("═══════════════════════════════════════════");

  return lines.join("\n");
}

export async function exportDataAsTxt(userId: string, dateRange?: DateRange): Promise<void> {
  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (!isSharingAvailable) {
    throw new Error("Sharing is not available on this device");
  }

  const [scans, streakData] = await Promise.all([
    getRecentScans(99999),
    getStreakData(userId),
  ]);

  const range = dateRange ?? { preset: "all" };
  const filteredScans = filterScansByDate(scans, range);

  const stats = computeStats(filteredScans, streakData);
  const generatedDate = new Date().toLocaleString();
  const txt = generateTxtReport(stats, filteredScans, streakData.streakHistory, generatedDate);

  const cacheDir = (FileSystem as unknown as { cacheDirectory: string }).cacheDirectory ?? "";
  const filePath = `${cacheDir}glucoscan-report.txt`;
  await FileSystem.writeAsStringAsync(filePath, txt);

  await Sharing.shareAsync(filePath, {
    mimeType: "text/plain",
    dialogTitle: "Share GlucoScan Report",
  });
}

// ── CSV export ──────────────────────────────────────────

export async function exportData(userId: string, dateRange?: DateRange): Promise<void> {
  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (!isSharingAvailable) {
    throw new Error("Sharing is not available on this device");
  }

  // Fetch data using existing services
  const [scans, streakData] = await Promise.all([
    getRecentScans(99999),
    getStreakData(userId),
  ]);

  const range = dateRange ?? { preset: "all" };
  const filteredScans = filterScansByDate(scans, range);
  const filteredStreaks = filterStreakEntriesByDate(streakData.streakHistory, range);

  const scansCsv = generateScansCsv(filteredScans);
  const streaksCsv = generateStreaksCsv(filteredStreaks);

  const stats = computeStats(filteredScans, streakData);

  // Combine everything into a single comprehensive CSV file
  const combinedCsv = [
    `# GlucoScan Data Export — ${new Date().toLocaleString()}`,
    `# ======================================`,
    `#`,
    `# SUMMARY`,
    `# Total Scans: ${stats.totalScans}`,
    `# Sugar-Free Scans: ${stats.sugarFreeScans}`,
    `# Sugar-Free Rate: ${stats.sugarFreeRate}%`,
    `# Total Days Tracked: ${stats.daysTracked}`,
    `# Current Streak: ${stats.currentStreak} days`,
    `# Longest Streak: ${stats.longestStreak} days`,
    `#`,
    `# ======================================`,
    `#`,
    `# === FOOD SCANS ===`,
    scansCsv,
    `#`,
    `# === STREAK HISTORY ===`,
    streaksCsv,
  ].join("\n");

  // Write and share the combined file
  const cacheDir = (FileSystem as unknown as { cacheDirectory: string }).cacheDirectory ?? "";
  const filePath = `${cacheDir}glucoscan-export.csv`;
  await FileSystem.writeAsStringAsync(filePath, combinedCsv);

  await Sharing.shareAsync(filePath, {
    mimeType: "text/csv",
    dialogTitle: "Export GlucoScan Data",
  });
}

// ── Share PDF via Email ─────────────────────────────────

export async function sharePdfViaEmail(userId: string, dateRange?: DateRange): Promise<void> {
  const isAvailable = await MailComposer.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("No email client is available on this device");
  }

  // Generate PDF first
  const [scans, streakData] = await Promise.all([
    getRecentScans(99999),
    getStreakData(userId),
  ]);

  const range = dateRange ?? { preset: "all" };
  const filteredScans = filterScansByDate(scans, range);
  const stats = computeStats(filteredScans, streakData);
  const generatedDate = new Date().toLocaleString();
  const recentTableScans = filteredScans.slice(0, 20);
  const html = buildPdfHtml(stats, filteredScans, recentTableScans, streakData.streakHistory, generatedDate);

  const { uri } = await Print.printToFileAsync({ html });

  // Copy to a stable location
  const cacheDir = (FileSystem as unknown as { cacheDirectory: string }).cacheDirectory ?? "";
  const destPath = `${cacheDir}glucoscan-report.pdf`;
  await FileSystem.copyAsync({ from: uri, to: destPath });

  // Build email body with summary
  const sugarFreeRate = stats.sugarFreeRate;
  const emailBody = [
    `<div style="font-family: sans-serif; max-width: 600px;">`,
    `<h2 style="color: #2ecc71;">GlucoScan Report</h2>`,
    `<p>Here's your latest GlucoScan data report generated on <strong>${generatedDate}</strong>.</p>`,
    `<hr style="border: none; border-top: 1px solid #e0e0e0;" />`,
    `<table style="width: 100%; font-size: 14px;">`,
    `<tr><td><strong>Total Scans</strong></td><td style="text-align: right;">${stats.totalScans}</td></tr>`,
    `<tr><td><strong>Sugar-Free Rate</strong></td><td style="text-align: right; color: ${sugarFreeRate >= 70 ? "#2ecc71" : "#e74c3c"};">${sugarFreeRate}%</td></tr>`,
    `<tr><td><strong>Current Streak</strong></td><td style="text-align: right;">${stats.currentStreak} days</td></tr>`,
    `<tr><td><strong>Longest Streak</strong></td><td style="text-align: right;">${stats.longestStreak} days</td></tr>`,
    `<tr><td><strong>Days Tracked</strong></td><td style="text-align: right;">${stats.daysTracked}</td></tr>`,
    `</table>`,
    `<hr style="border: none; border-top: 1px solid #e0e0e0;" />`,
    `<p style="color: #888; font-size: 12px;">The full PDF report with charts is attached.</p>`,
    `<p style="color: #888; font-size: 12px;">— GlucoScan, made with 💚 for sugar-free living</p>`,
    `</div>`,
  ].join("\n");

  await MailComposer.composeAsync({
    subject: `GlucoScan Report — ${new Date().toLocaleDateString()}`,
    body: emailBody,
    isHtml: true,
    attachments: [destPath],
  });
}

// ── Export format selector ──────────────────────────────

export type ExportFormat = "csv" | "pdf" | "txt" | "email";

export async function exportDataWithFormat(
  userId: string,
  format: ExportFormat,
  dateRange?: DateRange
): Promise<void> {
  if (format === "pdf") {
    await exportDataAsPdf(userId, dateRange);
  } else if (format === "email") {
    await sharePdfViaEmail(userId, dateRange);
  } else if (format === "txt") {
    await exportDataAsTxt(userId, dateRange);
  } else {
    await exportData(userId, dateRange);
  }
}

/**
 * Get preview text for the UI.
 */
export async function getExportPreview(
  userId: string,
  dateRange?: DateRange
): Promise<string> {
  const [scans, streakData] = await Promise.all([
    getRecentScans(99999),
    getStreakData(userId),
  ]);

  const range = dateRange ?? { preset: "all" };
  const filteredScans = filterScansByDate(scans, range);
  const stats = computeStats(filteredScans, streakData);

  const rangeLabel = DATE_RANGE_LABELS[range.preset];
  return `📊 ${stats.totalScans} scans · ${stats.sugarFreeRate}% sugar-free (${rangeLabel})`;
}

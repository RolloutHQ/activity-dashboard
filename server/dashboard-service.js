import { query } from "./db.js";

const METRICS = {
  newLeadsAssigned: {
    key: "newLeadsAssigned",
    label: "New Leads Assigned",
    table: "rollout_people",
    timeExpr: '"created"',
    whereClause: "TRUE",
  },
  contactsMade: {
    key: "contactsMade",
    label: "Contacts Made",
    aggregate: "manualComms",
  },
  callsMade: {
    key: "callsMade",
    label: "Calls Made",
    table: "rollout_calls",
    timeExpr: '"created"',
    whereClause: 'COALESCE("isIncoming", FALSE) = FALSE',
  },
  textsSent: {
    key: "textsSent",
    label: "Texts Sent (Manual)",
    table: "rollout_text_messages",
    timeExpr: 'COALESCE("sent", "created")',
    whereClause: 'COALESCE("isIncoming", FALSE) = FALSE',
  },
  emailsSent: {
    key: "emailsSent",
    label: "Emails Sent (Manual)",
    table: "rollout_email_messages",
    timeExpr: 'COALESCE("sent", "created")',
    whereClause: 'COALESCE("isIncoming", FALSE) = FALSE',
  },
};

function clampRange(rangeDays) {
  const parsed = Number.parseInt(rangeDays, 10);
  if (Number.isNaN(parsed)) return 90;
  return Math.max(7, Math.min(parsed, 365));
}

function startDate(rangeDays) {
  return new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
}

function normalizeDate(dateValue) {
  return new Date(dateValue).toISOString().slice(0, 10);
}

function fillDailyGaps(points, rangeDays) {
  const pointsByDay = new Map(points.map((p) => [normalizeDate(p.day), Number(p.value)]));
  const series = [];
  const today = new Date();

  for (let i = rangeDays - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - i);
    const dayKey = day.toISOString().slice(0, 10);
    series.push({
      date: dayKey,
      value: pointsByDay.get(dayKey) || 0,
    });
  }

  return series;
}

async function metricTotal(metric, credentialId, fromDate) {
  if (metric.aggregate === "manualComms") {
    const { rows } = await query(
      `
        SELECT (
          (SELECT COUNT(*) FROM public.rollout_calls
            WHERE "credentialId" = $1
              AND "created" >= $2
              AND COALESCE("isIncoming", FALSE) = FALSE)
          +
          (SELECT COUNT(*) FROM public.rollout_text_messages
            WHERE "credentialId" = $1
              AND COALESCE("sent", "created") >= $2
              AND COALESCE("isIncoming", FALSE) = FALSE)
          +
          (SELECT COUNT(*) FROM public.rollout_email_messages
            WHERE "credentialId" = $1
              AND COALESCE("sent", "created") >= $2
              AND COALESCE("isIncoming", FALSE) = FALSE)
        )::int AS value
      `,
      [credentialId, fromDate.toISOString()],
    );

    return Number(rows[0]?.value || 0);
  }

  const sql = `
    SELECT COUNT(*)::int AS value
    FROM public.${metric.table}
    WHERE "credentialId" = $1
      AND ${metric.timeExpr} >= $2
      AND ${metric.whereClause}
  `;

  const { rows } = await query(sql, [credentialId, fromDate.toISOString()]);
  return Number(rows[0]?.value || 0);
}

async function metricTrend(metric, credentialId, fromDate) {
  if (metric.aggregate === "manualComms") {
    const { rows } = await query(
      `
        WITH daily_channel_counts AS (
          SELECT DATE_TRUNC('day', "created") AS day, COUNT(*)::int AS value
          FROM public.rollout_calls
          WHERE "credentialId" = $1
            AND "created" >= $2
            AND COALESCE("isIncoming", FALSE) = FALSE
          GROUP BY 1

          UNION ALL

          SELECT DATE_TRUNC('day', COALESCE("sent", "created")) AS day, COUNT(*)::int AS value
          FROM public.rollout_text_messages
          WHERE "credentialId" = $1
            AND COALESCE("sent", "created") >= $2
            AND COALESCE("isIncoming", FALSE) = FALSE
          GROUP BY 1

          UNION ALL

          SELECT DATE_TRUNC('day', COALESCE("sent", "created")) AS day, COUNT(*)::int AS value
          FROM public.rollout_email_messages
          WHERE "credentialId" = $1
            AND COALESCE("sent", "created") >= $2
            AND COALESCE("isIncoming", FALSE) = FALSE
          GROUP BY 1
        )
        SELECT day, SUM(value)::int AS value
        FROM daily_channel_counts
        GROUP BY 1
        ORDER BY 1
      `,
      [credentialId, fromDate.toISOString()],
    );

    return rows;
  }

  const sql = `
    SELECT DATE_TRUNC('day', ${metric.timeExpr}) AS day, COUNT(*)::int AS value
    FROM public.${metric.table}
    WHERE "credentialId" = $1
      AND ${metric.timeExpr} >= $2
      AND ${metric.whereClause}
    GROUP BY 1
    ORDER BY 1
  `;

  const { rows } = await query(sql, [credentialId, fromDate.toISOString()]);
  return rows;
}

function quoteIdent(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function sourceRowCounts(credentialId) {
  const tableResult = await query(
    `
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name LIKE 'rollout\\_%' ESCAPE '\\'
        AND column_name = 'credentialId'
      ORDER BY table_name
    `,
  );

  if (!tableResult.rows.length) {
    return [];
  }

  const unions = tableResult.rows
    .map(({ table_name: tableName }, index) => {
      const paramRef = `$${index + 1}`;
      return `SELECT '${tableName}' AS table_name, COUNT(*)::int AS value FROM public.${quoteIdent(tableName)} WHERE "credentialId" = ${paramRef}`;
    })
    .join(" UNION ALL ");

  const params = Array.from({ length: tableResult.rows.length }, () => credentialId);
  const { rows } = await query(`${unions} ORDER BY value DESC, table_name ASC`, params);
  return rows.filter((row) => Number(row.value) > 0).map((row) => ({ table: row.table_name, value: Number(row.value) }));
}

async function credentialsList() {
  const tableResult = await query(
    `
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name LIKE 'rollout\\_%' ESCAPE '\\'
        AND column_name = 'credentialId'
      ORDER BY table_name
    `,
  );

  if (!tableResult.rows.length) return [];

  const unions = tableResult.rows
    .map(({ table_name: tableName }) => {
      return `SELECT "credentialId" AS credential_id, "appKey" AS app_key, "updated" AS updated_at FROM public.${quoteIdent(tableName)} WHERE "credentialId" IS NOT NULL`;
    })
    .join(" UNION ALL ");

  const { rows } = await query(
    `
      SELECT credential_id AS "credentialId",
             MAX(app_key) FILTER (WHERE app_key IS NOT NULL) AS "appKey",
             MAX(updated_at) AS "lastSeenAt"
      FROM (${unions}) all_credentials
      GROUP BY credential_id
      ORDER BY "lastSeenAt" DESC NULLS LAST, "credentialId" ASC
      LIMIT 200
    `,
  );

  return rows;
}

export async function getDashboardSummary({
  credentialId,
  metricKey = "contactsMade",
  rangeDays = 90,
}) {
  const clampedRangeDays = clampRange(rangeDays);
  const fromDate = startDate(clampedRangeDays);

  const metrics = Object.values(METRICS);
  const kpis = await Promise.all(
    metrics.map(async (metric) => ({
      key: metric.key,
      label: metric.label,
      value: await metricTotal(metric, credentialId, fromDate),
    })),
  );

  const resolvedMetric = METRICS[metricKey] || METRICS.contactsMade;
  const trendRows = await metricTrend(resolvedMetric, credentialId, fromDate);
  const trend = fillDailyGaps(trendRows, clampedRangeDays);

  const sources = await sourceRowCounts(credentialId);

  return {
    credentialId,
    rangeDays: clampedRangeDays,
    fromDate: fromDate.toISOString(),
    toDate: new Date().toISOString(),
    metrics: kpis,
    availableMetrics: metrics.map((metric) => ({
      key: metric.key,
      label: metric.label,
    })),
    trend: {
      key: resolvedMetric.key,
      label: resolvedMetric.label,
      data: trend,
    },
    sources,
  };
}

export async function listCredentials() {
  return credentialsList();
}

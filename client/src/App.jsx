import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RolloutLinkProvider,
  CredentialsManager,
} from "@rollout/link-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const RANGE_OPTIONS = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "3M", value: 90 },
  { label: "6M", value: 180 },
  { label: "12M", value: 365 },
];

const PAGES = [
  { key: "overview", label: "Agent Activity Overview" },
  { key: "integrations", label: "Integrations" },
];

const FALLBACK_METRIC_OPTIONS = [
  { key: "contactsMade", label: "Contacts Made" },
  { key: "newLeadsAssigned", label: "New Leads Assigned" },
  { key: "callsMade", label: "Calls Made" },
  { key: "textsSent", label: "Texts Sent (Manual)" },
  { key: "emailsSent", label: "Emails Sent (Manual)" },
];

const LOCAL_API_HINT =
  "Run `npm run dev` so both the API server (:4000) and Vite client (:5173) are running.";

const APP_NAME_OVERRIDES = {
  "follow-up-boss": "Follow Up Boss",
  "follow_up_boss": "Follow Up Boss",
  fub: "Follow Up Boss",
  mls: "MLS",
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatDateLabel(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatAppName(appKey) {
  if (!appKey) return "Unknown App";
  const normalized = String(appKey).trim().toLowerCase();
  if (APP_NAME_OVERRIDES[normalized]) return APP_NAME_OVERRIDES[normalized];

  return normalized
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .map((segment) =>
      segment.length <= 3 ? segment.toUpperCase() : `${segment[0].toUpperCase()}${segment.slice(1)}`,
    )
    .join(" ");
}

function credentialIdFromItem(item) {
  return item?.credentialId || item?.id || "";
}

function TinySparkline({ points }) {
  return (
    <div className="kpiSparkline">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <Line type="monotone" dataKey="value" stroke="#2A66FF" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DashboardView({ summary, selectedMetric, onChangeMetric }) {
  const metricOptions = summary.availableMetrics?.length
    ? summary.availableMetrics
    : FALLBACK_METRIC_OPTIONS;

  const chartData = summary.trend?.data || [];
  const sourceRows = summary.sources || [];

  const sparklineByMetric = useMemo(() => {
    const latest = chartData.slice(-20);
    const base = latest.length ? latest : [{ date: "0", value: 0 }];
    return summary.metrics.reduce((acc, metric, index) => {
      acc[metric.key] = base.map((row, rowIndex) => ({
        idx: rowIndex,
        value: Math.max(0, Number(row.value) + (index % 2 === 0 ? index : -index)),
      }));
      return acc;
    }, {});
  }, [chartData, summary.metrics]);

  return (
    <>
      <section className="kpiGrid">
        {summary.metrics.map((metric) => (
          <article className="kpiCard" key={metric.key}>
            <p className="kpiLabel">{metric.label}</p>
            <p className="kpiValue">{formatNumber(metric.value)}</p>
            <TinySparkline points={sparklineByMetric[metric.key] || [{ idx: 0, value: 0 }]} />
          </article>
        ))}
      </section>

      <section className="panel">
        <header className="panelHeader">
          <h2>Business Growth Trend</h2>
          <div className="panelHeaderRight">
            <label htmlFor="metric" className="label">Value</label>
            <select
              id="metric"
              className="select"
              value={selectedMetric}
              onChange={(event) => onChangeMetric(event.target.value)}
            >
              {metricOptions.map((metric) => (
                <option key={metric.key} value={metric.key}>
                  {metric.label}
                </option>
              ))}
            </select>
          </div>
        </header>
        <div className="chartWrap">
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2958EA" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2958EA" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#d6ddf2" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                tick={{ fill: "#5f6a89", fontSize: 12 }}
                stroke="#b5bfd8"
              />
              <YAxis tick={{ fill: "#5f6a89", fontSize: 12 }} stroke="#b5bfd8" />
              <Tooltip
                formatter={(value) => [formatNumber(value), summary.trend?.label || "Count"]}
                labelFormatter={(label) => formatDateLabel(label)}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#2958EA"
                strokeWidth={3}
                fill="url(#activityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <header className="panelHeader">
          <h2>Connected Source Footprint</h2>
          <p className="muted">Rows synced into each `rollout_%` table for this credential.</p>
        </header>
        <div className="sourcesTable">
          <div className="sourcesHead">Table</div>
          <div className="sourcesHead">Rows</div>
          {sourceRows.length ? (
            sourceRows.map((row) => (
              <div className="sourcesRow" key={row.table}>
                <span>{row.table}</span>
                <strong>{formatNumber(row.value)}</strong>
              </div>
            ))
          ) : (
            <>
              <div className="sourcesRow">
                <span>No rows found for this credential yet.</span>
                <strong>0</strong>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("overview");
  const [selectedCredential, setSelectedCredential] = useState("");
  const [rangeDays, setRangeDays] = useState(90);
  const [selectedMetric, setSelectedMetric] = useState("contactsMade");

  const configQuery = useQuery({
    queryKey: ["config"],
    queryFn: () => fetchJson("/api/config"),
    retry: false,
  });

  const credentialsQuery = useQuery({
    queryKey: ["credentials"],
    queryFn: () => fetchJson("/api/credentials"),
    retry: false,
  });

  useEffect(() => {
    if (selectedCredential) return;
    const firstCredential = credentialIdFromItem(credentialsQuery.data?.credentials?.[0]);
    if (firstCredential) {
      setSelectedCredential(firstCredential);
    }
  }, [credentialsQuery.data, selectedCredential]);

  const credentialId = selectedCredential;

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", credentialId, rangeDays, selectedMetric],
    enabled: Boolean(credentialId) && activePage === "overview",
    queryFn: () =>
      fetchJson(
        `/api/dashboard/summary?credentialId=${encodeURIComponent(credentialId)}&rangeDays=${rangeDays}&metric=${encodeURIComponent(selectedMetric)}`,
      ),
    retry: false,
  });

  const rolloutAppKey = configQuery.data?.rolloutAppKey || "";
  const rolloutApiBaseUrl = configQuery.data?.rolloutApiBaseUrl;
  const defaultUserId = configQuery.data?.defaultUserId || "user123";

  const rolloutTokenQuery = useQuery({
    queryKey: ["rollout-token-ready", defaultUserId],
    enabled: Boolean(rolloutAppKey) && !configQuery.isLoading && !configQuery.isError,
    queryFn: () => fetchJson(`/api/rollout/token?userId=${encodeURIComponent(defaultUserId)}`),
    retry: false,
  });

  const generateToken = async (userId) => {
    const effectiveUser = userId || defaultUserId;
    const result = await fetchJson(`/api/rollout/token?userId=${encodeURIComponent(effectiveUser)}`);
    return result.token;
  };

  const handleLinkCredentialAdded = ({ id }) => {
    setSelectedCredential(id);
    credentialsQuery.refetch();
  };

  const handleLinkCredentialDeleted = ({ id }) => {
    if (selectedCredential === id) {
      setSelectedCredential("");
    }
    credentialsQuery.refetch();
  };

  return (
    <main className="appShell">
      <aside className="sidebar">
        <h1 className="brand">Rollout</h1>
        <p className="brandSub">CRM Activity Console</p>
        <nav>
          {PAGES.map((page) => (
            <button
              key={page.key}
              type="button"
              className={activePage === page.key ? "navLink active" : "navLink"}
              onClick={() => setActivePage(page.key)}
            >
              {page.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="content">
        <header className="topBar">
          <div>
            <p className="eyebrow">{activePage === "overview" ? "Reporting" : "Configuration"}</p>
            <h2>{activePage === "overview" ? "Agent Activity Overview" : "Integrations"}</h2>
          </div>
          <span className="refreshTag">
            {activePage === "overview"
              ? "Last Updated: Just now"
              : `Selected Credential: ${credentialId || "None"}`}
          </span>
        </header>

        {activePage === "integrations" ? (
          <section className="integrationPanel">
            <div className="integrationHeader">
              <h3>Rollout Credentials Manager</h3>
              <p>Use Rollout Link to create, remove, and manage CRM credentials.</p>
            </div>

            {configQuery.isLoading ? (
              <p className="muted">Loading Rollout config…</p>
            ) : null}

            {configQuery.isError ? (
              <p className="error">{`${configQuery.error.message}. ${LOCAL_API_HINT}`}</p>
            ) : null}

            {!configQuery.isLoading && !configQuery.isError && !rolloutAppKey ? (
              <p className="muted">
                Set `ROLLOUT_APP_KEY` in `.env` to enable the credentials manager.
              </p>
            ) : null}

            {rolloutAppKey && rolloutTokenQuery.isLoading ? (
              <p className="muted">Checking Rollout token service…</p>
            ) : null}

            {rolloutAppKey && rolloutTokenQuery.isError ? (
              <p className="error">
                {`${rolloutTokenQuery.error.message}. Ensure ROLLOUT_CLIENT_SECRET and ROLLOUT_PROJECT_KEY (or ROLLOUT_CLIENT_ID) are set.`}
              </p>
            ) : null}

            {rolloutAppKey && !rolloutTokenQuery.isLoading && !rolloutTokenQuery.isError ? (
              <RolloutLinkProvider token={generateToken} apiBaseUrl={rolloutApiBaseUrl}>
                <CredentialsManager
                  apiCategories={{ crm: true }}
                  onCredentialAdded={handleLinkCredentialAdded}
                  onCredentialDeleted={handleLinkCredentialDeleted}
                />
              </RolloutLinkProvider>
            ) : null}
          </section>
        ) : (
          <>
            <section className="integrationPanel">
              <div className="integrationHeader">
                <h3>1. Select a credential</h3>
                <p>Pick a credential button below. Each button shows its connected app.</p>
              </div>

              {credentialsQuery.isLoading ? (
                <p className="muted">Loading credentials…</p>
              ) : null}

              {credentialsQuery.isError ? (
                <p className="error">{`${credentialsQuery.error.message}. ${LOCAL_API_HINT}`}</p>
              ) : null}

              {!!credentialsQuery.data?.credentials?.length && (
                <div className="recentCredentials">
                  <p className="selectedCredentialText">
                    Selected: {credentialId || "None"}
                  </p>
                  <div className="credentialButtonWrap">
                    {credentialsQuery.data.credentials.slice(0, 12).map((item) => {
                      const credentialIdValue = credentialIdFromItem(item);
                      if (!credentialIdValue) return null;
                      const isSelected = credentialId === credentialIdValue;
                      const appName = formatAppName(item.appKey);

                      return (
                        <button
                          type="button"
                          key={credentialIdValue}
                          className={isSelected ? "credentialButton active" : "credentialButton"}
                          aria-pressed={isSelected}
                          onClick={() => {
                            setSelectedCredential(credentialIdValue);
                          }}
                        >
                          <span className="credentialApp">{appName}</span>
                          <span className="credentialIdText">{credentialIdValue}</span>
                          {isSelected ? <span className="pillBadge">Selected</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!credentialsQuery.isLoading &&
              !credentialsQuery.isError &&
              !credentialsQuery.data?.credentials?.length ? (
                <p className="muted">
                  No credentials found yet. Use the Integrations tab to connect one.
                </p>
              ) : null}
            </section>

            <section className="filters">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={option.value === rangeDays ? "chip active" : "chip"}
                  onClick={() => setRangeDays(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </section>

            {dashboardQuery.isError && <p className="error">{dashboardQuery.error.message}</p>}

            {!credentialId ? (
              <div className="emptyState">
                <h3>Choose or connect a credential to start</h3>
                <p>This dashboard appears after Rollout integration selection.</p>
              </div>
            ) : null}

            {dashboardQuery.isLoading && credentialId ? (
              <div className="emptyState">
                <h3>Loading dashboard…</h3>
              </div>
            ) : null}

            {dashboardQuery.data ? (
              <DashboardView
                summary={dashboardQuery.data}
                selectedMetric={selectedMetric}
                onChangeMetric={setSelectedMetric}
              />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

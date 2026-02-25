import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RolloutConnectProvider, CredentialInput } from "@rollout/connect-react";
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

const FALLBACK_METRIC_OPTIONS = [
  { key: "contactsMade", label: "Contacts Made" },
  { key: "newLeadsAssigned", label: "New Leads Assigned" },
  { key: "callsMade", label: "Calls Made" },
  { key: "textsSent", label: "Texts Sent (Manual)" },
  { key: "emailsSent", label: "Emails Sent (Manual)" },
];

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
  const [selectedCredential, setSelectedCredential] = useState("");
  const [manualCredential, setManualCredential] = useState("");
  const [rangeDays, setRangeDays] = useState(90);
  const [selectedMetric, setSelectedMetric] = useState("contactsMade");

  const configQuery = useQuery({
    queryKey: ["config"],
    queryFn: () => fetchJson("/api/config"),
  });

  const credentialsQuery = useQuery({
    queryKey: ["credentials"],
    queryFn: () => fetchJson("/api/credentials"),
  });

  useEffect(() => {
    if (selectedCredential || manualCredential) return;
    const firstCredential = credentialsQuery.data?.credentials?.[0]?.credentialId;
    if (firstCredential) {
      setSelectedCredential(firstCredential);
    }
  }, [credentialsQuery.data, selectedCredential, manualCredential]);

  const credentialId = selectedCredential || manualCredential;

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", credentialId, rangeDays, selectedMetric],
    enabled: Boolean(credentialId),
    queryFn: () =>
      fetchJson(
        `/api/dashboard/summary?credentialId=${encodeURIComponent(credentialId)}&rangeDays=${rangeDays}&metric=${encodeURIComponent(selectedMetric)}`,
      ),
  });

  const generateToken = async (userId) => {
    const effectiveUser = userId || configQuery.data?.defaultUserId || "user123";
    const result = await fetchJson(`/api/rollout/token?userId=${encodeURIComponent(effectiveUser)}`);
    return result.token;
  };

  return (
    <main className="appShell">
      <aside className="sidebar">
        <h1 className="brand">Rollout</h1>
        <p className="brandSub">CRM Activity Console</p>
        <nav>
          <a className="navLink active" href="#overview">Agent Activity Overview</a>
          <a className="navLink" href="#overview">Communication</a>
          <a className="navLink" href="#overview">Business Trend</a>
        </nav>
      </aside>

      <div className="content">
        <header className="topBar" id="overview">
          <div>
            <p className="eyebrow">Reporting</p>
            <h2>Agent Activity Overview</h2>
          </div>
          <span className="refreshTag">Last Updated: Just now</span>
        </header>

        <section className="integrationPanel">
          <div className="integrationHeader">
            <h3>1. Connect via Rollout</h3>
            <p>Use the Rollout credential picker or paste an existing credential ID below.</p>
          </div>

          {configQuery.isLoading ? (
            <p className="muted">Loading Rollout config…</p>
          ) : null}

          {configQuery.isError ? (
            <p className="error">{configQuery.error.message}</p>
          ) : null}

          {configQuery.data?.rolloutAppKey ? (
            <RolloutConnectProvider
              apiBaseUrl={configQuery.data.rolloutApiBaseUrl}
              tokenGenerationFn={generateToken}
            >
              <CredentialInput
                appKey={configQuery.data.rolloutAppKey}
                value={selectedCredential}
                onChange={setSelectedCredential}
              />
            </RolloutConnectProvider>
          ) : (
            <p className="muted">
              Set `ROLLOUT_APP_KEY` and `ROLLOUT_API_BASE_URL` in `.env` to enable inline connect.
            </p>
          )}

          <div className="manualCredentialRow">
            <input
              type="text"
              placeholder="or paste credentialId..."
              value={manualCredential}
              onChange={(event) => setManualCredential(event.target.value.trim())}
            />
            <button type="button" onClick={() => dashboardQuery.refetch()}>
              Load Dashboard
            </button>
          </div>

          {!!credentialsQuery.data?.credentials?.length && (
            <div className="recentCredentials">
              <p className="label">Recent credentials</p>
              <p className="selectedCredentialText">
                Selected: {credentialId || "None"}
              </p>
              <div className="pillWrap">
                {credentialsQuery.data.credentials.slice(0, 8).map((item) => {
                  const isSelected = credentialId === item.credentialId;

                  return (
                    <button
                      type="button"
                      key={item.credentialId}
                      className={isSelected ? "pill active" : "pill"}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedCredential(item.credentialId);
                        setManualCredential("");
                      }}
                    >
                      <span className="pillText">{item.credentialId}</span>
                      {isSelected ? <span className="pillBadge">Selected</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
      </div>
    </main>
  );
}

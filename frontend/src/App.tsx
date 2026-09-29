import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  LayoutDashboard,
  Leaf,
  ListFilter,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Wallet,
  X,
} from "lucide-react";
import { useLiveTransactions } from "./hooks/useLiveTransactions";
import { Transaction } from "./types";
import { money, summarize, transactionCSV } from "./lib/finance";
import { demoTransactions } from "./lib/demo";
import type { UserProfile } from "./components/AuthenticatedApp";

type View = "Overview" | "Activity" | "Spending plan" | "To review";
const nav = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Activity", icon: ListFilter },
  { name: "Spending plan", icon: Target },
  { name: "To review", icon: ShieldCheck },
] as const;
const colors = [
  "#20796b",
  "#87aa94",
  "#e9be65",
  "#8b9bc9",
  "#cf9383",
  "#9daeb8",
];
function stored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export default function App({
  user,
  onLogout,
  onExitDemo,
}: {
  user: UserProfile | null;
  onLogout: () => Promise<void>;
  onExitDemo: () => void;
}) {
  const [demo, setDemo] = useState(!user);
  const storageOwner = user?.id || "guest-demo";
  const live = useLiveTransactions(!demo);
  const samples = useMemo(() => demoTransactions(), []);
  const transactions = demo ? samples : live.transactions;
  const [view, setView] = useState<View>("Overview");
  const [account, setAccount] = useState("all");
  const [currency, setCurrency] = useState("USD");
  const [period, setPeriod] = useState("month");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [direction, setDirection] = useState("all");
  const [hidden, setHidden] = useState(false);
  const [targets, setTargets] = useState<Record<string, number>>(() => {
    const value = stored<Record<string, number>>(
      `finstream.targets.v1:${storageOwner}`,
      {},
    );
    return typeof value === "object" && value && !Array.isArray(value)
      ? value
      : {};
  });
  const [reviewed, setReviewed] = useState<string[]>(() => {
    const value = stored<unknown>(`finstream.reviewed.v1:${storageOwner}`, []);
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string")
      : [];
  });
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [targetInput, setTargetInput] = useState("");
  const [targetError, setTargetError] = useState("");
  const detailDialog = useRef<HTMLDialogElement>(null);
  const targetDialog = useRef<HTMLDialogElement>(null);
  const helpDialog = useRef<HTMLDialogElement>(null);
  const currencies = [...new Set(transactions.map((tx) => tx.currency))].sort();
  const activeCurrency = currencies.includes(currency)
    ? currency
    : currencies[0] || "USD";
  const targetKey = `${demo ? "demo:" : ""}${activeCurrency}`;
  const target =
    Number(targets[targetKey]) > 0 ? Number(targets[targetKey]) : 0;
  const accounts = [
    ...new Map(
      transactions.map((tx) => [
        tx.account_id,
        tx.institution_name || `Account ${tx.account_id.slice(-4)}`,
      ]),
    ).entries(),
  ];
  const format = (amount: number) =>
    hidden ? "••••" : money(amount, activeCurrency);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const monthName = now.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const inMonth = (tx: Transaction) => {
    const date = new Date(tx.transaction_time);
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  };
  const scoped = transactions.filter(
    (tx) =>
      tx.currency === activeCurrency &&
      (account === "all" || tx.account_id === account) &&
      (period === "all" ||
        (period === "month"
          ? inMonth(tx)
          : Date.parse(tx.transaction_time) >= now.getTime() - 7 * 86400000 &&
            Date.parse(tx.transaction_time) <= now.getTime())),
  );
  const summary = summarize(scoped);
  // A spending target always uses this month across all accounts of the chosen currency.
  const monthSpent = summarize(
    transactions.filter((tx) => tx.currency === activeCurrency && inMonth(tx)),
  ).spent;
  const progress = target ? Math.min(100, (monthSpent / target) * 100) : 0;
  const pending = scoped.filter(
    (tx) => tx.is_anomaly && !reviewed.includes(tx.id),
  );
  const categories = [...new Set(scoped.map((tx) => tx.category))].sort();
  const activity = scoped.filter(
    (tx) =>
      (category === "all" || tx.category === category) &&
      (direction === "all" ||
        (direction === "out" ? tx.amount > 0 : tx.amount < 0)) &&
      `${tx.normalized_merchant || ""} ${tx.raw_description} ${tx.category} ${tx.institution_name || ""}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );
  const visible = view === "Overview" ? scoped.slice(0, 5) : activity;
  useEffect(() => {
    if (detail) detailDialog.current?.showModal();
  }, [detail]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(id);
  }, [notice]);
  function persist(key: string, value: unknown) {
    try {
      localStorage.setItem(`${key}:${storageOwner}`, JSON.stringify(value));
      return true;
    } catch {
      setNotice(
        "Browser storage is unavailable. Your change will last for this visit only.",
      );
      return false;
    }
  }
  function review(tx: Transaction) {
    const wasReviewed = reviewed.includes(tx.id);
    const next = wasReviewed
      ? reviewed.filter((id) => id !== tx.id)
      : [...reviewed, tx.id];
    setReviewed(next);
    if (persist("finstream.reviewed.v1", next))
      setNotice(
        wasReviewed
          ? "Moved back to your review list."
          : "Marked as reviewed on this device.",
      );
  }
  function exportActivity() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", transactionCSV(activity)], {
        type: "text/csv;charset=utf-8;",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `finstream-${demo ? "sample-" : ""}activity.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Exported ${activity.length} transactions.`);
  }
  function openTarget() {
    setTargetInput(target ? String(target) : "");
    setTargetError("");
    targetDialog.current?.showModal();
  }
  function switchDemo() {
    if (!user && demo) {
      onExitDemo();
      return;
    }
    setDemo(!demo);
    setAccount("all");
    setCategory("all");
    setSearch("");
    setDirection("all");
  }
  const [syncing, setSyncing] = useState(false);
  async function syncGmail() {
    setSyncing(true);
    try {
      const response = await fetch("/api/v1/auth/google/sync-session", {
        method: "POST",
      });
      if (response.status === 401) {
        window.dispatchEvent(new Event("finstream:unauthorized"));
        return;
      }
      if (!response.ok) throw new Error();
      let result = await response.json();
      if (["started", "already_syncing", "syncing"].includes(result.status)) {
        setNotice("Checking Gmail for bank activity... Your transactions will appear as they are processed.");
        const deadline = Date.now() + 150_000;
        do {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const status = await fetch("/api/v1/auth/google/sync-status");
          if (status.status === 401) {
            window.dispatchEvent(new Event("finstream:unauthorized"));
            return;
          }
          if (!status.ok) throw new Error();
          result = await status.json();
          await live.refresh();
        } while (["syncing", "idle"].includes(result.status) && Date.now() < deadline);
      }
      if (result.status === "error") throw new Error();
      setNotice(
        result.status !== "success"
          ? "Gmail is taking longer than expected. Refresh activity to check imported transactions, or try syncing again shortly."
          : result.synced > 0
            ? `${result.synced} new transactions queued. Your activity will update as they are processed.`
            : result.transactions_found === 0
              ? "Gmail checked. No supported bank transaction emails were found."
              : "Gmail checked. Your activity is up to date, or queued transactions are still being processed.",
      );
      await live.refresh();
    } catch {
      setNotice(
        "Gmail sync failed. Try again or sign out and reconnect Google.",
      );
    } finally {
      setSyncing(false);
    }
  }
  function clearFilters() {
    setSearch("");
    setCategory("all");
    setDirection("all");
    setAccount("all");
    setPeriod("all");
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <a href="#main" className="brand">
          <span className="brand-mark">
            <Leaf size={23} />
          </span>{" "}
          finstream<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">Your everyday money</div>
        <nav aria-label="Main navigation">
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              aria-label={name}
              className={`nav-item ${view === name ? "active" : ""}`}
              aria-current={view === name ? "page" : undefined}
              onClick={() => setView(name)}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === "To review" && pending.length > 0 && (
                <span className="nav-count">{pending.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="quiet-note">
            <ShieldCheck size={22} />
            <strong>A little clarity, every day.</strong>
            <p>All your activity. One place to make sense of it.</p>
          </div>
          <button
            className="nav-item"
            onClick={() => helpDialog.current?.showModal()}
          >
            <CircleHelp size={19} />
            How it works
          </button>
          <div className="profile">
            <div className="avatar">{user?.name.slice(0, 1) || "D"}</div>
            <div>
              <strong>{user?.name || "Demo workspace"}</strong>
              <span>Personal finance</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            My workspace <ChevronRight size={14} />
            <strong>{view}</strong>
          </div>
          <div className="topbar-actions">
            <span
              className={`connection ${demo ? "sample" : live.isConnected ? "online" : ""}`}
            >
              <i />
              {demo
                ? "Sample data"
                : live.isConnected
                  ? "Connected"
                  : "Offline"}
            </span>
            <button
              className="icon-button"
              aria-label={hidden ? "Show amounts" : "Hide amounts"}
              onClick={() => setHidden(!hidden)}
            >
              {hidden ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
            <button
              className="icon-button notification"
              aria-label={`Review ${pending.length} unusual transactions`}
              onClick={() => setView("To review")}
            >
              <Bell size={19} />
              {pending.length > 0 && <i />}
            </button>
            <span className="avatar small">
              {user?.name.slice(0, 1) || "D"}
            </span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {user && (
            <div className="account-actions">
              <div className="user-name">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </div>
              <button
                className="button"
                disabled={syncing || demo}
                onClick={() => void syncGmail()}
              >
                <RefreshCw size={16} />
                {syncing ? "Syncing Gmail…" : "Sync Gmail"}
              </button>
              <button className="button" onClick={() => void onLogout()}>
                Sign out
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="date-label">
                {now.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <h1>
                {view === "Overview"
                  ? "A clearer view of your money."
                  : view === "Activity"
                    ? "The little things add up."
                    : view === "Spending plan"
                      ? "Make room for what matters."
                      : "A second look, for peace of mind."}
              </h1>
              <p>
                {view === "Overview"
                  ? "Your everyday spending, all together and easy to understand."
                  : view === "Activity"
                    ? "Find a purchase, check a payment, or take your activity with you."
                    : view === "Spending plan"
                      ? "Set a monthly target that works for your everyday life."
                      : "Unusual doesn’t always mean wrong. Check these purchases when you have a moment."}
              </p>
            </div>
            <button className="button subtle demo-button" onClick={switchDemo}>
              {demo ? "Back to my activity" : "Explore a demo"}
              <ArrowUpRight size={16} />
            </button>
          </div>
          {demo && (
            <div className="demo-banner">
              <Leaf size={18} />
              <span>
                You’re exploring sample activity. Your real accounts are
                separate.
              </span>
              <button onClick={switchDemo}>
                Exit demo <X size={14} />
              </button>
            </div>
          )}
          {!demo && live.error && (
            <div className="error-banner" role="alert">
              <span>{live.error}</span>
              <button
                className="button"
                disabled={live.loading}
                onClick={() => void live.refresh()}
              >
                Try again
              </button>
            </div>
          )}
          <div className="scope-bar">
            <div className="scope-controls">
              <label>
                <Wallet size={16} />
                <select
                  aria-label="Account"
                  value={account}
                  onChange={(e) => {
                    setAccount(e.target.value);
                    setCategory("all");
                  }}
                >
                  <option value="all">All accounts</option>
                  {accounts.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name} · {id.slice(-4)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <select
                  aria-label="Time period"
                  value={period}
                  onChange={(e) => {
                    setPeriod(e.target.value);
                    setCategory("all");
                  }}
                >
                  <option value="month">This month</option>
                  <option value="week">Last 7 days</option>
                  <option value="all">All loaded activity</option>
                </select>
              </label>
              <label>
                <select
                  aria-label="Currency"
                  value={activeCurrency}
                  onChange={(e) => {
                    setCurrency(e.target.value);
                    setCategory("all");
                  }}
                >
                  {(currencies.length ? currencies : ["USD"]).map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              </label>
            </div>
            <span className="scope-note">
              {demo
                ? "Sample overview"
                : `${transactions.length} transactions loaded`}
              {!demo && (
                <button
                  className="icon-button"
                  aria-label="Refresh activity"
                  disabled={live.loading}
                  onClick={() => void live.refresh()}
                >
                  <RefreshCw size={15} className={live.loading ? "spin" : ""} />
                </button>
              )}
            </span>
          </div>
          {!demo && live.hasMore && (
            <p className="data-note">
              Summaries cover loaded activity only. Load older activity below
              for a fuller picture.
            </p>
          )}
          {view === "Overview" && (
            <>
              <section className="metrics" aria-label="Spending summary">
                <div className="metric featured">
                  <div className="metric-label">
                    Money out{" "}
                    <span className="metric-icon">
                      <ArrowUpRight size={18} />
                    </span>
                  </div>
                  <strong>{format(summary.spent)}</strong>
                  <span>Purchases & payments in this view</span>
                  <div className="featured-lines" aria-hidden="true" />
                </div>
                <div className="metric">
                  <div className="metric-label">
                    Money in{" "}
                    <span className="metric-icon mint">
                      <ArrowDownLeft size={18} />
                    </span>
                  </div>
                  <strong>{format(summary.received)}</strong>
                  <span>Deposits, credits & refunds</span>
                </div>
                <div className="metric">
                  <div className="metric-label">
                    In minus out{" "}
                    <span className="metric-icon blue">
                      <Wallet size={18} />
                    </span>
                  </div>
                  <strong>{format(summary.received - summary.spent)}</strong>
                  <span>Activity difference, not account balance</span>
                </div>
              </section>
              <div className="overview-grid">
                <section className="panel spending-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Where your money goes</h2>
                      <p>
                        {period === "month" ? monthName : "Selected activity"} ·{" "}
                        {activeCurrency}
                      </p>
                    </div>
                    <span className="soft-icon">
                      <SlidersHorizontal size={18} />
                    </span>
                  </div>
                  {summary.spent > 0 ? (
                    <div className="breakdown">
                      <div
                        className="donut"
                        style={{
                          background: `conic-gradient(${summary.categories
                            .map((c, i, all) => {
                              const start =
                                (all
                                  .slice(0, i)
                                  .reduce((s, x) => s + x.amount, 0) /
                                  summary.spent) *
                                100;
                              return `${colors[i % colors.length]} ${start}% ${start + (c.amount / summary.spent) * 100}%`;
                            })
                            .join(",")})`,
                        }}
                        role="img"
                        aria-label="Spending by category; amounts listed alongside"
                      >
                        <div>
                          <span>Total spent</span>
                          <strong>{format(summary.spent)}</strong>
                          <small>{summary.categories.length} categories</small>
                        </div>
                      </div>
                      <div className="category-list">
                        {summary.categories.slice(0, 5).map((item, i) => (
                          <button
                            key={item.name}
                            className="category-row"
                            onClick={() => {
                              setCategory(item.name);
                              setView("Activity");
                            }}
                          >
                            <i style={{ background: colors[i] }} />
                            <span>{item.name}</span>
                            <strong>{format(item.amount)}</strong>
                            <small>
                              {Math.round((item.amount / summary.spent) * 100)}%
                            </small>
                          </button>
                        ))}
                        {summary.categories.length > 5 && (
                          <button
                            className="text-button"
                            onClick={() => setView("Spending plan")}
                          >
                            See all categories <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="empty compact">
                      <Wallet />
                      <h3>Your spending story starts here</h3>
                      <p>
                        Your category breakdown will appear as purchases arrive.
                      </p>
                    </div>
                  )}
                </section>
                <section className="plan-card">
                  <div className="section-heading">
                    <h2>Your monthly target</h2>
                    <Target size={21} />
                  </div>
                  <p>A little intention goes a long way.</p>
                  <div className="target-value">
                    {target
                      ? format(Math.abs(target - monthSpent))
                      : "Find your rhythm"}
                    <span>
                      {target
                        ? monthSpent > target
                          ? "over your spending target"
                          : "left in your spending target"
                        : "Start with a comfortable monthly limit."}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      style={{ width: `${progress}%` }}
                      className={monthSpent > target && target ? "over" : ""}
                    />
                  </div>
                  <div className="progress-label">
                    <span>{format(monthSpent)} spent</span>
                    <span>
                      {target ? `${format(target)} target` : "No target yet"}
                    </span>
                  </div>
                  <button className="button plan-action" onClick={openTarget}>
                    {target ? "Adjust my target" : "Set a spending target"}
                    <ArrowRight size={16} />
                  </button>
                  <small>
                    This month · all {activeCurrency} accounts · stored on this
                    device
                  </small>
                </section>
              </div>
              {pending.length > 0 && (
                <button
                  className="review-banner"
                  onClick={() => setView("To review")}
                >
                  <span className="review-icon">
                    <ShieldCheck size={22} />
                  </span>
                  <span>
                    <strong>
                      {pending.length === 1
                        ? "One purchase could use a second look"
                        : `${pending.length} purchases could use a second look`}
                    </strong>
                    <small>
                      We noticed spending that looks different from your usual
                      activity.
                    </small>
                  </span>
                  <span className="review-link">
                    Review <ArrowRight size={17} />
                  </span>
                </button>
              )}
            </>
          )}
          {(view === "Overview" || view === "Activity") && (
            <section className="panel activity-panel">
              <div className="section-heading">
                <div>
                  <h2>
                    {view === "Overview" ? "Recent activity" : "Your activity"}
                  </h2>
                  <p>
                    {view === "Overview"
                      ? "The latest comings and goings."
                      : `${activity.length} matching transactions`}
                  </p>
                </div>
                {view === "Overview" ? (
                  <button
                    className="text-button"
                    onClick={() => setView("Activity")}
                  >
                    View all activity <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    className="button"
                    disabled={!activity.length}
                    onClick={exportActivity}
                  >
                    <Download size={16} />
                    Export CSV
                  </button>
                )}
              </div>
              {view === "Activity" && (
                <div className="activity-filters">
                  <label className="search-field">
                    <Search size={17} />
                    <input
                      aria-label="Search activity"
                      placeholder="Search merchants or purchases"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="all">All categories</option>
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Money direction"
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                  >
                    <option value="all">Money in & out</option>
                    <option value="out">Money out</option>
                    <option value="in">Money in</option>
                  </select>
                </div>
              )}
              <div className="transaction-list">
                {visible.map((tx) => (
                  <button
                    className="transaction-row"
                    key={tx.id}
                    onClick={() => setDetail(tx)}
                  >
                    <span
                      className={`merchant-icon ${tx.amount < 0 ? "income" : ""}`}
                    >
                      {tx.amount < 0 ? (
                        <ArrowDownLeft size={20} />
                      ) : (
                        (
                          tx.normalized_merchant ||
                          tx.raw_description ||
                          "?"
                        ).slice(0, 1)
                      )}
                    </span>
                    <span className="merchant-info">
                      <strong>
                        {tx.normalized_merchant ||
                          tx.raw_description ||
                          "Unknown merchant"}
                      </strong>
                      <small>
                        {tx.institution_name ||
                          `Account ${tx.account_id.slice(-4)}`}
                        <span className="mobile-category">
                          {" "}
                          · {tx.category}
                          <br />
                          {new Date(tx.transaction_time).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </span>
                      </small>
                    </span>
                    <span className="category-pill">{tx.category}</span>
                    <span className="transaction-date">
                      {new Date(tx.transaction_time).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </span>
                    <span
                      className={`transaction-amount ${tx.amount < 0 ? "income-text" : ""}`}
                    >
                      <strong>
                        {tx.amount < 0 ? "+" : "−"}
                        {format(Math.abs(tx.amount))}
                      </strong>
                      {tx.is_anomaly && (
                        <small
                          className={
                            reviewed.includes(tx.id) ? "" : "needs-review"
                          }
                        >
                          {reviewed.includes(tx.id) ? "Reviewed" : "To review"}
                        </small>
                      )}
                    </span>
                    <ChevronRight size={15} className="row-chevron" />
                  </button>
                ))}
              </div>
              {!visible.length && (
                <div className="empty">
                  <Search size={28} />
                  <h3>
                    {live.loading && !demo
                      ? "Loading your activity…"
                      : transactions.length
                        ? "No matching activity"
                        : "Welcome to a clearer money routine"}
                  </h3>
                  <p>
                    {transactions.length
                      ? "Try another period, account, or search."
                      : "Activity from your connected bank feed will appear here. Explore the demo to see how it works."}
                  </p>
                  {transactions.length ? (
                    <button className="button" onClick={clearFilters}>
                      Clear filters
                    </button>
                  ) : (
                    <button className="button primary" onClick={switchDemo}>
                      Explore sample activity
                    </button>
                  )}
                </div>
              )}
              <div className="panel-footer">
                <span>
                  {view === "Overview"
                    ? `Showing ${visible.length} of ${scoped.length} transactions in this view`
                    : "Select any transaction for more details."}
                </span>
                {!demo && live.hasMore && (
                  <button
                    className="text-button"
                    disabled={live.loading}
                    onClick={() => void live.loadMore()}
                  >
                    {live.loading ? "Loading…" : "Load older activity"}
                  </button>
                )}
              </div>
            </section>
          )}
          {view === "Spending plan" && (
            <div className="budget-layout">
              <section className="panel budget-main">
                <div className="section-heading">
                  <div>
                    <h2>Your plan for {monthName}</h2>
                    <p>
                      All {activeCurrency} accounts · current month · loaded
                      activity
                    </p>
                  </div>
                  <Target size={24} />
                </div>
                <div className="budget-number">
                  {target
                    ? format(Math.abs(target - monthSpent))
                    : "One simple target."}
                </div>
                <p>
                  {target
                    ? monthSpent > target
                      ? "over your monthly target. You can adjust it as life changes."
                      : "left before reaching your monthly target."
                    : "Choose how much you want to spend this month. You can change it anytime."}
                </p>
                <div className="progress-track">
                  <div style={{ width: `${progress}%` }} />
                </div>
                <div className="progress-label">
                  <span>{format(monthSpent)} spent</span>
                  <span>
                    {target ? `${format(target)} target` : "Target not set"}
                  </span>
                </div>
                <button className="button primary" onClick={openTarget}>
                  {target ? "Edit spending target" : "Set a spending target"}
                </button>
                <p className="data-note">
                  Your target is saved in this browser, separately for each
                  currency. Credits and refunds do not reduce spending.
                </p>
              </section>
              <section className="panel">
                <div className="section-heading">
                  <h2>Category spending</h2>
                </div>
                <p className="data-note">
                  Uses the account and period filters above.
                </p>
                {summary.categories.map((item, i) => (
                  <div className="budget-category" key={item.name}>
                    <div>
                      <span>{item.name}</span>
                      <strong>{format(item.amount)}</strong>
                    </div>
                    <div className="progress-track">
                      <div
                        style={{
                          width: `${(item.amount / summary.spent) * 100}%`,
                          background: colors[i % colors.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
                {!summary.categories.length && (
                  <p className="empty">No spending in this view yet.</p>
                )}
              </section>
            </div>
          )}
          {view === "To review" && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Worth checking</h2>
                  <p>{pending.length} purchases to review in this view</p>
                </div>
                <ShieldCheck size={23} />
              </div>
              {pending.map((tx) => (
                <article className="review-card" key={tx.id}>
                  <div>
                    <span className="tag">Unusual amount</span>
                    <h3>{tx.normalized_merchant || tx.raw_description}</h3>
                    <p>
                      {tx.anomaly_reason ||
                        "This purchase is different from your usual spending. Check that you recognize it."}
                    </p>
                    <small>
                      {new Date(tx.transaction_time).toLocaleDateString()} ·{" "}
                      {tx.institution_name || "Connected account"}
                    </small>
                  </div>
                  <div className="review-card-actions">
                    <strong>{format(tx.amount)}</strong>
                    <button
                      className="button primary"
                      onClick={() => review(tx)}
                    >
                      <Check size={16} />
                      Mark as reviewed
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setDetail(tx)}
                    >
                      View details
                    </button>
                  </div>
                </article>
              ))}
              {!pending.length && (
                <div className="empty">
                  <ShieldCheck size={36} />
                  <h3>You’re all caught up</h3>
                  <p>No unreviewed unusual purchases in this view.</p>
                  <button
                    className="button"
                    onClick={() => setView("Activity")}
                  >
                    Browse activity
                  </button>
                </div>
              )}
              <p className="data-note">
                Review status is saved on this device. If you don’t recognize a
                purchase, contact your bank directly.
              </p>
            </section>
          )}
          <footer className="page-footer">
            <span>
              <Leaf size={14} /> A little more clarity. A little less worry.
            </span>
            <button onClick={() => helpDialog.current?.showModal()}>
              About your data <CircleHelp size={14} />
            </button>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <dialog
        ref={detailDialog}
        onClose={() => setDetail(null)}
        aria-labelledby="detail-title"
      >
        <div className="dialog-heading">
          <h2 id="detail-title">Transaction details</h2>
          <button
            className="icon-button"
            aria-label="Close transaction details"
            onClick={() => detailDialog.current?.close()}
          >
            <X />
          </button>
        </div>
        {detail && (
          <>
            <div className="detail-merchant">
              <span className="merchant-icon">
                <CreditCard />
              </span>
              <h3>{detail.normalized_merchant || detail.raw_description}</h3>
              <strong>
                {hidden
                  ? "••••"
                  : money(Math.abs(detail.amount), detail.currency)}
              </strong>
              <p>{detail.amount < 0 ? "Money in" : "Money out"}</p>
            </div>
            <dl>
              <div>
                <dt>Date</dt>
                <dd>{new Date(detail.transaction_time).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Account</dt>
                <dd>{detail.institution_name || detail.account_id}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{detail.category}</dd>
              </div>
              <div>
                <dt>Bank description</dt>
                <dd>{detail.raw_description || "Not provided"}</dd>
              </div>
              <div>
                <dt>Currency</dt>
                <dd>{detail.currency}</dd>
              </div>
            </dl>
            {detail.is_anomaly && (
              <div className="detail-review">
                <strong>
                  {reviewed.includes(detail.id)
                    ? "Reviewed on this device"
                    : "Worth a second look"}
                </strong>
                <p>
                  {detail.anomaly_reason ||
                    "This purchase is different from your usual spending."}
                </p>
                {
                  <button
                    className="button primary"
                    onClick={() => {
                      review(detail);
                      detailDialog.current?.close();
                    }}
                  >
                    {reviewed.includes(detail.id)
                      ? "Mark as unreviewed"
                      : "Mark as reviewed"}
                  </button>
                }
              </div>
            )}
          </>
        )}
      </dialog>
      <dialog ref={targetDialog} aria-labelledby="target-title">
        <div className="dialog-heading">
          <h2 id="target-title">Your monthly spending target</h2>
          <button
            className="icon-button"
            aria-label="Close spending target"
            onClick={() => targetDialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <p>
          A flexible limit for all your {activeCurrency} accounts. Saved on this
          device{demo ? " for this demo" : ""}.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const amount = Number(targetInput);
            if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
              setTargetError("Enter an amount between 0.01 and 100,000,000.");
              return;
            }
            const next = {
              ...targets,
              [targetKey]: Math.round(amount * 100) / 100,
            };
            setTargets(next);
            if (persist("finstream.targets.v1", next))
              setNotice("Monthly spending target saved.");
            targetDialog.current?.close();
          }}
        >
          <label className="form-label" htmlFor="target-amount">
            Monthly target ({activeCurrency})
          </label>
          <input
            id="target-amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            max="100000000"
            step="0.01"
            required
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder="e.g. 2500"
            aria-describedby={targetError ? "target-error" : undefined}
          />
          {targetError && (
            <p id="target-error" role="alert">
              {targetError}
            </p>
          )}
          <div className="dialog-actions">
            {target > 0 && (
              <button
                type="button"
                className="button"
                onClick={() => {
                  const next = { ...targets };
                  delete next[targetKey];
                  setTargets(next);
                  persist("finstream.targets.v1", next);
                  targetDialog.current?.close();
                }}
              >
                Remove target
              </button>
            )}
            <button className="button primary" type="submit">
              Save target
            </button>
          </div>
        </form>
      </dialog>
      <dialog ref={helpDialog} aria-labelledby="help-title">
        <div className="dialog-heading">
          <h2 id="help-title">Your money, made clearer.</h2>
          <button
            className="icon-button"
            aria-label="Close help"
            onClick={() => helpDialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <p>
          FinStream brings purchases from your configured bank feeds into one
          view and groups them into categories.
        </p>
        <h3>Understanding the numbers</h3>
        <p>
          Money out includes purchases and payments. Money in includes deposits
          and refunds. Their difference is not your bank balance. Currencies are
          kept separate, with no exchange-rate conversion.
        </p>
        <h3>A picture of loaded activity</h3>
        <p>
          Summaries use the transactions loaded here. Load older activity to
          include more history. Activity refreshes automatically every 30
          seconds while this tab is visible.
        </p>
        <h3>Personal to this browser</h3>
        <p>
          Spending targets and reviewed flags are saved on this device. They
          won’t follow you to another browser. Sample activity is kept separate
          from your real transactions.
        </p>
        <h3>Getting started</h3>
        <p>
          Sign in with Google to import banking notifications from Gmail. Use
          Sync Gmail to check for new activity. Direct bank connections are not
          available yet.
        </p>
      </dialog>
    </div>
  );
}

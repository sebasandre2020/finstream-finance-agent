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
  Languages,
  LayoutDashboard,
  Leaf,
  ListFilter,
  Moon,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Target,
  Wallet,
  X,
} from "lucide-react";
import { useLiveTransactions } from "./hooks/useLiveTransactions";
import { Transaction } from "./types";
import { summarize, transactionCSV } from "./lib/finance";
import { demoTransactions } from "./lib/demo";
import { translateCategory } from "./lib/i18n";
import { usePreferences } from "./hooks/usePreferences";
import type { UserProfile } from "./components/AuthenticatedApp";

type View = "Overview" | "Activity" | "Spending plan" | "To review";
const nav = [
  { id: "Overview", icon: LayoutDashboard },
  { id: "Activity", icon: ListFilter },
  { id: "Spending plan", icon: Target },
  { id: "To review", icon: ShieldCheck },
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
  const { lang, toggleLang, theme, toggleTheme, t, formatDate, formatMoney } =
    usePreferences();
  const [demo, setDemo] = useState(!user);
  const storageOwner = user?.id || "guest-demo";
  const live = useLiveTransactions(!demo);
  const samples = useMemo(() => demoTransactions(), []);
  const transactions = demo ? samples : live.transactions;
  const [view, setView] = useState<View>("Overview");
  const [account, setAccount] = useState("all");
  const [currency, setCurrency] = useState("");
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

  const currencyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of transactions) {
      counts.set(tx.currency, (counts.get(tx.currency) || 0) + 1);
    }
    return counts;
  }, [transactions]);

  const dominantCurrency = useMemo(() => {
    if (!transactions.length) return "USD";
    const entries = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1]);
    const usdCount = currencyCounts.get("USD") || 0;
    if (entries[0] && entries[0][1] > usdCount) {
      return entries[0][0];
    }
    if (currencyCounts.has("USD")) {
      return "USD";
    }
    return entries[0]?.[0] || "USD";
  }, [currencyCounts, transactions.length]);

  const currencies = useMemo(
    () => [...new Set(transactions.map((tx) => tx.currency))].sort(),
    [transactions],
  );

  const activeCurrency =
    currency && currencies.includes(currency) ? currency : dominantCurrency;
  const targetKey = `${demo ? "demo:" : ""}${activeCurrency}`;
  const target =
    Number(targets[targetKey]) > 0 ? Number(targets[targetKey]) : 0;
  const accounts = [
    ...new Map(
      transactions.map((tx) => [
        tx.account_id,
        tx.institution_name || t.accountNumber(tx.account_id.slice(-4)),
      ]),
    ).entries(),
  ];

  const format = (amount: number) =>
    hidden ? "••••" : formatMoney(amount, activeCurrency);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const monthName = formatDate(now, {
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
      setNotice(t.storageUnavailable);
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
      setNotice(wasReviewed ? t.movedToReviewList : t.markedAsReviewed);
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
    setNotice(t.exportedTransactions(activity.length));
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
        setNotice(t.gmailSyncStarted);
        const deadline = Date.now() + 150_000;
        do {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const status = await fetch("/api/v1/auth/google/sync-status");
          if (status.status === 401) {
            window.dispatchEvent(new Event("finstream:unauthorized"));
            return;
          }
          if (!status.ok) throw new Error();
          result = await status.json();
          await live.refresh();
        } while (
          ["syncing", "idle"].includes(result.status) &&
          Date.now() < deadline
        );
      }
      if (result.status === "error") throw new Error();
      setNotice(
        result.status !== "success"
          ? t.gmailSyncSlow
          : result.synced > 0
            ? t.gmailSyncQueued(result.synced)
            : result.transactions_found === 0
              ? t.gmailSyncNone
              : t.gmailSyncUpToDate,
      );
      await live.refresh();
    } catch {
      setNotice(t.gmailSyncFailed);
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
        {t.skipToContent}
      </a>
      <aside className="sidebar">
        <a href="#main" className="brand">
          <span className="brand-mark">
            <Leaf size={23} />
          </span>{" "}
          finstream<span className="brand-dot">{t.brandDot}</span>
        </a>
        <div className="workspace-label">{t.workspaceLabel}</div>
        <nav aria-label="Main navigation">
          {nav.map(({ id, icon: Icon }) => (
            <button
              key={id}
              aria-label={t.nav[id]}
              className={`nav-item ${view === id ? "active" : ""}`}
              aria-current={view === id ? "page" : undefined}
              onClick={() => setView(id)}
            >
              <Icon size={19} />
              <span>{t.nav[id]}</span>
              {id === "To review" && pending.length > 0 && (
                <span className="nav-count">{pending.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="quiet-note">
            <ShieldCheck size={22} />
            <strong>{t.quietNoteTitle}</strong>
            <p>{t.quietNoteText}</p>
          </div>
          <button
            className="nav-item"
            onClick={() => helpDialog.current?.showModal()}
          >
            <CircleHelp size={19} />
            {t.howItWorks}
          </button>
          <div className="profile">
            <div className="avatar">{user?.name.slice(0, 1) || "D"}</div>
            <div>
              <strong>{user?.name || t.demoWorkspace}</strong>
              <span>{t.personalFinance}</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            {t.myWorkspace} <ChevronRight size={14} />
            <strong>{t.nav[view]}</strong>
          </div>
          <div className="topbar-actions">
            <span
              className={`connection ${demo ? "sample" : live.isConnected ? "online" : ""}`}
            >
              <i />
              <span className="connection-text">
                {demo
                  ? t.sampleData
                  : live.isConnected
                    ? t.connected
                    : t.offline}
              </span>
            </span>
            <button
              type="button"
              className="icon-button lang-toggle"
              aria-label={lang === "en" ? t.switchToSpanish : t.switchToEnglish}
              title={lang === "en" ? t.switchToSpanish : t.switchToEnglish}
              onClick={toggleLang}
            >
              <Languages size={17} />
              <span className="lang-label">{lang === "en" ? "ES" : "EN"}</span>
            </button>
            <button
              type="button"
              className="icon-button theme-toggle"
              aria-label={theme === "dark" ? t.switchToLight : t.switchToDark}
              title={theme === "dark" ? t.switchToLight : t.switchToDark}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={hidden ? t.showAmounts : t.hideAmounts}
              onClick={() => setHidden(!hidden)}
            >
              {hidden ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
            <button
              type="button"
              className="icon-button notification"
              aria-label={t.reviewUnusualNotice(pending.length)}
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
                {syncing ? t.syncingGmail : t.syncGmail}
              </button>
              <button className="button" onClick={() => void onLogout()}>
                {t.signOut}
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="date-label">
                {formatDate(now, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <h1>{t.headings[view].title}</h1>
              <p>{t.headings[view].desc}</p>
            </div>
            <button className="button subtle demo-button" onClick={switchDemo}>
              {demo ? t.backToActivity : t.exploreDemo}
              <ArrowUpRight size={16} />
            </button>
          </div>
          {demo && (
            <div className="demo-banner">
              <Leaf size={18} />
              <span>{t.demoBanner}</span>
              <button onClick={switchDemo}>
                {t.exitDemo} <X size={14} />
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
                {t.tryAgain}
              </button>
            </div>
          )}
          <div className="scope-bar">
            <div className="scope-controls">
              <label>
                <Wallet size={16} />
                <select
                  aria-label={t.account}
                  value={account}
                  onChange={(e) => {
                    setAccount(e.target.value);
                    setCategory("all");
                  }}
                >
                  <option value="all">{t.allAccounts}</option>
                  {accounts.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name} · {id.slice(-4)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <select
                  aria-label={t.timePeriod}
                  value={period}
                  onChange={(e) => {
                    setPeriod(e.target.value);
                    setCategory("all");
                  }}
                >
                  <option value="month">{t.thisMonth}</option>
                  <option value="week">{t.last7Days}</option>
                  <option value="all">{t.allLoadedActivity}</option>
                </select>
              </label>
              <label>
                <select
                  aria-label={t.currency}
                  value={activeCurrency}
                  onChange={(e) => {
                    setCurrency(e.target.value);
                    setCategory("all");
                  }}
                >
                  {(currencies.length ? currencies : ["USD"]).map((code) => (
                    <option key={code} value={code}>
                      {code}
                      {currencyCounts.get(code)
                        ? ` (${currencyCounts.get(code)})`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <span className="scope-note">
              {demo
                ? t.sampleOverview
                : t.transactionsLoaded(transactions.length)}
              {!demo && (
                <button
                  className="icon-button"
                  aria-label={t.refreshActivity}
                  disabled={live.loading}
                  onClick={() => void live.refresh()}
                >
                  <RefreshCw size={15} className={live.loading ? "spin" : ""} />
                </button>
              )}
            </span>
          </div>
          {!demo && live.hasMore && (
            <p className="data-note">{t.summariesCoverLoaded}</p>
          )}
          {view === "Overview" && (
            <>
              <section className="metrics" aria-label={t.spendingSummary}>
                <div className="metric featured">
                  <div className="metric-label">
                    {t.moneyOut}{" "}
                    <span className="metric-icon">
                      <ArrowUpRight size={18} />
                    </span>
                  </div>
                  <strong>{format(summary.spent)}</strong>
                  <span>{t.moneyOutSub}</span>
                  <div className="featured-lines" aria-hidden="true" />
                </div>
                <div className="metric">
                  <div className="metric-label">
                    {t.moneyIn}{" "}
                    <span className="metric-icon mint">
                      <ArrowDownLeft size={18} />
                    </span>
                  </div>
                  <strong>{format(summary.received)}</strong>
                  <span>{t.moneyInSub}</span>
                </div>
                <div className="metric">
                  <div className="metric-label">
                    {t.inMinusOut}{" "}
                    <span className="metric-icon blue">
                      <Wallet size={18} />
                    </span>
                  </div>
                  <strong>{format(summary.received - summary.spent)}</strong>
                  <span>{t.inMinusOutSub}</span>
                </div>
              </section>
              <div className="overview-grid">
                <section className="panel spending-panel">
                  <div className="section-heading">
                    <div>
                      <h2>{t.whereMoneyGoes}</h2>
                      <p>
                        {period === "month" ? monthName : t.selectedActivity} ·{" "}
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
                        aria-label={t.spendingByCategoryAria}
                      >
                        <div>
                          <span>{t.totalSpent}</span>
                          <strong>{format(summary.spent)}</strong>
                          <small>
                            {t.categoryCount(summary.categories.length)}
                          </small>
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
                            <span>{translateCategory(item.name, lang)}</span>
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
                            {t.seeAllCategories} <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="empty compact">
                      <Wallet />
                      <h3>{t.emptySpendingTitle}</h3>
                      <p>{t.emptySpendingDesc}</p>
                    </div>
                  )}
                </section>
                <section className="plan-card">
                  <div className="section-heading">
                    <h2>{t.monthlyTarget}</h2>
                    <Target size={21} />
                  </div>
                  <p>{t.targetIntention}</p>
                  <div className="target-value">
                    {target
                      ? format(Math.abs(target - monthSpent))
                      : t.findYourRhythm}
                    <span>
                      {target
                        ? monthSpent > target
                          ? t.overSpendingTarget
                          : t.leftInSpendingTarget
                        : t.startLimit}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      style={{ width: `${progress}%` }}
                      className={monthSpent > target && target ? "over" : ""}
                    />
                  </div>
                  <div className="progress-label">
                    <span>{t.spentAmount(format(monthSpent))}</span>
                    <span>
                      {target ? t.targetAmount(format(target)) : t.noTargetYet}
                    </span>
                  </div>
                  <button className="button plan-action" onClick={openTarget}>
                    {target ? t.adjustTarget : t.setSpendingTarget}
                    <ArrowRight size={16} />
                  </button>
                  <small>{t.targetFootnote(activeCurrency)}</small>
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
                        ? t.singleReviewBanner
                        : t.multipleReviewBanner(pending.length)}
                    </strong>
                    <small>{t.reviewBannerSub}</small>
                  </span>
                  <span className="review-link">
                    {t.reviewAction} <ArrowRight size={17} />
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
                    {view === "Overview" ? t.recentActivity : t.yourActivity}
                  </h2>
                  <p>
                    {view === "Overview"
                      ? t.recentActivitySub
                      : t.matchingTransactions(activity.length)}
                  </p>
                </div>
                {view === "Overview" ? (
                  <button
                    className="text-button"
                    onClick={() => setView("Activity")}
                  >
                    {t.viewAllActivity} <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    className="button"
                    disabled={!activity.length}
                    onClick={exportActivity}
                  >
                    <Download size={16} />
                    {t.exportCSV}
                  </button>
                )}
              </div>
              {view === "Activity" && (
                <div className="activity-filters">
                  <label className="search-field">
                    <Search size={17} />
                    <input
                      aria-label={t.searchActivity}
                      placeholder={t.searchPlaceholder}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label={t.categoryLabel}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="all">{t.allCategories}</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {translateCategory(c, lang)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={t.moneyDirection}
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                  >
                    <option value="all">{t.directionAll}</option>
                    <option value="out">{t.directionOut}</option>
                    <option value="in">{t.directionIn}</option>
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
                          t.unknownMerchant}
                      </strong>
                      <small>
                        {tx.institution_name ||
                          t.accountNumber(tx.account_id.slice(-4))}
                        <span className="mobile-category">
                          {" "}
                          · {translateCategory(tx.category, lang)}
                          <br />
                          {formatDate(tx.transaction_time, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </small>
                    </span>
                    <span className="category-pill">
                      {translateCategory(tx.category, lang)}
                    </span>
                    <span className="transaction-date">
                      {formatDate(tx.transaction_time, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
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
                          {reviewed.includes(tx.id) ? t.reviewed : t.toReview}
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
                      ? t.loadingActivity
                      : transactions.length
                        ? t.noMatchingActivity
                        : t.welcomeRoutine}
                  </h3>
                  <p>
                    {transactions.length ? t.noMatchingSub : t.welcomeSub}
                  </p>
                  {transactions.length ? (
                    <button className="button" onClick={clearFilters}>
                      {t.clearFilters}
                    </button>
                  ) : (
                    <button className="button primary" onClick={switchDemo}>
                      {t.exploreSampleActivity}
                    </button>
                  )}
                </div>
              )}
              <div className="panel-footer">
                <span>
                  {view === "Overview"
                    ? t.showingTransactions(visible.length, scoped.length)
                    : t.selectTxDetails}
                </span>
                {!demo && live.hasMore && (
                  <button
                    className="text-button"
                    disabled={live.loading}
                    onClick={() => void live.loadMore()}
                  >
                    {live.loading ? t.loadingOlder : t.loadOlderActivity}
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
                    <h2>{t.planForMonth(monthName)}</h2>
                    <p>{t.planSubtitle(activeCurrency)}</p>
                  </div>
                  <Target size={24} />
                </div>
                <div className="budget-number">
                  {target
                    ? format(Math.abs(target - monthSpent))
                    : t.oneSimpleTarget}
                </div>
                <p>
                  {target
                    ? monthSpent > target
                      ? t.overTargetExplanation
                      : t.leftBeforeTargetExplanation
                    : t.chooseSpendExplanation}
                </p>
                <div className="progress-track">
                  <div style={{ width: `${progress}%` }} />
                </div>
                <div className="progress-label">
                  <span>{t.spentAmount(format(monthSpent))}</span>
                  <span>
                    {target ? t.targetAmount(format(target)) : t.targetNotSet}
                  </span>
                </div>
                <button className="button primary" onClick={openTarget}>
                  {target ? t.editSpendingTarget : t.setSpendingTarget}
                </button>
                <p className="data-note">{t.spendingTargetBrowserNote}</p>
              </section>
              <section className="panel">
                <div className="section-heading">
                  <h2>{t.categorySpending}</h2>
                </div>
                <p className="data-note">{t.categorySpendingNote}</p>
                {summary.categories.map((item, i) => (
                  <div className="budget-category" key={item.name}>
                    <div>
                      <span>{translateCategory(item.name, lang)}</span>
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
                  <p className="empty">{t.noSpendingInView}</p>
                )}
              </section>
            </div>
          )}
          {view === "To review" && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>{t.worthChecking}</h2>
                  <p>{t.purchasesToReviewCount(pending.length)}</p>
                </div>
                <ShieldCheck size={23} />
              </div>
              {pending.map((tx) => (
                <article className="review-card" key={tx.id}>
                  <div>
                    <span className="tag">{t.unusualAmount}</span>
                    <h3>{tx.normalized_merchant || tx.raw_description}</h3>
                    <p>{tx.anomaly_reason || t.defaultAnomalyReason}</p>
                    <small>
                      {formatDate(tx.transaction_time)} ·{" "}
                      {tx.institution_name || t.connectedAccount}
                    </small>
                  </div>
                  <div className="review-card-actions">
                    <strong>{format(tx.amount)}</strong>
                    <button
                      className="button primary"
                      onClick={() => review(tx)}
                    >
                      <Check size={16} />
                      {t.markAsReviewed}
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setDetail(tx)}
                    >
                      {t.viewDetails}
                    </button>
                  </div>
                </article>
              ))}
              {!pending.length && (
                <div className="empty">
                  <ShieldCheck size={36} />
                  <h3>{t.allCaughtUp}</h3>
                  <p>{t.allCaughtUpDesc}</p>
                  <button
                    className="button"
                    onClick={() => setView("Activity")}
                  >
                    {t.browseActivity}
                  </button>
                </div>
              )}
              <p className="data-note">{t.reviewBrowserNote}</p>
            </section>
          )}
          <footer className="page-footer">
            <span>
              <Leaf size={14} /> {t.footerMotto}
            </span>
            <button onClick={() => helpDialog.current?.showModal()}>
              {t.aboutYourData} <CircleHelp size={14} />
            </button>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            aria-label={t.dismissNotification}
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
          <h2 id="detail-title">{t.dialogDetailsTitle}</h2>
          <button
            className="icon-button"
            aria-label={t.closeDetails}
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
                  : formatMoney(Math.abs(detail.amount), detail.currency)}
              </strong>
              <p>{detail.amount < 0 ? t.directionIn : t.directionOut}</p>
            </div>
            <dl>
              <div>
                <dt>{t.date}</dt>
                <dd>{new Date(detail.transaction_time).toLocaleString()}</dd>
              </div>
              <div>
                <dt>{t.account}</dt>
                <dd>{detail.institution_name || detail.account_id}</dd>
              </div>
              <div>
                <dt>{t.categoryLabel}</dt>
                <dd>{translateCategory(detail.category, lang)}</dd>
              </div>
              <div>
                <dt>{t.bankDescription}</dt>
                <dd>{detail.raw_description || t.notProvided}</dd>
              </div>
              <div>
                <dt>{t.currency}</dt>
                <dd>{detail.currency}</dd>
              </div>
            </dl>
            {detail.is_anomaly && (
              <div className="detail-review">
                <strong>
                  {reviewed.includes(detail.id)
                    ? t.reviewedOnDevice
                    : t.worthSecondLook}
                </strong>
                <p>{detail.anomaly_reason || t.defaultAnomalyReason}</p>
                {
                  <button
                    className="button primary"
                    onClick={() => {
                      review(detail);
                      detailDialog.current?.close();
                    }}
                  >
                    {reviewed.includes(detail.id)
                      ? t.markAsUnreviewed
                      : t.markAsReviewed}
                  </button>
                }
              </div>
            )}
          </>
        )}
      </dialog>
      <dialog ref={targetDialog} aria-labelledby="target-title">
        <div className="dialog-heading">
          <h2 id="target-title">{t.dialogTargetTitle}</h2>
          <button
            className="icon-button"
            aria-label={t.closeTarget}
            onClick={() => targetDialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <p>{t.dialogTargetDesc(activeCurrency, demo)}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const amount = Number(targetInput);
            if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
              setTargetError(t.targetAmountError);
              return;
            }
            const next = {
              ...targets,
              [targetKey]: Math.round(amount * 100) / 100,
            };
            setTargets(next);
            if (persist("finstream.targets.v1", next))
              setNotice(t.targetSaved);
            targetDialog.current?.close();
          }}
        >
          <label className="form-label" htmlFor="target-amount">
            {t.monthlyTargetInputLabel(activeCurrency)}
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
                {t.removeTarget}
              </button>
            )}
            <button className="button primary" type="submit">
              {t.saveTarget}
            </button>
          </div>
        </form>
      </dialog>
      <dialog ref={helpDialog} aria-labelledby="help-title">
        <div className="dialog-heading">
          <h2 id="help-title">{t.dialogHelpTitle}</h2>
          <button
            className="icon-button"
            aria-label={t.closeHelp}
            onClick={() => helpDialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <p>{t.helpP1}</p>
        <h3>{t.helpH1}</h3>
        <p>{t.helpP2}</p>
        <h3>{t.helpH2}</h3>
        <p>{t.helpP3}</p>
        <h3>{t.helpH3}</h3>
        <p>{t.helpP4}</p>
        <h3>{t.helpH4}</h3>
        <p>{t.helpP5}</p>
      </dialog>
    </div>
  );
}

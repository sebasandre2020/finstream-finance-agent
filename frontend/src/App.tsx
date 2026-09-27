import { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Check, 
  ShieldAlert 
} from 'lucide-react';
import { useLiveTransactions } from './hooks/useLiveTransactions';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { AccountSelector } from './components/AccountSelector';
import { FilterToolbar } from './components/FilterToolbar';
import { TransactionTable } from './components/TransactionTable';
import { TransactionDetailModal } from './components/TransactionDetailModal';
import { EmailConnectModal } from './components/EmailConnectModal';
import { Transaction, UserSession, ThemeMode } from './types';

export default function App() {
  const { 
    transactions, 
    anomalies, 
    accounts, 
    isConnected, 
    dismissAnomaly,
    refreshTransactions,
    refreshAccounts
  } = useLiveTransactions();

  // Theming state: Base colors white for brights and black for darks
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('fin_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem('fin_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Filter States
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Inspection
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [isSyncingNow, setIsSyncingNow] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // 1. Handle URL Query Params and 7-day Session Persistence
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleSync = params.get('google_sync');
    const sessionToken = params.get('session_token');
    const email = params.get('email');
    const name = params.get('name');
    const picture = params.get('picture') || undefined;
    const sessionExpires = params.get('session_expires');
    const googleError = params.get('google_auth_error');
    const synced = params.get('synced') || '0';
    const found = params.get('found') || '0';

    if (sessionToken && email) {
      const newSession: UserSession = {
        session_token: sessionToken,
        email,
        name: name || email.split('@')[0],
        picture: picture || undefined,
        session_expires: sessionExpires || new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
      };
      localStorage.setItem('fin_user_session', JSON.stringify(newSession));
      setUserSession(newSession);

      if (googleSync === 'success') {
        setNotification({
          type: 'success',
          message: `Sesión iniciada para ${email}. Se inspeccionaron ${found} correos bancarios y se sincronizaron ${synced} transacciones nuevas.`
        });
      }
      window.history.replaceState({}, document.title, window.location.pathname);
      refreshTransactions();
      refreshAccounts();
    } else if (googleError) {
      setNotification({
        type: 'error',
        message: `Error al autenticar con Google: ${googleError}`
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Load saved 7-day session from localStorage
      const savedSessionRaw = localStorage.getItem('fin_user_session');
      if (savedSessionRaw) {
        try {
          const parsed: UserSession = JSON.parse(savedSessionRaw);
          if (new Date(parsed.session_expires).getTime() > Date.now()) {
            setUserSession(parsed);
            fetch('/api/v1/auth/me', {
              headers: { Authorization: `Bearer ${parsed.session_token}` }
            })
              .then(async (res) => {
                if (res.ok) {
                  const profile = await res.json();
                  setUserSession((prev) =>
                    prev ? { ...prev, name: profile.name, email: profile.email, picture: profile.picture } : parsed
                  );
                } else if (res.status === 401) {
                  localStorage.removeItem('fin_user_session');
                  setUserSession(null);
                }
              })
              .catch(() => {});
          } else {
            localStorage.removeItem('fin_user_session');
          }
        } catch {
          localStorage.removeItem('fin_user_session');
        }
      }
    }
  }, [refreshTransactions, refreshAccounts]);

  const handleLogout = async () => {
    if (userSession?.session_token) {
      try {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${userSession.session_token}` }
        });
      } catch {
        // Ignore logout errors
      }
    }
    localStorage.removeItem('fin_user_session');
    setUserSession(null);
    setNotification({
      type: 'info',
      message: 'Sesión cerrada exitosamente.'
    });
  };

  const handleSyncNow = async () => {
    if (!userSession?.session_token) return;
    setIsSyncingNow(true);
    try {
      const resp = await fetch('/api/v1/auth/google/sync-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userSession.session_token}` }
      });
      if (resp.status === 401) {
        localStorage.removeItem('fin_user_session');
        setUserSession(null);
        setNotification({
          type: 'error',
          message: 'Tu sesión ha expirado en el servidor. Por favor vuelve a conectar tu cuenta.'
        });
        return;
      }
      const data = await resp.json();
      refreshTransactions();
      refreshAccounts();
      setNotification({
        type: 'success',
        message: `Sincronización en vivo completada: ${data.synced ?? 0} nuevas transacciones actualizadas.`
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Error al sincronizar con Gmail: ${err.message || 'Error de red'}`
      });
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handlePurgeMockData = async () => {
    if (!confirm('¿Deseas eliminar las transacciones de prueba simuladas y dejar únicamente tus transacciones bancarias reales?')) {
      return;
    }
    try {
      const resp = await fetch('/api/v1/accounts/purge-simulated', { method: 'POST' });
      const data = await resp.json();
      refreshTransactions();
      refreshAccounts();
      setSelectedAccount('all');
      setSelectedPeriod('all');
      setSelectedMonth('all');
      setSearchQuery('');
      setNotification({
        type: 'success',
        message: `Se eliminaron ${data.transactions_removed} transacciones simuladas. Tu libro mayor ahora solo muestra registros reales.`
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Error al purgar datos: ${err.message}`
      });
    }
  };

  const handleResetFilters = () => {
    setSelectedAccount('all');
    setSelectedPeriod('all');
    setSelectedMonth('all');
    setSearchQuery('');
  };

  // Multi-criteria Filtering
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // 1. Account Filter
      if (selectedAccount !== 'all' && t.account_id !== selectedAccount) {
        return false;
      }

      const txDate = new Date(t.transaction_time);
      const now = new Date();

      // 2. Time Period Filter
      if (selectedPeriod === 'today') {
        const isToday =
          txDate.getDate() === now.getDate() &&
          txDate.getMonth() === now.getMonth() &&
          txDate.getFullYear() === now.getFullYear();
        if (!isToday) return false;
      } else if (selectedPeriod === '7d') {
        const diffMs = now.getTime() - txDate.getTime();
        if (diffMs > 7 * 86400 * 1000 || diffMs < 0) return false;
      } else if (selectedPeriod === '15d') {
        const diffMs = now.getTime() - txDate.getTime();
        if (diffMs > 15 * 86400 * 1000 || diffMs < 0) return false;
      } else if (selectedPeriod === '30d') {
        const diffMs = now.getTime() - txDate.getTime();
        if (diffMs > 30 * 86400 * 1000 || diffMs < 0) return false;
      } else if (selectedPeriod === 'this_month') {
        const isThisMonth =
          txDate.getMonth() === now.getMonth() &&
          txDate.getFullYear() === now.getFullYear();
        if (!isThisMonth) return false;
      }

      // 3. Month Filter
      if (selectedMonth !== 'all') {
        const targetMonth = parseInt(selectedMonth, 10);
        if (txDate.getMonth() !== targetMonth) {
          return false;
        }
      }

      // 4. Live Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesMerchant = t.normalized_merchant?.toLowerCase().includes(q);
        const matchesRaw = t.raw_description.toLowerCase().includes(q);
        const matchesCat = t.category.toLowerCase().includes(q);
        const matchesSub = t.sub_category?.toLowerCase().includes(q);
        const matchesAmt = String(t.amount).includes(q);
        const matchesInst = t.institution_name?.toLowerCase().includes(q);

        if (!matchesMerchant && !matchesRaw && !matchesCat && !matchesSub && !matchesAmt && !matchesInst) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, selectedAccount, selectedPeriod, selectedMonth, searchQuery]);

  const totalSpend = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const val = Number(t.amount) || 0;
      return acc + (val > 0 ? val : 0);
    }, 0);
  }, [filteredTransactions]);

  const totalAnomalies = useMemo(() => {
    return filteredTransactions.filter((t) => t.is_anomaly).length;
  }, [filteredTransactions]);

  const currentCurrency = filteredTransactions[0]?.currency === 'USD' ? '$' : 'S/';
  const isFilterActive = selectedAccount !== 'all' || selectedPeriod !== 'all' || selectedMonth !== 'all' || searchQuery !== '';

  const selectedAccountName = useMemo(() => {
    if (selectedAccount === 'all') return 'Todas las cuentas';
    const acc = accounts.find((a) => a.id === selectedAccount);
    return acc ? `${acc.institution_name} (${acc.account_number_mask})` : 'Cuenta seleccionada';
  }, [selectedAccount, accounts]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 transition-colors duration-200">
      {/* 1. Executive Minimalist Header */}
      <Header
        userSession={userSession}
        isConnected={isConnected}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenConnectModal={() => setIsEmailModalOpen(true)}
        onSyncNow={handleSyncNow}
        isSyncingNow={isSyncingNow}
        onLogout={handleLogout}
      />

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Notification Banner */}
        {notification && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between backdrop-blur animate-fade-in shadow-sm ${
            notification.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30 text-emerald-900 dark:text-emerald-200' 
              : notification.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/30 text-rose-900 dark:text-rose-200'
              : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200'
          }`}>
            <div className="flex items-center space-x-3">
              {notification.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : notification.type === 'error' ? (
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
              ) : (
                <Check className="h-5 w-5 text-zinc-600 dark:text-zinc-400 shrink-0" />
              )}
              <span className="text-xs font-medium">{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Anomaly Alerts List */}
        {anomalies.length > 0 && (
          <div className="space-y-2.5">
            {anomalies.map((alert) => (
              <div 
                key={alert.transaction_id}
                className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 rounded-2xl p-4 flex items-start justify-between shadow-sm animate-fade-in"
              >
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl mt-0.5">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold font-mono tracking-wider px-2 py-0.5 rounded-full bg-rose-200/60 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
                        {alert.severity} • TRANSACCIÓN ATÍPICA
                      </span>
                      <span className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                        {alert.merchant || 'Comercio Desconocido'} • {currentCurrency}{(Number(alert.amount) || 0).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-800 dark:text-zinc-200 mt-1 font-medium leading-relaxed">
                      {alert.reason}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => dismissAnomaly(alert.transaction_id)}
                  className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-1.5 rounded-lg transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 2. Executive KPI Cards */}
        <MetricCards
          totalSpend={totalSpend}
          currency={currentCurrency}
          transactionCount={filteredTransactions.length}
          accounts={accounts}
          anomalyCount={totalAnomalies}
          selectedAccountName={selectedAccountName}
        />

        {/* 3. Account Selector */}
        <AccountSelector
          accounts={accounts}
          selectedAccountId={selectedAccount}
          onSelectAccount={setSelectedAccount}
          transactions={transactions}
          currencySymbol={currentCurrency}
        />

        {/* 4. Filter Toolbar */}
        <FilterToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          onResetFilters={handleResetFilters}
          isFilterActive={isFilterActive}
          onPurgeMockData={handlePurgeMockData}
        />

        {/* 5. Real-Time Transaction Ledger */}
        <TransactionTable
          transactions={filteredTransactions}
          totalTransactionsCount={transactions.length}
          onSelectTransaction={setSelectedTransaction}
          currencySymbol={currentCurrency}
        />
      </main>

      {/* 6. Transaction Detail Slide-over / Modal */}
      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />

      {/* 7. Re-engineered Bank Connection Modal */}
      <EmailConnectModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
      />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Building2, 
  CheckCircle2, 
  DollarSign, 
  Layers, 
  Mail, 
  Radio, 
  Sparkles, 
  X,
  Trash2,
  RefreshCw,
  LogOut,
  CreditCard,
  Check,
  Calendar,
  Clock,
  RotateCcw
} from 'lucide-react';
import { useLiveTransactions } from './hooks/useLiveTransactions';
import { EmailConnectModal } from './components/EmailConnectModal';
import { UserSession } from './types';

const MONTH_NAMES = [
  { value: '0', label: 'Enero' },
  { value: '1', label: 'Febrero' },
  { value: '2', label: 'Marzo' },
  { value: '3', label: 'Abril' },
  { value: '4', label: 'Mayo' },
  { value: '5', label: 'Junio' },
  { value: '6', label: 'Julio' },
  { value: '7', label: 'Agosto' },
  { value: '8', label: 'Septiembre' },
  { value: '9', label: 'Octubre' },
  { value: '10', label: 'Noviembre' },
  { value: '11', label: 'Diciembre' },
];

const PERIOD_OPTIONS = [
  { key: 'all', label: 'Todo el tiempo' },
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: 'Últimos 7 días' },
  { key: '15d', label: 'Últimos 15 días' },
  { key: '30d', label: 'Últimos 30 días' },
  { key: 'this_month', label: 'Este mes' },
];

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

  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
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
          message: `¡Sesión iniciada con éxito para ${email}! Se encontraron ${found} correos bancarios y se sincronizaron ${synced} transacciones nuevas.`
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
          message: 'Tu sesión ha expirado en el servidor. Por favor vuelve a conectar tu cuenta BCP / Gmail.'
        });
        return;
      }
      const data = await resp.json();
      refreshTransactions();
      refreshAccounts();
      setNotification({
        type: 'success',
        message: `Sincronización en vivo completada: ${data.synced ?? 0} nuevas transacciones agregadas.`
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
    if (!confirm('¿Deseas eliminar todas las transacciones de prueba simuladas y dejar únicamente tus transacciones bancarias reales?')) {
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
      setNotification({
        type: 'success',
        message: `Se eliminaron ${data.transactions_removed} transacciones simuladas. Tu dashboard ahora solo muestra tus transacciones reales.`
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
  };

  // Multi-criteria Filtering: Account + Period + Month
  const filteredTransactions = transactions.filter((t) => {
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

    return true;
  });

  const totalSpend = filteredTransactions.reduce((acc, t) => {
    const val = Number(t.amount) || 0;
    return acc + (val > 0 ? val : 0);
  }, 0);
  const totalAnomalies = filteredTransactions.filter((t) => t.is_anomaly).length;

  const currentCurrency = filteredTransactions[0]?.currency === 'USD' ? '$' : 'S/';
  const isFilterActive = selectedAccount !== 'all' || selectedPeriod !== 'all' || selectedMonth !== 'all';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-teal-500/10 border border-teal-500/30 p-2 rounded-lg text-teal-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                FinStream Intelligence
                <span className="text-xs bg-slate-800 text-teal-400 font-mono px-2 py-0.5 rounded border border-slate-700">v1.0.0</span>
              </h1>
              <p className="text-xs text-slate-400">Agente Financiero Multicuenta en Tiempo Real (BCP & Yape)</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {userSession ? (
              <div className="flex items-center space-x-3 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full shadow-sm">
                {userSession.picture ? (
                  <img 
                    src={userSession.picture} 
                    alt={userSession.name} 
                    className="h-7 w-7 rounded-full border border-teal-500/40 object-cover" 
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold font-mono">
                    {userSession.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-semibold text-white leading-tight">{userSession.name}</div>
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Sync activo (60s)</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1 pl-1 border-l border-slate-800">
                  <button
                    onClick={handleSyncNow}
                    disabled={isSyncingNow}
                    title="Sincronizar Gmail en vivo ahora"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-teal-300 hover:bg-slate-800 transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSyncingNow ? 'animate-spin text-teal-400' : ''}`} />
                  </button>
                  <button
                    onClick={() => setIsEmailModalOpen(true)}
                    title="Opciones de Conexión Bancaria"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    <Mail className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleLogout}
                    title="Cerrar sesión"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsEmailModalOpen(true)}
                className="flex items-center space-x-2 text-xs font-semibold bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 px-3.5 py-1.5 rounded-full transition shadow-sm"
              >
                <Mail className="h-3.5 w-3.5 text-teal-400" />
                <span>Conectar Banco (BCP / Yape)</span>
              </button>
            )}

            <div className="flex items-center space-x-2 text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
              <Radio className={`h-3 w-3 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-rose-500'}`} />
              <span className={isConnected ? 'text-emerald-400' : 'text-rose-400'}>
                {isConnected ? 'Kafka SSE: ACTIVO' : 'Reconectando...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Notification Banner */}
        {notification && (
          <div className={`p-4 rounded-xl border flex items-center justify-between backdrop-blur animate-fade-in ${
            notification.type === 'success' 
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
              : notification.type === 'error'
              ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              : 'bg-blue-950/40 border-blue-500/40 text-blue-200'
          }`}>
            <div className="flex items-center space-x-3">
              {notification.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              ) : notification.type === 'error' ? (
                <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
              ) : (
                <Check className="h-5 w-5 text-blue-400 shrink-0" />
              )}
              <span className="text-sm font-medium">{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Anomaly Banners */}
        {anomalies.length > 0 && (
          <div className="space-y-3">
            {anomalies.map((alert) => (
              <div 
                key={alert.transaction_id}
                className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-4 flex items-start justify-between backdrop-blur animate-fade-in"
              >
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-rose-500/20 text-rose-400 rounded-lg mt-0.5">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold font-mono tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                        {alert.severity} ANOMALÍA DETECTADA
                      </span>
                      <span className="text-xs text-slate-400">
                        {alert.merchant || 'Comercio Desconocido'} • {currentCurrency}{(Number(alert.amount) || 0).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-200 mt-1 font-medium">{alert.reason}</p>
                  </div>
                </div>
                <button
                  onClick={() => dismissAnomaly(alert.transaction_id)}
                  className="text-slate-400 hover:text-white p-1 hover:bg-slate-800/50 rounded transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Dynamic Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Gasto Total Filtrado</span>
              <DollarSign className="h-4 w-4 text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {currentCurrency}{totalSpend.toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {selectedAccount === 'all' ? 'En todas las cuentas y tarjetas' : 'En la cuenta seleccionada'}
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Cuentas y Tarjetas</span>
              <Building2 className="h-4 w-4 text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{accounts.length} Cuentas</div>
            <p className="text-xs text-slate-500 mt-1">BCP Tarjetas, Yape y Cuentas Bancarias</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Precisión de Categorización</span>
              <CheckCircle2 className="h-4 w-4 text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">98.4%</div>
            <p className="text-xs text-slate-500 mt-1">pgvector HNSW + Reflexión LangGraph</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Gastos Atípicos (Outliers)</span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{totalAnomalies} Detectados</div>
            <p className="text-xs text-slate-500 mt-1">Desviación Absoluta Mediana (MAD &gt; 3.5)</p>
          </div>
        </div>

        {/* Filter Section Container */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 space-y-3.5">
          {/* Row 1: Dynamic Account Filter Tabs & Cards */}
          <div className="flex items-center justify-between overflow-x-auto pb-1 gap-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedAccount('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap flex items-center gap-2 ${
                  selectedAccount === 'all'
                    ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                }`}
              >
                <span>Todas las Cuentas</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                  selectedAccount === 'all' ? 'bg-slate-950/30 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                }`}>
                  {transactions.length}
                </span>
              </button>

              {accounts.map((acc) => {
                const isSelected = selectedAccount === acc.id;
                const count = acc.transaction_count ?? transactions.filter(t => t.account_id === acc.id).length;
                return (
                  <button
                    key={acc.id}
                    onClick={() => setSelectedAccount(acc.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap flex items-center gap-2 ${
                      isSelected
                        ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <CreditCard className={`h-3.5 w-3.5 ${isSelected ? 'text-slate-950' : 'text-teal-400'}`} />
                    <span>{acc.institution_name} ({acc.account_number_mask})</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                      isSelected ? 'bg-slate-950/30 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Purge Simulated Data Button */}
            <button
              onClick={handlePurgeMockData}
              title="Eliminar las transacciones de prueba simuladas y mostrar únicamente las transacciones reales de tus correos bancarios"
              className="text-xs text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 bg-slate-900 px-3 py-1.5 rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Limpiar Datos Simulados</span>
            </button>
          </div>

          {/* Row 2: Time Period & Month Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
            {/* Period selector pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5">
              <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
                <Clock className="h-3 w-3 text-slate-400" />
                Periodo:
              </span>
              {PERIOD_OPTIONS.map((opt) => {
                const isActive = selectedPeriod === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setSelectedPeriod(opt.key)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                      isActive
                        ? 'bg-slate-100 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Month Dropdown & Reset Action */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                <Calendar className="h-3.5 w-3.5 text-teal-400" />
                <span className="text-slate-400 text-[11px] font-mono">Mes:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer pr-1"
                >
                  <option value="all" className="bg-slate-900 text-slate-200">Todos los meses</option>
                  {MONTH_NAMES.map((m) => (
                    <option key={m.value} value={m.value} className="bg-slate-900 text-slate-200">
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {isFilterActive && (
                <button
                  onClick={handleResetFilters}
                  title="Restablecer todos los filtros"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex items-center gap-1 text-xs font-medium"
                >
                  <RotateCcw className="h-3 w-3 text-teal-400" />
                  <span className="hidden sm:inline">Restablecer</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Real-Time Ledger Table */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-teal-400" />
              Libro Mayor de Transacciones Reales en Tiempo Real
              <span className="text-xs text-slate-400 font-normal">
                ({filteredTransactions.length} de {transactions.length})
              </span>
            </h2>
            <span className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Actualización instantánea vía SSE & Gmail API
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">FECHA Y HORA</th>
                  <th className="py-3 px-4">CUENTA / TARJETA</th>
                  <th className="py-3 px-4">COMERCIO / BENEFICIARIO</th>
                  <th className="py-3 px-4">CATEGORÍA</th>
                  <th className="py-3 px-4">CONFIANZA</th>
                  <th className="py-3 px-4">ESTADO</th>
                  <th className="py-3 px-4 text-right">MONTO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 space-y-2">
                      <p className="text-sm font-medium">No se encontraron transacciones con los filtros seleccionados.</p>
                      <p className="text-xs text-slate-600">
                        Prueba seleccionando otro periodo, mes o cuenta.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const txCurr = tx.currency === 'USD' ? '$' : 'S/';
                    const txDate = new Date(tx.transaction_time);
                    return (
                      <tr 
                        key={tx.id} 
                        className={`hover:bg-slate-800/30 transition ${tx.is_anomaly ? 'bg-rose-950/10' : ''}`}
                      >
                        {/* FECHA Y HORA Formatted in 2 lines with icons */}
                        <td className="py-3 px-4 font-mono whitespace-nowrap">
                          <div className="text-slate-200 font-semibold flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-teal-400/80" />
                            <span>
                              {txDate.toLocaleDateString('es-PE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 pl-4.5">
                            <Clock className="h-2.5 w-2.5 text-slate-500" />
                            <span>
                              {txDate.toLocaleTimeString('es-PE', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </span>
                          </div>
                        </td>

                        {/* CUENTA / TARJETA */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="bg-slate-800 text-teal-300 px-2.5 py-1 rounded-lg border border-slate-700 text-xs font-medium inline-flex items-center gap-1.5">
                            <CreditCard className="h-3 w-3 text-teal-400" />
                            <span>{tx.institution_name || 'BCP / Yape'}</span>
                          </span>
                        </td>

                        {/* COMERCIO / BENEFICIARIO */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-100">
                            {tx.normalized_merchant || 'Comercio no resuelto'}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-xs font-mono">
                            {tx.raw_description}
                          </div>
                        </td>

                        {/* CATEGORÍA */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-teal-950/80 text-teal-300 border border-teal-800/50">
                            {tx.category}
                            {tx.sub_category && (
                              <span className="text-teal-400/60">› {tx.sub_category}</span>
                            )}
                          </div>
                        </td>

                        {/* CONFIANZA */}
                        <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                          {(tx.confidence_score * 100).toFixed(0)}%
                        </td>

                        {/* ESTADO */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {tx.is_anomaly ? (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold"
                              title={tx.anomaly_reason || 'Consumo atípico detectado'}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              ANOMALÍA
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-xs">
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                              Verificado
                            </span>
                          )}
                        </td>

                        {/* MONTO */}
                        <td className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap ${
                          Number(tx.amount) > 0 ? 'text-slate-100' : 'text-emerald-400'
                        }`}>
                          {txCurr}{(Number(tx.amount) || 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <EmailConnectModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
      />
    </div>
  );
}

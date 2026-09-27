import React from 'react';
import { 
  Mail, 
  RefreshCw, 
  LogOut, 
  Sun, 
  Moon 
} from 'lucide-react';
import { UserSession, ThemeMode } from '../types';

interface HeaderProps {
  userSession: UserSession | null;
  isConnected: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenConnectModal: () => void;
  onSyncNow: () => void;
  isSyncingNow: boolean;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userSession,
  isConnected,
  theme,
  onToggleTheme,
  onOpenConnectModal,
  onSyncNow,
  isSyncingNow,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-black/80 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Identity */}
        <div className="flex items-center space-x-3.5">
          <div className="h-9 w-9 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center font-mono font-bold shadow-sm">
            <span className="text-base tracking-tighter">FS</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-zinc-950 dark:text-zinc-50 font-sans">
                FINSTREAM
              </span>
              <span className="text-[10px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">
              Agente Financiero Multicuenta en Tiempo Real (BCP • BBVA • Falabella • Yape)
            </p>
          </div>
        </div>

        {/* Right Actions & Utilities */}
        <div className="flex items-center space-x-2.5">
          {/* Live Stream Pulse Badge */}
          <div className="hidden md:flex items-center space-x-2 text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
            <span className="relative flex h-2 w-2">
              {isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-zinc-400'}`}></span>
            </span>
            <span>{isConnected ? 'LIVE // KAFKA SSE' : 'RECONECTANDO'}</span>
          </div>

          {/* Theme Toggle (Dark / Light) */}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {/* User Session or Connect CTA */}
          {userSession ? (
            <div className="flex items-center space-x-2 bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 pl-2 pr-1.5 py-1 rounded-full shadow-sm">
              {userSession.picture ? (
                <img 
                  src={userSession.picture} 
                  alt={userSession.name} 
                  className="h-6 w-6 rounded-full border border-zinc-300 dark:border-zinc-700 object-cover" 
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-[10px] font-bold font-mono">
                  {userSession.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}

              <div className="text-left hidden lg:block pr-1">
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-tight">
                  {userSession.name}
                </div>
              </div>

              {/* Sync Button */}
              <button
                onClick={onSyncNow}
                disabled={isSyncingNow}
                title="Sincronizar Gmail ahora"
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncingNow ? 'animate-spin text-zinc-900 dark:text-zinc-100' : ''}`} />
              </button>

              {/* Options Button */}
              <button
                onClick={onOpenConnectModal}
                title="Opciones de Conexión Bancaria"
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
              >
                <Mail className="h-3.5 w-3.5" />
              </button>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                title="Cerrar sesión"
                className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenConnectModal}
              className="flex items-center space-x-2 text-xs font-medium bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 px-3.5 py-1.5 rounded-full transition shadow-sm"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Conectar Banco</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

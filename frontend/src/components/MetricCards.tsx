import React from 'react';
import { 
  DollarSign, 
  CreditCard, 
  TrendingDown, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';
import { Account } from '../types';

interface MetricCardsProps {
  totalSpend: number;
  currency: string;
  transactionCount: number;
  accounts: Account[];
  anomalyCount: number;
  selectedAccountName: string;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  totalSpend,
  currency,
  transactionCount,
  accounts,
  anomalyCount,
  selectedAccountName,
}) => {
  const avgTicket = transactionCount > 0 ? totalSpend / transactionCount : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Spend */}
      <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm transition hover:border-zinc-300 dark:hover:border-zinc-700">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
            Gasto Total Filtrado
          </span>
          <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
            <DollarSign className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
          {currency} {totalSpend.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1.5 truncate">
          <span>{transactionCount} transacciones en</span>
          <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">{selectedAccountName}</span>
        </div>
      </div>

      {/* 2. Connected Accounts */}
      <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm transition hover:border-zinc-300 dark:hover:border-zinc-700">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
            Cuentas y Tarjetas
          </span>
          <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
            <CreditCard className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
          {accounts.length} <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">Activas</span>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 truncate">
          BCP, BBVA, Falabella, Yape y Plin
        </div>
      </div>

      {/* 3. Average Ticket */}
      <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm transition hover:border-zinc-300 dark:hover:border-zinc-700">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
            Ticket Promedio
          </span>
          <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
            <TrendingDown className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
          {currency} {avgTicket.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
          Promedio por operación realizada
        </div>
      </div>

      {/* 4. Audit & Anomalies */}
      <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm transition hover:border-zinc-300 dark:hover:border-zinc-700">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
            Conciliación & Seguridad
          </span>
          <div className={`p-1.5 rounded-lg ${anomalyCount > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
            {anomalyCount > 0 ? <AlertCircle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
          </div>
        </div>
        <div className="text-2xl font-bold font-mono tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums flex items-center gap-2">
          {anomalyCount > 0 ? (
            <>
              <span className="text-amber-500">{anomalyCount}</span>
              <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">Atípicos</span>
            </>
          ) : (
            <>
              <span>100%</span>
              <span className="text-sm font-normal text-emerald-600 dark:text-emerald-400 font-sans">Verificado</span>
            </>
          )}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
          {anomalyCount > 0 ? 'Revisar transacciones marcadas' : 'Cero alertas de fraude o desvío'}
        </div>
      </div>
    </div>
  );
};

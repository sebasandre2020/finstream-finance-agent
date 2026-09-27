import React from 'react';
import { CreditCard, Landmark, Wallet } from 'lucide-react';
import { Account, Transaction } from '../types';

interface AccountSelectorProps {
  accounts: Account[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  transactions: Transaction[];
  currencySymbol: string;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({
  accounts,
  selectedAccountId,
  onSelectAccount,
  transactions,
  currencySymbol,
}) => {
  // Helper to get total spend for an account from current loaded transactions
  const getAccountSpend = (accId: string) => {
    return transactions
      .filter((t) => t.account_id === accId)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  };

  const getAccountTxCount = (accId: string, fallbackCount?: number) => {
    const calculated = transactions.filter((t) => t.account_id === accId).length;
    return calculated > 0 ? calculated : (fallbackCount ?? 0);
  };

  const totalAllSpend = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const getBankIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('yape') || lower.includes('plin')) {
      return <Wallet className="h-3.5 w-3.5 shrink-0" />;
    }
    if (lower.includes('bcp') || lower.includes('bbva') || lower.includes('falabella')) {
      return <Landmark className="h-3.5 w-3.5 shrink-0" />;
    }
    return <CreditCard className="h-3.5 w-3.5 shrink-0" />;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold">
          Cuentas y Tarjetas Monitoreadas
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Selecciona una entidad para filtrar
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* All Accounts Button */}
        <button
          onClick={() => onSelectAccount('all')}
          className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
            selectedAccountId === 'all'
              ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-zinc-950 dark:border-white shadow-md'
              : 'bg-white dark:bg-zinc-900/40 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className="text-[10px] font-mono tracking-wider uppercase font-semibold opacity-75">
              Consolidado
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              selectedAccountId === 'all'
                ? 'bg-white/20 dark:bg-zinc-900/20 font-bold'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}>
              {transactions.length}
            </span>
          </div>

          <div className="font-bold text-xs truncate">
            Todas las Cuentas
          </div>

          <div className="text-[11px] font-mono tabular-nums mt-1 font-semibold opacity-90">
            {currencySymbol} {totalAllSpend.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </button>

        {/* Individual Account Cards */}
        {accounts.map((acc) => {
          const isSelected = selectedAccountId === acc.id;
          const count = getAccountTxCount(acc.id, acc.transaction_count);
          const spend = getAccountSpend(acc.id);
          const icon = getBankIcon(acc.institution_name);

          return (
            <button
              key={acc.id}
              onClick={() => onSelectAccount(acc.id)}
              className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-zinc-950 dark:border-white shadow-md'
                  : 'bg-white dark:bg-zinc-900/40 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-1.5 opacity-80">
                  {icon}
                  <span className="text-[10px] font-mono tracking-wider uppercase truncate max-w-[70px]">
                    {acc.institution_name}
                  </span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  isSelected
                    ? 'bg-white/20 dark:bg-zinc-900/20 font-bold'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}>
                  {count}
                </span>
              </div>

              <div className="font-semibold text-xs truncate">
                {acc.account_number_mask}
              </div>

              <div className="text-[11px] font-mono tabular-nums mt-1 font-semibold opacity-90">
                {currencySymbol} {spend.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

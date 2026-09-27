import React, { useMemo } from 'react';
import { Sparkles, Calendar, Store, CreditCard } from 'lucide-react';
import { Transaction } from '../types';

interface FinancialInsightBannerProps {
  transactions: Transaction[];
  currencySymbol: string;
}

export const FinancialInsightBanner: React.FC<FinancialInsightBannerProps> = ({
  transactions,
  currencySymbol,
}) => {
  const insights = useMemo(() => {
    if (transactions.length === 0) return null;

    // 1. Highest single transaction
    let maxTx = transactions[0];
    let totalSpend = 0;
    const merchantMap = new Map<string, number>();
    const bankMap = new Map<string, number>();

    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (amt > 0) {
        totalSpend += amt;
        if (amt > (Number(maxTx.amount) || 0)) {
          maxTx = tx;
        }
        const m = tx.normalized_merchant || 'Desconocido';
        merchantMap.set(m, (merchantMap.get(m) || 0) + amt);

        const b = tx.institution_name || 'BCP';
        bankMap.set(b, (bankMap.get(b) || 0) + amt);
      }
    });

    // Top merchant
    let topMerchant = { name: '', amount: 0 };
    merchantMap.forEach((amt, name) => {
      if (amt > topMerchant.amount) {
        topMerchant = { name, amount: amt };
      }
    });

    // Top bank entity
    let topBank = { name: '', amount: 0 };
    bankMap.forEach((amt, name) => {
      if (amt > topBank.amount) {
        topBank = { name, amount: amt };
      }
    });

    const topBankPercent = totalSpend > 0 ? (topBank.amount / totalSpend) * 100 : 0;

    return {
      highestTx: {
        merchant: maxTx.normalized_merchant || 'Consumo',
        amount: Number(maxTx.amount) || 0,
      },
      topMerchant,
      topBank: {
        name: topBank.name,
        percentage: topBankPercent.toFixed(0),
      },
    };
  }, [transactions]);

  if (!insights || insights.highestTx.amount === 0) return null;

  return (
    <div className="bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl px-4 py-3 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2 text-zinc-950 dark:text-zinc-50 font-semibold font-mono">
        <Sparkles className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
        <span className="uppercase text-[11px] tracking-wider">Síntesis de Inteligencia Financiera</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-zinc-600 dark:text-zinc-400">
        {/* Insight 1: Largest transaction */}
        <div className="flex items-center gap-1.5">
          <Store className="h-3.5 w-3.5 text-zinc-400" />
          <span>Mayor compra:</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {insights.highestTx.merchant} ({currencySymbol}{insights.highestTx.amount.toFixed(2)})
          </span>
        </div>

        {/* Insight 2: Primary Channel */}
        <div className="flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5 text-zinc-400" />
          <span>Canal preferido:</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {insights.topBank.name} ({insights.topBank.percentage}% del gasto)
          </span>
        </div>

        {/* Insight 3: Top merchant */}
        {insights.topMerchant.name && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            <span>Destino principal:</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {insights.topMerchant.name} ({currencySymbol}{insights.topMerchant.amount.toFixed(2)})
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

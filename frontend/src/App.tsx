import React, { useState } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  ArrowUpRight, 
  Building2, 
  CheckCircle2, 
  CreditCard, 
  DollarSign, 
  Layers, 
  Radio, 
  Sparkles, 
  TrendingUp, 
  X 
} from 'lucide-react';
import { useLiveTransactions } from './hooks/useLiveTransactions';
import { Transaction } from './types';

export default function App() {
  const { transactions, anomalies, isConnected, dismissAnomaly } = useLiveTransactions();
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'ledger' | 'anomalies'>('ledger');

  const filteredTransactions = transactions.filter((t) => {
    if (selectedAccount === 'all') return true;
    return t.account_id === selectedAccount;
  });

  const totalSpend = filteredTransactions.reduce((acc, t) => acc + (t.amount > 0 ? t.amount : 0), 0);
  const totalAnomalies = filteredTransactions.filter((t) => t.is_anomaly).length;

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
              <p className="text-xs text-slate-400">Real-Time Multi-Account Financial Classifier & Anomaly Agent</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
              <Radio className={`h-3 w-3 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-rose-500'}`} />
              <span className={isConnected ? 'text-emerald-400' : 'text-rose-400'}>
                {isConnected ? 'Kafka SSE Stream: ACTIVE' : 'Reconnecting...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
                        {alert.severity} ANOMALY DETECTED
                      </span>
                      <span className="text-xs text-slate-400">
                        {alert.merchant || 'Unknown Payee'} • ${alert.amount.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-200 mt-1 font-medium">{alert.reason}</p>
                  </div>
                </div>
                <button
                  onClick={() => dismissAnomaly(alert.transaction_id)}
                  className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
                  title="Dismiss alert"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Top KPI Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Filtered Spend</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">${totalSpend.toFixed(2)}</div>
            <p className="text-xs text-slate-500 mt-1">Across active transaction ledger</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Connected Accounts</span>
              <Building2 className="h-4 w-4 text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">3 Accounts</div>
            <p className="text-xs text-slate-500 mt-1">Chase, Bank of America, Capital One</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Agent Resolution Rate</span>
              <CheckCircle2 className="h-4 w-4 text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">98.4%</div>
            <p className="text-xs text-slate-500 mt-1">pgvector HNSW + LangGraph Reflection</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Flagged Outliers</span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{totalAnomalies} Flagged</div>
            <p className="text-xs text-slate-500 mt-1">Median Absolute Deviation (MAD > 3.5)</p>
          </div>
        </div>

        {/* Account Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedAccount('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              selectedAccount === 'all'
                ? 'bg-teal-500 text-slate-950 font-bold shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Accounts ({transactions.length})
          </button>
          <button
            onClick={() => setSelectedAccount('b0000000-0000-0000-0000-000000000001')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              selectedAccount === 'b0000000-0000-0000-0000-000000000001'
                ? 'bg-teal-500 text-slate-950 font-bold shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Chase Sapphire (*4821)
          </button>
          <button
            onClick={() => setSelectedAccount('b0000000-0000-0000-0000-000000000002')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              selectedAccount === 'b0000000-0000-0000-0000-000000000002'
                ? 'bg-teal-500 text-slate-950 font-bold shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            BofA Checking (*9104)
          </button>
          <button
            onClick={() => setSelectedAccount('b0000000-0000-0000-0000-000000000003')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              selectedAccount === 'b0000000-0000-0000-0000-000000000003'
                ? 'bg-teal-500 text-slate-950 font-bold shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Capital One (*1288)
          </button>
        </div>

        {/* Real-Time Ledger Table */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-teal-400" />
              Real-Time Unified Transaction Ledger
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              Live updates via Server-Sent Events
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">TIMESTAMP</th>
                  <th className="py-3 px-4">ACCOUNT</th>
                  <th className="py-3 px-4">MERCHANT / RAW PAYEE</th>
                  <th className="py-3 px-4">CATEGORY</th>
                  <th className="py-3 px-4">CONFIDENCE</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4 text-right">AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No transactions recorded yet. Fire simulated bank webhooks using{' '}
                      <code className="text-teal-400 bg-slate-900 px-1 py-0.5 rounded">python scripts/simulate_bank_feed.py</code>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr 
                      key={tx.id} 
                      className={`hover:bg-slate-800/30 transition ${tx.is_anomaly ? 'bg-rose-950/10' : ''}`}
                    >
                      <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {new Date(tx.transaction_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 text-xs">
                          {tx.institution_name || 'Connected Bank'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100">
                          {tx.normalized_merchant || 'Unresolved Payee'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs font-mono">
                          {tx.raw_description}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-950/80 text-teal-300 border border-teal-800/50">
                          {tx.category}
                          {tx.sub_category && (
                            <span className="text-teal-400/60">› {tx.sub_category}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                        {(tx.confidence_score * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {tx.is_anomaly ? (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold"
                            title={tx.anomaly_reason || 'Outlier charge'}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            ANOMALY
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-xs">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            Verified
                          </span>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap ${
                        tx.amount > 0 ? 'text-slate-100' : 'text-emerald-400'
                      }`}>
                        ${tx.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

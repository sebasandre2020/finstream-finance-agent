import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Key, 
  ExternalLink,
  ShieldCheck, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface EmailConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GoogleAuthStatus {
  configured: boolean;
  client_id_prefix: string | null;
  redirect_uri: string;
  message: string;
}

const PRESET_EMAILS = {
  bcp_card_debit: {
    title: 'BCP Débito - Rappi (S/ 46.50)',
    sender: 'notificaciones@bcp.com.pe',
    subject: 'Constancia de Operación - Consumo',
    body: `Estimado(a) Cliente:
Le informamos que se ha realizado una operación con su Tarjeta Credimás Débito BCP N° ...4921
Operación: Consumo
Comercio: RAPPI PERU
Importe: S/ 46.50
Fecha y hora: 26/09/2026 14:15:22
Canal: POS / Internet
Si no reconoce esta operación, comuníquese inmediatamente con nuestra Banca por Teléfono.`
  },
  bcp_card_starbucks: {
    title: 'BCP Crédito - Starbucks (S/ 18.50)',
    sender: 'bancodecredito@bcp.com.pe',
    subject: 'Notificación de Consumo con Tarjeta BCP',
    body: `Hola SEBASTIAN,
Registramos un consumo con tu Tarjeta Visa Signature BCP terminada en 8812.
Establecimiento: STARBUCKS JOCKEY PLAZA
Monto: S/ 18.50
Fecha y hora: 26/09/2026 14:30
Gracias por usar tus tarjetas BCP.`
  },
  yape_sent: {
    title: 'Yape Enviado - Cebichería (S/ 78.00)',
    sender: 'notificaciones@yape.com.pe',
    subject: '¡Yapeaste!',
    body: `¡Yapeaste con éxito!
Enviaste dinero a: CEBICHERIA LA MAR SAC
Monto: S/ 78.00
Fecha: 26/09/2026 - 14:35
Nro. de Operación: 94810294
¡Gracias por yapear!`
  },
  bcp_transfer: {
    title: 'Transferencia BCP - Clínica (S/ 250.00)',
    sender: 'avisos@viabcp.com',
    subject: 'Constancia de Transferencia a Terceros BCP',
    body: `Constancia de Operación
Detalle de la transferencia:
Cuenta Origen: Cuenta Sueldo BCP ...3019
Beneficiario: CLINICA SAN FELIPE
Importe: S/ 250.00
Fecha: 26/09/2026 a las 11:20
Número de operación: 00481920`
  }
};

export const EmailConnectModal: React.FC<EmailConnectModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'google' | 'paste' | 'imap'>('google');
  
  // Google OAuth Status state
  const [googleStatus, setGoogleStatus] = useState<GoogleAuthStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);

  // Paste / Dry-run state
  const [selectedPreset, setSelectedPreset] = useState<string>('bcp_card_debit');
  const [sender, setSender] = useState<string>(PRESET_EMAILS.bcp_card_debit.sender);
  const [subject, setSubject] = useState<string>(PRESET_EMAILS.bcp_card_debit.subject);
  const [body, setBody] = useState<string>(PRESET_EMAILS.bcp_card_debit.body);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<any>(null);

  // Gmail IMAP fallback state
  const [gmailAddress, setGmailAddress] = useState<string>('');
  const [appPassword, setAppPassword] = useState<string>('');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(true);
  const [maxEmails, setMaxEmails] = useState<number>(10);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      checkGoogleStatus();
    }
  }, [isOpen]);

  const checkGoogleStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const resp = await fetch('/api/v1/auth/google/status');
      if (resp.ok) {
        const data: GoogleAuthStatus = await resp.json();
        setGoogleStatus(data);
      }
    } catch (e) {
      console.warn('Failed to load Google OAuth status', e);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  if (!isOpen) return null;

  const handleGoogleSignIn = () => {
    window.location.href = '/api/v1/auth/google/login';
  };

  const handleSelectPreset = (key: string) => {
    setSelectedPreset(key);
    if (key in PRESET_EMAILS) {
      const preset = PRESET_EMAILS[key as keyof typeof PRESET_EMAILS];
      setSender(preset.sender);
      setSubject(preset.subject);
      setBody(preset.body);
      setParseResult(null);
    }
  };

  const handleIngestEmail = async () => {
    setIsProcessing(true);
    setParseResult(null);
    try {
      const resp = await fetch('/api/v1/email/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, subject, body })
      });
      const data = await resp.json();
      setParseResult(data);
    } catch (err: any) {
      setParseResult({ status: 'error', message: err.message || 'Error de conexión con el backend' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncGmail = async () => {
    if (!gmailAddress || !appPassword) {
      alert('Por favor ingresa tu correo Gmail y tu Contraseña de Aplicación de 16 caracteres.');
      return;
    }
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const resp = await fetch('/api/v1/email/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_address: gmailAddress,
          app_password: appPassword,
          unread_only: unreadOnly,
          max_emails: maxEmails
        })
      });
      const data = await resp.json();
      setSyncResult(data);
    } catch (err: any) {
      setSyncResult({ connected: false, error: err.message || 'Error al conectar con Gmail' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                Conectar Entidades Bancarias
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Lectura automática de notificaciones BCP, BBVA, Falabella y Yape
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 px-6 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('google')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'google' 
                ? 'border-zinc-950 dark:border-white text-zinc-950 dark:text-white font-bold' 
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <span>Google Sign-In</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              Directo
            </span>
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'paste' 
                ? 'border-zinc-950 dark:border-white text-zinc-950 dark:text-white font-bold' 
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <span>Plantillas de Prueba</span>
          </button>
          <button
            onClick={() => setActiveTab('imap')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'imap' 
                ? 'border-zinc-950 dark:border-white text-zinc-950 dark:text-white font-bold' 
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <span>Contraseña IMAP</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* TAB 1: GOOGLE SIGN-IN */}
          {activeTab === 'google' && (
            <div className="space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white border border-zinc-200 rounded-xl shadow-sm shrink-0">
                    {/* Official Google G Logo */}
                    <svg className="h-6 w-6" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      Autenticación Oficial de Google
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                      Conecta tu cuenta en un solo clic. El agente solicita permiso de solo lectura (<code className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200">gmail.readonly</code>) para ingerir automáticamente notificaciones bancarias de tus cuentas.
                    </p>
                    <div className="flex items-center gap-1.5 mt-3 text-[11px] text-zinc-700 dark:text-zinc-300">
                      <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Privacidad garantizada: Sin acceso de modificación ni envío de correos.</span>
                    </div>
                  </div>
                </div>

                {/* Google Button */}
                <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  {googleStatus?.configured ? (
                    <button
                      onClick={handleGoogleSignIn}
                      className="w-full flex items-center justify-center gap-3 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 font-semibold px-6 py-3 rounded-xl transition shadow-md text-xs group"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                      </svg>
                      <span>Iniciar Sesión con Google</span>
                      <ArrowRight className="h-4 w-4 ml-1 text-zinc-400 group-hover:translate-x-0.5 transition" />
                    </button>
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-600 dark:text-amber-400">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>Credenciales Google en espera de configuración</span>
                      </div>
                      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                        Configura <code className="font-mono text-zinc-900 dark:text-zinc-100">GOOGLE_CLIENT_ID</code> y <code className="font-mono text-zinc-900 dark:text-zinc-100">GOOGLE_CLIENT_SECRET</code> en tu archivo <code className="font-mono text-zinc-900 dark:text-zinc-100">.env</code> para habilitar el acceso OAuth.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status footer */}
              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1">
                <span className="flex items-center gap-1.5 font-mono text-[11px]">
                  <span className={`h-2 w-2 rounded-full ${googleStatus?.configured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {googleStatus?.configured ? 'OAuth 2.0 Operativo' : 'OAuth 2.0 Inactivo'}
                </span>
                <button
                  onClick={checkGoogleStatus}
                  disabled={isLoadingStatus}
                  className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingStatus ? 'animate-spin' : ''}`} />
                  <span>Reverificar</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PROBAR PLANTILLA BCP / YAPE */}
          {activeTab === 'paste' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Selecciona una plantilla de prueba:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PRESET_EMAILS).map(([key, item]) => (
                    <button
                      key={key}
                      onClick={() => handleSelectPreset(key)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition ${
                        selectedPreset === key 
                          ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-zinc-950 dark:border-white font-medium shadow-sm' 
                          : 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <span className="font-semibold block truncate">{item.title}</span>
                      <span className="text-[10px] opacity-70 block truncate font-mono mt-0.5">{item.sender}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mb-1">Remitente</label>
                  <input
                    type="text"
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mb-1">Asunto</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mb-1">
                  Cuerpo del Correo
                </label>
                <textarea
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-400 leading-relaxed"
                />
              </div>

              <button
                onClick={handleIngestEmail}
                disabled={isProcessing}
                className="w-full flex items-center justify-center space-x-2 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 font-bold px-4 py-2.5 rounded-xl transition text-xs disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Procesando notificación bancaria...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Ingestar y Procesar en Vivo</span>
                  </>
                )}
              </button>

              {parseResult && (
                <div className={`p-3.5 rounded-xl border text-xs animate-fade-in ${
                  parseResult.status === 'ingested' 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300' 
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300'
                }`}>
                  <div className="flex items-center gap-2 font-bold">
                    {parseResult.status === 'ingested' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                    <span>{parseResult.message}</span>
                  </div>
                  {parseResult.transaction && (
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono mt-2 bg-white/60 dark:bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <div><span className="text-zinc-500">Comercio:</span> {parseResult.transaction.merchant}</div>
                      <div><span className="text-zinc-500">Monto:</span> {parseResult.transaction.currency} {parseResult.transaction.amount?.toFixed(2)}</div>
                      <div><span className="text-zinc-500">Parser:</span> {parseResult.transaction.parser_used}</div>
                      <div><span className="text-zinc-500">Confianza:</span> {(parseResult.transaction.confidence * 100).toFixed(0)}%</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: APP PASSWORD (IMAP) */}
          {activeTab === 'imap' && (
            <div className="space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-zinc-500" />
                    Conexión IMAP SSL
                  </span>
                  <a 
                    href="https://myaccount.google.com/apppasswords" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center gap-1 underline"
                  >
                    Generar en Google
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mb-1">
                      Correo Gmail
                    </label>
                    <input
                      type="email"
                      placeholder="usuario@gmail.com"
                      value={gmailAddress}
                      onChange={(e) => setGmailAddress(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mb-1">
                      Contraseña de Aplicación (16 dígitos)
                    </label>
                    <input
                      type="password"
                      placeholder="•••• •••• •••• ••••"
                      value={appPassword}
                      onChange={(e) => setAppPassword(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center space-x-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={unreadOnly}
                      onChange={(e) => setUnreadOnly(e.target.checked)}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-0"
                    />
                    <span>Solo correos no leídos</span>
                  </label>
                  <div className="flex items-center space-x-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>Límite:</span>
                    <select
                      value={maxEmails}
                      onChange={(e) => setMaxEmails(Number(e.target.value))}
                      className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-0.5 text-xs text-zinc-900 dark:text-zinc-100"
                    >
                      <option value={5}>5 correos</option>
                      <option value={10}>10 correos</option>
                      <option value={20}>20 correos</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSyncGmail}
                disabled={isSyncing}
                className="w-full flex items-center justify-center space-x-2 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 font-bold px-4 py-2.5 rounded-xl transition text-xs disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Sincronizando con Gmail IMAP...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Sincronizar Bandeja de Entrada</span>
                  </>
                )}
              </button>

              {syncResult && (
                <div className={`p-3.5 rounded-xl border text-xs animate-fade-in ${
                  syncResult.connected 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300' 
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
                }`}>
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {syncResult.connected ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-500" />
                    )}
                    <span>{syncResult.connected ? 'Sincronización Exitosa' : 'Error de Conexión'}</span>
                  </div>
                  {syncResult.connected ? (
                    <div className="text-[11px] space-y-0.5 text-zinc-700 dark:text-zinc-300 font-mono mt-1">
                      <p>Correos inspeccionados: {syncResult.inspected_count}</p>
                      <p>Transacciones encontradas: {syncResult.parsed_count}</p>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">Nuevas transacciones agregadas: {syncResult.synced_count}</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{syncResult.error}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

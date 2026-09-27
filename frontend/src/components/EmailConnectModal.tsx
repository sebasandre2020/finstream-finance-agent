import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Key, 
  ExternalLink,
  Zap,
  Globe,
  ShieldCheck,
  ArrowRight
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

  // Fetch Google OAuth status when opening modal
  useEffect(() => {
    if (isOpen) {
      checkGoogleStatus();
    }
  }, [isOpen]);

  const checkGoogleStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const resp = await fetch('http://localhost:8000/api/v1/auth/google/status');
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
    // Redirect browser directly to Google OAuth initiation endpoint
    window.location.href = 'http://localhost:8000/api/v1/auth/google/login';
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
      const resp = await fetch('http://localhost:8000/api/v1/email/ingest', {
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
      const resp = await fetch('http://localhost:8000/api/v1/email/sync', {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Conectar Banco (BCP / Yape)
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Gratis ($0)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Sincronización automática de notificaciones bancarias en tiempo real
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2">
          <button
            onClick={() => setActiveTab('google')}
            className={`pb-3 px-4 text-xs font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'google' 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            Google Sign-In (Recomendado)
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`pb-3 px-4 text-xs font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'paste' 
                ? 'border-teal-500 text-teal-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Probar Plantillas BCP / Yape
          </button>
          <button
            onClick={() => setActiveTab('imap')}
            className={`pb-3 px-4 text-xs font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'imap' 
                ? 'border-teal-500 text-teal-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="h-3.5 w-3.5" />
            App Password (IMAP)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* TAB 1: GOOGLE SIGN-IN */}
          {activeTab === 'google' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/20 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white rounded-xl shadow-md shrink-0">
                    {/* Official Google G SVG */}
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
                    <h3 className="text-sm font-semibold text-white">
                      Inicio de Sesión Oficial con Google
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Conecta tu cuenta en un solo clic. El agente solo solicitará permiso de lectura (<code className="text-blue-300 font-mono text-[11px]">gmail.readonly</code>) para buscar automáticamente notificaciones de <strong className="text-white">BCP</strong> y <strong className="text-white">Yape</strong>.
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-[11px] text-emerald-400">
                      <ShieldCheck className="h-4 w-4" />
                      <span>100% seguro: Nunca almacenamos tu contraseña ni alteramos tus correos.</span>
                    </div>
                  </div>
                </div>

                {/* Google Button or Configuration Notice */}
                <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                  {googleStatus?.configured ? (
                    <button
                      onClick={handleGoogleSignIn}
                      className="w-full sm:w-auto flex-1 flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold px-6 py-3 rounded-xl transition shadow-lg hover:shadow-white/10 text-sm group"
                    >
                      {/* Google Icon */}
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                      </svg>
                      <span>Iniciar Sesión con Google</span>
                      <ArrowRight className="h-4 w-4 ml-1 text-slate-500 group-hover:translate-x-0.5 transition" />
                    </button>
                  ) : (
                    <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                        <span>Configuración de Google OAuth pendiente</span>
                      </div>
                      <p className="mt-1 text-slate-400">
                        Para habilitar este botón con tu cuenta real de Google, sigue la guía paso a paso que el asistente te compartirá para agregar tu <code className="text-amber-200">GOOGLE_CLIENT_ID</code> y <code className="text-amber-200">GOOGLE_CLIENT_SECRET</code> en el archivo <code className="text-amber-200">.env</code>.
                      </p>
                      <div className="mt-2 text-[11px] font-mono text-slate-400">
                        URI de Redirección Autorizada: <span className="text-teal-400">http://localhost:8000/api/v1/auth/google/callback</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status footer */}
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${googleStatus?.configured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {googleStatus?.configured ? 'Google OAuth 2.0 Listo' : 'Credenciales Google por configurar'}
                </span>
                <button
                  onClick={checkGoogleStatus}
                  disabled={isLoadingStatus}
                  className="flex items-center gap-1 text-slate-400 hover:text-white transition"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingStatus ? 'animate-spin' : ''}`} />
                  <span>Reverificar</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PROBAR PLANTILLA BCP / YAPE */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Selecciona una plantilla de prueba o pega un correo real:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PRESET_EMAILS).map(([key, item]) => (
                    <button
                      key={key}
                      onClick={() => handleSelectPreset(key)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition ${
                        selectedPreset === key 
                          ? 'bg-teal-500/10 border-teal-500/50 text-teal-300 shadow-sm' 
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-semibold block truncate">{item.title}</span>
                      <span className="text-[10px] text-slate-500 block truncate">{item.sender}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Remitente</label>
                  <input
                    type="text"
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Asunto</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Cuerpo del Correo (HTML o Texto)
                </label>
                <textarea
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono focus:border-teal-500 focus:outline-none leading-relaxed"
                />
              </div>

              <button
                onClick={handleIngestEmail}
                disabled={isProcessing}
                className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition shadow-lg hover:shadow-teal-500/20 text-xs disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Parseando y Publicando en Kafka...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Ingestar al Dashboard en Vivo</span>
                  </>
                )}
              </button>

              {parseResult && (
                <div className={`p-4 rounded-xl border text-xs animate-fade-in ${
                  parseResult.status === 'ingested' 
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' 
                    : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                }`}>
                  <div className="flex items-center gap-2 font-bold mb-2">
                    {parseResult.status === 'ingested' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-400" />
                    )}
                    <span>{parseResult.message}</span>
                  </div>
                  {parseResult.transaction && (
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mt-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <div><span className="text-slate-400">Comercio:</span> {parseResult.transaction.merchant}</div>
                      <div><span className="text-slate-400">Monto:</span> {parseResult.transaction.currency} {parseResult.transaction.amount?.toFixed(2)}</div>
                      <div><span className="text-slate-400">Parser:</span> {parseResult.transaction.parser_used}</div>
                      <div><span className="text-slate-400">Confianza:</span> {(parseResult.transaction.confidence * 100).toFixed(0)}%</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: APP PASSWORD (IMAP) */}
          {activeTab === 'imap' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-teal-400" />
                    Conexión Directa IMAP SSL
                  </span>
                  <a 
                    href="https://myaccount.google.com/apppasswords" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 underline"
                  >
                    Crear Contraseña en Google
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">Tu Correo de Gmail</label>
                    <input
                      type="email"
                      placeholder="tu_correo@gmail.com"
                      value={gmailAddress}
                      onChange={(e) => setGmailAddress(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Contraseña de Aplicación (16 letras)
                    </label>
                    <input
                      type="password"
                      placeholder="xxxx xxxx xxxx xxxx"
                      value={appPassword}
                      onChange={(e) => setAppPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none font-mono tracking-wider"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={unreadOnly}
                      onChange={(e) => setUnreadOnly(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-0"
                    />
                    <span>Solo correos no leídos</span>
                  </label>
                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <span>Límite:</span>
                    <select
                      value={maxEmails}
                      onChange={(e) => setMaxEmails(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200"
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
                className="w-full flex items-center justify-center space-x-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition shadow-lg text-xs disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Conectando a IMAP y Sincronizando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>Sincronizar Bandeja de Entrada</span>
                  </>
                )}
              </button>

              {syncResult && (
                <div className={`p-4 rounded-xl border text-xs animate-fade-in ${
                  syncResult.connected 
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' 
                    : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                }`}>
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {syncResult.connected ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-400" />
                    )}
                    <span>{syncResult.connected ? 'Sincronización Exitosa' : 'Error de Conexión'}</span>
                  </div>
                  {syncResult.connected ? (
                    <div className="text-[11px] space-y-1 text-slate-300">
                      <p>Correos inspeccionados: {syncResult.inspected_count}</p>
                      <p>Transacciones encontradas: {syncResult.parsed_count}</p>
                      <p className="text-emerald-400 font-semibold">Nuevas transacciones agregadas al dashboard: {syncResult.synced_count}</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-rose-300 mt-1">{syncResult.error}</p>
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

export type Language = "en" | "es";

export const LANG_KEY = "finstream.language.v1";

export function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "es") return saved;
  } catch {
    /* ignore storage access issues */
  }
  return "en";
}

export function saveLanguage(lang: Language): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage may be blocked */
  }
}

export const categoryTranslations: Record<string, { en: string; es: string }> = {
  Groceries: { en: "Groceries", es: "Alimentación" },
  "Food & Drink": { en: "Food & Drink", es: "Comida y bebida" },
  Travel: { en: "Travel", es: "Viajes" },
  Shopping: { en: "Shopping", es: "Compras" },
  Entertainment: { en: "Entertainment", es: "Entretenimiento" },
  Utilities: { en: "Utilities", es: "Servicios" },
  Health: { en: "Health", es: "Salud" },
  Income: { en: "Income", es: "Ingresos" },
  Transfer: { en: "Transfer", es: "Transferencia" },
  Uncategorized: { en: "Uncategorized", es: "Sin categoría" },
};

export function translateCategory(category: string, lang: Language): string {
  if (lang === "es" && categoryTranslations[category]?.es) {
    return categoryTranslations[category].es;
  }
  return category;
}

export const translations = {
  en: {
    // Navigation & Shell
    skipToContent: "Skip to content",
    brandDot: ".",
    workspaceLabel: "Your everyday money",
    nav: {
      Overview: "Overview",
      Activity: "Activity",
      "Spending plan": "Spending plan",
      "To review": "To review",
    },
    quietNoteTitle: "A little clarity, every day.",
    quietNoteText: "All your activity. One place to make sense of it.",
    howItWorks: "How it works",
    demoWorkspace: "Demo workspace",
    personalFinance: "Personal finance",

    // Topbar
    myWorkspace: "My workspace",
    sampleData: "Sample data",
    connected: "Connected",
    offline: "Offline",
    showAmounts: "Show amounts",
    hideAmounts: "Hide amounts",
    reviewUnusualNotice: (count: number) =>
      `Review ${count} unusual transaction${count === 1 ? "" : "s"}`,
    switchToDark: "Switch to dark mode",
    switchToLight: "Switch to light mode",
    switchToSpanish: "Cambiar a Español",
    switchToEnglish: "Switch to English",

    // Headings & View Subtitles
    headings: {
      Overview: {
        title: "A clearer view of your money.",
        desc: "Your everyday spending, all together and easy to understand.",
      },
      Activity: {
        title: "The little things add up.",
        desc: "Find a purchase, check a payment, or take your activity with you.",
      },
      "Spending plan": {
        title: "Make room for what matters.",
        desc: "Set a monthly target that works for your everyday life.",
      },
      "To review": {
        title: "A second look, for peace of mind.",
        desc: "Unusual doesn’t always mean wrong. Check these purchases when you have a moment.",
      },
    },

    // Demo & User Actions
    exploreDemo: "Explore a demo",
    backToActivity: "Back to my activity",
    demoBanner: "You’re exploring sample activity. Your real accounts are separate.",
    exitDemo: "Exit demo",
    syncGmail: "Sync Gmail",
    syncingGmail: "Syncing Gmail…",
    signOut: "Sign out",
    tryAgain: "Try again",

    // Scope & Filters
    account: "Account",
    allAccounts: "All accounts",
    accountNumber: (num: string) => `Account ${num}`,
    timePeriod: "Time period",
    thisMonth: "This month",
    last7Days: "Last 7 days",
    allLoadedActivity: "All loaded activity",
    currency: "Currency",
    sampleOverview: "Sample overview",
    transactionsLoaded: (count: number) => `${count} transactions loaded`,
    refreshActivity: "Refresh activity",
    summariesCoverLoaded:
      "Summaries cover loaded activity only. Load older activity below for a fuller picture.",

    // Metrics
    spendingSummary: "Spending summary",
    moneyOut: "Money out",
    moneyOutSub: "Purchases & payments in this view",
    moneyIn: "Money in",
    moneyInSub: "Deposits, credits & refunds",
    inMinusOut: "In minus out",
    inMinusOutSub: "Activity difference, not account balance",

    // Overview Cards
    whereMoneyGoes: "Where your money goes",
    selectedActivity: "Selected activity",
    totalSpent: "Total spent",
    categoryCount: (count: number) =>
      `${count} categor${count === 1 ? "y" : "ies"}`,
    spendingByCategoryAria: "Spending by category; amounts listed alongside",
    seeAllCategories: "See all categories",
    emptySpendingTitle: "Your spending story starts here",
    emptySpendingDesc: "Your category breakdown will appear as purchases arrive.",

    // Spending Target Card
    monthlyTarget: "Your monthly target",
    targetIntention: "A little intention goes a long way.",
    findYourRhythm: "Find your rhythm",
    overSpendingTarget: "over your spending target",
    leftInSpendingTarget: "left in your spending target",
    startLimit: "Start with a comfortable monthly limit.",
    spentAmount: (amount: string) => `${amount} spent`,
    targetAmount: (amount: string) => `${amount} target`,
    noTargetYet: "No target yet",
    adjustTarget: "Adjust my target",
    setSpendingTarget: "Set a spending target",
    targetFootnote: (currency: string) =>
      `This month · all ${currency} accounts · stored on this device`,

    // Review Banner
    singleReviewBanner: "One purchase could use a second look",
    multipleReviewBanner: (count: number) =>
      `${count} purchases could use a second look`,
    reviewBannerSub:
      "We noticed spending that looks different from your usual activity.",
    reviewAction: "Review",

    // Activity Section
    recentActivity: "Recent activity",
    yourActivity: "Your activity",
    recentActivitySub: "The latest comings and goings.",
    matchingTransactions: (count: number) =>
      `${count} matching transaction${count === 1 ? "" : "s"}`,
    viewAllActivity: "View all activity",
    exportCSV: "Export CSV",
    searchActivity: "Search activity",
    searchPlaceholder: "Search merchants or purchases",
    categoryLabel: "Category",
    allCategories: "All categories",
    moneyDirection: "Money direction",
    directionAll: "Money in & out",
    directionOut: "Money out",
    directionIn: "Money in",
    unknownMerchant: "Unknown merchant",
    reviewed: "Reviewed",
    toReview: "To review",

    // Empty States
    loadingActivity: "Loading your activity…",
    noMatchingActivity: "No matching activity",
    welcomeRoutine: "Welcome to a clearer money routine",
    noMatchingSub: "Try another period, account, or search.",
    welcomeSub:
      "Activity from your connected bank feed will appear here. Explore the demo to see how it works.",
    clearFilters: "Clear filters",
    exploreSampleActivity: "Explore sample activity",

    // Activity Footer
    showingTransactions: (visible: number, scoped: number) =>
      `Showing ${visible} of ${scoped} transactions in this view`,
    selectTxDetails: "Select any transaction for more details.",
    loadOlderActivity: "Load older activity",
    loadingOlder: "Loading…",

    // Spending Plan View
    planForMonth: (month: string) => `Your plan for ${month}`,
    planSubtitle: (currency: string) =>
      `All ${currency} accounts · current month · loaded activity`,
    oneSimpleTarget: "One simple target.",
    overTargetExplanation:
      "over your monthly target. You can adjust it as life changes.",
    leftBeforeTargetExplanation: "left before reaching your monthly target.",
    chooseSpendExplanation:
      "Choose how much you want to spend this month. You can change it anytime.",
    targetNotSet: "Target not set",
    editSpendingTarget: "Edit spending target",
    spendingTargetBrowserNote:
      "Your target is saved in this browser, separately for each currency. Credits and refunds do not reduce spending.",
    categorySpending: "Category spending",
    categorySpendingNote: "Uses the account and period filters above.",
    noSpendingInView: "No spending in this view yet.",

    // To Review View
    worthChecking: "Worth checking",
    purchasesToReviewCount: (count: number) =>
      `${count} purchase${count === 1 ? "" : "s"} to review in this view`,
    unusualAmount: "Unusual amount",
    defaultAnomalyReason:
      "This purchase is different from your usual spending. Check that you recognize it.",
    connectedAccount: "Connected account",
    markAsReviewed: "Mark as reviewed",
    markAsUnreviewed: "Mark as unreviewed",
    viewDetails: "View details",
    allCaughtUp: "You’re all caught up",
    allCaughtUpDesc: "No unreviewed unusual purchases in this view.",
    browseActivity: "Browse activity",
    reviewBrowserNote:
      "Review status is saved on this device. If you don’t recognize a purchase, contact your bank directly.",

    // Footer
    footerMotto: "A little more clarity. A little less worry.",
    aboutYourData: "About your data",

    // Dialogs
    dialogDetailsTitle: "Transaction details",
    closeDetails: "Close transaction details",
    date: "Date",
    dateTime: "Date & time",
    bankDescription: "Bank description",
    notProvided: "Not provided",
    reviewedOnDevice: "Reviewed on this device",
    worthSecondLook: "Worth a second look",

    dialogTargetTitle: "Your monthly spending target",
    closeTarget: "Close spending target",
    dialogTargetDesc: (currency: string, demo: boolean) =>
      `A flexible limit for all your ${currency} accounts. Saved on this device${demo ? " for this demo" : ""}.`,
    monthlyTargetInputLabel: (currency: string) =>
      `Monthly target (${currency})`,
    targetAmountError: "Enter an amount between 0.01 and 100,000,000.",
    removeTarget: "Remove target",
    saveTarget: "Save target",

    dialogHelpTitle: "Your money, made clearer.",
    closeHelp: "Close help",
    helpP1:
      "FinStream brings purchases from your configured bank feeds into one view and groups them into categories.",
    helpH1: "Understanding the numbers",
    helpP2:
      "Money out includes purchases and payments. Money in includes deposits and refunds. Their difference is not your bank balance. Currencies are kept separate, with no exchange-rate conversion.",
    helpH2: "A picture of loaded activity",
    helpP3:
      "Summaries use the transactions loaded here. Load older activity to include more history. Activity refreshes automatically every 30 seconds while this tab is visible.",
    helpH3: "Personal to this browser",
    helpP4:
      "Spending targets and reviewed flags are saved on this device. They won’t follow you to another browser. Sample activity is kept separate from your real transactions.",
    helpH4: "Getting started",
    helpP5:
      "Sign in with Google to import banking notifications from Gmail. Use Sync Gmail to check for new activity. Direct bank connections are not available yet.",

    // Notifications / Toasts
    dismissNotification: "Dismiss notification",
    storageUnavailable:
      "Browser storage is unavailable. Your change will last for this visit only.",
    movedToReviewList: "Moved back to your review list.",
    markedAsReviewed: "Marked as reviewed on this device.",
    exportedTransactions: (count: number) =>
      `Exported ${count} transaction${count === 1 ? "" : "s"}.`,
    targetSaved: "Monthly spending target saved.",
    gmailSyncStarted:
      "Checking Gmail for bank activity... Your transactions will appear as they are processed.",
    gmailSyncSlow:
      "Gmail is taking longer than expected. Refresh activity to check imported transactions, or try syncing again shortly.",
    gmailSyncQueued: (count: number) =>
      `${count} new transaction${count === 1 ? "" : "s"} queued. Your activity will update as they are processed.`,
    gmailSyncNone:
      "Gmail checked. No supported bank transaction emails were found.",
    gmailSyncUpToDate:
      "Gmail checked. Your activity is up to date, or queued transactions are still being processed.",
    gmailSyncFailed:
      "Gmail sync failed. Try again or sign out and reconnect Google.",

    // Auth screen
    authTitlePart1: "Your money.",
    authTitlePart2: "Your own space.",
    authSubtitle:
      "Sign in to see your spending across accounts and bring your banking notifications together.",
    signInGoogle: "Sign in with Google",
    authDisclosure:
      "With your permission, FinStream reads Gmail banking notifications to import transactions. It cannot send or delete your emails.",
    googleAdminConfig:
      "Google sign-in needs to be configured by the administrator.",
    authFootnote:
      "Your financial activity is only available in your signed-in account.",
    checkingSession: "Checking your session…",
    sessionEnded: "Your session ended. Sign in again to continue.",
    sessionCheckFailed: "We couldn’t check your session. Please try again.",
    signOutFailed: "Sign-out failed. Please try again.",
    googleAuthError: "Google sign-in wasn’t completed. Please try again.",
  },
  es: {
    // Navigation & Shell
    skipToContent: "Saltar al contenido",
    brandDot: ".",
    workspaceLabel: "Tus finanzas del día a día",
    nav: {
      Overview: "Resumen",
      Activity: "Actividad",
      "Spending plan": "Plan de gastos",
      "To review": "Por revisar",
    },
    quietNoteTitle: "Claridad cada día.",
    quietNoteText: "Toda tu actividad. Un solo lugar para entenderla.",
    howItWorks: "Cómo funciona",
    demoWorkspace: "Espacio de prueba",
    personalFinance: "Finanzas personales",

    // Topbar
    myWorkspace: "Mi espacio",
    sampleData: "Datos de prueba",
    connected: "Conectado",
    offline: "Desconectado",
    showAmounts: "Mostrar montos",
    hideAmounts: "Ocultar montos",
    reviewUnusualNotice: (count: number) =>
      `Revisar ${count} transacci${count === 1 ? "ón inusual" : "ones inusuales"}`,
    switchToDark: "Cambiar a modo oscuro",
    switchToLight: "Cambiar a modo claro",
    switchToSpanish: "Cambiar a Español",
    switchToEnglish: "Switch to English",

    // Headings & View Subtitles
    headings: {
      Overview: {
        title: "Una vista más clara de tu dinero.",
        desc: "Tus gastos diarios, organizados y fáciles de entender.",
      },
      Activity: {
        title: "Los pequeños detalles cuentan.",
        desc: "Busca una compra, revisa un pago o exporta tu actividad.",
      },
      "Spending plan": {
        title: "Haz espacio para lo importante.",
        desc: "Define un objetivo mensual que se adapte a tu vida.",
      },
      "To review": {
        title: "Una segunda mirada, para tu tranquilidad.",
        desc: "Inusual no siempre significa un error. Revisa estas compras cuando tengas un momento.",
      },
    },

    // Demo & User Actions
    exploreDemo: "Explorar versión de prueba",
    backToActivity: "Volver a mi actividad",
    demoBanner: "Estás explorando datos de prueba. Tus cuentas reales están separadas.",
    exitDemo: "Salir de la prueba",
    syncGmail: "Sincronizar Gmail",
    syncingGmail: "Sincronizando Gmail…",
    signOut: "Cerrar sesión",
    tryAgain: "Reintentar",

    // Scope & Filters
    account: "Cuenta",
    allAccounts: "Todas las cuentas",
    accountNumber: (num: string) => `Cuenta ${num}`,
    timePeriod: "Período de tiempo",
    thisMonth: "Este mes",
    last7Days: "Últimos 7 días",
    allLoadedActivity: "Toda la actividad cargada",
    currency: "Moneda",
    sampleOverview: "Resumen de prueba",
    transactionsLoaded: (count: number) => `${count} transacciones cargadas`,
    refreshActivity: "Actualizar actividad",
    summariesCoverLoaded:
      "Los resúmenes cubren solo la actividad cargada. Carga actividad más antigua abajo para una visión más completa.",

    // Metrics
    spendingSummary: "Resumen de gastos",
    moneyOut: "Gastos",
    moneyOutSub: "Compras y pagos en esta vista",
    moneyIn: "Ingresos",
    moneyInSub: "Depósitos, créditos y reembolsos",
    inMinusOut: "Ingresos menos gastos",
    inMinusOutSub: "Diferencia de actividad, no saldo de cuenta",

    // Overview Cards
    whereMoneyGoes: "A dónde va tu dinero",
    selectedActivity: "Actividad seleccionada",
    totalSpent: "Total gastado",
    categoryCount: (count: number) =>
      `${count} categor${count === 1 ? "ía" : "ías"}`,
    spendingByCategoryAria: "Gastos por categoría; montos listados al lado",
    seeAllCategories: "Ver todas las categorías",
    emptySpendingTitle: "Tu historia de gastos empieza aquí",
    emptySpendingDesc: "El desglose por categorías aparecerá cuando registres compras.",

    // Spending Target Card
    monthlyTarget: "Tu objetivo mensual",
    targetIntention: "Un poco de planificación marca la diferencia.",
    findYourRhythm: "Encuentra tu ritmo",
    overSpendingTarget: "por encima de tu objetivo",
    leftInSpendingTarget: "restante de tu objetivo",
    startLimit: "Comienza con un límite mensual cómodo.",
    spentAmount: (amount: string) => `${amount} gastado`,
    targetAmount: (amount: string) => `Objetivo: ${amount}`,
    noTargetYet: "Sin objetivo aún",
    adjustTarget: "Ajustar mi objetivo",
    setSpendingTarget: "Definir objetivo de gasto",
    targetFootnote: (currency: string) =>
      `Este mes · todas las cuentas en ${currency} · guardado en este dispositivo`,

    // Review Banner
    singleReviewBanner: "Una compra requiere una revisión",
    multipleReviewBanner: (count: number) =>
      `${count} compras requieren una revisión`,
    reviewBannerSub:
      "Notamos gastos que difieren de tu actividad habitual.",
    reviewAction: "Revisar",

    // Activity Section
    recentActivity: "Actividad reciente",
    yourActivity: "Tu actividad",
    recentActivitySub: "Los movimientos más recientes.",
    matchingTransactions: (count: number) =>
      `${count} transacci${count === 1 ? "ón coincidente" : "ones coincidentes"}`,
    viewAllActivity: "Ver toda la actividad",
    exportCSV: "Exportar CSV",
    searchActivity: "Buscar actividad",
    searchPlaceholder: "Buscar comercios o compras",
    categoryLabel: "Categoría",
    allCategories: "Todas las categorías",
    moneyDirection: "Dirección del dinero",
    directionAll: "Ingresos y gastos",
    directionOut: "Solo gastos",
    directionIn: "Solo ingresos",
    unknownMerchant: "Comercio desconocido",
    reviewed: "Revisado",
    toReview: "Por revisar",

    // Empty States
    loadingActivity: "Cargando tu actividad…",
    noMatchingActivity: "No hay actividad coincidente",
    welcomeRoutine: "Bienvenido a una rutina financiera más clara",
    noMatchingSub: "Prueba con otro período, cuenta o búsqueda.",
    welcomeSub:
      "La actividad de tus bancos aparecerá aquí. Explora la prueba para ver cómo funciona.",
    clearFilters: "Limpiar filtros",
    exploreSampleActivity: "Explorar actividad de prueba",

    // Activity Footer
    showingTransactions: (visible: number, scoped: number) =>
      `Mostrando ${visible} de ${scoped} transacciones en esta vista`,
    selectTxDetails: "Selecciona una transacción para más detalles.",
    loadOlderActivity: "Cargar actividad anterior",
    loadingOlder: "Cargando…",

    // Spending Plan View
    planForMonth: (month: string) => `Tu plan para ${month}`,
    planSubtitle: (currency: string) =>
      `Todas las cuentas en ${currency} · mes actual · actividad cargada`,
    oneSimpleTarget: "Un objetivo simple.",
    overTargetExplanation:
      "sobre tu objetivo mensual. Puedes ajustarlo según tus necesidades.",
    leftBeforeTargetExplanation: "restante antes de alcanzar tu objetivo mensual.",
    chooseSpendExplanation:
      "Elige cuánto quieres gastar este mes. Puedes cambiarlo en cualquier momento.",
    targetNotSet: "Objetivo no definido",
    editSpendingTarget: "Editar objetivo de gasto",
    spendingTargetBrowserNote:
      "Tu objetivo se guarda en este navegador, por separado para cada moneda. Los créditos y reembolsos no reducen el gasto.",
    categorySpending: "Gasto por categoría",
    categorySpendingNote: "Usa los filtros de cuenta y período superiores.",
    noSpendingInView: "No hay gastos en esta vista todavía.",

    // To Review View
    worthChecking: "Para revisar",
    purchasesToReviewCount: (count: number) =>
      `${count} compra${count === 1 ? "" : "s"} para revisar en esta vista`,
    unusualAmount: "Monto inusual",
    defaultAnomalyReason:
      "Esta compra difiere de tus gastos habituales. Verifica que la reconozcas.",
    connectedAccount: "Cuenta conectada",
    markAsReviewed: "Marcar como revisado",
    markAsUnreviewed: "Marcar como no revisado",
    viewDetails: "Ver detalles",
    allCaughtUp: "Estás al día",
    allCaughtUpDesc: "No hay compras inusuales pendientes de revisión en esta vista.",
    browseActivity: "Explorar actividad",
    reviewBrowserNote:
      "El estado de revisión se guarda en este dispositivo. Si no reconoces una compra, contacta directamente a tu banco.",

    // Footer
    footerMotto: "Un poco más de claridad. Un poco menos de preocupación.",
    aboutYourData: "Sobre tus datos",

    // Dialogs
    dialogDetailsTitle: "Detalles de la transacción",
    closeDetails: "Cerrar detalles de la transacción",
    date: "Fecha",
    dateTime: "Fecha y hora",
    bankDescription: "Descripción del banco",
    notProvided: "No proporcionada",
    reviewedOnDevice: "Revisado en este dispositivo",
    worthSecondLook: "Requiere revisión",

    dialogTargetTitle: "Tu objetivo mensual de gasto",
    closeTarget: "Cerrar objetivo de gasto",
    dialogTargetDesc: (currency: string, demo: boolean) =>
      `Un límite flexible para todas tus cuentas en ${currency}. Guardado en este dispositivo${demo ? " para esta prueba" : ""}.`,
    monthlyTargetInputLabel: (currency: string) =>
      `Objetivo mensual (${currency})`,
    targetAmountError: "Ingresa un monto entre 0.01 y 100,000,000.",
    removeTarget: "Eliminar objetivo",
    saveTarget: "Guardar objetivo",

    dialogHelpTitle: "Tu dinero, más claro.",
    closeHelp: "Cerrar ayuda",
    helpP1:
      "FinStream reúne los movimientos de tus entidades bancarias configuradas en una sola vista y los agrupa en categorías.",
    helpH1: "Entender los números",
    helpP2:
      "Los gastos incluyen compras y pagos. Los ingresos incluyen depósitos y reembolsos. Su diferencia no es el saldo de tu cuenta. Las monedas se gestionan por separado, sin conversión de tipo de cambio.",
    helpH2: "Una imagen de la actividad cargada",
    helpP3:
      "Los resúmenes utilizan las transacciones cargadas aquí. Carga actividad más antigua para incluir más historial. La actividad se actualiza automáticamente cada 30 segundos mientras la pestaña esté visible.",
    helpH3: "Privado en este navegador",
    helpP4:
      "Los objetivos de gasto y los estados de revisión se guardan en este dispositivo. No te seguirán a otro navegador. La actividad de prueba se mantiene separada de tus transacciones reales.",
    helpH4: "Primeros pasos",
    helpP5:
      "Inicia sesión con Google para importar notificaciones bancarias desde Gmail. Usa Sincronizar Gmail para comprobar nueva actividad. La conexión bancaria directa aún no está disponible.",

    // Notifications / Toasts
    dismissNotification: "Descartar notificación",
    storageUnavailable:
      "El almacenamiento del navegador no está disponible. Tu cambio durará solo en esta visita.",
    movedToReviewList: "Devuelto a tu lista de revisión.",
    markedAsReviewed: "Marcado como revisado en este dispositivo.",
    exportedTransactions: (count: number) =>
      `Se exportaron ${count} transacci${count === 1 ? "ón" : "ones"}.`,
    targetSaved: "Objetivo mensual de gasto guardado.",
    gmailSyncStarted:
      "Buscando actividad bancaria en Gmail... Tus transacciones aparecerán a medida que se procesen.",
    gmailSyncSlow:
      "Gmail está tardando más de lo habitual. Actualiza la actividad para verificar transacciones importadas o intenta sincronizar de nuevo en unos momentos.",
    gmailSyncQueued: (count: number) =>
      `${count} nueva${count === 1 ? " transacci\u00f3n en cola" : "s transacciones en cola"}. Tu actividad se actualizará conforme se procesen.`,
    gmailSyncNone:
      "Gmail revisado. No se encontraron correos de transacciones bancarias compatibles.",
    gmailSyncUpToDate:
      "Gmail revisado. Tu actividad está al día o las transacciones en cola siguen procesándose.",
    gmailSyncFailed:
      "La sincronización de Gmail falló. Intenta de nuevo o cierra sesión y vuelve a conectar Google.",

    // Auth screen
    authTitlePart1: "Tu dinero.",
    authTitlePart2: "Tu propio espacio.",
    authSubtitle:
      "Inicia sesión para ver tus gastos en todas tus cuentas y reunir tus notificaciones bancarias.",
    signInGoogle: "Iniciar sesión con Google",
    authDisclosure:
      "Con tu permiso, FinStream lee las notificaciones bancarias de Gmail para importar transacciones. No puede enviar ni eliminar tus correos.",
    googleAdminConfig:
      "El inicio de sesión con Google debe ser configurado por el administrador.",
    authFootnote:
      "Tu actividad financiera solo está disponible en tu cuenta con sesión iniciada.",
    checkingSession: "Comprobando tu sesión…",
    sessionEnded: "Tu sesión terminó. Inicia sesión de nuevo para continuar.",
    sessionCheckFailed: "No pudimos comprobar tu sesión. Intenta de nuevo.",
    signOutFailed: "Error al cerrar sesión. Intenta de nuevo.",
    googleAuthError: "El inicio de sesión con Google no se completó. Intenta de nuevo.",
  },
};

export type TranslationKeys = typeof translations.en;

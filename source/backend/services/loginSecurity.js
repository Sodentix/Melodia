// Standardwerte für Login-Limits und Sperrdauer
const DEFAULT_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000); // 15 Minuten Fenster
const DEFAULT_MAX_ATTEMPTS = Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 5);        // max. 5 Fehlversuche
const DEFAULT_BLOCK_DURATION_MS = Number(process.env.LOGIN_BLOCK_DURATION_MS || DEFAULT_WINDOW_MS); // Sperrdauer = Fensterzeit

// Speicher (Map) für alle Login-Versuche, Schlüssel = E-Mail oder IP
const attemptsStore = new Map();

/**
 * Gibt die aktuelle Konfiguration zurück.
 * Wird verwendet, um auf die aktiven Rate-Limit-Einstellungen zuzugreifen.
 */
function getConfig() {
  return {
    windowMs: DEFAULT_WINDOW_MS,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    blockDurationMs: DEFAULT_BLOCK_DURATION_MS,
  };
}

/**
 * Gibt den Eintrag für einen Benutzer (identifier) zurück.
 * Wenn keiner existiert, wird ein neuer mit Standardwerten erstellt.
 */
function getEntry(identifier) {
  if (!attemptsStore.has(identifier)) {
    attemptsStore.set(identifier, { attempts: 0, expiresAt: 0, blockedUntil: 0 });
  }
  return attemptsStore.get(identifier);
}

/**
 * Prüft, ob der Benutzer momentan blockiert ist.
 * - Wenn 'blockedUntil' noch in der Zukunft liegt → Benutzer ist blockiert.
 * - Wenn Sperre oder Fenster abgelaufen sind → Eintrag wird gelöscht.
 */
function isBlocked(identifier) {
  const now = Date.now();
  const entry = attemptsStore.get(identifier);
  if (!entry) return false;

  console.log(attemptsStore);

  // Noch blockiert
  if (entry.blockedUntil && entry.blockedUntil > now) {
    return true;
  }

  // Sperre abgelaufen → Eintrag löschen
  if (entry.blockedUntil && entry.blockedUntil <= now) {
    attemptsStore.delete(identifier);
    return false;
  }

  // Zeitfenster abgelaufen → Eintrag löschen
  if (entry.expiresAt && entry.expiresAt <= now) {
    attemptsStore.delete(identifier);
  }

  return false;
}

/**
 * Wird bei jedem fehlgeschlagenen Login aufgerufen.
 * - Erhöht die Anzahl der Fehlversuche.
 * - Setzt Ablaufzeiten neu.
 * - Sperrt Benutzer, wenn max. Versuche erreicht.
 */
function recordFailedAttempt(identifier) {
  const now = Date.now();
  const { windowMs, maxAttempts, blockDurationMs } = getConfig();
  const entry = getEntry(identifier);

  // Neues Zeitfenster starten, wenn altes abgelaufen ist
  if (entry.expiresAt <= now) {
    entry.attempts = 0;
  }

  // Fehlversuch erhöhen
  entry.attempts += 1;
  entry.expiresAt = now + windowMs;

  // Falls max. Versuche erreicht → Sperre aktivieren
  if (entry.attempts >= maxAttempts) {
    entry.blockedUntil = now + blockDurationMs;
    entry.attempts = 0;
  }

  // Aktualisierten Eintrag speichern
  attemptsStore.set(identifier, entry);

  // Gibt zurück, ob Benutzer jetzt gesperrt ist
  return entry.blockedUntil && entry.blockedUntil > now;
}

/**
 * Setzt alle Fehlversuche für einen Benutzer zurück.
 * Wird z. B. bei erfolgreichem Login aufgerufen.
 */
function resetAttempts(identifier) {
  attemptsStore.delete(identifier);
}

/**
 * Gibt zurück, wann eine Sperre endet.
 * - Falls keine Sperre → null.
 * - Falls Sperre abgelaufen → Eintrag löschen und null zurückgeben.
 */
function getBlockExpiresAt(identifier) {
  const entry = attemptsStore.get(identifier);
  if (!entry || !entry.blockedUntil) return null;
  if (entry.blockedUntil <= Date.now()) {
    attemptsStore.delete(identifier);
    return null;
  }
  return entry.blockedUntil;
}

/**
 * Exportiert alle Funktionen, damit sie im Backend genutzt werden können.
 * '__testing.resetAll' wird nur für Unit-Tests verwendet.
 */
module.exports = {
  isBlocked,
  recordFailedAttempt,
  resetAttempts,
  getBlockExpiresAt,
  __testing: {
    resetAll: () => attemptsStore.clear(),
  },
};

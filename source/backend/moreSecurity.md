# 🛡️ Web-App Sicherheitscheckliste (Frontend + Backend)

Eine umfassende Übersicht über essentielle Sicherheitsmaßnahmen für Webanwendungen mit **Vue.js (Frontend)** und **Express.js (Backend)**.

---

## 🔒 1. Transport- & Netzwerk-Sicherheit

* **HTTPS erzwingen** – TLS 1.3 verwenden und HSTS aktivieren.
* **API Rate Limiting** – Anfragen pro IP / Token / Minute begrenzen (z. B. `express-rate-limit`).
* **CORS-Regeln einschränken** – Nur notwendige Origins, Header und Methoden erlauben.
* **DDoS-Schutz** – Reverse-Proxy oder CDN wie Cloudflare einsetzen.

---

## 🔐 2. Authentifizierung & Autorisierung

* **Sichere Authentifizierung** – Nur über Sessions oder signierte JWTs.
* **Rollenbasierte Autorisierung** – Serverseitige Prüfung für jeden Endpoint.
* **Brute-Force-Schutz** – Nach mehreren Fehlversuchen temporär sperren.
* **Session-Sicherheit** – Cookies mit `HttpOnly`, `Secure`, `SameSite`, Timeout.

---

## 🧱 3. Eingabe- & Ausgabesicherheit

* **Input-Validierung** – Backendseitig mit `joi`, `zod` oder `express-validator` prüfen.
* **XSS-Schutz** – Alle Ausgaben im Frontend escapen.
* **SQL/NoSQL-Injection verhindern** – Parametrisierte Queries oder ORM verwenden.
* **Content Security Policy (CSP)** – Nur eigene Skripte und Ressourcen zulassen.

---

## 🧰 4. Header & Browser-Schutz

* **HTTP-Security-Header aktivieren** – z. B. mit `helmet`:

  * `X-Frame-Options`
  * `X-Content-Type-Options`
  * `Referrer-Policy`
  * `Permissions-Policy`
* **CSRF-Schutz** – Bei Cookie-Login: CSRF-Token oder `SameSite=Lax`.

---

## 🗂️ 5. Datei- & Datenverwaltung

* **Upload-Filter** – MIME-Type, Größenlimit, Virenscan.
* **Keine direkten Zugriffe** – Uploads außerhalb des Webroots speichern.
* **Backups & Recovery** – Regelmäßige, verschlüsselte Backups mit Wiederherstellungstest.

---

## 🧩 6. Logging, Monitoring & Fehlerbehandlung

* **Logging** – Sicherheitsrelevante Aktionen erfassen, aber keine Passwörter.
* **Monitoring** – Verdächtige Aktivitäten automatisch erkennen.
* **Error-Handling** – Keine Stacktraces oder Interna an den Client senden.

---

## ⚙️ 7. Entwicklungs- & Deployment-Sicherheit

* **Trennung von Umgebungen** – Dev, Stage und Prod strikt trennen.
* **API-Keys geheim halten** – Niemals im Frontend oder Git speichern.
* **Regelmäßige Updates** – npm-Pakete, Node und Server-Software aktuell halten.
* **CI/CD-Härtung** – Keine Secrets im Build, minimale Berechtigungen.

---

## 🧾 8. Erweiterte Maßnahmen

* **Caching absichern** – Keine privaten Antworten öffentlich cachen lassen.
* **Rate-Limit pro Benutzer** – Nicht nur IP-basiert, sondern auch Token-basiert.
* **Security Scans** – OWASP ZAP oder npm audit regelmäßig ausführen.
* **Security-Header prüfen** – z. B. mit `securityheaders.com`.

---

> ✅ **Tipp:** Führe vor jedem Release einen **OWASP ASVS-Check** oder **ZAP Scan** durch, um alle relevanten Schwachstellen frühzeitig zu erkennen.

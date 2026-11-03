# Memoria del proyecto — CYCS Chat

> Contexto persistente entre sesiones de OpenCode. **Solo lo vigente y accionable.**
> Al cerrar una tarea se **actualiza** este archivo; **no** se anexa un diario.
> Histórico detallado (si hiciera falta) va a `config_session/anterior_memory.md`;
> el código exacto de cada cambio queda en git (`git show <hash>`).

## Estado actual — 02/11/2026

- **Fase: planificación cerrada. Implementación NO iniciada.** El código está intacto desde `e5768b5`.
- **Plan vigente:** `docs/planes/plan-endurecimiento-chat.md` — 8 fases, 23 tareas
  (18 obligatorias + 5 opcionales). Commit del plan: **`d1e55a6`**.
- **Bloqueado por:** autorización explícita del usuario + respuestas a **D1–D6** (ver «Plan vigente»).
- **Repo:** `main` limpio. HEAD = commit de esta memoria (ver `git log -1`) → `d1e55a6` (plan) → `e5768b5` (merge PR #1).
- **Sin tests ni linter** todavía; el plan los introduce en T2.1 (`node --test`).
- **Servicios:** los inicia el usuario (`rules.md` §2). En esta sesión no se ejecutó ni se tocó nada.

## Qué es

Aplicación de chat con IA. Frontend estático (HTML/CSS/JS) + backend Node/Express **local** y una
**función serverless de Netlify** para producción. Ambos llaman a un endpoint compatible con OpenAI
(`ApiNex`) usando el SDK `openai`. No hay base de datos.

- Nombre: `apinex-deepseek-chat` (UI: «CYCS Chat»).
- Modelo por defecto: `free/deepseek-v4.1-flash` («DeepSeek V4.1 Flash 1017»).
- El historial de conversación vive **solo en el navegador** (variable en memoria, se pierde al recargar).

## Stack y archivos

| Archivo | Rol |
|---|---|
| `server.js` | Express 5 **solo para desarrollo local**: sirve `public/` y expone `/api/health` y `/api/chat`. |
| `netlify/functions/chat.mts` | Función de producción (`POST /api/chat`), Functions v2. **Duplica** la lógica de `server.js`. |
| `netlify/functions/health.mts` | Función de producción (`GET /api/health`). |
| `netlify.toml` | `publish = "public"`, directorio de funciones y configuración de `netlify dev`. |
| `public/index.html` | Interfaz: sidebar, bienvenida, sugerencias, composer, selector de modelo (11 opciones). |
| `public/script.js` | Estado de la conversación, envío a `/api/chat`, typing, copiar, reiniciar, tema. |
| `public/styles.css` | Diseño responsive (escritorio/móvil), tokens de color claro/oscuro. |
| `package.json` | ESM (`"type": "module"`), scripts `dev` / `start`. **Sin** `engines` ni `packageManager`. |
| `pnpm-lock.yaml` | Lock de dependencias (gestor: **pnpm**). |
| `.env` | Credenciales locales. Ignorado por git y **nunca** estuvo en el historial (verificado). |
| `opencode.json` | Carga `config_session/rules.md` y `config_session/memory.md` como instrucciones. |
| `docs/planes/plan-endurecimiento-chat.md` | Plan vigente (fases, tareas, riesgos, verificaciones). |
| `test/`, `tools/`, `lib/` | **Aún no existen**; los crea el plan (T2.1, T4.1). |

Dependencias: `dotenv`, `express@^5.1.0`, `openai@^5.12.2`, `@netlify/functions@^6.0.3`.
Entorno observado: **Node v22.23.1 · pnpm 12.16.1**.

## Configuración (`.env`)

```env
APINEX_API_KEY=...
APINEX_BASE_URL=...
PORT=3000            # opcional, 3000 por defecto
```

Sin `APINEX_API_KEY` o `APINEX_BASE_URL`, `/api/chat` responde 500 con un mensaje claro y
`/api/health` devuelve `configured: false`. La clave nunca se envía al navegador.

## Cómo ejecutar

```bash
pnpm install
pnpm dev        # node --watch server.js  → http://localhost:3000
pnpm start      # node server.js
netlify dev     # emula Netlify (funciones + proxy) → http://localhost:8889
```

En `netlify dev` las rutas de función tienen prioridad sobre el proxy a `pnpm dev`: **`/api/chat`
prueba la función, no Express**.

## Contrato de la API (estado real, 02/11/2026)

- `GET /api/health` → `{ ok: true, configured: boolean }`.
- `POST /api/chat` → body `{ messages: [{ role, content }], model? }`.
  - **`model` se ignora**: `server.js:70` y `chat.mts:58` usan el literal `"free/deepseek-v4.1-flash"`,
    aunque el frontend lo envía (`public/script.js:219-222`).
  - Filtra solo `user`/`assistant`, descarta vacíos, conserva los **últimos 20** mensajes y trunca
    cada contenido a **12 000** caracteres (`server.js:59-63`, `chat.mts:47-51`).
  - Antepone un `system` en español y devuelve `{ answer }` o `{ error }`.
  - **Sin `max_tokens`**, **sin autenticación**, **sin rate limit**.
- Hay **dos implementaciones equivalentes** del endpoint (Express y función Netlify): todo cambio de
  lógica debe hacerse en ambas hasta que el plan (Fase 2) las unifique en `lib/chat-core.mjs`.

## Hallazgos confirmados (evidencia verificada el 02/11/2026)

Ordenados por severidad. **No son tareas**: se ejecutan solo si el usuario autoriza (plan vigente).

1. **Endpoint abierto** — sin auth ni rate limit (`server.js:32`, `chat.mts:8`). Riesgo económico directo
   sobre la cuota de ApiNex. → Fase 7.
2. **Selector de modelo muerto** — `script.js:219-222` envía `model`; backend lo ignora
   (`server.js:70`, `chat.mts:58`). UI con 11 opciones en `index.html:202-222`.
   `free/jev-1.13` corresponde a un modelo **System One** (no chat) y fallaría por chat completions;
   `free/glm-5.3-flashx` y `free/minimax-m3.1-flash` son IDs **no verificados**. → Fase 4.
3. **Lógica duplicada** — validación, prompt y límites copiados en `server.js:41-79` y `chat.mts:29-67`.
   → Fase 2.
4. **Errores inconsistentes** — Express filtra el texto del proveedor al cliente (`server.js:93-100`);
   la función responde 502 genérico y **no registra nada** (`chat.mts:78-80`) → imposible depurar en
   producción. → Fase 2 (T2.4).
5. **Sin techo de costo** — no hay `max_tokens`; 20 × 12 000 = hasta ~240 000 caracteres por petición.
   → Fase 3.
6. **Entorno no reproducible** — `package.json` sin `engines` ni `packageManager`; Netlify puede usar
   otro Node/pnpm que el local. → Fase 1.
7. **`@netlify/functions` en `dependencies`** (`package.json:11`) — solo se usa como tipo
   (`chat.mts:2`). → T1.3 (opcional).
8. **Body sin límite en la función** — Express limita a 1 MB (`server.js:10`); `chat.mts:25` lee
   `req.json()` sin tope. → T3.3.
9. **`express.static("public")` relativo al CWD** (`server.js:11`) — falla si se arranca desde otra carpeta.
10. **Sin timeout de cliente** — `script.js` no usa `AbortController`; el servidor puede tardar hasta 60 s.
    → T5.1.
11. **El cliente es la fuente de verdad del historial** — el backend acepta cualquier turno
    `user`/`assistant` enviado (`server.js:51-58`). No es escalada, pero permite inyectar turnos falsos.
12. **XSS: correcto** — `script.js:121` usa `textContent`. **No tocar.**

## Plan vigente (resumen ejecutivo)

Documento completo: `docs/planes/plan-endurecimiento-chat.md` (commit `d1e55a6`).

| Fase | Tareas | Esfuerzo | Punto del análisis |
|---|---|---|---|
| 0 — Línea base | T0.1 | S | (preparación) |
| 1 — Entorno reproducible | T1.1, T1.2, T1.3* | S | 5 |
| 2 — Núcleo compartido | T2.1 → T2.4 | M | 3 |
| 3 — Límites contexto/costo | T3.1 → T3.3 | S | 6 |
| 4 — Selector de modelo | T4.1 → T4.3 | M | 2 |
| 5 — Timeout/latencia | T5.1 | S | 4a |
| 6 — Streaming* | T6.1 → T6.3 | L | 4b |
| 7 — Protección del endpoint | T7.1 → T7.5* | M | 1 |

`*` = opcional. Orden recomendado: `0 → 1 → 2 → 3 → 4 → 5 → 7 → [6 si D2 = sí]`.
La Fase 7 es independiente y **puede ejecutarse primero** si se quiere reducir el riesgo económico ya.
La Fase 2 va antes de 3 y 4 para implementar límites y selector una sola vez.

### Decisiones pendientes (bloquean la implementación)

| ID | Decisión | Propuesta por defecto |
|---|---|---|
| **D1** | Límites de contexto | 12 mensajes · 4.000 chars por mensaje · `max_tokens` 1.024 |
| **D2** | ¿Streaming (Fase 6)? | **No** por ahora; reevaluar con las mediciones de T2.4 |
| **D3** | Rate limit | 10 peticiones / 60 s por IP + dominio → 429 |
| **D4** | Modelos permitidos | Los que valide T4.1 (excluyendo Jev, que no es chat) |
| **D5** | ¿Turnstile/captcha? | No |
| **D6** | ¿Región `gru` (São Paulo)? | No: requiere plan Pro/Enterprise |

### Definition of Done (por tarea)

1. Checkpoint `checkpoint: tarea <fase>.<n> — <descripción>` **antes** de tocar código.
2. Cambio acotado a los archivos declarados en el plan.
3. Verificación automatizada de la IA (`node --check`, `node --test`, bundle esbuild) reportada.
4. Verificación visual del usuario ✅.
5. `memory.md` actualizado (tarea, commit, estado).
6. Commit final de la tarea; el `push` lo hace el usuario.

## Hechos técnicos verificados (Netlify, 02/11/2026)

Fuente: `docs.netlify.com/build/functions/configuration.md` y `/api.md`.

- **Límite de ejecución síncrona: 60 s. No configurable.** No existe `config.timeout`.
- Streaming: 60 s y 20 MB de respuesta; payload buffered: 6 MB.
- **`config.rateLimit` existe** (`windowLimit`, `windowSize`, `aggregateBy`, `action`, `to`): la
  protección del endpoint no necesita servicio externo.
- El runtime de funciones usa la versión de Node del **build**; si no es válida, cae a **Node 24**.
- `[functions] node_bundler = "esbuild"` es configurable en `netlify.toml` (necesario para que el
  bundle resuelva `lib/`).
- `region` (p. ej. `gru`) requiere plan Pro/Enterprise.
- **Corrección al análisis del 02/11:** dije «10 s por defecto / 26 s configurable»; es **incorrecto**.
  No repetir ese dato.

## Reglas de trabajo

Fuente: `config_session/rules.md`. Resumen operativo:

1. **No modificar código sin autorización explícita** del usuario.
2. **El usuario** inicia/detiene servicios; la IA no.
3. **La IA** ejecuta pruebas automatizadas; **el usuario** hace la verificación visual.
4. **La IA** hace `git commit`; **el usuario** hace `git push`.
5. Antes de cada tarea: commit `checkpoint: tarea <n> — <descripción>`.
6. Tareas pequeñas y verificables por separado; prohibido el cambio masivo.
7. Planes en `docs/planes/plan-<tema>.md` por fases y tareas con nivel de riesgo.
8. Nunca afirmar una causa raíz sin evidencia verificada (`rules.md` §10).
9. Todo SQL (si algún día hay BD) se entrega como archivo `.sql`, no como texto suelto.
10. `memory.md` se actualiza con cada tarea finalizada.

## Cómo continuar en una sesión nueva

1. Leer `config_session/rules.md`, este archivo y `docs/planes/plan-endurecimiento-chat.md`.
2. Verificar el estado real: `git status`, `git log -5`, `node -v`, `pnpm -v`.
3. **Pedir autorización** de implementación y las respuestas a **D1–D6** (o «usa las propuestas»).
4. Empezar por **T0.1** con `checkpoint: tarea 0.1 — línea base`.
5. Respetar el ciclo: checkpoint → implementar → pruebas de la IA → verificación visual del usuario →
   commit final → actualizar esta memoria.
6. **No iniciar servicios** (los arranca el usuario) y **no hacer `push`**.

## Protocolo de memoria

- Este archivo es la **única** fuente de contexto entre sesiones.
- Al terminar cada tarea: actualizar «Estado actual», mover lo cerrado a una línea de resumen y
  registrar el commit. Si algo deja de ser vigente, se elimina (no se acumula).
- Los pendientes reales van en «Pendientes abiertos»; la deuda aceptada no se disfraza de tarea.
- Ante la pregunta «¿qué hay pendiente?»: verificar `git status`, el estado real del repo y esta
  sección antes de responder.

## Pendientes abiertos

- **Autorización de implementación + respuestas a D1–D6** (bloquea todo el plan).
- **`git push`** de `d1e55a6` (plan) y del commit de esta memoria (lo hace el usuario).
- Nota de despliegue: `publish = "public"`, así que `docs/` y `config_session/` **no se publican** en
  Netlify; el push solo actualiza el repo y redepliega la web.

## Registro de sesiones

### 02/11/2026 — Análisis de solo lectura + plan de endurecimiento

- Análisis estático completo del proyecto (sin tocar código, sin iniciar servicios, sin instalar nada):
  backend Express, función Netlify, frontend, `netlify.toml`, `package.json`, `.env` (solo claves) y git.
- Se verificó la documentación oficial de Netlify y se **corrigió** el dato del timeout (60 s fijos, no
  configurable) y se confirmó `config.rateLimit`.
- Se redactó `docs/planes/plan-endurecimiento-chat.md` (8 fases, 23 tareas, riesgos y verificaciones).
- Commit del plan: **`d1e55a6`**. Commit de esta memoria: ver `git log -1`.
- **Sin cambios de código.** El usuario hará `git push` y Netlify redeployará.

### 30/10/2026 — Botón de tema claro/oscuro

- Checkpoint previo `9d58e1a`. Se tokenizaron los colores de `styles.css` y se añadió
  `:root[data-theme="dark"]`; botón `#theme-toggle`, script anti-parpadeo y persistencia en
  `localStorage` + `prefers-color-scheme`. `node --check` OK y verificación visual del usuario ✅.

### 30/10/2026 — Depuración inicial de la memoria

- Se reemplazó por completo `config_session/memory.md` (contenía ~831 líneas de otro proyecto).
- Sin cambios de código. Commit de checkpoint `9d58e1a`.

# Plan — Endurecimiento y calidad de CYCS Chat

> **Estado:** borrador — **pendiente de autorización**
> **Fecha:** 02/11/2026
> **Base:** análisis de solo lectura del 02/11/2026 (sin cambios de código)
> **Convención:** `docs/planes/plan-<tema>.md` (rules.md §9)
> **Ejecución:** una tarea a la vez, con checkpoint propio y prueba intermedia (rules.md §4 y §6)

---

## 1. Objetivo y alcance

Resolver los 6 puntos del análisis (§6), en este orden de riesgo:

| # | Punto del análisis | Fase |
|---|---|---|
| 1 | Proteger `/api/chat` (auth/rate limit) | Fase 7 |
| 2 | Cablear el selector de modelo con allowlist | Fase 4 |
| 3 | Extraer núcleo compartido (eliminar duplicación) | Fase 2 |
| 4 | Timeout / latencia (y streaming opcional) | Fases 5 y 6 |
| 5 | `engines` + `packageManager` | Fase 1 |
| 6 | Tope de contexto + `max_tokens` | Fase 3 |

**Fuera de alcance:** suite de tests completa, base de datos, autenticación de usuarios, rediseño de UI, migración de gestor de paquetes.

---

## 2. Corrección al análisis previo (transparencia)

En el análisis afirmé que las funciones de Netlify tenían "~10 s por defecto y hasta 26 s configurables". **Eso es incorrecto** según la documentación vigente:

- **Límite de ejecución síncrona: 60 s. No configurable.** No existe `config.timeout`.
- Streaming: 60 s y 20 MB de respuesta.
- `config.rateLimit` **sí existe** (`windowLimit`, `windowSize`, `aggregateBy`, `action`, `to`).
- El runtime de funciones usa la versión de Node del **build**; si no es válida, cae a **Node 24**.

Consecuencia para el plan: la Fase 5 deja de ser "configurar timeout" y pasa a ser **timeout de cliente + medición**; la Fase 7 puede resolverse con la plataforma, sin servicio externo.

---

## 3. Trazabilidad: punto → tarea

| Punto | Tareas |
|---|---|
| 5. Entorno reproducible | T1.1, T1.2, T1.3 (opc.) |
| 3. Núcleo compartido | T2.1, T2.2, T2.3, T2.4 |
| 6. Límites de contexto/costo | T3.1, T3.2, T3.3 |
| 2. Selector de modelo | T4.1, T4.2, T4.3 |
| 4a. Timeout/latencia | T5.1 (+ logs de T2.4) |
| 4b. Streaming (opcional) | T6.1, T6.2, T6.3 |
| 1. Protección del endpoint | T7.1, T7.2, T7.3, T7.4, T7.5 (opc.) |

---

## 4. Decisiones que necesito de ti (bloquean fases)

| ID | Decisión | Propuesta por defecto |
|---|---|---|
| **D1** | Límites exactos de contexto | 12 mensajes · 4.000 caracteres por mensaje · `max_tokens` 1.024 |
| **D2** | ¿Streaming (Fase 6)? | **No** por ahora; reevaluar con las mediciones de T2.4 |
| **D3** | Rate limit | 10 peticiones / 60 s por IP + dominio, respuesta 429 |
| **D4** | Modelos permitidos | Los que valide T4.1 (excluyendo Jev, que no es chat) |
| **D5** | ¿Turnstile/captcha? | No (innecesario si T7.1 + T7.4 están activos) |
| **D6** | ¿Región `gru` (São Paulo) para latencia? | No por ahora: requiere plan Pro/Enterprise |

---

## 5. Fases y tareas

### Fase 0 — Línea base (sin código) · esfuerzo S

#### T0.1 — Registrar el estado de partida
- **Objetivo:** tener un punto de comparación verificable antes de tocar nada.
- **Archivos:** ninguno (solo lectura). Registro en este plan.
- **Cambio:** anotar `git log -1`, `node -v`, `pnpm -v`, resultado de `node --check server.js` y `node --check public/script.js`, y la latencia de 3 respuestas reales (las mide el usuario).
- **Riesgo:** Bajo — no modifica código.
- **Verificación:** IA ejecuta los checks y los anota; usuario aporta las 3 latencias.
- **Rollback:** no aplica.

---

### Fase 1 — Entorno reproducible (punto 5) · esfuerzo S

#### T1.1 — Alinear la versión de Node
- **Objetivo:** que local y Netlify usen la misma versión de Node.
- **Archivos:** `.nvmrc` (nuevo), `package.json`.
- **Cambio:** `.nvmrc` con `22`; `"engines": { "node": ">=20 <23" }`.
- **Riesgo:** **Bajo** — no toca lógica. Mitiga el fallback a Node 24 y diferencias de runtime.
- **Verificación:** IA: `node -v` coincide con `.nvmrc`. Usuario: deploy preview compila con Node 22.
- **Rollback:** revert del commit.

#### T1.2 — Fijar la versión de pnpm
- **Objetivo:** que Netlify no elija una versión de pnpm distinta a la del lockfile.
- **Archivos:** `package.json`.
- **Cambio:** `"packageManager": "pnpm@12.16.1"`.
- **Riesgo:** **Medio** — si Netlify no soporta esa versión exacta, el build falla. Mitigación: verificar en deploy preview antes de mergear; el rollback es una línea.
- **Verificación:** IA: `pnpm install --frozen-lockfile` local OK. Usuario: deploy preview OK.
- **Rollback:** revert.

#### T1.3 — `@netlify/functions` a devDependencies *(opcional)*
- **Objetivo:** coherencia semántica (solo se usa como tipo).
- **Archivos:** `package.json`.
- **Cambio:** mover el paquete a `devDependencies`.
- **Riesgo:** Bajo — Netlify instala devDependencies en el build.
- **Verificación:** deploy preview OK.
- **Rollback:** revert.

---

### Fase 2 — Núcleo compartido (punto 3) · esfuerzo M

#### T2.1 — Crear `lib/chat-core.mjs` + pruebas unitarias
- **Objetivo:** una sola implementación de validación, normalización, prompt y modelo, **sin red ni variables de entorno**.
- **Archivos:** `lib/chat-core.mjs` (nuevo), `test/chat-core.test.mjs` (nuevo), `package.json` (script `"test": "node --test"`).
- **Cambio:** exportar funciones puras: `sanitizeMessages`, `buildRequest`, `SYSTEM_PROMPT`, `DEFAULT_MODEL`, límites. Pruebas: roles inválidos, vacíos, truncado, recorte de historial, forma del request.
- **Riesgo:** **Bajo** — código nuevo, todavía no lo usa nadie.
- **Verificación:** IA: `node --test` verde y `node --check lib/chat-core.mjs`.
- **Rollback:** revert (nada depende aún del archivo).

#### T2.2 — `server.js` usa el núcleo
- **Objetivo:** eliminar la lógica duplicada del backend local **sin cambiar comportamiento**.
- **Archivos:** `server.js`.
- **Cambio:** reemplazar validación/slicing/prompt por llamadas al núcleo. Mismos status (400/500/502) y mismos mensajes.
- **Riesgo:** **Medio** — refactor del camino crítico. Mitigación: T2.1 ya probado + comparación de respuestas antes/después.
- **Verificación:** IA: `node --test` + `node --check server.js`. Usuario: chat local responde igual; errores 400/500 iguales.
- **Rollback:** revert.

#### T2.3 — `chat.mts` usa el núcleo
- **Objetivo:** eliminar la duplicación en la función de Netlify.
- **Archivos:** `netlify/functions/chat.mts`, `netlify.toml`.
- **Cambio:** importar el núcleo; añadir `[functions] node_bundler = "esbuild"` para que el bundle resuelva `lib/`.
- **Riesgo:** **Medio** — el bundler debe incluir `lib/` en el artefacto. Mitigación: verificar el bundle y el deploy preview.
- **Verificación:** IA: bundle con esbuild sin errores. Usuario: `netlify dev` responde y deploy preview OK.
- **Rollback:** revert.

#### T2.4 — Errores y logging unificados
- **Objetivo:** dejar de filtrar mensajes del proveedor y poder depurar en producción.
- **Archivos:** `lib/chat-core.mjs`, `server.js`, `chat.mts`.
- **Cambio:** `toPublicError(error)` → `{ status, message }` con mensaje genérico; log en servidor con `requestId` (contexto de Netlify) o timestamp, modelo, duración y status. Nunca loguear contenido de mensajes ni la API key.
- **Riesgo:** **Medio** — cambian los mensajes visibles; el front ya consume `data.error`, así que el contrato se mantiene.
- **Verificación:** IA: tests de mapeo de errores. Usuario: forzar un error (key inválida en entorno de prueba) y ver mensaje genérico + log.
- **Rollback:** revert.

---

### Fase 3 — Límites de contexto y costo (punto 6) · esfuerzo S

#### T3.1 — `max_tokens`
- **Objetivo:** poner techo a la salida del modelo.
- **Archivos:** `lib/chat-core.mjs`.
- **Cambio:** constante `MAX_OUTPUT_TOKENS = 1024` incluida en el request.
- **Riesgo:** Bajo — respuestas más cortas; verificable.
- **Verificación:** IA: test de que el request incluye `max_tokens`. Usuario: respuesta normal.
- **Rollback:** revert.

#### T3.2 — Límites de historial
- **Objetivo:** bajar el costo por petición y evitar 400 por contexto.
- **Archivos:** `lib/chat-core.mjs`.
- **Cambio:** de 20 mensajes / 12.000 chars a **12 / 4.000** (D1).
- **Riesgo:** **Bajo-Medio** — cambia el comportamiento en conversaciones largas.
- **Verificación:** IA: tests con 30 mensajes → 12; contenido > 4.000 → truncado. Usuario: conversación larga sigue funcionando.
- **Rollback:** revert (constantes).

#### T3.3 — Límite de tamaño de petición en la función
- **Objetivo:** evitar que un body gigante consuma memoria/cuota.
- **Archivos:** `netlify/functions/chat.mts`, `lib/chat-core.mjs`.
- **Cambio:** rechazar con 413 si el body supera 256 KB (Express ya limita a 1 MB).
- **Riesgo:** Bajo — no afecta el uso normal.
- **Verificación:** IA: test unitario del helper. Usuario: envío normal OK.
- **Rollback:** revert.

---

### Fase 4 — Selector de modelo (punto 2) · esfuerzo M

#### T4.1 — Verificar el catálogo real de ApiNex
- **Objetivo:** saber qué IDs existen **antes** de habilitar el selector.
- **Archivos:** `tools/verificar-modelos.mjs` (temporal, no se publica).
- **Cambio:** script que consulta `GET {APINEX_BASE_URL}/models` y lista IDs; si el endpoint no existe, prueba mínima por modelo. **Lo ejecuta el usuario** (usa su key y consume cuota mínima).
- **Riesgo:** Bajo — no toca la app.
- **Verificación:** salida del script → tabla de IDs válidos (se anexa a este plan).
- **Rollback:** borrar el script.

#### T4.2 — Allowlist y respeto de `model`
- **Objetivo:** que el modelo elegido en la UI se aplique de verdad, sin permitir IDs arbitrarios.
- **Archivos:** `lib/chat-core.mjs`, `server.js`, `chat.mts`.
- **Cambio:** `ALLOWED_MODELS` (id → etiqueta); si `model` falta → `DEFAULT_MODEL`; si no está en la lista → 400 con la lista válida.
- **Riesgo:** **Medio** — cambia el contrato de la API y depende de T4.1.
- **Verificación:** IA: tests (válido, inválido, ausente). Usuario: cambiar modelo en la UI y comprobar que la respuesta proviene del modelo elegido.
- **Rollback:** revert.

#### T4.3 — Limpiar el `<select>` del frontend
- **Objetivo:** que la UI no ofrezca modelos inexistentes.
- **Archivos:** `public/index.html`.
- **Cambio:** dejar solo IDs validados; **quitar `free/jev-1.13`** (System One, no es chat) y cualquier ID no confirmado en T4.1.
- **Riesgo:** Bajo.
- **Verificación:** IA: grep de IDs de la UI contra `ALLOWED_MODELS`. Usuario: cada opción responde.
- **Rollback:** revert.

---

### Fase 5 — Timeout y latencia (punto 4a) · esfuerzo S

#### T5.1 — Timeout de cliente
- **Objetivo:** que la UI no espere indefinidamente (el servidor tiene 60 s fijos).
- **Archivos:** `public/script.js`.
- **Cambio:** `AbortController` con 45 s; mensaje claro ("La respuesta tardó demasiado") y opción de reintentar.
- **Riesgo:** Bajo.
- **Verificación:** IA: `node --check`. Usuario: simular lentitud y ver el mensaje.
- **Rollback:** revert.

---

### Fase 6 — Streaming (punto 4b) · **OPCIONAL** · esfuerzo L

> No ejecutar sin decisión explícita (D2). Cambia el contrato entre los tres archivos.

#### T6.1 — SSE en el núcleo y en Express
- **Archivos:** `lib/chat-core.mjs`, `server.js`. **Riesgo:** Medio-Alto.
- **Verificación:** IA: tests del parser de chunks. Usuario: `curl` ve eventos.

#### T6.2 — Render incremental en el frontend
- **Archivos:** `public/script.js`, `public/styles.css`. **Riesgo:** Medio.
- **Verificación:** Usuario: los tokens aparecen progresivamente; el typing indicator desaparece.

#### T6.3 — Streaming en la función de Netlify
- **Archivos:** `netlify/functions/chat.mts`. **Riesgo:** Medio.
- **Verificación:** deploy preview; límite 60 s / 20 MB.

---

### Fase 7 — Protección del endpoint (punto 1) · esfuerzo M

> **Fase independiente:** puede ejecutarse **primero** si quieres reducir el riesgo económico de inmediato.

#### T7.1 — Rate limit nativo en Netlify
- **Objetivo:** frenar abuso sin servicio externo.
- **Archivos:** `netlify/functions/chat.mts`.
- **Cambio:** `config.rateLimit = { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"], action: "rate_limit" }` (D3).
- **Riesgo:** Bajo — configuración declarativa de la plataforma.
- **Verificación:** Usuario: 11 peticiones rápidas → 429; uso normal intacto.
- **Rollback:** revert (una línea).

#### T7.2 — Throttle equivalente en Express
- **Objetivo:** paridad de comportamiento en local.
- **Archivos:** `server.js`.
- **Cambio:** contador en memoria por IP (ventana deslizante). Documentar que en serverless no se usa porque T7.1 lo cubre.
- **Riesgo:** Bajo-Medio — riesgo de bloquear al propio usuario si se configura agresivo.
- **Verificación:** IA: test del limitador con reloj simulado. Usuario: 11 peticiones → 429.
- **Rollback:** revert.

#### T7.3 — Allowlist de `Origin`
- **Objetivo:** que solo tu sitio pueda llamar al endpoint desde un navegador.
- **Archivos:** `lib/chat-core.mjs`, `chat.mts`, `server.js`.
- **Cambio:** comparar `Origin`/`Host` contra dominios permitidos; sin `Origin` (curl) se permite, se documenta la limitación.
- **Riesgo:** Bajo.
- **Verificación:** IA: tests con/sin `Origin`. Usuario: el sitio sigue funcionando; un dominio ajeno recibe 403.
- **Rollback:** revert.

#### T7.4 — Límite de gasto en ApiNex *(operativo, sin código)*
- **Objetivo:** red de seguridad real del costo.
- **Acción del usuario:** revisar en el panel de ApiNex si existe límite de gasto/cuota mensual y activarlo.
- **Riesgo:** Bajo.
- **Verificación:** captura del límite activo.

#### T7.5 — Turnstile/captcha *(opcional, solo si D5 = sí)*
- **Riesgo:** Alto — requiere claves, integración en frontend y validación en backend.

---

## 6. Orden de ejecución recomendado

```
Fase 0 → Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 7 → [Fase 6 si D2 = sí]
```

- **Fase 2 antes que 3 y 4:** así los límites y el selector se implementan una sola vez.
- **Fase 7 puede ir primero:** es independiente y reduce el riesgo económico desde el día uno.
- **Fase 6 al final:** es la de mayor riesgo y la única que cambia el contrato entre los tres archivos.

---

## 7. Definition of Done (por tarea)

1. Checkpoint `checkpoint: tarea <fase>.<n> — <descripción>` creado **antes** de tocar código.
2. Cambio acotado a los archivos declarados.
3. Verificación automatizada por la IA (`node --check`, `node --test`, bundle con esbuild) reportada.
4. Verificación visual del usuario ✅.
5. `memory.md` actualizado con la tarea, el commit y el estado.
6. Commit final de la tarea (el `push` lo hace el usuario).

---

## 8. Riesgos y contingencias

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| T1.2 rompe el build de Netlify (pnpm no disponible) | Media | Alto | Deploy preview antes de mergear; rollback de una línea |
| Fase 2 cambia comportamiento sin querer | Media | Alto | Tests del núcleo + comparación de respuestas antes/después |
| El bundler no incluye `lib/` en la función | Baja | Alto | `node_bundler = "esbuild"` + verificación del bundle |
| T4.1 revela que varios IDs de la UI no existen | Alta | Medio | Se corrigen en T4.3 (es el objetivo) |
| Rate limit bloquea al usuario legítimo | Baja | Medio | Umbral 10/60 s + ventana documentada |

---

## 9. Registro (se completa durante la ejecución)

| Tarea | Checkpoint | Commit final | Resultado |
|---|---|---|---|
| — | — | — | pendiente de autorización |

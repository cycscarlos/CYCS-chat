# Memoria del proyecto — CYCS Chat

> Contexto persistente entre sesiones de OpenCode. **Solo lo vigente y accionable.**
> Al cerrar una tarea se **actualiza** este archivo; **no** se anexa un diario.
> Histórico detallado (si hiciera falta) va a `config_session/anterior_memory.md`;
> el código exacto de cada cambio queda en git (`git show <hash>`).
>
> **Nota de depuración (30/10/2026):** este archivo contenía ~831 líneas de un proyecto
> distinto (posadas / MySQL / alwaysdata) con rutas, commits y planes inexistentes aquí.
> Se reemplazó por completo para iniciar la memoria persistente de **CYCS Chat**.

## Estado actual — 30/10/2026

- **Proyecto nuevo.** Base: commit `0b3b770 first commit`; checkpoint `9d58e1a` (estado previo al
  botón de tema) en `main`.
- **HECHO (30/10): botón de tema claro/oscuro** (ver abajo). Implementado, con sintaxis verificada y
  **verificación visual del usuario ✅**. Commit final de la tarea incluido en el historial de `main`.
- **Sin tests ni lint** configurados todavía.
- **No verificado en ejecución** en esta sesión (los servicios los inicia el usuario, `rules.md` §2).

## Qué es

Aplicación **local** de chat con IA. Frontend estático (HTML/CSS/JS) + backend Node/Express que
llama a un endpoint compatible con OpenAI (`ApiNex`) usando el SDK `openai`. No hay base de datos.

- Nombre: `apinex-deepseek-chat` (UI: «CYCS Chat»).
- Modelo por defecto: `free/deepseek-v4.1-flash` («DeepSeek V4.1 Flash 1017»).
- El historial de conversación vive **solo en el navegador** (variable en memoria, se pierde al recargar).

## Stack y archivos

| Archivo | Rol |
|---|---|
| `server.js` | Express 5, sirve `public/` y expone `/api/health` y `/api/chat`. Llama a ApiNex. |
| `public/index.html` | Interfaz: sidebar, bienvenida, sugerencias, composer, selector de modelo. |
| `public/script.js` | Estado de la conversación, envío a `/api/chat`, typing, copiar, reiniciar. |
| `public/styles.css` | Diseño responsive (escritorio/móvil). |
| `public/favicon.webp` | Icono. |
| `package.json` | ESM (`"type": "module"`), scripts `dev` / `start`. |
| `pnpm-lock.yaml` | Lock de dependencias (gestor: **pnpm**). |
| `.env` | Credenciales locales (ignorado por git). |
| `opencode.json` | Carga `config_session/rules.md` y `config_session/memory.md` como instrucciones. |

Dependencias: `dotenv`, `express@^5.1.0`, `openai@^5.12.2`. Node observado: v22.23.1 · pnpm 12.16.1.

## Configuración (`.env`)

Variables requeridas por el servidor:

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
pnpm dev      # node --watch server.js
pnpm start    # node server.js
```

Abrir `http://localhost:3000`.

## Contrato de la API

- `GET /api/health` → `{ ok: true, configured: boolean }`.
- `POST /api/chat` → body `{ messages: [{ role, content }], model? }`.
  - Filtra solo `user`/`assistant`, descarta vacíos, conserva los **últimos 20** mensajes y
    trunca cada contenido a **12 000** caracteres.
  - Antepone un `system` en español.
  - Devuelve `{ answer }` o `{ error }` con el status correspondiente.

## HECHO (30/10/2026) — botón de tema claro/oscuro

- **Ubicación:** topbar, junto a «Limpiar», dentro de `.topbar-actions`. Botón circular `#theme-toggle`
  con SVG sol/luna, `aria-label` dinámico, `aria-pressed` y `title`.
- **Comportamiento:** lee `localStorage["cycs-theme"]`; si no existe usa `prefers-color-scheme`.
  Aplica `data-theme="light|dark"` en `<html>`. Un script inline en el `<head>` (antes del CSS) evita
  el parpadeo inicial. Si el usuario no ha elegido, sigue en vivo los cambios del sistema.
  También actualiza `<meta name="theme-color">`.
- **CSS:** `styles.css` pasó de colores literales a tokens en `:root` (claro) y `:root[data-theme="dark"]`
  (oscuro). Paleta oscura: fondo `#0f1115`, superficie `#171a20`, sidebar `#12151a`, borde `#262b33`,
  texto `#e6e8ec`; el ámbar `#e69138` se conserva. Transiciones suaves con `prefers-reduced-motion`.
- **Archivos:** `public/index.html`, `public/styles.css`, `public/script.js`. Sin cambios en `server.js`.
- **Verificación:** `node --check public/script.js` OK; llaves CSS 133/133; **verificación visual del
  usuario ✅** (claro ↔ oscuro, persistencia al recargar y móvil).

## Hallazgos / deuda conocida (NO son tareas; requieren autorización para tocarse)

- **El selector de modelo no tiene efecto.** `public/script.js` envía `model`, pero `server.js:70`
  usa el literal `"free/deepseek-v4.1-flash"` e ignora `req.body.model`. La UI ofrece 11 modelos
  (`muse-spark-1.3`, `glm-5.3-flash`, `gemini-3.8-flash`, `gpt-6-luna`, etc.) que hoy no se aplican.
- **`.env.example`: resuelto (30/10).** El usuario actualizó `README.md` y `.gitignore`: ya no se
  referencia la plantilla; el `.env` se crea manualmente en la raíz y `.gitignore` solo ignora `.env`.
- **`config_session/rules.md` apunta a archivos inexistentes:** `AGENTS.md`, `PRODUCT.md`,
  `DESIGN.md`, `docs/planes/`, `tools/migration/`, `index.js` y MySQL. Son restos del proyecto
  anterior; no aplican a CYCS Chat (salvo que el usuario los quiera crear).
- **No hay suite de pruebas ni linter**, así que `rules.md` §3 (la IA corre `npm test`) no tiene
  comando todavía.

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

## Protocolo de memoria

- Este archivo es la **única** fuente de contexto entre sesiones.
- Al terminar cada tarea: actualizar «Estado actual», mover lo cerrado a una línea de resumen y
  registrar el commit. Si algo deja de ser vigente, se elimina (no se acumula).
- Los pendientes reales van en «Pendientes abiertos»; la deuda aceptada no se disfraza de tarea.
- Ante la pregunta «¿qué hay pendiente?»: verificar `git status`, el estado real del repo y esta
  sección antes de responder. Si no hay nada: «¡No hay absolutamente nada pendiente!».

## Pendientes abiertos

Ninguno. (Ver «Hallazgos / deuda conocida»: son observaciones, no tareas autorizadas.)

## Registro de sesiones

### 30/10/2026 — Botón de tema claro/oscuro

- Checkpoint previo `9d58e1a`.
- Se tokenizaron los colores de `styles.css` y se añadió `:root[data-theme="dark"]`.
- Se añadió el botón `#theme-toggle` en el topbar, el script anti-parpadeo y la lógica de alternancia
  con `localStorage` + `prefers-color-scheme`.
- Verificado: `node --check` OK, llaves CSS balanceadas y **verificación visual del usuario ✅**.
- Commit final de la tarea (el `push` lo hace el usuario).

### 30/10/2026 — Depuración inicial de la memoria

- Se inspeccionó el proyecto real: `server.js`, `public/*`, `package.json`, `README.md`, `.gitignore`,
  `.env` (solo claves) y el historial de git.
- Se **reemplazó por completo** `config_session/memory.md` (831 líneas de otro proyecto → memoria
  vigente de CYCS Chat).
- Sin cambios de código. Commit de checkpoint `9d58e1a` (incluye esta memoria).

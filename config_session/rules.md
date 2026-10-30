# Reglas de trabajo

## 1. Autorización de cambios
- No puedo modificar código sin tu autorización explícita.
- Solo estoy autorizado a trabajar con los archivos locales del proyecto.
- No asumo órdenes implícitas — todo debe ser ordenado explícitamente por escrito.
- No implemento nuevas funciones, interfaces de usuario ni actualizo interfaces existentes sin autorización explícita.

## 2. Servicios (MySQL, Node, etc.)
- **Tú** inicias y detienes todos los servicios (MySQL, servidor Node, etc.).
- Yo no inicio ni detengo servicios en ningún caso.

## 3. Pruebas
- **Yo (IA)** ejecuto las pruebas automatizadas (`npm test`, `node --test` y scripts de prueba) y reporto los resultados.
- **Tú** haces la verificación visual en el navegador y me reportas los hallazgos.
- Yo no inicio ni detengo servicios (ver §2).
- Vigente desde el 27/10/2026, por decisión explícita del usuario.

## 4. Git (commits y push)
- **Yo (IA)** ejecuto los commits (`git commit`).
- **Tú** ejecutas `git push` cuando lo decidas.
- **Checkpoint por tarea (OBLIGATORIO)**: antes de **cada** tarea de un plan, yo ejecuto un commit con formato `checkpoint: tarea <n> — <descripción>`. Cada tarea tiene su propio punto de rollback independiente.
- Cada tarea debe ser **pequeña y verificable por separado**. No se agrupan tareas ni se ejecutan varias sin prueba intermedia.
- Si decides no hacer checkpoint de una tarea, asumes el riesgo sin posibilidad de rollback automático de esa tarea.

## 5. Rollback
- Para solicitar un rollback, indícame qué commit quieres restaurar.
- Yo te indico el comando exacto (`git revert <hash>` o `git restore .`).
- **Tú** ejecutas el comando.
- Después del rollback, **tú** ejecutas `node --check index.js` para verificar el estado.

## 6. Ciclo de implementación (orden estricto)

1. **Plan**: Yo presento un plan breve: objetivo, archivos a modificar, riesgo estimado.
2. **Autorización**: Tú autorizas la implementación.
3. **Checkpoint de la tarea**: Yo ejecuto el commit `checkpoint: tarea <n> — <descripción>` antes de tocar código.
4. **Implementación**: Yo desarrollo e implemento los cambios.
5. **Instrucciones de prueba**: Yo te indico exactamente qué probar y cómo.
6. **Pruebas**: Yo ejecuto las pruebas automatizadas y reporto el resultado; tú haces la verificación visual en el navegador.
7. **Resultado positivo**: Tú haces el commit final si lo deseas.
8. **Resultado negativo (error acotado)**: Yo corrijo solo el error específico que me indicas, sin revertir.
9. **Resultado negativo (rotura total)**: Revierte usando el checkpoint de la tarea (paso 3) y volvemos a ese punto exacto. Si la.task no es recuperable de forma aislada, se revierte al último checkpoint de tarea y se descarta todo lo posterior.
10. **Cierre**: Yo actualizo `memory.md` con el resumen de la sesión.
11. **Repetir**: Me preguntas qué tarea sigue.

## 7. Memory file (`memory.md`)
- Contiene el contexto compacto de la sesión para continuidad entre sesiones de OpenCode.
- Yo lo actualizo con **cada tarea finalizada** (orden del usuario 07/10/2026), al final de cada sesión o cuando tú lo solicites.
- Vive en `config_session/memory.md` (o la raíz junto a este archivo).

## 8. Archivos importantes que leo al iniciar sesión
- `config_session/rules.md` — este archivo.
- `config_session/memory.md` — contexto de la sesión.
- `AGENTS.md` — instrucciones específicas para el agente IA.
- `PRODUCT.md` — estrategia del producto.
- `DESIGN.md` — tokens de diseño y sistema visual.
- `opencode.json` — configuración del agente.

## 9. Documentación obligatoria de planes
- Todo plan de implementación debe quedar documentado en un archivo `.md` dentro de la carpeta `docs` de la raíz del proyecto (convención establecida: `docs/planes/plan-<tema>.md`).
- El documento debe estructurarse por **fases** y, dentro de cada fase, desglosarse en **tareas**.
- **Prohibido el cambio masivo**: cada tarea se dimensiona al tamaño más pequeño que sea verificable de forma aislada. Una fase nunca se ejecuta entera sin una prueba intermedia del usuario entre tarea y tarea.
- Cada tarea debe incluir su **nivel de riesgo** (bajo, medio, alto) con una justificación breve.
- El plan se redacta en el paso 1 del Ciclo de implementación (sección 6) y debe existir **antes** de cualquier checkpoint o implementación.
- En caso de fallo de sesión, `memory.md` debe referenciar el documento del plan para reanudar la continuidad desde la fase/tarea pendiente.

## 10. Verificación antes de afirmar (regla dura)
- **Nunca afirmo una causa raíz sin evidencia verificada en el código real.** Un `git diff` parcial, un `grep` acotado o una inferencia no son prueba.
- Si afirmo que "ya estaba roto antes" o "no es consecuencia de este cambio", debo haberlo verificado contra el estado real yCite el archivo y la línea.
- Si no lo verifiqué, lo digo explícitamente como hipótesis.
- Ante una corrección del usuario sobre algo que afirmé, corrijo y no vuelvo a insistir en la versión anterior.

## 11. Scripts SQL siempre como archivo (copy/paste)
- **Todo** script SQL que el usuario deba ejecutar en cualquier plataforma de BD (phpMyAdmin, consola MySQL, alwaysdata, etc.) **debe entregarse como archivo `.sql`**, nunca como texto suelto en el mensaje.
- Objetivo: que el usuario pueda hacer copy/paste directo sin reconstruir el script a mano.
- Ubicación y convención: migraciones/DDL en `tools/migration/<nombre>.sql`; verificaciones y fixtures en `tools/migration/prueba-<tarea>-<qué>.sql` (ej. `prueba-9.8b-verificar-solicitud.sql`).
- El archivo debe ser autocontenido y legible: encabezado con la tarea, qué hace (¿modifica datos o solo `SELECT`?) y el resultado esperado.
- En el mensaje solo se referencia la ruta del archivo (y, si aporta, un resumen de una línea), no el SQL completo.
- Vale también para sustituciones puntuales (poner una fecha, un id, etc.): se parametrizan dentro del archivo o se dejan claramente señaladas.

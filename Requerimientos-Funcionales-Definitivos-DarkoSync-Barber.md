# DarkoSync Barber
**Documento Definitivo de Requerimientos Funcionales y Operativos**

**Versión:** 2.0 — Base para Diseño, Desarrollo, Branding y Planificación  
**Fecha:** Octubre 2026  
**Mercado Piloto:** La Paz, Bolivia (Sopocachi, Miraflores, San Miguel, Centro)  
**Plataforma:** Web-first (PWA instalable) → Nativo en fase posterior de adopción  
**Audiencia:** Producto, Diseño UX/UI, Desarrollo, Branding, Stakeholders

> **Principio rector de este documento:** Todo lo que no se pueda ejecutar en menos de 10 segundos con una mano ocupada, o que genere fricción real en el sillón, fue eliminado o simplificado radicalmente. Este es el contrato funcional definitivo.

---

## 1. Contexto, Problema de Mercado y Visión del Producto

### 1.1 El Problema Real

1. **Pérdida de la memoria del corte:** El cliente no recuerda números de máquina, altura de degradado ni técnica exacta. Cada barbero nuevo trabaja a ciegas.
2. **Cultura de orden de llegada vs. agendas rígidas:** La mayoría del público no agenda. Si ve la sala llena (aunque sea “falso lleno”), se va al local de al lado.
3. **Falso lleno:** El barbero puede estar a 4 minutos de terminar y no tener a nadie esperando, pero desde afuera parece ocupado.
4. **Portafolios desordenados:** Fotos sueltas en Instagram/TikTok sin ficha técnica ni autoría clara.
5. **WhatsApp como interrupción:** Coordinar disponibilidad por mensaje rompe el ritmo del barbero.

### 1.2 Visión de DarkoSync Barber

Herramienta de trabajo ágil para el barbero + portal de consulta inmediata para el cliente, centrada en dos pilares:

- **Historial Clínico Capilar:** Ficha digital que viaja con el cliente. Registro técnico + fotográfico en menos de 20 segundos.
- **Semáforo Pasivo de Ocupación:** Indicador en tiempo real (Verde / Rojo / Amarillo / Gris) sin agendas rígidas ni gestión de turnos.

---

## 2. Perfiles de Usuario

### 2.1 Cliente Final

- Varones 16-45 años, corte cada 15-30 días.
- Necesita: no explicar el corte cada vez, saber cuánto tardará en sentarse, ver portafolio real y precios, acceder sin instalar app pesada.

### 2.2 Barbero (Operador + Marca Personal)

- Profesional independiente o comisionista.
- Necesita: registrar ficha en <20 s, portafolio verificado que viaje con él, evitar que se vayan clientes por “falso lleno”, proteger su autoría.

### 2.3 Dueño / Administrador de Local

- Local de 2 a 6 sillones.
- Necesita: llenar horas muertas, administrar sillones activos, factura legal fácil (QR + C.I.), privacidad del negocio.

---

## 3. Dinámica Operativa en el Salón (Flujo Definitivo)

1. **Entrada y Sillón** → Cliente se sienta.
2. **Vinculación Express**:
   - Con red: Cliente escanea QR del espejo o el barbero busca por teléfono (se abre historial si existe).
   - Sin red (modo degradado): Barbero ingresa el teléfono manualmente y arranca en modo “Nuevo / Sin historial remoto”.
3. **Consulta Técnica** → Barbero ve en su pantalla los cortes anteriores (chips + fotos). Sistema pasa a **Rojo (Cortando)**.
4. **Registro Final Rápido** (objetivo <20 s):
   - Si el cliente ya tiene historial local/remoto → chips pre-cargados con el último corte (“Repetir último corte”).
   - Barbero ajusta solo lo que cambió (1-3 toques).
   - Toma 0, 1 o 2 fotos (opcional).
   - Presiona “Guardar y Finalizar”.
5. **Micro-Tap de Sala** (0.5–1 s, pantalla completa, thumb-zone):
   - [0 - Nadie]    [1 a 2]    [3 o más]
   - Si no toca en 5 segundos → asume 0 (sala vacía).
6. **Consentimiento de foto** → Si se tomó foto, se define en el sillón al momento de la captura (toggle rápido en pantalla: “¿Autoriza portafolio público?”). Por defecto es privada.

---

## 4. Requerimientos Funcionales por Módulo (Estado Definitivo)

### Módulo 1: Historial Clínico Capilar `MVP`

#### RF-1.1 Ficha Técnica (solo chips visuales)

- **Base Lateral:** #000 (Shaver), #0, #0.5, #1, #1.5, #2, #3, #4+
- **Tipo de Degradado:** Low Fade, Mid Fade, High Fade, Taper Fade, Skin Fade, Clásico Tijera
- **Parte Superior:** Tijera Texturizado, Tijera Recto, Desvellonado, Sin Tocar, Crop Francés
- **Barba:** Sí/No + altura de mejilla (Alta / Media / Baja)
- **Adicionales:** Cejas navaja, Diseño/Línea, Tinte, Lavado
- **Notas especiales:** Eliminado texto libre. Solo chips fijos opcionales: “Remolino fuerte”, “Cicatriz”, “Pelo muy fino”, “Piel sensible”.

#### RF-1.2 Portabilidad del Historial

El historial pertenece al cliente. Viaja con él a cualquier barbero autorizado.

#### RF-1.3 Registro sin App (Cero Fricción)

Barbero ingresa solo el número de teléfono del cliente. Sin contraseñas ni OTP obligatorio por SMS (evita fallos de entrega de operadoras en Bolivia). Cliente puede ver su ficha mediante acceso web ligero.

#### RF-1.4 Consentimiento de Fotografías

Toda foto es privada por defecto. La autorización para portafolio público se define directamente en el sillón al tomar la fotografía (mediante confirmación verbal/toggle del barbero o aprobación en pantalla presencial).

#### RF-1.5 Pre-carga “Repetir último corte” `NUEVO`

Al escanear el QR de un cliente recurrente, los chips aparecen pre-seleccionados con el último corte. El barbero solo confirma o ajusta. Objetivo: bajar el registro a 6-10 segundos reales.

### Módulo 2: Semáforo Pasivo de Ocupación `MVP`

#### RF-2.1 Estados del Sillón

- **Verde** — Libre
- **Rojo** — Cortando (ficha abierta)
- **Amarillo** — Cortando + gente en sala
- **Gris** — Desconectado / fuera de turno

#### RF-2.2 Tiempo restante (simplificado)

Se eliminan los minutos exactos. Solo tres estados visuales:

- “Recién empezó”
- “A mitad”
- “Casi termina / Finalizando detalles”

#### RF-2.3 Micro-Tap de Sala

Al finalizar corte: diálogo a pantalla completa, tres botones gordos en thumb-zone. Timeout 5 s → asume 0.

#### RF-2.4 Cancelación de Turno Fantasma

Si una ficha permanece en “Cortando” más de 50 minutos sin actividad → regresa a Libre + notificación al barbero.

### Módulo 3: Acceso Físico (QRs) `MVP`

#### RF-3.1 QR Acrílico del Espejo

QR único por barbero. Al escanearlo se vincula cliente-barbero y se abre el historial (si existe).

#### RF-3.2 QR de Mesa de Espera

**Eliminado del MVP** como contador pasivo (generaba datos mentirosos). Se puede reintroducir más adelante solo como acceso a estilos/WiFi, nunca como fuente de verdad de ocupación.

### Módulo 4: Descubrimiento y Portal de Barberos `MVP (versión mínima)`

- Mapa geolocalizado con pines de color del semáforo en vivo.
- Filtros básicos: zona (barrios) + rango de precio.
- Especialidades: máximo 5 chips en MVP (Fades, Barba, Diseños, Clásico, Otros).
- Portafolio: solo fotos reales autorizadas + chips técnicos del corte.

### Módulo 5: Marca Personal del Barbero `MVP`

- Perfil profesional autónomo que viaja con el barbero (portafolio, estadísticas de fidelidad, seguidores).
- Control de dispositivo único activo: una sola sesión móvil a la vez. Si se abre en otro teléfono, se cierra la anterior.

### Módulo 6: Motor de Fidelización `MVP (versión controlada)` `Automatización completa → Fase 1.5`

- Se calcula y guarda el ciclo natural de cada cliente (invisible para el barbero).
- Botón “Seguir” existe pero es silencioso en MVP.
- Notificación de “ya toca corte” se activa **solo manualmente** por el barbero desde el historial del cliente (“Avisar que ya toca”). Así el barbero mantiene el control de la relación.
- Notificaciones automáticas de precio / traslado / promociones → postergadas a Fase 1.5.

---

## 5. Reglas de Negocio Definitivas

| Código | Regla | Justificación |
|--------|-------|---------------|
| RN-01 | No intermediación financiera | DarkoSync nunca toca el dinero del corte. Cobro directo en local (efectivo o QR del barbero). Evita riesgos SIN/ASFI. |
| RN-02 | Acceso restringido al historial | Solo se abre cuando el cliente escanea el QR del sillón o autoriza explícitamente. |
| RN-03 | Límite de cortes por plan | Al llegar al tope se bloquea el registro de nuevas fichas. Historial pasado sigue visible. |
| RN-04 | Permanencia del historial del cliente | El historial pertenece al cliente. Ningún dueño puede eliminarlo ni retenerlo. |
| RN-05 | Fotografías con consentimiento obligatorio | Ninguna foto pública sin autorización explícita del cliente. |
| RN-06 | Exclusión mutua (un corte por sillón) | Una cuenta de barbero solo puede tener una ficha en estado “Cortando” a la vez. |
| RN-07 | Umbral temporal mínimo (Anti-Ráfaga no bloqueante) | El botón “Guardar y Finalizar” NUNCA se bloquea. Si un corte finaliza en menos de 15 minutos (o menos de 8 min con chip “Corte Express”), se guarda inmediatamente y se marca internamente con flag `rapid_closure: true` para análisis posterior y detección de fraude sin trabar la operación en el sillón. |

---

## 6. Modelo Comercial y Facturación

### 6.1 Planes de Suscripción (Bs / mes)

| Plan Autónomo<br>(1 Barbero) | Plan Barbería Base<br>(2-3 Sillones) | Plan Alto Flujo<br>(4+ Sillones) |
|------------------------------|--------------------------------------|----------------------------------|
| • 1 sillón activo<br>• Hasta 60 cortes/mes<br>• Semáforo en vivo<br>• Portafolio verificado<br><br>**Bs 45/mes** | • Hasta 3 sillones<br>• Hasta 200 cortes/mes<br>• Semáforo por sillón<br>• Notificaciones promo<br>• Reporte horas muertas<br><br>**Bs 110/mes** | • Sillones ilimitados<br>• Cortes ilimitados<br>• Semáforo + Métricas<br>• Alertas automáticas<br>• Soporte prioritario<br><br>**Bs 190/mes** |

### 6.2 Cobro y Facturación

- Cobro mensual por QR en bolivianos.
- Factura electrónica nominada a Cédula de Identidad (no se requiere NIT).
- 5 días de gracia → luego Modo Solo Lectura (puede ver historiales, no registrar nuevos cortes, pin del mapa pasa a gris).

---

## 7. Situaciones Excepcionales (Comportamiento Obligatorio)

- **Sin conexión / conectividad de campo:** Para el MVP se determinó estrategia **Online-First** con reintentos transparentes vía `clientRequestId`. El complejo motor Offline-Light (Dexie + Outbox en disco) queda en standby para fases posteriores, ya que la conectividad en las zonas piloto de La Paz es estable.
- **Cliente se niega a foto:** Foto no es obligatoria. Se puede cerrar el corte solo con chips.
- **Grupo (padre + hijo, amigos):** Múltiples perfiles de corte asociados al mismo número de teléfono, diferenciados por nombre (“Carlos” / “Carlos Jr.”).
- **Manos con talco/gel/agua:** Todos los botones críticos deben funcionar con canto del dedo o toque grueso (touch targets ≥ 48×48 dp).

---

## 8. Criterios de Éxito del Producto

1. **Velocidad de registro:** Barbero experimentado finaliza ficha completa en < 25 segundos (objetivo real con pre-carga: < 12 s).
2. **Precisión del semáforo:** Cambio Libre → Ocupado visible en el mapa del cliente en < 3 segundos.
3. **Adopción del historial:** ≥ 70 % de los clientes atendidos en salones piloto tienen ficha registrada al cabo del primer mes.
4. **Cero rechazo por citas fantasma:** Ningún barbero debe rechazar cliente presencial por error de la plataforma.

---

## 9. Decisiones de Arquitectura y UX No Negociables

- **Web-first (PWA instalable)** — Cero fricción de descarga. Offline-first real (IndexedDB + Service Worker). Cámara y notificaciones vía PWA.
- **Modo oscuro alto contraste (OLED)** — Obligatorio. Las barberías tienen aros de luz potentes.
- **Thumb-zone absoluta** — Toda acción primaria en el tercio inferior de la pantalla.
- **Máximo 3 decisiones visuales por pantalla** — Solo chips, toggles e iconos. Cero texto libre obligatorio.
- **Latencia cognitiva cero** — El barbero no debe leer; debe reconocer.

---

## 10. Qué se Posterga (Fase 1.5 / v1.1)

- Notificaciones automáticas de fidelización (precio, traslado, promociones).
- QR de mesa de espera como contador de ocupación.
- Filtros de especialidad muy granulares.
- Reportes detallados de horas muertas visibles para el dueño en planes bajos.
- Estimaciones de minutos exactos de tiempo restante.
- App nativa (se evalúa solo después de adopción real de la PWA).

---

> **Este documento es la única fuente de verdad funcional.**  
> Cualquier pantalla, flujo o feature que no esté aquí o que viole los principios de velocidad, thumb-zone y cero fricción debe ser rechazado en revisión de diseño o desarrollo.

---

Documento generado y consolidado a partir del relevamiento original + auditorías de campo y decisiones de producto tomadas en octubre 2026.  
Listo para alimentar: Diseño UX/UI · Arquitectura técnica · Branding · Roadmap de desarrollo.

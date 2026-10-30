# 🚀 AI-ToDu - Fake REST API Logística B2B

![Node.js](https://img.shields.io/badge/Node.js_24+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![OpenAPI](https://img.shields.io/badge/OpenAPI_3.1-6BA539?style=for-the-badge&logo=openapiinitiative&logoColor=white)

**AI-ToDu** es una plataforma logística B2B. Este repositorio contiene la **Fake REST API canónica** que sostiene su demostración: motor de reglas, adaptador HTTP local, persistencia y contrato de servicios.

### 🌍 [Acceder al Workspace de Demostración](https://ai-todu.github.io/ai-todu-webapp/)

> **Nota para evaluación:** prototipo académico **v0.2.0**, con contrato en inglés y datos ficticios. No es un backend productivo desplegado: Node HTTP se ejecuta localmente y la alternativa de Pages funciona dentro del navegador. Java/Spring Boot, PostgreSQL/JPA y autenticación segura de servidor siguen pendientes para AV2.

---

## 🏗️ Arquitectura del Proyecto

Este paquete es la **fuente de referencia del motor demo**. El frontend copia una versión exacta para su servidor integrado y su Service Worker, manteniendo commit y hashes en un manifiesto de procedencia.

* **Dominio:** reglas y objetos de valor para stock, ventas y despachos.
* **Motor de operaciones:** validación completa antes de aceptar una modificación del estado.
* **Adaptador HTTP local:** rutas `/api/v1`, con persistencia JSON.
* **Adaptador de navegador:** el Service Worker del frontend consume el mismo motor y confirma cada solicitud aceptada en una transacción IndexedDB.
* **Diseño relacional:** DDL de 35 tablas como destino de migración, separado del almacenamiento JSON en ejecución.

### Estructura de Directorios

```text
public/mock/            # Motor y reglas de dominio de demostración
tools/                  # Servidor HTTP y pruebas
database/               # Esquema y modelo relacional de referencia
openapi.json            # Contrato implementado de la Fake API
```

---

## 🛠️ Tecnologías y Prácticas Implementadas

* **Ejecución:** Node.js 24 o posterior, sin dependencias de runtime.
* **Contrato:** [OpenAPI 3.1](openapi.json), limitado a las operaciones demo implementadas.
* **Persistencia local:** `.demo-data/state.json`, excluido de Git.
* **Reglas:** cantidades válidas, SKU único, conservación del producto, rechazo de sobreventa y recepción excesiva, anulación única y referencias por empresa.
* **Logística y devoluciones:** recursos disponibles, entrega con receptor, devolución no mayor a lo vendido y bloqueo durante un despacho sin terminar.
* **Pruebas:** fallos de dominio, autorización/tenant, concurrencia HTTP y persistencia tras reiniciar.

Una venta valida sus líneas antes de confirmar venta, instantáneas, pago/recibo demo, stock y movimientos. Las solicitudes rechazadas no dejan un estado parcial.

---

## 🚀 Despliegue Local (Para Desarrolladores)

1. Clona el repositorio:

   ```sh
   git clone --branch fix/tb1-readiness https://github.com/AI-ToDu/ai-todu-fake-api.git
   cd ai-todu-fake-api
   ```

2. Ejecuta sus pruebas:

   ```sh
   npm test
   ```

3. Inicia el adaptador HTTP:

   ```sh
   npm start -- --port 8853
   ```

El proceso escucha en `127.0.0.1`; los contratos utilizan `/api/v1`. Este paquete no sirve una interfaz Angular compilada. Para el recorrido completo de navegador, ejecutar `npm run demo` en el frontend: su servidor integrado comparte el motor y sirve la interfaz en el puerto 8850.

## 🔐 Cuentas de Demostración

| Rol | Correo |
| --- | --- |
| Administrador | admin@demo.ai-todu.test |
| Almacén | warehouse@demo.ai-todu.test |
| Ventas | sales@demo.ai-todu.test |
| Logística | logistics@demo.ai-todu.test |

Contraseña de prueba intencionalmente pública: **DemoOnly2026!**. Estas identidades y sus mecanismos de almacenamiento/autorización son exclusivos de la demostración.

## ✅ Verificación, Sincronización y Alcance

El frontend registra el origen del motor en `mock-provenance.json`. Al cambiar el motor, confirmar primero las modificaciones aquí y ejecutar desde el frontend:

```sh
npm run mock:sync -- ../ai-todu-fake-api
```

Después ejecutar sus pruebas y compilación. El [diseño de 35 tablas](database/schema.sql) es una referencia de migración, no el adaptador JSON. Consultar [arquitectura y cobertura](https://github.com/AI-ToDu/ai-todu-report/blob/fix/tb1-readiness/design/architecture.md).

En Pages, `/api/v1` se intercepta en el navegador; no es un backend remoto invocable con curl. IndexedDB conserva datos por navegador/origen y no sincroniza dispositivos. No hay pagos reales, emisión fiscal, correos de recuperación, invitaciones, suscripciones, optimización de rutas ni seguridad productiva implementados.

### Ramas y Revisión

`fix/tb1-readiness` contiene la implementación y documentación revisables. Las ramas `main` y `develop` parten de la inicialización del paquete; la integración se revisa mediante PR. El historial de autoría y los registros históricos del equipo se conservan.

---

## 🔗 Ecosistema del Proyecto

* **[Landing Page](https://github.com/AI-ToDu/ai-todu-platform/tree/fix/tb1-readiness):** presentación del producto y acceso a la demo.
* **[Frontend](https://github.com/AI-ToDu/ai-todu-webapp/tree/fix/tb1-readiness):** espacio de trabajo Angular.
* **[Fake REST API](https://github.com/AI-ToDu/ai-todu-fake-api/tree/fix/tb1-readiness):** motor canónico de demostración y contrato OpenAPI.
* **[Informe](https://github.com/AI-ToDu/ai-todu-report/tree/fix/tb1-readiness):** requisitos, arquitectura, diseño de datos y evidencias.

---

## 👥 Equipo de Desarrollo

**IA-INNOVATION · AI-ToDu.** Las contribuciones a este repositorio se acreditan mediante su historial y revisión de PR. El informe registra por separado los aportes históricos del frontend y las evidencias individuales del equipo.

---
*Desarrollado por el equipo IA-INNOVATION · AI-ToDu · UPC · 2026.*

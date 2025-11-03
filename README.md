# Control de pólizas

Aplicación mínima construida con Node.js, Tailwind CSS (vía CDN) y SQLite para gestionar pólizas, siniestros y la documentación asociada a cada cliente.

## Requisitos

- Node.js 18 o superior.
- SQLite3 disponible en la línea de comandos (incluido en la mayoría de las distribuciones Linux).

## Puesta en marcha

```bash
npm start
```

El servidor escucha por defecto en `http://localhost:3000`. Al iniciarse crea el archivo `data.db` y las tablas necesarias si todavía no existen.

## Funcionalidades principales

- Tabla interactiva que combina información de pólizas y clientes.
- Modales para crear o editar pólizas y clientes al hacer clic en cualquier celda.
- Seguimiento del envío de cartas a brokers y clientes.
- Control de reclamos presentados y carga de PDF para informes técnicos y actas de inspección (los archivos se guardan en `uploads/`).

## Notas

- Los archivos PDF se envían en base64 desde el navegador y el servidor los almacena con un nombre único dentro de `uploads/`.
- Si necesitas limpiar la base de datos, elimina el archivo `data.db` con el servidor detenido.
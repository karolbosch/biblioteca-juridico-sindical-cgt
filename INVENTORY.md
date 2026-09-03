# Inventario

## ZIP recibido

El archivo inicial contenía un prototipo estático y no incluía los PDFs del corpus. Se encontraron:

- frontend HTML/CSS/JavaScript;
- 121 fichas de metadatos en `documents.json`;
- Worker monolítico básico;
- una migración D1 reducida;
- workflow de GitHub Pages;
- generador SQL sencillo.

Por tanto, en esta entrega se han preservado e integrado las 121 fichas, pero no se han podido copiar ni auditar los documentos binarios que no estaban dentro del ZIP.

## Entrega actual

La estructura tiene 44 archivos:

- 10 en `docs/` (portada, administración, sector Contact Center, estilos, scripts y datos);
- 11 en `worker/` (configuración, 8 módulos, paquete y migración);
- 7 herramientas de importación, privacidad, cadenas, esquema y credenciales;
- 4 suites de pruebas;
- 3 workflows de GitHub Actions;
- arquitectura, despliegue, TODO, variables y documentación raíz.

## Estado del corpus

- Metadatos preservados: **121**.
- PDFs recibidos dentro del ZIP: **0**.
- Identificadores directos detectados en el JSON público por patrones DNI/NIE/IBAN/email/teléfono: **0**.
- Cadenas con inconsistencia estructural detectada en el seed: **0**.
- Enlaces y metadatos incompletos: pendientes de enriquecimiento según `TODO.md`.

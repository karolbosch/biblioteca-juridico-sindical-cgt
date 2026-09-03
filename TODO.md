# TODO técnico por fases

## Completado en este MVP

- [x] Repositorio modular, inventario inicial de 121 fichas y modo sin backend.
- [x] Esquema D1 extensible, FTS5, índices, cadenas procesales, ITSS y auditoría.
- [x] Búsqueda pública, filtros, ranking jurídico y vista de cadena.
- [x] `/api/ask` con Workers AI opcional y fallback documental.
- [x] Login PBKDF2, sesión segura, CSRF, CORS, rate limiting y límites de subida.
- [x] Subida PDF/ZIP a R2 privado, SHA-256 y detección de duplicados.
- [x] Bloqueo de publicación por privacidad y registro de auditoría.
- [x] Importador JSON/CSV/carpetas y manifiesto R2.
- [x] GitHub Actions para pruebas, Pages y Worker.
- [x] Pruebas del caso obligatorio de resolución favorable revocada.

## Antes de publicar documentos reales

- [ ] Ejecutar revisión humana de cada PDF y registrar los cinco controles de privacidad.
- [ ] Completar `chain_id`, relaciones y autoridad final de las sentencias del corpus.
- [ ] Enriquecer materias, resúmenes, ECLI/ROJ, fechas y URLs oficiales.
- [ ] Fragmentar e indexar la Guía Jurídico-Sindical por capítulo, apartado y página.
- [ ] Incorporar extracción/OCR en un proceso aislado fuera del Worker; nunca ejecutar binarios aportados.
- [ ] Definir responsables, política de retención de originales y procedimiento de incidentes.

## Evolución

- [ ] Embeddings precomputados y búsqueda híbrida, manteniendo FTS5 como fallback.
- [ ] Comparador de resoluciones y alertas de cambios procesales.
- [ ] Adaptadores de descubrimiento para BOE, CENDOJ, TC, CURIA, EUR-Lex e ITSS.
- [ ] Usuarios múltiples, roles, favoritos, colecciones y notas privadas.

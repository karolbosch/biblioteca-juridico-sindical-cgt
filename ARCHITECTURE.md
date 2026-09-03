# Arquitectura del MVP

## Decisiones

La interfaz pública es estática y se publica en GitHub Pages. El Worker expone la API, D1 conserva metadatos y estado, R2 guarda binarios y Workers AI es opcional. Si la IA falla o agota su asignación, `ruleBasedAnswer` devuelve una respuesta documental determinista.

```text
GitHub Pages (docs/)
        │ HTTPS/CORS estricto
        ▼
Cloudflare Worker (worker/src/)
  ├─ /api/ask ── D1 FTS5 + ranking jurídico ── Workers AI opcional
  ├─ /api/auth ─ sesiones HttpOnly + CSRF + PBKDF2
  └─ /api/admin ─ cuarentena, revisión y publicación bloqueada
        │
        ├─ D1: fichas, cadenas, revisiones, auditoría
        ├─ R2 ORIGINALS: private/originals/ (sin URL pública)
        └─ R2 PUBLIC: public/anonymized/ (solo tras verificación)
```

## Fiabilidad jurídica

El ranking combina coincidencia textual, materia, jerarquía, actualidad, sector, autoridad final y estado procesal. `REVOCADA`, `ANULADA`, `CASADA_TOTALMENTE` y `SUPERADA_DOCTRINALMENTE` reciben una penalización que impide presentarlas como criterio actual. Se conservan como antecedente histórico. La IA solo recibe fichas recuperadas del corpus y debe indicar `El dato no consta en la biblioteca` cuando falte un dato. La respuesta se muestra antes que las fuentes; el desplegable ordena ET, convenio, restante normativa, guía CGT y jurisprudencia.

## Privacidad

Una subida entra en `private/originals/` con `ANONIMIZACION_PENDIENTE` o `REQUIERE_REVISION`. La publicación exige simultáneamente:

1. copia anonimizada independiente;
2. estado `ANONIMIZACION_VERIFICADA`;
3. verificación humana;
4. cero hallazgos residuales;
5. revisión de texto, metadatos, objetos, imágenes y capa OCR.

El script incluido realiza auditoría conservadora, pero nunca declara un PDF publicable automáticamente.

## Escalado

D1 FTS5 evita reconstruir el frontend al añadir documentos. El corpus estático es el modo demostración y contingencia. La API consulta D1 en tiempo real, pagina resultados y descarga PDFs solo bajo petición. La tabla `search_index` permite añadir embeddings precomputados sin cambiar la API pública.

## Ingesta automatizada

GitHub Actions actúa como proceso diario. Consulta únicamente feeds oficiales configurados, descarga PDFs directos desde una lista de hosts permitidos, crea una copia privada con redacciones automáticas y exige revisión humana. El correo SMTP contiene enlaces profundos al panel. Confirmar copia de R2 privado a R2 público, crea la ficha D1 y activa automáticamente el trigger FTS5. Solicitar reanonimización solo cambia el estado; la siguiente ejecución vuelve a procesar el original privado.

# Archivos de demostración

**Todos los archivos son inofensivos y contienen únicamente datos FICTICIOS.**
Se generan con `node scripts/make-demo-files.mjs` (también sincroniza `public/demo/` para la bandeja de archivos arrastrables del chat).

| Archivo | Caso demo | Cómo usarlo | Resultado esperado |
|---|---|---|---|
| `factura_urgente.zip` | 1 · Gestoría | Subir con el clip 📎 en el chat | **Bloquear** — contiene `factura.pdf.exe` (ejecutable camuflado; en realidad es texto) |
| `reservas_agosto.xlsm` | 2 · Hotel | Subir como Hotel Málaga Centro | **Escalar** — macros + datos de clientes → Private Scanning (simulado) |
| `documentacion_paciente.pdf` | 3 · Clínica | Subir como Clínica Sur | **Escalar** — DNI/IBAN/salud ficticios → análisis solo local + revisión humana |
| `correo_phishing.txt` | 4 · Autónomo | Pegar su contenido en la pestaña «Correo» | **Bloquear** — enlace de pago fraudulento |
| `acta_reunion.pdf` | Archivo limpio | Subir con el clip 📎 | **Abrir** — sin señales de riesgo |
| `nominas_enero.csv` | Sensible cotidiano | Subir o arrastrar al chat | **Escalar** — DNI/IBAN ficticios → revisión humana, análisis solo local |
| `presupuesto_marketing.pdf` | 5 · SafeDocs | Unirlo con `acta_reunion.pdf` en SafeDocs | PDF combinado descargable, procesado 100 % en local |

URL de phishing para la pestaña «URL» (dominio ficticio, no existe):

```
http://pagos-verificacion-urgente.top/verificar?id=8123
```

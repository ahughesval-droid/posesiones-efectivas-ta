'use strict';

const express   = require('express');
const fs        = require('fs');
const path      = require('path');
const { fillPDF } = require('./fill_pdf');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

const TEMPLATE_PATH  = path.join(__dirname, 'template', 'Formulario_de_Posesion_Efectiva-TIPO_FORMULARIO.pdf');
const BORRADORES_DIR = path.join(__dirname, 'borradores');

[BORRADORES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/calcular-presuncion', (req, res) => {
  try {
    const { valor_primer_br } = req.body;
    const valor      = parseInt(valor_primer_br, 10) || 0;
    const presuncion = Math.round(valor * 0.20);
    res.json({ presuncion, valor_primer_br: valor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generar-pdf', async (req, res) => {
  try {
    const formData = req.body;
    console.log('[PDF] Generando para causante:', formData?.causante?.primer_apellido || 'sin nombre');

    const pdfBuffer = await fillPDF(TEMPLATE_PATH, formData);

    const causanteApellido = (formData?.causante?.primer_apellido || 'posesion').replace(/\s+/g, '_');
    const filename = `PE_${causanteApellido}_${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[PDF] Error:', error);
    res.status(500).json({ error: 'Error al generar el PDF', details: error.message });
  }
});

app.post('/api/guardar-borrador', (req, res) => {
  try {
    let formData, nombre;
    if (req.body.data) { formData = req.body.data; nombre = req.body.nombre; }
    else { formData = req.body; nombre = null; }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    let filename;

    if (nombre && nombre.trim()) {
      const safeName = nombre.trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 50).trim().replace(/\s+/g, '_');
      filename = `${safeName}_${timestamp}.json`;
    } else {
      const causante = formData.causante || {};
      const apellido = (causante.primer_apellido || '').trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
      const nombres = (causante.nombres || '').trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
      const base = (apellido || nombres) ? `${apellido}_${nombres}` : 'sin_nombre';
      filename = `borrador_${base}_${timestamp}.json`;
    }

    const filepath = path.join(BORRADORES_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(formData, null, 2), 'utf8');
    console.log('[Borrador] Guardado:', filename);
    res.json({ success: true, filename });
  } catch (error) {
    console.error('[Borrador] Error guardando:', error);
    res.status(500).json({ error: 'Error al guardar borrador', details: error.message });
  }
});

app.get('/api/borradores', (req, res) => {
  try {
    if (!fs.existsSync(BORRADORES_DIR)) return res.json([]);
    const files = fs.readdirSync(BORRADORES_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const stat    = fs.statSync(path.join(BORRADORES_DIR, f));
          const content = JSON.parse(fs.readFileSync(path.join(BORRADORES_DIR, f), 'utf8'));
          const c = content.causante || {};
          return {
            filename: f, created: stat.birthtime, modified: stat.mtime,
            causante: `${c.nombres||''} ${c.primer_apellido||''} ${c.segundo_apellido||''}`.trim() || 'Sin nombre',
            rut_causante: c.rut || '', size: stat.size,
          };
        } catch { return null; }
      })
      .filter(Boolean).sort((a, b) => new Date(b.modified) - new Date(a.modified));
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Error al listar borradores', details: error.message });
  }
});

app.get('/api/cargar-borrador/:filename', (req, res) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const filepath = path.join(BORRADORES_DIR, safeFilename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Borrador no encontrado' });
    res.json(JSON.parse(fs.readFileSync(filepath, 'utf8')));
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar borrador', details: error.message });
  }
});

app.delete('/api/borrador/:filename', (req, res) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const filepath = path.join(BORRADORES_DIR, safeFilename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Borrador no encontrado' });
    fs.unlinkSync(filepath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar borrador', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor Posesión Efectiva → http://localhost:${PORT}`);
  console.log(`📄 Template: ${TEMPLATE_PATH}`);
  console.log(`📁 Borradores: ${BORRADORES_DIR}\n`);
});

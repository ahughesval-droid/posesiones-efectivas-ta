'use strict';

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// ─── Formatters ────────────────────────────────────────────────────────────────

function formatMoney(value) {
  if (value === undefined || value === null || value === '') return '';
  const num = parseInt(value, 10);
  if (isNaN(num)) return String(value);
  return num.toLocaleString('de-DE'); // uses dots as thousands separator
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function formatRut(rut) {
  if (!rut) return { numero: '', dv: '' };
  const clean = String(rut).replace(/[^0-9Kk]/g, '');
  if (clean.length < 2) return { numero: '', dv: '' };
  return { numero: clean.slice(0, -1), dv: clean.slice(-1).toUpperCase() };
}

// ─── Field mapper ───────────────────────────────────────────────────────────────

function buildFieldValues(formData) {
  const fields = {};

  const causante        = formData.causante        || {};
  const solicitante     = formData.solicitante     || {};
  const representante   = formData.representante   || {};
  const partida         = formData.partida         || {};
  const domicilioCau    = formData.domicilio_causante || {};
  const herederos       = formData.herederos       || [];
  const bienesRaices    = formData.bienes_raices   || [];
  const vehiculos       = formData.vehiculos       || [];
  const menaje          = formData.menaje          || [];
  const otrosMuebles    = formData.otros_muebles   || [];
  const otrosBienes     = formData.otros_bienes    || [];
  const pasivos         = formData.pasivos         || [];
  const usaPresuncion   = formData.presuncion_20 === '1' || formData.presuncion_20 === true;

  // ── Causante ──
  const rutCau = formatRut(causante.rut);
  fields['RUT CAUSANTE']                  = rutCau.numero;
  fields['VERIFICADOR RUT']               = rutCau.dv;
  fields['NOMBRE CAUSANTE']               = causante.nombres || '';
  fields['PRIMER APELLIDO CAUSANTE']      = causante.primer_apellido || '';
  fields['SEGUNDO APELLIDO CAUSANTE']     = causante.segundo_apellido || '';

  if (causante.fecha_nacimiento) {
    const [y, m, d] = causante.fecha_nacimiento.split('-');
    fields['DIA NACIMIENTO CAUSANTE']  = d || '';
    fields['MES NACIMIENTO CAUSANTE']  = m || '';
    fields['AÑO NACIMIENTO CAUSANTE']  = y || '';
  }
  if (causante.fecha_defuncion) {
    const [y, m, d] = causante.fecha_defuncion.split('-');
    fields['DIA DEFUNCION CAUSANTE']  = d || '';
    fields['MES DEFUNCION']           = m || '';
    fields['AÑO DEFUNCION CAUSANTE']  = y || '';
  }

  fields['ESTADO CIVIL']                              = causante.estado_civil || '';
  fields['NACIONALIDAD']                              = causante.nacionalidad || '';
  fields['ACTIVIDAD/PROFESION/OFICIO DEL CAUSANTE']   = causante.actividad || '';

  // ── Partida defunción ──
  fields['CIRCUNSCRIPCION DEFUNCION']   = partida.circunscripcion || '';
  fields['TIPO DE REGISTRO DEFUNCION']  = partida.tipo_registro   || '';
  fields['AÑO DEFUNCION']              = partida.ano             || '';
  fields['N° INSCRIPCION DEFUNCION']   = partida.n_inscripcion   || '';
  fields['LUGAR DEFUNCION CAUSANTE']    = partida.lugar_defuncion || '';

  // ── Domicilio causante ──
  fields['CALLE ULTIMO DOMICILIO']                = domicilioCau.calle   || '';
  fields['NUMERO ULTIMO DOMICILIO']               = domicilioCau.numero  || '';
  fields['LETRA DE LA CALLE DEL ULTIMO DOMICILIO']= domicilioCau.letra   || '';
  fields['RESTO ULTIMO DOMICILIO CAUSANTE']        = domicilioCau.resto   || '';
  fields['COMUNA ULTIMO DOMICILIO CAUSANTE']       = domicilioCau.comuna  || '';
  fields['REGION ULTIMO DOMICILIO CAUSANTE']       = domicilioCau.region  || '';

  // ── Régimen / instrumento ──
  fields['REGIMEN PATRIMONIAL']         = formData.regimen_patrimonial || '';
  fields['SUBINSCRIPCIONES MATRIMONIO'] = formData.subinscripciones    || '';
  fields['DOCUMENTO FUNDANTE']          = representante.documento_fundante || '';
  fields['FECHA INSTRUMENTO']           = representante.fecha_doc      || '';
  fields['NOTARIO AUTORIZANTE']         = representante.autorizante    || '';

  // ── Solicitante ──
  const rutSol = formatRut(solicitante.rut);
  fields['RUT SOLICITANTE']                        = rutSol.numero;
  fields['VERIFICADOR RUT SOLICITANTE']            = rutSol.dv;
  fields['NOMBRE SOLICITANTE']                     = solicitante.nombres           || '';
  fields['PRIMER APELLIDO SOLICITANTE']            = solicitante.primer_apellido   || '';
  fields['SEGUNDO APELLIDO SOLICITANTE']           = solicitante.segundo_apellido  || '';
  fields['CALLE SOLICITANTE']                      = solicitante.calle             || '';
  fields['NUMERO CALLE SOLICITANTE']               = solicitante.numero_calle      || '';
  fields['LETRA DIRECCION SOLICITANTE']            = solicitante.letra             || '';
  fields['RESTO DEL DOMICILIO DEL SOLICITANTE']    = solicitante.resto_domicilio   || '';
  fields['COMUNA SOLICITANTE']                     = solicitante.comuna            || '';
  fields['REGION SOLICITANTE']                     = solicitante.region            || '';
  fields['MEDIO DE CONTACTO SOLICITANTE']          = solicitante.medio_contacto    || '';
  fields['CORREO ELECTRONICO SOLICITANTE']         = solicitante.correo            || '';
  fields['TELEFONO SOLICITANTE']                   = solicitante.telefono          || '';

  // ── Representante ──
  if (representante.rut) {
    const rutRep = formatRut(representante.rut);
    fields['RUT DEL REPRESENTANTE']           = rutRep.numero;
    fields['VERIFICADOR RUT REPRESENTANTE']   = rutRep.dv;
    fields['NOMBRES REPRESENTANTE']           = representante.nombres           || '';
    fields['PRIMER APELLIDO REPRESENTANTE']   = representante.primer_apellido   || '';
    fields['SEGUNDO APELLIDO REPRESENTANTE']  = representante.segundo_apellido  || '';
    fields['CALLE REPRESENTANTE']             = representante.calle             || '';
    fields['NUMERO DIRECCION REPRESENTANTE']  = representante.numero_calle      || '';
    fields['LETRA DIRECCION REPRESENTANTE']   = representante.letra             || '';
    fields['RESTO DOMICILIO REPRESENTANTE']   = representante.resto_domicilio   || '';
    fields['COMUNA DIRECCION REPRESENTANTE']  = representante.comuna            || '';
    fields['REGION DIRECCION REPRESENTANTE']  = representante.region            || '';
    fields['TIPO REPRESENTANTE']              = representante.tipo              || '';
    fields['CESIONARIO?']                     = representante.cesionario        || '';
    fields['CORREO ELECTRONICO REPRESENTANTE']= representante.correo            || '';
    fields['TELEFONO REPRESENTANTE']          = representante.telefono          || '';
  }

  // ── Herederos página 1 (índices 0-7 → fields .0 .1 ... .7) ──
  for (let i = 0; i < Math.min(8, herederos.length); i++) {
    const h = herederos[i];
    if (!h) continue;
    const rh = formatRut(h.rut);
    const idx = String(i);
    fields[`RUT HEREDERO.${idx}`]                          = `${rh.numero}-${rh.dv}`;
    fields[`NOMBRE Y APELLIDOS HEREDERO.${idx}`]           = [h.nombres, h.primer_apellido, h.segundo_apellido].filter(Boolean).join(' ');
    fields[`FECHA NACIMIENTO HEREDERO.${idx}`]             = formatDate(h.fecha_nacimiento);
    fields[`FECHA DEFUNCION HEREDERO.${idx}`]              = formatDate(h.fecha_defuncion);
    fields[`CALIDAD DE HEREDERO.${idx}`]                   = h.calidad || '';
    fields[`RUN REPRESENTACION/TRANSMISION HEREDERO.${idx}`] = h.run_representacion || '';
    fields[`DOMICILIO COMUNA Y REGION HEREDERO.${idx}`]    = [h.domicilio, h.comuna, h.region].filter(Boolean).join(' ');
  }

  // ── Herederos página 2 (índices 8-19 → fields .8.0 .8.1 ... .8.11) ──
  for (let i = 8; i < Math.min(20, herederos.length); i++) {
    const h = herederos[i];
    if (!h) continue;
    const rh = formatRut(h.rut);
    const idx = `8.${i - 8}`;
    fields[`RUT HEREDERO.${idx}`]                          = `${rh.numero}-${rh.dv}`;
    fields[`NOMBRE Y APELLIDOS HEREDERO.${idx}`]           = [h.nombres, h.primer_apellido, h.segundo_apellido].filter(Boolean).join(' ');
    fields[`FECHA NACIMIENTO HEREDERO.${idx}`]             = formatDate(h.fecha_nacimiento);
    fields[`FECHA DEFUNCION HEREDERO.${idx}`]              = formatDate(h.fecha_defuncion);
    fields[`CALIDAD DE HEREDERO.${idx}`]                   = h.calidad || '';
    fields[`RUN REPRESENTACION/TRANSMISION HEREDERO.${idx}`] = h.run_representacion || '';
    fields[`DOMICILIO COMUNA Y REGION HEREDERO.${idx}`]    = [h.domicilio, h.comuna, h.region].filter(Boolean).join(' ');
  }

  // ── Observaciones / Inventario general ──
  fields['OBSERVACIONES']                       = formData.observaciones || '';
  fields['NUMERO DE HOJAS DE INVENTARIO']       = String(formData.inventario_hojas || '1');
  fields['CON BENEFICIO DE INVENTARIO? SI/NO']  = formData.beneficio_inventario || '';
  fields['PRESUNCION 20%']                      = usaPresuncion ? '1' : '2';

  // ── Bienes Raíces (max 4 en formulario) ──
  let totalBR = 0;
  for (let i = 0; i < Math.min(4, bienesRaices.length); i++) {
    const br = bienesRaices[i];
    if (!br) continue;
    const val = parseInt(br.valoracion || 0, 10) || 0;
    const exc = parseInt(br.exencion   || 0, 10) || 0;
    totalBR += val;
    fields[`ROL SII.${i}`]           = br.rol_sii          || '';
    fields[`TIPO DE BIEN N/A.${i}`]  = br.tipo             || '';
    fields[`COMUNA.${i}`]            = br.comuna           || '';
    fields[`FECHA ADQUISICION.${i}`] = br.fecha_adquisicion|| '';
    fields[`FOJAS.${i}`]             = br.fojas            || '';
    fields[`NUMERO.${i}`]            = br.numero_cbr       || '';
    fields[`AÑO.${i}`]              = br.ano_cbr          || '';
    fields[`CONSERVADOR.${i}`]       = br.conservador      || '';
    fields[`P/S.${i}`]              = br.ps               || 'P';
    fields[`VALOR ACTIVO 1.${i}`]   = formatMoney(val);
    fields[`EXENCION ACTIVO 1.${i}`]= formatMoney(exc);
  }
  for (let i = 4; i < bienesRaices.length; i++) {
    const br = bienesRaices[i];
    if (br) totalBR += parseInt(br.valoracion || 0, 10) || 0;
  }
  fields['TOTAL BIENES RAICES'] = formatMoney(totalBR);

  // ── Vehículos (max 4) ──
  let totalVeh = 0;
  for (let i = 0; i < Math.min(4, vehiculos.length); i++) {
    const v = vehiculos[i];
    if (!v) continue;
    const val = parseInt(v.valoracion || 0, 10) || 0;
    totalVeh += val;
    fields[`PPU.${i}`]                        = v.ppu              || '';
    fields[`CODIGO SII.${i}`]                 = v.codigo_sii       || '';
    fields[`TIPO.${i}`]                       = v.tipo             || '';
    fields[`MARCA.${i}`]                      = v.marca            || '';
    fields[`MODELO.${i}`]                     = v.modelo           || '';
    fields[`AÑO AUTO.${i}`]                  = v.ano              || '';
    fields[`NUMERO IDENTIFICACION CHASIS.${i}`] = v.n_identificacion || '';
    fields[`P/S VEHICULO.${i}`]              = v.ps               || 'P';
    fields[`VALOR AUTO.${i}`]               = formatMoney(val);
  }
  for (let i = 4; i < vehiculos.length; i++) {
    const v = vehiculos[i];
    if (v) totalVeh += parseInt(v.valoracion || 0, 10) || 0;
  }
  fields['TOTAL AUTOS'] = formatMoney(totalVeh);

  // ── Menaje ──
  let totalMenaje = 0;
  if (usaPresuncion && bienesRaices.length > 0) {
    const primerBRVal = parseInt(bienesRaices[0].valoracion || 0, 10) || 0;
    totalMenaje = Math.round(primerBRVal * 0.20);
    fields['DESCRIPCION DEL BIEN MENAJE.0'] = 'Presunción 20% bien raíz';
    fields['PROPIO O SOCIAL.0']             = 'P';
    fields['VALOR MENAJE.0']               = formatMoney(totalMenaje);
  } else {
    // Field indices available in the form for menaje
    const menIndices = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11];
    for (let i = 0; i < Math.min(menIndices.length, menaje.length); i++) {
      const m  = menaje[i];
      const mi = menIndices[i];
      if (!m) continue;
      const val = parseInt(m.valoracion || 0, 10) || 0;
      totalMenaje += val;
      fields[`DESCRIPCION DEL BIEN MENAJE.${mi}`] = m.descripcion || '';
      fields[`PROPIO O SOCIAL.${mi}`]             = m.ps          || 'P';
      fields[`VALOR MENAJE.${mi}`]               = formatMoney(val);
    }
    for (let i = menIndices.length; i < menaje.length; i++) {
      const m = menaje[i];
      if (m) totalMenaje += parseInt(m.valoracion || 0, 10) || 0;
    }
  }
  fields['TOTAL MENAJE'] = formatMoney(totalMenaje);

  // ── Otros Muebles / Negocios Derechos (C2, max 4) ──
  let totalOM = 0;
  for (let i = 0; i < Math.min(4, otrosMuebles.length); i++) {
    const om = otrosMuebles[i];
    if (!om) continue;
    const val = parseInt(om.valoracion || 0, 10) || 0;
    totalOM += val;
    fields[`NEGOCIOS DERECHOS DESCRIPCION`]       = fields['NEGOCIOS DERECHOS DESCRIPCION'] || om.descripcion || '';
    fields[`NEGOCIOS DERECHOS P/S`]               = fields['NEGOCIOS DERECHOS P/S']         || om.ps          || 'P';
    fields[`NEGOCIOS DERECHOS VALOR${i + 1}`]     = formatMoney(val);
  }
  for (let i = 4; i < otrosMuebles.length; i++) {
    const om = otrosMuebles[i];
    if (om) totalOM += parseInt(om.valoracion || 0, 10) || 0;
  }
  fields['TOTAL DERECHOS'] = formatMoney(totalOM);

  // ── Otros Bienes / Otros Activos (C3, max 4) ──
  let totalOB = 0;
  for (let i = 0; i < Math.min(4, otrosBienes.length); i++) {
    const ob = otrosBienes[i];
    if (!ob) continue;
    const val = parseInt(ob.valoracion || 0, 10) || 0;
    totalOB += val;
    fields[`OTROS ACTIVOS DESCRIPCION`]         = fields['OTROS ACTIVOS DESCRIPCION']       || ob.descripcion || '';
    fields[`OTROS ACTIVOS P/S`]                 = fields['OTROS ACTIVOS P/S']               || ob.ps          || 'P';
    fields[`OTROS ACTIVOS VALOR${i + 1}`]       = formatMoney(val);
  }
  for (let i = 4; i < otrosBienes.length; i++) {
    const ob = otrosBienes[i];
    if (ob) totalOB += parseInt(ob.valoracion || 0, 10) || 0;
  }
  fields['TOTAL OTROS ACTIVOS'] = formatMoney(totalOB);

  // ── Pasivos (max 4) ──
  let totalPas = 0;
  for (let i = 0; i < Math.min(4, pasivos.length); i++) {
    const p = pasivos[i];
    if (!p) continue;
    const val = parseInt(p.valoracion || 0, 10) || 0;
    totalPas += val;
    if (i === 0) {
      fields['DESCRIPCION DEUDAS']   = p.descripcion || '';
      fields['ACREEDOR DEUDA']       = p.acreedor    || '';
      fields['CERTIFICADO DEUDA']    = p.n_documento || '';
    }
    fields[`VALOR DEUDA${i + 1}`] = formatMoney(val);
  }
  for (let i = 4; i < pasivos.length; i++) {
    const p = pasivos[i];
    if (p) totalPas += parseInt(p.valoracion || 0, 10) || 0;
  }
  fields['TOTAL PASIVOS'] = formatMoney(totalPas);

  // ── Totales finales ──
  const totalActivos      = totalBR + totalVeh + totalMenaje + totalOM + totalOB;
  const masaHereditaria   = totalActivos - totalPas;
  fields['TOTAL FINAL ACTIVOS']     = formatMoney(totalActivos);
  fields['TOTAL MASA HEREDITARIA']  = formatMoney(masaHereditaria);

  // Nombre completo causante
  fields['NOMBRE COMPLETO DEL CAUSANTE'] = [causante.nombres, causante.primer_apellido, causante.segundo_apellido]
    .filter(Boolean).join(' ');

  fields['VALOR UTM'] = formData.valor_utm || '';

  return fields;
}

// ─── Annex page builder (pure pdf-lib) ──────────────────────────────────────────

async function buildAnnexPage(formData) {
  const bienesRaices  = formData.bienes_raices  || [];
  const vehiculos     = formData.vehiculos       || [];
  const menaje        = formData.menaje          || [];
  const otrosMuebles  = formData.otros_muebles   || [];
  const otrosBienes   = formData.otros_bienes    || [];
  const pasivos       = formData.pasivos         || [];
  const usaPresuncion = formData.presuncion_20 === '1' || formData.presuncion_20 === true;

  const needsAnnex = (
    bienesRaices.length > 4 ||
    vehiculos.length    > 4 ||
    (!usaPresuncion && menaje.length > 11) ||
    otrosMuebles.length > 4 ||
    otrosBienes.length  > 4 ||
    pasivos.length      > 4
  );

  if (!needsAnnex) return null;

  const pdfDoc = await PDFDocument.create();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 841.89; // A4 landscape
  const PAGE_H = 595.28;
  const MARGIN = 50;
  const LINE_H = 14;

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 50;

  function ensureLine(count = 1) {
    if (y - LINE_H * count < MARGIN) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 50;
    }
  }

  function drawText(text, x, size, bold = false) {
    page.drawText(String(text || '').slice(0, 140), {
      x, y, size,
      font: bold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
  }

  // Title
  drawText('ANEXO - CONTINUACIÓN INVENTARIO POSESIÓN EFECTIVA', MARGIN, 13, true);
  y -= 20;

  const causante = formData.causante || {};
  const nombreCau = [causante.nombres, causante.primer_apellido, causante.segundo_apellido].filter(Boolean).join(' ');
  drawText(`Causante: ${nombreCau}`, MARGIN, 10);
  y -= 22;

  function sectionHeader(title) {
    ensureLine(2);
    y -= 6;
    page.drawRectangle({ x: MARGIN - 2, y: y - 2, width: PAGE_W - MARGIN * 2, height: LINE_H + 4, color: rgb(0.85, 0.88, 0.95) });
    drawText(title, MARGIN, 10, true);
    y -= LINE_H + 4;
  }

  function drawLine(text) {
    ensureLine();
    drawText(text, MARGIN + 10, 9);
    y -= LINE_H;
  }

  // Bienes Raíces adicionales
  if (bienesRaices.length > 4) {
    sectionHeader('A1. BIENES RAÍCES (continuación desde N°5)');
    for (let i = 4; i < bienesRaices.length; i++) {
      const br = bienesRaices[i];
      if (!br) continue;
      drawLine(`${i + 1}. Tipo: ${br.tipo || ''} | ROL: ${br.rol_sii || ''} | ${br.comuna || ''} | P/S: ${br.ps || 'P'} | Valor: $${formatMoney(br.valoracion)} | Exención: $${formatMoney(br.exencion || 0)}`);
    }
  }

  // Vehículos adicionales
  if (vehiculos.length > 4) {
    sectionHeader('B1. VEHÍCULOS (continuación desde N°5)');
    for (let i = 4; i < vehiculos.length; i++) {
      const v = vehiculos[i];
      if (!v) continue;
      drawLine(`${i + 1}. PPU: ${v.ppu || ''} | ${v.marca || ''} ${v.modelo || ''} ${v.ano || ''} | P/S: ${v.ps || 'P'} | Valor: $${formatMoney(v.valoracion)}`);
    }
  }

  // Menaje adicional
  if (!usaPresuncion && menaje.length > 11) {
    sectionHeader('B2. MENAJE (continuación desde N°12)');
    for (let i = 11; i < menaje.length; i++) {
      const m = menaje[i];
      if (!m) continue;
      drawLine(`${i + 1}. ${m.descripcion || ''} | P/S: ${m.ps || 'P'} | Valor: $${formatMoney(m.valoracion)}`);
    }
  }

  // Otros Muebles adicionales
  if (otrosMuebles.length > 4) {
    sectionHeader('C2. OTROS BIENES MUEBLES (continuación desde N°5)');
    for (let i = 4; i < otrosMuebles.length; i++) {
      const om = otrosMuebles[i];
      if (!om) continue;
      drawLine(`${i + 1}. ${om.descripcion || ''} | P/S: ${om.ps || 'P'} | Valor: $${formatMoney(om.valoracion)}`);
    }
  }

  // Otros Bienes adicionales
  if (otrosBienes.length > 4) {
    sectionHeader('C3. OTROS BIENES/ACCIONES (continuación desde N°5)');
    for (let i = 4; i < otrosBienes.length; i++) {
      const ob = otrosBienes[i];
      if (!ob) continue;
      drawLine(`${i + 1}. ${ob.descripcion || ''} | ${ob.institucion || ''} | P/S: ${ob.ps || 'P'} | Valor: $${formatMoney(ob.valoracion)}`);
    }
  }

  // Pasivos adicionales
  if (pasivos.length > 4) {
    sectionHeader('2. PASIVOS (continuación desde N°5)');
    for (let i = 4; i < pasivos.length; i++) {
      const p = pasivos[i];
      if (!p) continue;
      drawLine(`${i + 1}. ${p.descripcion || ''} | Acreedor: ${p.acreedor || ''} | Doc: ${p.n_documento || ''} | Valor: $${formatMoney(p.valoracion)}`);
    }
  }

  return await pdfDoc.save();
}

// ─── Main fill function ─────────────────────────────────────────────────────────

async function fillPDF(templatePath, formData) {
  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const form   = pdfDoc.getForm();

  const fieldValues = buildFieldValues(formData);

  for (const [name, value] of Object.entries(fieldValues)) {
    if (value === undefined || value === null) continue;
    try {
      const field = form.getField(name);
      const str   = String(value);
      if (field.constructor.name === 'PDFCheckBox') {
        if (str === '1' || str.toLowerCase() === 'true' || str.toLowerCase() === 'si') {
          field.check();
        }
      } else {
        field.setText(str);
      }
    } catch (_) {
      // Field not found in this template – skip silently
    }
  }

  form.flatten(); // make fields read-only in output (optional – remove if editable PDF desired)

  let mainBytes = await pdfDoc.save();

  // Annex
  const annexBytes = await buildAnnexPage(formData);
  if (annexBytes) {
    const merged  = await PDFDocument.create();
    const mainDoc = await PDFDocument.load(mainBytes);
    const annexDoc= await PDFDocument.load(annexBytes);

    const mainPages  = await merged.copyPages(mainDoc,  mainDoc.getPageIndices());
    const annexPages = await merged.copyPages(annexDoc, annexDoc.getPageIndices());

    mainPages.forEach(p  => merged.addPage(p));
    annexPages.forEach(p => merged.addPage(p));

    mainBytes = await merged.save();
  }

  return Buffer.from(mainBytes);
}

module.exports = { fillPDF };

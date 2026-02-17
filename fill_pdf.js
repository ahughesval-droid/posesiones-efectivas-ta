'use strict';

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs   = require('fs');
const path = require('path');

// ─── Formatters ────────────────────────────────────────────────────────────────

function formatMoney(value) {
  if (value === undefined || value === null || value === '') return '';
  const num = parseInt(value, 10);
  if (isNaN(num)) return String(value);
  return num.toLocaleString('de-DE');
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

// CORRECCIÓN 3: calidad abreviada → nombre completo
const CALIDAD_MAP = {
  'C':'Cónyuge/Conv.Civil','H':'Hijo(a)','N':'Nieto(a)','P':'Padre/Madre',
  'A':'Abuelo(a)','HE':'Hermano(a)','S':'Sobrino(a)','T':'Tío(a)','PR':'Primo(a)','O':'Otro',
  'Hijo':'Hijo(a)','Hija':'Hijo(a)','Cónyuge':'Cónyuge/Conv.Civil',
  'Padre':'Padre/Madre','Madre':'Padre/Madre','Abuelo':'Abuelo(a)','Abuela':'Abuelo(a)',
  'Hermano':'Hermano(a)','Hermana':'Hermano(a)','Nieto':'Nieto(a)','Nieta':'Nieto(a)',
  'Sobrino':'Sobrino(a)','Sobrina':'Sobrino(a)',
};
function expandCalidad(raw) {
  if (!raw) return '';
  return CALIDAD_MAP[raw.trim()] || CALIDAD_MAP[raw.trim().toUpperCase()] || raw;
}

// ─── Field mapper ───────────────────────────────────────────────────────────────

function buildFieldValues(formData) {
  const fields    = {};
  const checkboxes = {};

  const causante      = formData.causante        || {};
  const solicitante   = formData.solicitante     || {};
  const representante = formData.representante   || {};
  const partida       = formData.partida         || {};
  const domicilioCau  = formData.domicilio_causante || {};
  const herederos     = formData.herederos       || [];
  const bienesRaices  = formData.bienes_raices   || [];
  const vehiculos     = formData.vehiculos       || [];
  const menaje        = formData.menaje          || [];
  const otrosMuebles  = formData.otros_muebles   || [];
  const otrosBienes   = formData.otros_bienes    || [];
  const pasivos       = formData.pasivos         || [];
  const usaPresuncion = formData.presuncion_20 === '1' || formData.presuncion_20 === true;

  // ── Causante ──
  const rutCau = formatRut(causante.rut);
  fields['RUT CAUSANTE']                = rutCau.numero;
  fields['VERIFICADOR RUT']             = rutCau.dv;
  fields['NOMBRE CAUSANTE']             = causante.nombres || '';
  fields['PRIMER APELLIDO CAUSANTE']    = causante.primer_apellido || '';
  fields['SEGUNDO APELLIDO CAUSANTE']   = causante.segundo_apellido || '';

  if (causante.fecha_nacimiento) {
    const [y, m, d] = causante.fecha_nacimiento.split('-');
    fields['DIA NACIMIENTO CAUSANTE'] = d || '';
    fields['MES NACIMIENTO CAUSANTE'] = m || '';
    fields['AÑO NACIMIENTO CAUSANTE'] = y || '';
  }
  if (causante.fecha_defuncion) {
    const [y, m, d] = causante.fecha_defuncion.split('-');
    fields['DIA DEFUNCION CAUSANTE'] = d || '';
    fields['MES DEFUNCION']          = m || '';
    fields['AÑO DEFUNCION CAUSANTE'] = y || '';
  }

  fields['ESTADO CIVIL']                            = causante.estado_civil || '';
  fields['NACIONALIDAD']                            = causante.nacionalidad || '';
  fields['ACTIVIDAD/PROFESION/OFICIO DEL CAUSANTE'] = causante.actividad   || '';

  // ── Partida defunción ──
  fields['CIRCUNSCRIPCION DEFUNCION']  = partida.circunscripcion || '';
  fields['TIPO DE REGISTRO DEFUNCION'] = partida.tipo_registro   || '';
  fields['AÑO DEFUNCION']             = partida.ano             || '';
  fields['N° INSCRIPCION DEFUNCION']  = partida.n_inscripcion   || '';
  fields['LUGAR DEFUNCION CAUSANTE']   = partida.lugar_defuncion || '';

  // ── Domicilio causante ──
  fields['CALLE ULTIMO DOMICILIO']                 = domicilioCau.calle  || '';
  fields['NUMERO ULTIMO DOMICILIO']                = domicilioCau.numero || '';
  fields['LETRA DE LA CALLE DEL ULTIMO DOMICILIO'] = domicilioCau.letra  || '';
  fields['RESTO ULTIMO DOMICILIO CAUSANTE']         = domicilioCau.resto  || '';
  fields['COMUNA ULTIMO DOMICILIO CAUSANTE']        = domicilioCau.comuna || '';
  fields['REGION ULTIMO DOMICILIO CAUSANTE']        = domicilioCau.region || '';

  // ── Régimen / instrumento ──
  fields['REGIMEN PATRIMONIAL']         = formData.regimen_patrimonial || '';
  fields['SUBINSCRIPCIONES MATRIMONIO'] = formData.subinscripciones    || '';
  fields['DOCUMENTO FUNDANTE']          = representante.documento_fundante || '';
  fields['FECHA INSTRUMENTO']           = representante.fecha_doc      || '';
  fields['NOTARIO AUTORIZANTE']         = representante.autorizante    || '';

  // ── Solicitante ──
  const rutSol = formatRut(solicitante.rut);
  fields['RUT SOLICITANTE']                     = rutSol.numero;
  fields['VERIFICADOR RUT SOLICITANTE']         = rutSol.dv;
  fields['NOMBRE SOLICITANTE']                  = solicitante.nombres          || '';
  fields['PRIMER APELLIDO SOLICITANTE']         = solicitante.primer_apellido  || '';
  fields['SEGUNDO APELLIDO SOLICITANTE']        = solicitante.segundo_apellido || '';
  fields['CALLE SOLICITANTE']                   = solicitante.calle            || '';
  fields['NUMERO CALLE SOLICITANTE']            = solicitante.numero_calle     || '';
  fields['LETRA DIRECCION SOLICITANTE']         = solicitante.letra            || '';
  fields['RESTO DEL DOMICILIO DEL SOLICITANTE'] = solicitante.resto_domicilio  || '';
  fields['COMUNA SOLICITANTE']                  = solicitante.comuna           || '';
  fields['REGION SOLICITANTE']                  = solicitante.region           || '';
  fields['MEDIO DE CONTACTO SOLICITANTE']       = solicitante.medio_contacto   || '';
  fields['CORREO ELECTRONICO SOLICITANTE']      = solicitante.correo           || '';
  fields['TELEFONO SOLICITANTE']                = solicitante.telefono         || '';

  // CORRECCIÓN 1: Nacionalidad solicitante → RUN (chileno) o RUT (extranjero)
  const nacSol = String(solicitante.nacionalidad || '1');
  checkboxes['RUN'] = nacSol === '1';
  checkboxes['RUT'] = nacSol === '2';

  // ── Representante ──
  if (representante.rut) {
    const rutRep = formatRut(representante.rut);
    fields['RUT DEL REPRESENTANTE']            = rutRep.numero;
    fields['VERIFICADOR RUT REPRESENTANTE']    = rutRep.dv;
    fields['NOMBRES REPRESENTANTE']            = representante.nombres           || '';
    fields['PRIMER APELLIDO REPRESENTANTE']    = representante.primer_apellido   || '';
    fields['SEGUNDO APELLIDO REPRESENTANTE']   = representante.segundo_apellido  || '';
    fields['CALLE REPRESENTANTE']              = representante.calle             || '';
    fields['NUMERO DIRECCION REPRESENTANTE']   = representante.numero_calle      || '';
    fields['LETRA DIRECCION REPRESENTANTE']    = representante.letra             || '';
    fields['RESTO DOMICILIO REPRESENTANTE']    = representante.resto_domicilio   || '';
    fields['COMUNA DIRECCION REPRESENTANTE']   = representante.comuna            || '';
    fields['REGION DIRECCION REPRESENTANTE']   = representante.region            || '';
    fields['TIPO REPRESENTANTE']               = representante.tipo              || '';
    fields['CESIONARIO?']                      = representante.cesionario        || '';
    fields['CORREO ELECTRONICO REPRESENTANTE'] = representante.correo            || '';
    fields['TELEFONO REPRESENTANTE']           = representante.telefono          || '';

    // CORRECCIÓN 2: RUN/RUT representante
    const nacRep = String(representante.nacionalidad || '1');
    checkboxes['RUN REPRESENTANTE'] = nacRep === '1';
    checkboxes['RUT REPRESENTANTE'] = nacRep === '2';
  }

  // ── Herederos página 1 (0-7) ──
  for (let i = 0; i < Math.min(8, herederos.length); i++) {
    const h   = herederos[i];
    if (!h) continue;
    const rh  = formatRut(h.rut);
    const idx = String(i);
    fields[`RUT HEREDERO.${idx}`]                            = `${rh.numero}-${rh.dv}`;
    fields[`NOMBRE Y APELLIDOS HEREDERO.${idx}`]             = [h.nombres, h.primer_apellido, h.segundo_apellido].filter(Boolean).join(' ');
    fields[`FECHA NACIMIENTO HEREDERO.${idx}`]               = formatDate(h.fecha_nacimiento);
    fields[`FECHA DEFUNCION HEREDERO.${idx}`]                = formatDate(h.fecha_defuncion);
    fields[`CALIDAD DE HEREDERO.${idx}`]                     = expandCalidad(h.calidad); // CORRECCIÓN 3
    fields[`RUN REPRESENTACION/TRANSMISION HEREDERO.${idx}`] = h.run_representacion || '';
    fields[`DOMICILIO COMUNA Y REGION HEREDERO.${idx}`]      = [h.domicilio, h.comuna, h.region].filter(Boolean).join(' ');
    // CORRECCIÓN 4: cedente checkbox
    const ced = String(h.cedente || '').toUpperCase();
    checkboxes[`CEDENTE SI/NO.${idx}`] = ced === 'S' || ced === 'SI' || ced === '1';
  }

  // ── Herederos página 2 (8-19) ──
  for (let i = 8; i < Math.min(20, herederos.length); i++) {
    const h   = herederos[i];
    if (!h) continue;
    const rh  = formatRut(h.rut);
    const idx = `8.${i - 8}`;
    fields[`RUT HEREDERO.${idx}`]                            = `${rh.numero}-${rh.dv}`;
    fields[`NOMBRE Y APELLIDOS HEREDERO.${idx}`]             = [h.nombres, h.primer_apellido, h.segundo_apellido].filter(Boolean).join(' ');
    fields[`FECHA NACIMIENTO HEREDERO.${idx}`]               = formatDate(h.fecha_nacimiento);
    fields[`FECHA DEFUNCION HEREDERO.${idx}`]                = formatDate(h.fecha_defuncion);
    fields[`CALIDAD DE HEREDERO.${idx}`]                     = expandCalidad(h.calidad); // CORRECCIÓN 3
    fields[`RUN REPRESENTACION/TRANSMISION HEREDERO.${idx}`] = h.run_representacion || '';
    fields[`DOMICILIO COMUNA Y REGION HEREDERO.${idx}`]      = [h.domicilio, h.comuna, h.region].filter(Boolean).join(' ');
    // CORRECCIÓN 4
    const ced = String(h.cedente || '').toUpperCase();
    checkboxes[`CEDENTE SI/NO.${idx}`] = ced === 'S' || ced === 'SI' || ced === '1';
  }

  // ── Inventario general ──
  fields['OBSERVACIONES']                      = formData.observaciones || '';
  fields['NUMERO DE HOJAS DE INVENTARIO']      = String(formData.inventario_hojas || '1');
  fields['CON BENEFICIO DE INVENTARIO? SI/NO'] = formData.beneficio_inventario || '';
  fields['PRESUNCION 20%']                     = usaPresuncion ? '1' : '2';

  // CORRECCIÓN 5: declaración impuesto → checkboxes 104/105/106
  const decImp = String(formData.declaracion_impuesto || 'exentas').toLowerCase();
  checkboxes['Check Box104'] = decImp === 'exentas';
  checkboxes['Check Box105'] = decImp === 'afectas_algunas';
  checkboxes['Check Box106'] = decImp === 'afectas_todas';

  // ── Bienes Raíces (max 4 por hoja) ──
  let totalBR = 0;
  for (let i = 0; i < Math.min(4, bienesRaices.length); i++) {
    const br  = bienesRaices[i]; if (!br) continue;
    const val = parseInt(br.valoracion || 0, 10) || 0;
    const exc = parseInt(br.exencion   || 0, 10) || 0;
    totalBR += val;
    fields[`ROL SII.${i}`]            = br.rol_sii           || '';
    fields[`TIPO DE BIEN N/A.${i}`]   = br.tipo              || '';
    fields[`COMUNA.${i}`]             = br.comuna            || '';
    fields[`FECHA ADQUISICION.${i}`]  = formatDate(br.fecha_adquisicion);
    fields[`FOJAS.${i}`]              = br.fojas             || '';
    fields[`NUMERO.${i}`]             = br.numero_cbr        || '';
    fields[`AÑO.${i}`]              = br.ano_cbr           || '';
    fields[`CONSERVADOR.${i}`]        = br.conservador       || '';
    fields[`P/S.${i}`]              = br.ps                || 'P';
    fields[`VALOR ACTIVO 1.${i}`]   = formatMoney(val);
    fields[`EXENCION ACTIVO 1.${i}`] = formatMoney(exc);
  }
  for (let i = 4; i < bienesRaices.length; i++) {
    if (bienesRaices[i]) totalBR += parseInt(bienesRaices[i].valoracion || 0, 10) || 0;
  }
  fields['TOTAL BIENES RAICES'] = formatMoney(totalBR);

  // ── Vehículos (max 4) ──
  let totalVeh = 0;
  for (let i = 0; i < Math.min(4, vehiculos.length); i++) {
    const v   = vehiculos[i]; if (!v) continue;
    const val = parseInt(v.valoracion || 0, 10) || 0;
    totalVeh += val;
    fields[`PPU.${i}`]                          = v.ppu              || '';
    fields[`CODIGO SII.${i}`]                   = v.codigo_sii       || '';
    fields[`TIPO.${i}`]                         = v.tipo             || '';
    fields[`MARCA.${i}`]                        = v.marca            || '';
    fields[`MODELO.${i}`]                       = v.modelo           || '';
    fields[`AÑO AUTO.${i}`]                    = v.ano              || '';
    fields[`NUMERO IDENTIFICACION CHASIS.${i}`] = v.n_identificacion || '';
    fields[`P/S VEHICULO.${i}`]               = v.ps               || 'P';
    fields[`VALOR AUTO.${i}`]                = formatMoney(val);
  }
  for (let i = 4; i < vehiculos.length; i++) {
    if (vehiculos[i]) totalVeh += parseInt(vehiculos[i].valoracion || 0, 10) || 0;
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
    const menIndices = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11];
    for (let i = 0; i < Math.min(menIndices.length, menaje.length); i++) {
      const m = menaje[i]; const mi = menIndices[i]; if (!m) continue;
      const val = parseInt(m.valoracion || 0, 10) || 0;
      totalMenaje += val;
      fields[`DESCRIPCION DEL BIEN MENAJE.${mi}`] = m.descripcion || '';
      fields[`PROPIO O SOCIAL.${mi}`]             = m.ps          || 'P';
      fields[`VALOR MENAJE.${mi}`]               = formatMoney(val);
    }
    for (let i = menIndices.length; i < menaje.length; i++) {
      if (menaje[i]) totalMenaje += parseInt(menaje[i].valoracion || 0, 10) || 0;
    }
  }
  fields['TOTAL MENAJE'] = formatMoney(totalMenaje);

  // ── Otros Muebles (C2, max 4) ──
  let totalOM = 0;
  for (let i = 0; i < Math.min(4, otrosMuebles.length); i++) {
    const om = otrosMuebles[i]; if (!om) continue;
    const val = parseInt(om.valoracion || 0, 10) || 0;
    totalOM += val;
    if (i === 0) { fields['NEGOCIOS DERECHOS DESCRIPCION'] = om.descripcion || ''; fields['NEGOCIOS DERECHOS P/S'] = om.ps || 'P'; }
    fields[`NEGOCIOS DERECHOS VALOR${i + 1}`] = formatMoney(val);
  }
  for (let i = 4; i < otrosMuebles.length; i++) {
    if (otrosMuebles[i]) totalOM += parseInt(otrosMuebles[i].valoracion || 0, 10) || 0;
  }
  fields['TOTAL DERECHOS'] = formatMoney(totalOM);

  // ── Otros Bienes (C3, max 4) ──
  let totalOB = 0;
  for (let i = 0; i < Math.min(4, otrosBienes.length); i++) {
    const ob = otrosBienes[i]; if (!ob) continue;
    const val = parseInt(ob.valoracion || 0, 10) || 0;
    totalOB += val;
    if (i === 0) { fields['OTROS ACTIVOS DESCRIPCION'] = ob.descripcion || ''; fields['OTROS ACTIVOS P/S'] = ob.ps || 'P'; }
    fields[`OTROS ACTIVOS VALOR${i + 1}`] = formatMoney(val);
  }
  for (let i = 4; i < otrosBienes.length; i++) {
    if (otrosBienes[i]) totalOB += parseInt(otrosBienes[i].valoracion || 0, 10) || 0;
  }
  fields['TOTAL OTROS ACTIVOS'] = formatMoney(totalOB);

  // ── Pasivos (max 4) ──
  let totalPas = 0;
  for (let i = 0; i < Math.min(4, pasivos.length); i++) {
    const p = pasivos[i]; if (!p) continue;
    const val = parseInt(p.valoracion || 0, 10) || 0;
    totalPas += val;
    if (i === 0) { fields['DESCRIPCION DEUDAS'] = p.descripcion || ''; fields['ACREEDOR DEUDA'] = p.acreedor || ''; fields['CERTIFICADO DEUDA'] = p.n_documento || ''; }
    fields[`VALOR DEUDA${i + 1}`] = formatMoney(val);
  }
  for (let i = 4; i < pasivos.length; i++) {
    if (pasivos[i]) totalPas += parseInt(pasivos[i].valoracion || 0, 10) || 0;
  }
  fields['TOTAL PASIVOS'] = formatMoney(totalPas);

  // ── Totales finales ──
  const totalActivos    = totalBR + totalVeh + totalMenaje + totalOM + totalOB;
  const masaHereditaria = totalActivos - totalPas;
  fields['TOTAL FINAL ACTIVOS']    = formatMoney(totalActivos);
  fields['TOTAL MASA HEREDITARIA'] = formatMoney(masaHereditaria);
  fields['NOMBRE COMPLETO DEL CAUSANTE'] = [causante.nombres, causante.primer_apellido, causante.segundo_apellido].filter(Boolean).join(' ');
  fields['VALOR UTM'] = formData.valor_utm || '';

  return { fields, checkboxes };
}

// ─── CORRECCIÓN 6: Copiar página 3 del formulario N-1 veces adicionales ────────

async function appendInventoryPages(templatePath, pdfDoc, formData) {
  const hojas      = parseInt(formData.inventario_hojas || '1', 10) || 1;
  const extraHojas = hojas - 1;
  if (extraHojas <= 0) return;

  // Cargamos el template original limpio para copiar la página 3 (índice 2)
  const templateBytes = fs.readFileSync(templatePath);
  const templateDoc   = await PDFDocument.load(templateBytes, { ignoreEncryption: true });

  for (let h = 0; h < extraHojas; h++) {
    const [copiedPage] = await pdfDoc.copyPages(templateDoc, [2]); // página 3 = inventario
    pdfDoc.addPage(copiedPage);
  }
}

// ─── Main fill function ─────────────────────────────────────────────────────────

async function fillPDF(templatePath, formData) {
  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const form   = pdfDoc.getForm();

  const { fields, checkboxes } = buildFieldValues(formData);

  // Rellenar campos de texto
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    try { form.getField(name).setText(String(value)); } catch (_) {}
  }

  // Rellenar checkboxes
  for (const [name, shouldCheck] of Object.entries(checkboxes)) {
    try {
      const cb = form.getCheckBox(name);
      if (shouldCheck) cb.check(); else cb.uncheck();
    } catch (_) {}
  }

  // CORRECCIÓN 6: agregar hojas de inventario adicionales
  await appendInventoryPages(templatePath, pdfDoc, formData);

  pdfDoc.getForm().flatten();
  return Buffer.from(await pdfDoc.save());
}

module.exports = { fillPDF };

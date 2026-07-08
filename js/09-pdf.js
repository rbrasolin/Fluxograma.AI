/* =========================================================
   09-pdf.js  |  Gerador de Fluxograma
   Coleta de dados de análise + geração do PDF (desenharTabelaPDF)
   (linhas 5754-6318 do script.js original - corte contiguo, sem alteracao de codigo)
   ========================================================= */
function coletarDadosAnaliseEstruturados(filtroArea = "") {
  if (!fluxoData || fluxoData.length === 0) return null;

  let etapas = obterEtapasDaTabela();
  if (!etapas.length) return null;

  if (filtroArea) {
    etapas = etapas.filter(e => (limpar(e.area || "") || "Sem Área") === filtroArea);
    if (!etapas.length) return null;
  }

  etapas.sort((a, b) => a.ordem - b.ordem);

  const etapaPorId = {};
  etapas.forEach(e => {
    etapaPorId[e.id] = e;
  });

  let tempoTotal = 0;
  let loops = 0;
  let decisoes = 0;
  let conexoesExtrasCount = 0;

  const etapasImpactadasRetrabalho = new Set();
  const tiposTempo = {};
  const sistemasTempo = {};

  etapas.forEach((etapa) => {
    tempoTotal += etapa.tempo;

    if (ehDecisao(etapa)) decisoes++;

    if (!tiposTempo[etapa.tipo]) tiposTempo[etapa.tipo] = 0;
    tiposTempo[etapa.tipo] += etapa.tempo;

    if (!sistemasTempo[etapa.sistema]) sistemasTempo[etapa.sistema] = 0;
    sistemasTempo[etapa.sistema] += etapa.tempo;

    const destinosSim = quebrarListaIds(etapa.proxSim);
    const destinosNao = quebrarListaIds(etapa.proxNao);
    const destinosExtras = quebrarListaIds(etapa.conexoesExtras);

    destinosSim.forEach((destinoId) => {
      const destino = etapaPorId[destinoId];
      if (destino && destino.ordem < etapa.ordem) {
        loops++;
        adicionarEtapasImpactadasPorRetorno(etapa.id, destinoId, etapaPorId, etapas, etapasImpactadasRetrabalho);
      }
    });

    destinosNao.forEach((destinoId) => {
      const destino = etapaPorId[destinoId];
      if (destino && destino.ordem < etapa.ordem) {
        loops++;
        adicionarEtapasImpactadasPorRetorno(etapa.id, destinoId, etapaPorId, etapas, etapasImpactadasRetrabalho);
      }
    });

    conexoesExtrasCount += destinosExtras.length;

    destinosExtras.forEach((destinoId) => {
      const destino = etapaPorId[destinoId];
      if (destino && destino.ordem < etapa.ordem) {
        loops++;
        adicionarEtapasImpactadasPorRetorno(etapa.id, destinoId, etapaPorId, etapas, etapasImpactadasRetrabalho);
      }
    });
  });

  let tempoPotencialRetrabalho = 0;
  etapas.forEach((etapa) => {
    if (etapasImpactadasRetrabalho.has(etapa.id)) {
      tempoPotencialRetrabalho += etapa.tempo;
    }
  });

  const impactoPotencialRetrabalho = tempoTotal
    ? (tempoPotencialRetrabalho / tempoTotal) * 100
    : 0;

  const taxaDecisao = etapas.length
    ? (decisoes / etapas.length) * 100
    : 0;

  const top3Gargalos = [...etapas]
    .sort((a, b) => b.tempo - a.tempo)
    .slice(0, 3)
    .map((e) => ({
      atividade: e.atividade,
      tempo: e.tempo,
      percentual: tempoTotal ? (e.tempo / tempoTotal) * 100 : 0
    }));

  const tempoPorTipo = Object.entries(tiposTempo)
    .map(([tipo, tempo]) => ({
      tipo,
      tempo,
      percentual: tempoTotal ? (tempo / tempoTotal) * 100 : 0
    }))
    .sort((a, b) => b.tempo - a.tempo);

  const tempoPorSistema = Object.entries(sistemasTempo)
    .map(([sistema, tempo]) => ({
      sistema,
      tempo,
      percentual: tempoTotal ? (tempo / tempoTotal) * 100 : 0
    }))
    .sort((a, b) => b.tempo - a.tempo);

  const pareto = [...etapas]
    .sort((a, b) => b.tempo - a.tempo)
    .map((e) => ({
      atividade: e.atividade,
      tempo: e.tempo
    }));

  let acumulado = 0;
  pareto.forEach((item) => {
    item.percentual = tempoTotal ? (item.tempo / tempoTotal) * 100 : 0;
    acumulado += item.percentual;
    item.pareto = acumulado;
  });

  return {
    tempoTotal,
    loops,
    conexoesExtrasCount,
    tempoPotencialRetrabalho,
    impactoPotencialRetrabalho,
    decisoes,
    taxaDecisao,
    top3Gargalos,
    tempoPorTipo,
    tempoPorSistema,
    pareto
  };
}

function extrairLinhasInfoProcesso() {
  const el = document.getElementById("infoProcesso");
  if (!el) return [];

  const labels = el.querySelectorAll(".exec-info-item");
  if (labels.length) {
    return Array.from(labels).map(item => {
      const label = item.querySelector(".exec-info-label")?.innerText?.trim() || "";
      const value = item.querySelector(".exec-info-value")?.innerText?.trim() || "";
      return `${label}: ${value}`;
    });
  }

  return el.innerText
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
}

function adicionarTextoQuebrado(doc, texto, x, y, maxWidth, lineHeight = 14, options = {}) {
  const linhas = doc.splitTextToSize(String(texto || ""), maxWidth);
  if (linhas.length === 0) return y;
  doc.text(linhas, x, y, options);
  return y + linhas.length * lineHeight;
}

function garantirEspacoPagina(doc, yAtual, alturaNecessaria, margem, pageHeight, onNewPage = null) {
  if (yAtual + alturaNecessaria > pageHeight - margem) {
    doc.addPage();
    let novoY = margem;
    if (typeof onNewPage === "function") {
      novoY = onNewPage(novoY);
    }
    return novoY;
  }
  return yAtual;
}

function limparTextoPDF(txt) {
  return String(txt || "")
    .replace(/⏱/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function desenharTabelaPDF(doc, config) {
  const {
    titulo,
    columns,
    rows,
    x,
    yInicial,
    larguraTotal,
    margem,
    pageHeight
  } = config;

  const borderWidth = 0.6;
  const cellPaddingX = 6;
  const lineHeight = 11;
  const minRowHeight = 20;
  const gapAntesTitulo = 16;
  const gapTituloCabecalho = 6;
  const gapDepoisTabela = 22;

  let y = yInicial + gapAntesTitulo;

  const weights = columns.map(col => col.weight || 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const colWidths = weights.map(w => (larguraTotal * w) / totalWeight);

  const getHeaderHeight = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    let maxLines = 1;
    columns.forEach((col, i) => {
      const linhas = doc.splitTextToSize(col.header, colWidths[i] - cellPaddingX * 2);
      if (linhas.length > maxLines) maxLines = linhas.length;
    });

    return Math.max(minRowHeight, maxLines * lineHeight + 12);
  };

  const getCellBlock = (valor, width, align) => {
    if (align === "left") {
      return doc.splitTextToSize(valor, width - cellPaddingX * 2);
    }
    return [valor];
  };

  const drawTableHeader = (yHeader) => {
    const headerHeight = getHeaderHeight();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setLineWidth(borderWidth);

    let currentX = x;

    columns.forEach((col, i) => {
      const width = colWidths[i];
      const linhas = doc.splitTextToSize(col.header, width - cellPaddingX * 2);

      doc.rect(currentX, yHeader, width, headerHeight);

      const totalTextHeight = linhas.length * lineHeight;
      const startY = yHeader + (headerHeight - totalTextHeight) / 2 + 8;

      linhas.forEach((linha, idx) => {
        doc.text(linha, currentX + width / 2, startY + idx * lineHeight, {
          align: "center"
        });
      });

      currentX += width;
    });

    return yHeader + headerHeight;
  };

  const drawTitleAndHeader = (yStart) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(titulo, x, yStart);

    let yLocal = yStart + gapTituloCabecalho;
    yLocal = drawTableHeader(yLocal);
    return yLocal;
  };

  y = garantirEspacoPagina(doc, y, 18 + gapTituloCabecalho + getHeaderHeight(), margem, pageHeight);
  y = drawTitleAndHeader(y);

  rows.forEach((row) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setLineWidth(borderWidth);

    let maxLines = 1;

    const rowLineCache = columns.map((col, i) => {
      const raw = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : "";
      const valor = limparTextoPDF(raw);
      const align = col.align || "left";
      const linhas = getCellBlock(valor, colWidths[i], align);

      if (linhas.length > maxLines) maxLines = linhas.length;
      return linhas;
    });

    const rowHeight = Math.max(minRowHeight, maxLines * lineHeight + 12);

    y = garantirEspacoPagina(
      doc,
      y,
      rowHeight,
      margem,
      pageHeight,
      (novoY) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setLineWidth(borderWidth);
        return drawTitleAndHeader(novoY);
      }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setLineWidth(borderWidth);

    let currentX = x;

    columns.forEach((col, i) => {
      const width = colWidths[i];
      const align = col.align || "left";
      const linhas = rowLineCache[i];

      doc.rect(currentX, y, width, rowHeight);

      const totalTextHeight = linhas.length * lineHeight;
      const startY = y + (rowHeight - totalTextHeight) / 2 + 8;

      if (align === "center") {
        linhas.forEach((linha, idx) => {
          doc.text(linha, currentX + width / 2, startY + idx * lineHeight, {
            align: "center"
          });
        });
      } else if (align === "right") {
        linhas.forEach((linha, idx) => {
          doc.text(linha, currentX + width - cellPaddingX, startY + idx * lineHeight, {
            align: "right"
          });
        });
      } else {
        linhas.forEach((linha, idx) => {
          doc.text(linha, currentX + cellPaddingX, startY + idx * lineHeight);
        });
      }

      currentX += width;
    });

    y += rowHeight;
  });

  return y + gapDepoisTabela;
}

async function _baixarAnalisePDFInterno() {
  const svg = obterSVGPronto();
  if (!svg) { mostrarToast("Gere o fluxo primeiro.", "alerta"); return; }

  const infoLinhas = extrairLinhasInfoProcesso();
  const dados = coletarDadosAnaliseEstruturados(filtroAnaliseArea);

  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({
    orientation: "p",
    unit: "pt",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margem = 40;
  const larguraUtil = pageWidth - margem * 2;

  let y = margem;

  const processoNome = obterValorCampo("processo") || "Fluxograma do Processo";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  y = adicionarTextoQuebrado(doc, processoNome, margem, y, larguraUtil, 18);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  y = garantirEspacoPagina(doc, y, 24, margem, pageHeight);
  doc.text("Informações do Processo", margem, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  infoLinhas.forEach((linha) => {
    y = garantirEspacoPagina(doc, y, 18, margem, pageHeight);
    y = adicionarTextoQuebrado(doc, linha, margem, y, larguraUtil, 13);
  });

  y += 14;

  const svgWidth = Number(svg.getAttribute("width")) || 1200;
  const svgHeight = Number(svg.getAttribute("height")) || 800;

  const escala = Math.min(larguraUtil / svgWidth, 1);
  const larguraSvgPdf = svgWidth * escala;
  const alturaSvgPdf = svgHeight * escala;

  y = garantirEspacoPagina(doc, y, alturaSvgPdf + 20, margem, pageHeight);

  await doc.svg(svg, {
    x: margem + (larguraUtil - larguraSvgPdf) / 2,
    y,
    width: larguraSvgPdf,
    height: alturaSvgPdf
  });

  y += alturaSvgPdf + 24;
  y = garantirEspacoPagina(doc, y, 28, margem, pageHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Análise do Processo", margem, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  // C2.3: escopo do filtro de raia + FTE
  let etapasPdf = obterEtapasDaTabela();
  if (filtroAnaliseArea) {
    etapasPdf = etapasPdf.filter(e => (limpar(e.area || "") || "Sem Área") === filtroAnaliseArea);
  }
  const ftePdf = calcularFTE(dados.tempoTotal, etapasPdf);

  y = garantirEspacoPagina(doc, y, 18, margem, pageHeight);
  doc.text(`Escopo: ${filtroAnaliseArea ? "Raia " + filtroAnaliseArea : "Processo inteiro"}`, margem, y);
  y += 18;

  y = garantirEspacoPagina(doc, y, 18, margem, pageHeight);
  doc.text(
    `FTE ${filtroAnaliseArea ? "da raia" : "total"}: ${formatarFTE(ftePdf.fteTotal)}  |  Volumetria: ${ftePdf.volumetria || "Não informado"}  |  Valor FTE: ${ftePdf.valorFTE || "Não informado"}`,
    margem,
    y
  );
  y += 18;

  y = garantirEspacoPagina(doc, y, 18, margem, pageHeight);
  doc.text(`Tempo total do processo: ${formatarTempo(dados.tempoTotal)}`, margem, y);
  y += 18;

  y = garantirEspacoPagina(doc, y, 18, margem, pageHeight);
  doc.text(`Loops detectados: ${dados.loops}`, margem, y);
  y += 18;

  y = garantirEspacoPagina(doc, y, 18, margem, pageHeight);
  doc.text(
    `Potencial retrabalho: ${formatarTempo(dados.tempoPotencialRetrabalho)} | ${formatarPercentual(dados.impactoPotencialRetrabalho)}%`,
    margem,
    y
  );
  y += 18;

  y = garantirEspacoPagina(doc, y, 18, margem, pageHeight);
  doc.text(
    `Taxa de decisão: ${dados.decisoes} etapa(s) | ${formatarPercentual(dados.taxaDecisao)}%`,
    margem,
    y
  );
  y += 6;

  if (!filtroAnaliseArea && ftePdf.ftePorArea && ftePdf.ftePorArea.length > 1) {
    y = desenharTabelaPDF(doc, {
      titulo: "FTE por Área",
      columns: [
        { header: "Área", key: "area", weight: 5.5, align: "left" },
        { header: "Tempo (horas)", key: "tempoFmt", weight: 1.6, align: "center" },
        { header: "FTE", key: "fteFmt", weight: 1.2, align: "center" }
      ],
      rows: ftePdf.ftePorArea.map(a => ({
        area: a.area,
        tempoFmt: formatarTempo(a.tempoSeg),
        fteFmt: formatarFTE(a.fte)
      })),
      x: margem,
      yInicial: y,
      larguraTotal: larguraUtil,
      margem,
      pageHeight
    });
  }

  // Handoffs entre áreas — mesmo recorte de raia da tela.
  const handoffsPdf = calcularHandoffs();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y = garantirEspacoPagina(doc, y, 18, margem, pageHeight);
  if (!filtroAnaliseArea) {
    doc.text(
      `Handoffs entre áreas: ${handoffsPdf.total}  |  Áreas envolvidas: ${handoffsPdf.areasEnvolvidas}  |  Interfaces entre áreas: ${handoffsPdf.pares.length}`,
      margem,
      y
    );
  } else {
    const _saidaN = handoffsPdf.pares.filter(p => p.origem === filtroAnaliseArea).reduce((s, p) => s + p.count, 0);
    const _entradaN = handoffsPdf.pares.filter(p => p.destino === filtroAnaliseArea).reduce((s, p) => s + p.count, 0);
    doc.text(
      `Handoffs da raia: ${_saidaN + _entradaN}  |  Saídas: ${_saidaN}  |  Entradas: ${_entradaN}`,
      margem,
      y
    );
  }
  y += 6;

  if (!filtroAnaliseArea && handoffsPdf.pares.length) {
    y = desenharTabelaPDF(doc, {
      titulo: "Handoffs entre Áreas",
      columns: [
        { header: "De", key: "de", weight: 4, align: "left" },
        { header: "Para", key: "para", weight: 4, align: "left" },
        { header: "Handoffs", key: "qtd", weight: 1.5, align: "center" }
      ],
      rows: handoffsPdf.pares.map(p => ({
        de: p.origem,
        para: p.destino,
        qtd: String(p.count)
      })),
      x: margem,
      yInicial: y,
      larguraTotal: larguraUtil,
      margem,
      pageHeight
    });
  } else if (filtroAnaliseArea) {
    const linhasHandoff = handoffsPdf.pares
      .filter(p => p.origem === filtroAnaliseArea)
      .map(p => ({ sentido: "Saída", outra: p.destino, qtd: String(p.count) }))
      .concat(
        handoffsPdf.pares
          .filter(p => p.destino === filtroAnaliseArea)
          .map(p => ({ sentido: "Entrada", outra: p.origem, qtd: String(p.count) }))
      );
    if (linhasHandoff.length) {
      y = desenharTabelaPDF(doc, {
        titulo: `Handoffs - Raia ${filtroAnaliseArea}`,
        columns: [
          { header: "Sentido", key: "sentido", weight: 2, align: "center" },
          { header: "Outra área", key: "outra", weight: 5.5, align: "left" },
          { header: "Handoffs", key: "qtd", weight: 1.5, align: "center" }
        ],
        rows: linhasHandoff,
        x: margem,
        yInicial: y,
        larguraTotal: larguraUtil,
        margem,
        pageHeight
      });
    }
  }

  y = desenharTabelaPDF(doc, {
    titulo: "Top 3 Gargalos",
    columns: [
      { header: "Atividade", key: "atividade", weight: 5.5, align: "left" },
      { header: "Tempo (horas)", key: "tempoFmt", weight: 1.6, align: "center" },
      { header: "%", key: "percentualFmt", weight: 1.2, align: "center" }
    ],
    rows: dados.top3Gargalos.map(item => ({
      atividade: item.atividade,
      tempoFmt: formatarTempo(item.tempo),
      percentualFmt: `${formatarPercentual(item.percentual)}%`
    })),
    x: margem,
    yInicial: y,
    larguraTotal: larguraUtil,
    margem,
    pageHeight
  });

  y = desenharTabelaPDF(doc, {
    titulo: "Tempo por Tipo",
    columns: [
      { header: "Tipo", key: "tipo", weight: 5.5, align: "left" },
      { header: "Tempo (horas)", key: "tempoFmt", weight: 1.6, align: "center" },
      { header: "%", key: "percentualFmt", weight: 1.2, align: "center" }
    ],
    rows: dados.tempoPorTipo.map(item => ({
      tipo: item.tipo,
      tempoFmt: formatarTempo(item.tempo),
      percentualFmt: `${formatarPercentual(item.percentual)}%`
    })),
    x: margem,
    yInicial: y,
    larguraTotal: larguraUtil,
    margem,
    pageHeight
  });

  y = desenharTabelaPDF(doc, {
    titulo: "Tempo por Sistema",
    columns: [
      { header: "Sistema", key: "sistema", weight: 5.5, align: "left" },
      { header: "Tempo (horas)", key: "tempoFmt", weight: 1.6, align: "center" },
      { header: "%", key: "percentualFmt", weight: 1.2, align: "center" }
    ],
    rows: dados.tempoPorSistema.map(item => ({
      sistema: item.sistema,
      tempoFmt: formatarTempo(item.tempo),
      percentualFmt: `${formatarPercentual(item.percentual)}%`
    })),
    x: margem,
    yInicial: y,
    larguraTotal: larguraUtil,
    margem,
    pageHeight
  });

  y = desenharTabelaPDF(doc, {
    titulo: "Pareto de Tempo",
    columns: [
      { header: "Atividade", key: "atividade", weight: 5.4, align: "left" },
      { header: "Tempo (horas)", key: "tempoFmt", weight: 1.5, align: "center" },
      { header: "%", key: "percentualFmt", weight: 1.0, align: "center" },
      { header: "Pareto", key: "paretoFmt", weight: 1.3, align: "center" }
    ],
    rows: dados.pareto.map(item => ({
      atividade: item.atividade,
      tempoFmt: formatarTempo(item.tempo),
      percentualFmt: `${formatarPercentual(item.percentual)}%`,
      paretoFmt: `${formatarPercentual(item.pareto)}%`
    })),
    x: margem,
    yInicial: y,
    larguraTotal: larguraUtil,
    margem,
    pageHeight
  });

  doc.save(`${ultimoNomeArquivo}_analise.pdf`);
}


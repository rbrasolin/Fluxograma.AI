/* =========================================================
   08-excel.js  |  Gerador de Fluxograma
   Pipeline Excel: gerarFluxoExcel, viewBox, obterSVGPronto (BYTE-IDENTICO)
   (linhas 5179-5753 do script.js original - corte contiguo, sem alteracao de codigo)
   ========================================================= */
function quebrarNomeRaiaExcel(texto, alturaDisponivel) {
  const nome = String(texto || "").trim();
  if (!nome) return [""];

  const fontSize = CONFIG.laneHeaderFontSize;
  const fontWeight = "bold";
  const margemVertical = 16;
  const larguraUtil = Math.max(80, alturaDisponivel - margemVertical * 2);

  // cabe em 1 linha
  if (medirLarguraTexto(nome, fontSize, fontWeight) <= larguraUtil) {
    return [nome];
  }

  const palavras = nome.split(/\s+/).filter(Boolean);

  // tenta quebrar em 2 linhas equilibradas
  if (palavras.length >= 2) {
    let melhor = null;

    for (let i = 1; i < palavras.length; i++) {
      const linha1 = palavras.slice(0, i).join(" ");
      const linha2 = palavras.slice(i).join(" ");

      const w1 = medirLarguraTexto(linha1, fontSize, fontWeight);
      const w2 = medirLarguraTexto(linha2, fontSize, fontWeight);
      const maior = Math.max(w1, w2);
      const diferenca = Math.abs(w1 - w2);
      const cabe = maior <= larguraUtil;

      const candidato = {
        linhas: [linha1, linha2],
        cabe,
        score: (cabe ? 0 : 100000) + maior + diferenca * 0.3
      };

      if (!melhor || candidato.score < melhor.score) {
        melhor = candidato;
      }
    }

    if (melhor) return melhor.linhas;
  }

  // fallback: quebra automática e limita em 2 linhas
  const linhasAuto = quebrarTextoPorLargura(nome, larguraUtil, fontSize, fontWeight);

  if (linhasAuto.length <= 2) return linhasAuto;

  const meio = Math.ceil(linhasAuto.length / 2);
  return [
    linhasAuto.slice(0, meio).join(" "),
    linhasAuto.slice(meio).join(" ")
  ];
}

function calcularLarguraFaixaRaiaExcel(lanesBase) {
  const lineHeight = CONFIG.laneHeaderFontSize + 4;

  let maxLinhas = 1;

  lanesBase.forEach((lane) => {
    const linhas = quebrarNomeRaiaExcel(lane.area, lane.height);
    lane.labelLines = linhas;
    maxLinhas = Math.max(maxLinhas, linhas.length);
  });

  // largura da faixa baseada na quantidade máxima de linhas
  // com uma folga maior para não ficar apertado
  return Math.max(
    EXCEL_LAYOUT.laneLabelWidth,
    maxLinhas * lineHeight + 24
  );
}

function ajustarViewBoxAoConteudo(svg, folga = 0) {
  if (!svg) return svg;

  let bbox = null;
  let wrapper = null;

  try {
    // getBBox costuma falhar quando o SVG ainda não está no DOM.
    wrapper = document.createElement("div");
    wrapper.style.position = "absolute";
    wrapper.style.left = "-100000px";
    wrapper.style.top = "-100000px";
    wrapper.style.visibility = "hidden";
    wrapper.style.pointerEvents = "none";
    wrapper.style.width = "0";
    wrapper.style.height = "0";
    wrapper.style.overflow = "hidden";

    document.body.appendChild(wrapper);
    wrapper.appendChild(svg);

    bbox = svg.getBBox();
  } catch (e) {
    bbox = null;
  } finally {
    if (wrapper && wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    }
  }

  if (
    !bbox ||
    !Number.isFinite(bbox.x) ||
    !Number.isFinite(bbox.y) ||
    !Number.isFinite(bbox.width) ||
    !Number.isFinite(bbox.height) ||
    bbox.width <= 0 ||
    bbox.height <= 0
  ) {
    // fallback: mantém dimensões existentes e evita gerar SVG 1x1
    const larguraAtual = Number(svg.getAttribute("width")) || 1000;
    const alturaAtual = Number(svg.getAttribute("height")) || 800;

    svg.setAttribute("viewBox", `0 0 ${larguraAtual} ${alturaAtual}`);
    svg.setAttribute("width", larguraAtual);
    svg.setAttribute("height", alturaAtual);
    return svg;
  }

  const x = bbox.x - folga;
  const y = bbox.y - folga;
  const width = bbox.width + folga * 2;
  const height = bbox.height + folga * 2;

  svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);

  return svg;
}

function gerarFluxoExcel() {
  if (!fluxoData || fluxoData.length === 0) {
    mostrarToast("Preencha a tabela antes de exportar.", "alerta");
    return null;
  }

  const etapas = obterEtapasDaTabela();

  if (!etapas.length) {
    mostrarToast("Nenhuma etapa válida foi encontrada na tabela.", "alerta");
    return null;
  }

  const idsValidos = new Set(etapas.map(e => e.id));

  etapas.sort((a, b) => a.ordem - b.ordem);

  const etapaPorId = {};
  etapas.forEach(e => {
    etapaPorId[e.id] = e;
  });

  const alturaPadraoNos = calcularAlturaPadraoNos(etapas);
  const maiorAlturaLosango = Math.ceil(alturaPadraoNos * CONFIG.decisionHeightFactor);
  const rowSlotHeight = Math.max(alturaPadraoNos, maiorAlturaLosango);
  const colSlotWidth = Math.max(CONFIG.boxWidth, CONFIG.decisionWidth);

  const maxColuna = Math.max(...etapas.map(e => e.coluna), 1) + 1;

  const areasOrdenadas = [];
  const areaJaExiste = new Set();

  etapas.forEach((e) => {
    const nome = e.area || "Sem Área";
    if (!areaJaExiste.has(nome)) {
      areaJaExiste.add(nome);
      areasOrdenadas.push(nome);
    }
  });

  // Respeita a ordem manual das raias definida no editor (mesma regra da tela).
  if (Array.isArray(ordemRaias) && ordemRaias.length) {
    areasOrdenadas.sort((a, b) => {
      const ia = ordemRaias.indexOf(a);
      const ib = ordemRaias.indexOf(b);
      return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
    });
  }

  let cursorY = 0;
  let rowOffsetGlobal = 0;
  const lanesBase = [];

  // Reserva para terminais Início/Fim acima/abaixo (espelha a visão online).
  // Sem terminais, os valores ficam 0 e o layout é idêntico ao atual.
  const reservaTerminalEx = 36 + (EXCEL_LAYOUT.startGap || 24) + 12;
  const extraTopAreaEx = {};
  const extraBottomAreaEx = {};
  if (Array.isArray(terminais) && terminais.length) {
    const linhasMaxPorAreaEx = {};
    etapas.forEach(e => {
      const a = e.area || "Sem Área";
      linhasMaxPorAreaEx[a] = Math.max(linhasMaxPorAreaEx[a] || 1, e.linha || 1);
    });
    const etapaPorIdEx = {};
    etapas.forEach(e => { etapaPorIdEx[e.id] = e; });
    terminais.forEach(t => {
      const alvo = etapaPorIdEx[t.alvo];
      if (!alvo) return;
      const a = alvo.area || "Sem Área";
      const lado = t.lado || (t.tipo === "inicio" ? "left" : "right");
      if (lado === "top" && (alvo.linha || 1) === 1) {
        extraTopAreaEx[a] = Math.max(extraTopAreaEx[a] || 0, reservaTerminalEx);
      } else if (lado === "bottom" && (alvo.linha || 1) === (linhasMaxPorAreaEx[a] || 1)) {
        extraBottomAreaEx[a] = Math.max(extraBottomAreaEx[a] || 0, reservaTerminalEx);
      }
    });
  }

  areasOrdenadas.forEach((nomeArea) => {
    const etapasArea = etapas.filter(e => (e.area || "Sem Área") === nomeArea);
    const maxLinhaArea = Math.max(...etapasArea.map(e => e.linha), 1);
    const qtdLinhas = maxLinhaArea;
    const extraTop = extraTopAreaEx[nomeArea] || 0;
    const extraBottom = extraBottomAreaEx[nomeArea] || 0;

    const contentHeight =
      qtdLinhas * rowSlotHeight +
      (qtdLinhas - 1) * EXCEL_LAYOUT.rowGap;

    const laneHeight =
      EXCEL_LAYOUT.lanePaddingTop +
      extraTop +
      contentHeight +
      extraBottom +
      EXCEL_LAYOUT.lanePaddingBottom;

    lanesBase.push({
      area: nomeArea,
      y: cursorY,
      height: laneHeight,
      contentHeight,
      extraTop,
      rows: qtdLinhas,
      rowOffsetGlobalStart: rowOffsetGlobal
    });

    rowOffsetGlobal += qtdLinhas + 2;
    cursorY += laneHeight + EXCEL_LAYOUT.laneGap;
  });

  const laneLabelWidthExcel = calcularLarguraFaixaRaiaExcel(lanesBase);

  const laneContentWidth =
    maxColuna * colSlotWidth +
    (maxColuna - 1) * EXCEL_LAYOUT.colGap;

  const lanes = lanesBase.map((base) => ({
    area: base.area,
    x: EXCEL_LAYOUT.extraLeftPadding,
    y: base.y,
    width: laneLabelWidthExcel + EXCEL_LAYOUT.laneEntryWidth + EXCEL_LAYOUT.laneTextOffsetLeft + laneContentWidth,
    height: base.height,
    contentX: EXCEL_LAYOUT.extraLeftPadding + laneLabelWidthExcel + EXCEL_LAYOUT.laneEntryWidth + EXCEL_LAYOUT.laneTextOffsetLeft,
    contentY: base.y + EXCEL_LAYOUT.lanePaddingTop + (base.extraTop || 0),
    contentHeight: base.contentHeight,
    rows: base.rows,
    rowOffsetGlobalStart: base.rowOffsetGlobalStart,
    labelWidth: laneLabelWidthExcel,
    labelLines: base.labelLines || [base.area]
  }));

  const larguraSvg = Math.max(...lanes.map(l => l.x + l.width), 0);
  const alturaSvg = lanes.length ? lanes[lanes.length - 1].y + lanes[lanes.length - 1].height : 0;

  const svg = criarElementoSVG("svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", larguraSvg);
  svg.setAttribute("height", alturaSvg);
  svg.setAttribute("viewBox", `0 0 ${larguraSvg} ${alturaSvg}`);
  svg.setAttribute("style", "background:transparent");

  desenharRaiasExcel(svg, lanes);

  const laneByArea = {};
  lanes.forEach(lane => {
    laneByArea[lane.area] = lane;
  });

  const posicoes = {};

  etapas.forEach((e) => {
    const lane = laneByArea[e.area || "Sem Área"];
    const slotX = lane.contentX + (e.coluna - 1) * (colSlotWidth + EXCEL_LAYOUT.colGap);
    const slotY = lane.contentY + (e.linha - 1) * (rowSlotHeight + EXCEL_LAYOUT.rowGap);

    const pergunta = ehDecisao(e);
    const w = pergunta ? CONFIG.decisionWidth : CONFIG.boxWidth;
    const h = obterAlturaNo(e, alturaPadraoNos);

    const x = slotX + (colSlotWidth - w) / 2;
    const y = slotY + (rowSlotHeight - h) / 2;

    posicoes[e.id] = {
      id: e.id,
      x,
      y,
      w,
      h,
      cx: x + w / 2,
      cy: y + h / 2,
      top: y,
      bottom: y + h,
      left: x,
      right: x + w,
      isDecision: pergunta,
      gridCol: e.coluna,
      gridRow: e.linha,
      gridRowGlobal: lane.rowOffsetGlobalStart + e.linha,
      area: e.area || "Sem Área",
      laneTop: lane.y + EXCEL_LAYOUT.lanePaddingTop,
      laneBottom: lane.y + lane.height - EXCEL_LAYOUT.lanePaddingBottom
    };
  });

  const primeiraEtapa = etapas[0];
  const ultimaEtapa = etapas[etapas.length - 1];
  const primeiraPos = posicoes[primeiraEtapa.id];
  const ultimaPos = posicoes[ultimaEtapa.id];

  // Caixa-alvo do Início e caixa-origem do Fim (padrão = primeira/última).
  const inicioAlvoIdEx = (inicioAlvo && posicoes[inicioAlvo]) ? inicioAlvo : primeiraEtapa.id;
  const fimOrigemIdEx = (fimOrigem && posicoes[fimOrigem]) ? fimOrigem : ultimaEtapa.id;
  const etapaInicioEx = etapas.find(e => e.id === inicioAlvoIdEx) || primeiraEtapa;
  const etapaFimEx = etapas.find(e => e.id === fimOrigemIdEx) || ultimaEtapa;
  const posInicioEx = posicoes[inicioAlvoIdEx];
  const posFimEx = posicoes[fimOrigemIdEx];
  const lanePrimeira = laneByArea[etapaInicioEx.area || "Sem Área"];
  const laneUltima = laneByArea[etapaFimEx.area || "Sem Área"];

  posicoes["__INICIO__"] = {
    id: "__INICIO__",
    x: posInicioEx.x - 60 - EXCEL_LAYOUT.startGap,
    y: posInicioEx.cy - 18,
    w: 60,
    h: 36,
    cx: posInicioEx.x - EXCEL_LAYOUT.startGap - 30,
    cy: posInicioEx.cy,
    top: posInicioEx.cy - 18,
    bottom: posInicioEx.cy + 18,
    left: posInicioEx.x - 60 - EXCEL_LAYOUT.startGap,
    right: posInicioEx.x - EXCEL_LAYOUT.startGap,
    isDecision: false,
    gridCol: 0,
    gridRow: etapaInicioEx.linha,
    gridRowGlobal: lanePrimeira.rowOffsetGlobalStart + etapaInicioEx.linha,
    area: etapaInicioEx.area || "Sem Área"
  };

  posicoes["__FIM__"] = {
    id: "__FIM__",
    x: posFimEx.x + posFimEx.w + EXCEL_LAYOUT.endGap,
    y: posFimEx.cy - 18,
    w: 60,
    h: 36,
    cx: posFimEx.x + posFimEx.w + EXCEL_LAYOUT.endGap + 30,
    cy: posFimEx.cy,
    top: posFimEx.cy - 18,
    bottom: posFimEx.cy + 18,
    left: posFimEx.x + posFimEx.w + EXCEL_LAYOUT.endGap,
    right: posFimEx.x + posFimEx.w + EXCEL_LAYOUT.endGap + 60,
    isDecision: false,
    gridCol: etapaFimEx.coluna + 1,
    gridRow: etapaFimEx.linha,
    gridRowGlobal: laneUltima.rowOffsetGlobalStart + etapaFimEx.linha,
    area: etapaFimEx.area || "Sem Área"
  };

  const algumaVaiAoFimEx = etapas.some((e) => {
    const temDest =
      quebrarListaIds(e.proxSim).filter(d => destinoEhValido(d, idsValidos)).length ||
      quebrarListaIds(e.proxNao).filter(d => destinoEhValido(d, idsValidos)).length ||
      quebrarListaIds(e.conexoesExtras).filter(d => destinoEhValido(d, idsValidos)).length;
    return !temDest && !e.semSaida;
  });
  const fimTemOrigemPropriaEx = !!(fimOrigem && posicoes[fimOrigem] && (() => {
    const lf = etapas.find(e => e.id === fimOrigem);
    return lf && (
      quebrarListaIds(lf.proxSim).filter(d => destinoEhValido(d, idsValidos)).length ||
      quebrarListaIds(lf.proxNao).filter(d => destinoEhValido(d, idsValidos)).length ||
      quebrarListaIds(lf.conexoesExtras).filter(d => destinoEhValido(d, idsValidos)).length
    );
  })());
  const haConexaoAoFimEx = algumaVaiAoFimEx || fimTemOrigemPropriaEx;

  if (!inicioOculto) {
    desenharCapsula(svg, "Início", posicoes["__INICIO__"].x, posicoes["__INICIO__"].y, 60, 36);
  }
  if (haConexaoAoFimEx) {
    desenharCapsula(svg, "Fim", posicoes["__FIM__"].x, posicoes["__FIM__"].y, 60, 36);
  }

  etapas.forEach((etapa) => {
    desenharNoExcel(svg, etapa, posicoes[etapa.id]);
  });

  const sharedRegistry = {};
  const routeRegistry = [];

  if (!inicioOculto) {
    desenharConexaoExcel(
      svg,
      posicoes["__INICIO__"],
      posicoes[inicioAlvoIdEx],
      "",
      0,
      posicoes,
      sharedRegistry,
      routeRegistry
    );
  }

  etapas.forEach((etapa) => {
    const origem = posicoes[etapa.id];
    const destinosSim = quebrarListaIds(etapa.proxSim).filter(destino => destinoEhValido(destino, idsValidos));
    const destinosNao = quebrarListaIds(etapa.proxNao).filter(destino => destinoEhValido(destino, idsValidos));
    const destinosExtras = quebrarListaIds(etapa.conexoesExtras).filter(destino => destinoEhValido(destino, idsValidos));

    const pergunta = ehDecisao(etapa);

    destinosSim.forEach((destinoId, indice) => {
      desenharConexaoExcel(
        svg,
        origem,
        posicoes[destinoId],
        rotuloConexaoFinal(etapa.id, destinoId, pergunta ? (indice === 0 ? "Sim" : `Sim ${indice + 1}`) : ""),
        indice,
        posicoes,
        sharedRegistry,
        routeRegistry
      );
    });

    destinosNao.forEach((destinoId, indice) => {
      desenharConexaoExcel(
        svg,
        origem,
        posicoes[destinoId],
        rotuloConexaoFinal(etapa.id, destinoId, pergunta ? (indice === 0 ? "Não" : `Não ${indice + 1}`) : (indice === 0 ? "Não" : `Não ${indice + 1}`)),
        indice,
        posicoes,
        sharedRegistry,
        routeRegistry
      );
    });

    destinosExtras.forEach((destinoId, indice) => {
      desenharConexaoExcel(
        svg,
        origem,
        posicoes[destinoId],
        rotuloConexaoFinal(etapa.id, destinoId, ""),
        indice + 1,
        posicoes,
        sharedRegistry,
        routeRegistry
      );
    });
  });

  etapas.forEach((etapa) => {
    const destinosSim = quebrarListaIds(etapa.proxSim).filter(destino => destinoEhValido(destino, idsValidos));
    const destinosNao = quebrarListaIds(etapa.proxNao).filter(destino => destinoEhValido(destino, idsValidos));
    const destinosExtras = quebrarListaIds(etapa.conexoesExtras).filter(destino => destinoEhValido(destino, idsValidos));

    if (destinosSim.length === 0 && destinosNao.length === 0 && destinosExtras.length === 0) {
      if (etapa.semSaida) return; // saída removida de propósito não vai ao Fim
      desenharConexaoExcel(
        svg,
        posicoes[etapa.id],
        posicoes["__FIM__"],
        "",
        0,
        posicoes,
        sharedRegistry,
        routeRegistry
      );
    }
  });

  // Fim a partir de uma caixa específica que tem saída própria
  if (fimOrigem && posicoes[fimOrigem]) {
    const lf = etapas.find(e => e.id === fimOrigem);
    const temSaida = lf && (
      quebrarListaIds(lf.proxSim).filter(d => destinoEhValido(d, idsValidos)).length ||
      quebrarListaIds(lf.proxNao).filter(d => destinoEhValido(d, idsValidos)).length ||
      quebrarListaIds(lf.conexoesExtras).filter(d => destinoEhValido(d, idsValidos)).length
    );
    if (temSaida) {
      desenharConexaoExcel(svg, posicoes[fimOrigem], posicoes["__FIM__"], "", 0, posicoes, sharedRegistry, routeRegistry);
    }
  }

  // Terminais Início/Fim adicionais (espelha a visão online)
  let larguraFinal = larguraSvg;
  let alturaFinal = alturaSvg;
  if (Array.isArray(terminais) && terminais.length) {
    const usadosPorAlvoEx = {};
    const gapEx = EXCEL_LAYOUT.startGap || 24;
    terminais.forEach((t) => {
      const alvoPos = posicoes[t.alvo];
      if (!alvoPos) return;
      const ehInicio = t.tipo === "inicio";
      const lado = t.lado || (ehInicio ? "left" : "right");
      const k = `${lado}_${t.alvo}`;
      const desloc = (usadosPorAlvoEx[k] || 0);
      usadosPorAlvoEx[k] = desloc + 1;

      const W = 60, H = 36;
      let tx, tcy;
      switch (lado) {
        case "right":  tx = alvoPos.x + alvoPos.w + gapEx; tcy = alvoPos.cy + desloc * 46; break;
        case "top":    tx = alvoPos.cx - W / 2 + desloc * 70; tcy = alvoPos.top - gapEx - H / 2; break;
        case "bottom": tx = alvoPos.cx - W / 2 + desloc * 70; tcy = alvoPos.bottom + gapEx + H / 2; break;
        case "left":
        default:       tx = alvoPos.x - W - gapEx; tcy = alvoPos.cy + desloc * 46;
      }
      const termId = (ehInicio ? "__INI_" : "__FIMX_") + t.id + "__";
      posicoes[termId] = {
        id: termId, x: tx, y: tcy - H / 2, w: W, h: H,
        cx: tx + W / 2, cy: tcy, top: tcy - H / 2, bottom: tcy + H / 2,
        left: tx, right: tx + W, isDecision: false,
        gridCol: (lado === "right") ? alvoPos.gridCol + 1
               : (lado === "left") ? Math.max(0, alvoPos.gridCol - 1) : alvoPos.gridCol,
        gridRow: alvoPos.gridRow, gridRowGlobal: alvoPos.gridRowGlobal, area: alvoPos.area
      };
      desenharCapsula(svg, ehInicio ? "Início" : "Fim", tx, tcy - H / 2, W, H);
      if (ehInicio) {
        desenharConexaoExcel(svg, posicoes[termId], alvoPos, rotuloConexaoFinal(termId, t.alvo, ""), 0, posicoes, sharedRegistry, routeRegistry);
      } else {
        desenharConexaoExcel(svg, alvoPos, posicoes[termId], rotuloConexaoFinal(t.alvo, termId, ""), 0, posicoes, sharedRegistry, routeRegistry);
      }
      larguraFinal = Math.max(larguraFinal, tx + W + 4);
      alturaFinal = Math.max(alturaFinal, tcy + H / 2 + 4);
    });
  }

  svg.setAttribute("viewBox", `0 0 ${larguraFinal} ${alturaFinal}`);
  svg.setAttribute("width", larguraFinal);
  svg.setAttribute("height", alturaFinal);
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");

return aplicarEscalaSVGExcel(svg, EXCEL_EXPORT_SCALE); 
}

/* =========================
   EXPORTAÇÃO SVG E PDF
========================= */

function obterSVGPronto() {
  const svgOriginal = document.querySelector("#diagram svg");
  if (!svgOriginal) {
    mostrarToast("Gere o fluxo primeiro.", "alerta");
    return null;
  }
  const clone = svgOriginal.cloneNode(true);

  // Remove toda a camada de edição e marcações, garantindo export limpo.
  clone.querySelectorAll("g.editor-ui").forEach(el => el.remove());
  clone.querySelectorAll("[data-origem]").forEach(el => {
    el.removeAttribute("data-origem");
    el.removeAttribute("data-destino");
    if (el.getAttribute("class") === "conexao-fluxo") el.removeAttribute("class");
    el.classList && el.classList.remove("conexao-selecionada");
  });

  return clone;
}


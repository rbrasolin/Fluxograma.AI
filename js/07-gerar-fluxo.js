/* =========================================================
   07-gerar-fluxo.js  |  Gerador de Fluxograma
   Orquestrador da geração do fluxo (tela/PNG/PDF) + obterEtapasDaTabela
   (linhas 4545-5178 do script.js original - corte contiguo, sem alteracao de codigo)
   ========================================================= */
function obterEtapasDaTabela() {
  const etapasValidas = fluxoData.filter(linha => limpar(linha.atividade || "") !== "");

  const uidParaId = {};
  etapasValidas.forEach((linha, index) => {
    uidParaId[linha.uid] = gerarIdVisual(index);
  });

  return etapasValidas.map((linha, index) => {
    const tempoTexto = limpar(linha.tempo || "");

    return {
      ordem: index + 1,
      id: uidParaId[linha.uid],
      atividade: limpar(linha.atividade || ""),
      area: limpar(linha.area || "") || "Sem Área",
      tipo: limpar(linha.tipo || "") || "Não informado",
      sistema: limpar(linha.sistema || "") || "Sem sistema informado",
      tempoTexto,
      tempo: tempoTexto ? tempoParaSegundos(tempoTexto) : 0,
      proxSim: uidParaId[linha.proxSim] || "",
      proxNao: uidParaId[linha.proxNao] || "",
      conexoesExtras: (Array.isArray(linha.extras) ? linha.extras : [])
        .map(uid => uidParaId[uid] || "")
        .filter(Boolean)
        .join(","),
      coluna: Math.max(1, Number(linha.coluna) || 1),
      linha: Math.max(1, Number(linha.linha) || 1),
      cor: normalizarCor(linha.cor || "white"),
      semSaida: !!linha.semSaida
    };
  });
}

function gerarFluxo() {
  if (!fluxoData || fluxoData.length === 0) {
    mostrarToast("Preencha a tabela ou importe um Excel antes de gerar o fluxo.", "alerta");
    return;
  }

  // Onda 3: garante o "Sim = próxima da ordem" antes de montar as etapas.
  reaplicarSugestoesConexao();

  const etapas = obterEtapasDaTabela();

  if (!etapas.length) {
    mostrarToast("Nenhuma etapa válida foi encontrada na tabela.", "alerta");
    return;
  }

  // Onda 3 / A2 — valida o fluxo e mostra o painel (não bloqueia a geração)
  const _resultadoValidacao = validarFluxo();
  renderPainelValidacao(_resultadoValidacao);
  if (_resultadoValidacao.erros.length) {
    mostrarToast(`Fluxo gerado, mas com ${_resultadoValidacao.erros.length} erro(s) — veja o painel acima.`, "erro");
  }

  const desenho = obterValorCampo("desenho");
  const processo = obterValorCampo("processo");
  const analista = obterValorCampo("analista");
  const negocio = obterValorCampo("negocio");
  const area = obterValorCampo("area");
  const gestor = obterValorCampo("gestor");

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

  // Aplica a ordem manual das raias (editor). Áreas sem ordem definida
  // vão para o fim, preservando a ordem natural de aparição.
  if (Array.isArray(ordemRaias) && ordemRaias.length) {
    areasOrdenadas.sort((a, b) => {
      const ia = ordemRaias.indexOf(a);
      const ib = ordemRaias.indexOf(b);
      return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
    });
  }
  ultimasAreasOrdenadas = [...areasOrdenadas];

  const linhasPorArea = {};
  areasOrdenadas.forEach((nome) => {
    linhasPorArea[nome] = 1;
  });

  etapas.forEach((e) => {
    const nome = e.area || "Sem Área";
    linhasPorArea[nome] = Math.max(linhasPorArea[nome] || 1, e.linha || 1);
  });

  const laneContentWidth =
    maxColuna * colSlotWidth +
    (maxColuna - 1) * CONFIG.colGap;

  // Reserva de espaço para terminais Início/Fim posicionados ACIMA/ABAIXO,
  // para que a raia do alvo cresça e o terminal fique dentro dela.
  const reservaTerminal = 36 + CONFIG.entryExitGap + 12;
  const extraTopArea = {};
  const extraBottomArea = {};
  if (Array.isArray(terminais) && terminais.length) {
    const etapaPorIdLocal = {};
    etapas.forEach((e) => { etapaPorIdLocal[e.id] = e; });
    terminais.forEach((t) => {
      const alvo = etapaPorIdLocal[t.alvo];
      if (!alvo) return;
      const area = alvo.area || "Sem Área";
      const lado = t.lado || (t.tipo === "inicio" ? "left" : "right");
      if (lado === "top" && (alvo.linha || 1) === 1) {
        extraTopArea[area] = Math.max(extraTopArea[area] || 0, reservaTerminal);
      } else if (lado === "bottom" && (alvo.linha || 1) === (linhasPorArea[area] || 1)) {
        extraBottomArea[area] = Math.max(extraBottomArea[area] || 0, reservaTerminal);
      }
    });
  }

  const lanes = {};
  let cursorY = CONFIG.marginY;
  let rowOffsetGlobal = 0;

  areasOrdenadas.forEach((nome) => {
    const qtdLinhas = linhasPorArea[nome] || 1;
    const extraTop = extraTopArea[nome] || 0;
    const extraBottom = extraBottomArea[nome] || 0;

    const contentHeight =
      qtdLinhas * rowSlotHeight +
      (qtdLinhas - 1) * CONFIG.rowGap;

    const laneHeight =
      CONFIG.lanePaddingTop +
      extraTop +
      contentHeight +
      extraBottom +
      CONFIG.lanePaddingBottom;

    lanes[nome] = {
      x: CONFIG.marginX,
      y: cursorY,
      width: CONFIG.laneLabelWidth + CONFIG.laneEntryWidth + laneContentWidth,
      height: laneHeight,
      contentX: CONFIG.marginX + CONFIG.laneLabelWidth + CONFIG.laneEntryWidth,
      contentY: cursorY + CONFIG.lanePaddingTop + extraTop,
      rows: qtdLinhas,
      rowOffsetGlobalStart: rowOffsetGlobal
    };

    rowOffsetGlobal += qtdLinhas + 2;
    cursorY += laneHeight + CONFIG.laneGap;
  });

  const svgWidth =
    CONFIG.marginX * 2 +
    CONFIG.laneLabelWidth +
    CONFIG.laneEntryWidth +
    laneContentWidth;

  const svgHeight = cursorY;

  const svg = criarElementoSVG("svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", svgWidth);
  svg.setAttribute("height", svgHeight);
  svg.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);
  svg.setAttribute("style", "background:#ffffff");

  const style = criarElementoSVG("style");
  style.textContent = `
    .box {
      stroke: #111111;
      stroke-width: 2;
    }

    .green { fill: #95d5b2; }
    .blue { fill: #8ecae6; }
    .yellow { fill: #ffd166; }
    .red { fill: #ef476f; }
    .white { fill: #ffffff; }

    .system {
      fill: #f5f5f5;
      stroke: #111111;
      stroke-width: 1.5;
    }

    .text {
      font-family: Arial, sans-serif;
      fill: #111111;
    }
  `;
  svg.appendChild(style);

  const defs = criarElementoSVG("defs");
  const marker = criarElementoSVG("marker");
  marker.setAttribute("id", "arrow");
  marker.setAttribute("markerWidth", "10");
  marker.setAttribute("markerHeight", "10");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "3");
  marker.setAttribute("orient", "auto");
  marker.setAttribute("markerUnits", "strokeWidth");

  const markerPath = criarElementoSVG("path");
  markerPath.setAttribute("d", "M0,0 L10,3 L0,6 Z");
  markerPath.setAttribute("fill", "#111111");
  marker.appendChild(markerPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  desenharRaias(svg, areasOrdenadas, lanes, svgWidth);

  const posicoes = {};

  etapas.forEach((e) => {
    const pergunta = ehDecisao(e);
    const w = pergunta ? CONFIG.decisionWidth : CONFIG.boxWidth;
    const h = obterAlturaNo(e, alturaPadraoNos);
    const lane = lanes[e.area || "Sem Área"];

    const slotX = lane.contentX + (e.coluna - 1) * (colSlotWidth + CONFIG.colGap);
    const slotY = lane.contentY + (e.linha - 1) * (rowSlotHeight + CONFIG.rowGap);

    const x = slotX + (colSlotWidth - w) / 2;
    const y = slotY + (rowSlotHeight - h) / 2;

    posicoes[e.id] = {
      id: e.id,
      x,
      y,
      w,
      h,
      isDecision: pergunta,
      gridCol: e.coluna,
      gridRow: e.linha,
      gridRowGlobal: lane.rowOffsetGlobalStart + e.linha,
      area: e.area || "Sem Área",
      laneTop: lane.y + CONFIG.lanePaddingTop,
      laneBottom: lane.y + lane.height - CONFIG.lanePaddingBottom
    };
  });

  const primeiraEtapa = etapas[0];
  const ultimaEtapa = etapas[etapas.length - 1];
  const primeiraPos = posicoes[primeiraEtapa.id];
  const ultimaPos = posicoes[ultimaEtapa.id];

  const primeiraLane = lanes[primeiraEtapa.area];

  // Caixa onde o Início conecta: padrão = primeira; pode ser reassinada (inicioAlvo)
  const inicioAlvoId = (inicioAlvo && posicoes[inicioAlvo]) ? inicioAlvo : primeiraEtapa.id;
  const alvoInicioPos = posicoes[inicioAlvoId];
  const alvoInicioLane = lanes[alvoInicioPos.area];

  posicoes["__INICIO__"] = {
    id: "__INICIO__",
    x: (inicioAlvoId === primeiraEtapa.id)
        ? primeiraLane.x + CONFIG.laneLabelWidth + 20
        : alvoInicioPos.x - 60 - CONFIG.entryExitGap,
    y: alvoInicioPos.y + (alvoInicioPos.h - 36) / 2,
    w: 60,
    h: 36,
    isDecision: false,
    gridCol: Math.max(0, alvoInicioPos.gridCol - 1),
    gridRow: alvoInicioPos.gridRow,
    gridRowGlobal: alvoInicioPos.gridRowGlobal,
    area: alvoInicioPos.area
  };

  // Caixa de onde o Fim vem: padrão = última; pode ser reassinada (fimOrigem)
  const fimOrigemId = (fimOrigem && posicoes[fimOrigem]) ? fimOrigem : ultimaEtapa.id;
  const origemFimPos = posicoes[fimOrigemId];

  posicoes["__FIM__"] = {
    id: "__FIM__",
    x: origemFimPos.x + origemFimPos.w + CONFIG.entryExitGap,
    y: origemFimPos.y + (origemFimPos.h - 36) / 2,
    w: 60,
    h: 36,
    isDecision: false,
    gridCol: origemFimPos.gridCol + 1,
    gridRow: origemFimPos.gridRow,
    gridRowGlobal: origemFimPos.gridRowGlobal,
    area: origemFimPos.area
  };

  // Há alguma conexão chegando ao Fim padrão?
  const algumaVaiAoFim = etapas.some((e) => {
    const temDest =
      quebrarListaIds(e.proxSim).filter(d => destinoEhValido(d, idsValidos)).length ||
      quebrarListaIds(e.proxNao).filter(d => destinoEhValido(d, idsValidos)).length ||
      quebrarListaIds(e.conexoesExtras).filter(d => destinoEhValido(d, idsValidos)).length;
    return !temDest && !e.semSaida;
  });
  const fimTemOrigemPropria = !!(fimOrigem && posicoes[fimOrigem] && (() => {
    const lf = etapas.find(e => e.id === fimOrigem);
    return lf && (
      quebrarListaIds(lf.proxSim).filter(d => destinoEhValido(d, idsValidos)).length ||
      quebrarListaIds(lf.proxNao).filter(d => destinoEhValido(d, idsValidos)).length ||
      quebrarListaIds(lf.conexoesExtras).filter(d => destinoEhValido(d, idsValidos)).length
    );
  })());
  const haConexaoAoFim = algumaVaiAoFim || fimTemOrigemPropria;

  if (!inicioOculto) {
    desenharCapsula(svg, "Início", posicoes["__INICIO__"].x, posicoes["__INICIO__"].y, 60, 36);
  }
  if (haConexaoAoFim) {
    desenharCapsula(svg, "Fim", posicoes["__FIM__"].x, posicoes["__FIM__"].y, 60, 36);
  }

  etapas.forEach((etapa) => {
    desenharNo(svg, etapa, posicoes[etapa.id]);
  });

  let loops = 0;
  let decisoes = 0;
  let conexoesExtrasCount = 0;
  const etapasImpactadasRetrabalho = new Set();
  const sharedRegistry = {};
  const routeRegistry = [];

  if (!inicioOculto) {
    desenharConexao(
      svg,
      posicoes["__INICIO__"],
      posicoes[inicioAlvoId],
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
    if (pergunta) decisoes++;

    destinosSim.forEach((destinoId, indice) => {
      const destino = etapaPorId[destinoId];
      if (destino && destino.ordem < etapa.ordem) {
        loops += adicionarLoopSeNecessario(etapa.id, destinoId, etapaPorId, etapa);
        adicionarEtapasImpactadasPorRetorno(etapa.id, destinoId, etapaPorId, etapas, etapasImpactadasRetrabalho);
      }

      desenharConexao(
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
      const destino = etapaPorId[destinoId];
      if (destino && destino.ordem < etapa.ordem) {
        loops += adicionarLoopSeNecessario(etapa.id, destinoId, etapaPorId, etapa);
        adicionarEtapasImpactadasPorRetorno(etapa.id, destinoId, etapaPorId, etapas, etapasImpactadasRetrabalho);
      }

      desenharConexao(
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
      const destino = etapaPorId[destinoId];
      if (destino && destino.ordem < etapa.ordem) {
        loops += adicionarLoopSeNecessario(etapa.id, destinoId, etapaPorId, etapa);
        adicionarEtapasImpactadasPorRetorno(etapa.id, destinoId, etapaPorId, etapas, etapasImpactadasRetrabalho);
      }

      conexoesExtrasCount++;
      desenharConexao(
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
      // Se o usuário removeu a saída de propósito (semSaida), a caixa fica
      // sem seta. A regra do Fim automático vale só para caixas que nunca
      // tiveram saída definida (ex.: última caixa do fluxo).
      if (etapa.semSaida) return;

      desenharConexao(
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

  // Se o usuário definiu de onde o Fim vem e essa caixa tem saída própria,
  // liga essa caixa ao Fim explicitamente (o laço acima só cobre caixas sem saída).
  if (fimOrigem && posicoes[fimOrigem]) {
    const lf = etapas.find(e => e.id === fimOrigem);
    const temSaida = lf && (
      quebrarListaIds(lf.proxSim).filter(d => destinoEhValido(d, idsValidos)).length ||
      quebrarListaIds(lf.proxNao).filter(d => destinoEhValido(d, idsValidos)).length ||
      quebrarListaIds(lf.conexoesExtras).filter(d => destinoEhValido(d, idsValidos)).length
    );
    if (temSaida) {
      desenharConexao(svg, posicoes[fimOrigem], posicoes["__FIM__"], "", 0, posicoes, sharedRegistry, routeRegistry);
    }
  }

  // Terminais extras (Início/Fim adicionais) próximos da caixa escolhida,
  // mantendo a mesma distância dos terminais originais.
  if (Array.isArray(terminais) && terminais.length) {
    const usadosPorAlvo = {};
    terminais.forEach((t) => {
      const alvoPos = posicoes[t.alvo];
      if (!alvoPos) return;

      const ehInicio = t.tipo === "inicio";
      const lado = t.lado || (ehInicio ? "left" : "right");

      // deslocamento se houver mais de um terminal no mesmo lado da mesma caixa
      const k = `${lado}_${t.alvo}`;
      const desloc = (usadosPorAlvo[k] || 0);
      usadosPorAlvo[k] = desloc + 1;

      const gap = CONFIG.entryExitGap;
      let tx, ty;
      switch (lado) {
        case "right":
          tx = alvoPos.x + alvoPos.w + gap;
          ty = alvoPos.y + (alvoPos.h - 36) / 2 + desloc * 46;
          break;
        case "top":
          tx = alvoPos.x + (alvoPos.w - 60) / 2 + desloc * 70;
          ty = alvoPos.y - 36 - gap;
          break;
        case "bottom":
          tx = alvoPos.x + (alvoPos.w - 60) / 2 + desloc * 70;
          ty = alvoPos.y + alvoPos.h + gap;
          break;
        case "left":
        default:
          tx = alvoPos.x - 60 - gap;
          ty = alvoPos.y + (alvoPos.h - 36) / 2 + desloc * 46;
      }

      const termId = (ehInicio ? "__INI_" : "__FIMX_") + t.id + "__";
      const gcol = (lado === "right") ? alvoPos.gridCol + 1
                 : (lado === "left") ? Math.max(0, alvoPos.gridCol - 1)
                 : alvoPos.gridCol;

      posicoes[termId] = {
        id: termId, x: tx, y: ty, w: 60, h: 36, isDecision: false,
        gridCol: gcol, gridRow: alvoPos.gridRow,
        gridRowGlobal: alvoPos.gridRowGlobal, area: alvoPos.area
      };

      desenharCapsula(svg, ehInicio ? "Início" : "Fim",
        posicoes[termId].x, posicoes[termId].y, 60, 36);

      if (ehInicio) {
        desenharConexao(svg, posicoes[termId], alvoPos, rotuloConexaoFinal(termId, t.alvo, ""), 0, posicoes, sharedRegistry, routeRegistry);
      } else {
        desenharConexao(svg, alvoPos, posicoes[termId], rotuloConexaoFinal(t.alvo, termId, ""), 0, posicoes, sharedRegistry, routeRegistry);
      }
    });
  }

  document.getElementById("diagram").innerHTML = "";
  document.getElementById("diagram").appendChild(svg);
  atualizarBarraRolagemSuperior();

  ultimoNomeArquivo = gerarNomeArquivo();

  let tempoTotal = 0;
  const atividadesTempo = [];
  const tiposTempo = {};
  const sistemasTempo = {};

  etapas.forEach((etapa) => {
    tempoTotal += etapa.tempo;
    atividadesTempo.push({ atividade: etapa.atividade, tempo: etapa.tempo });

    if (!tiposTempo[etapa.tipo]) tiposTempo[etapa.tipo] = 0;
    tiposTempo[etapa.tipo] += etapa.tempo;

    if (!sistemasTempo[etapa.sistema]) sistemasTempo[etapa.sistema] = 0;
    sistemasTempo[etapa.sistema] += etapa.tempo;
  });

  atividadesTempo.sort((a, b) => b.tempo - a.tempo);

  const tiposOrdenados = Object.entries(tiposTempo)
    .map(([nome, tempo]) => ({ nome, tempo }))
    .sort((a, b) => b.tempo - a.tempo);

  const sistemasOrdenados = Object.entries(sistemasTempo)
    .map(([nome, tempo]) => ({ nome, tempo }))
    .sort((a, b) => b.tempo - a.tempo);

  let tempoPotencialRetrabalho = 0;
  etapas.forEach((etapa) => {
    if (etapasImpactadasRetrabalho.has(etapa.id)) {
      tempoPotencialRetrabalho += etapa.tempo;
    }
  });

  const impactoPotencialRetrabalhoNum = tempoTotal
    ? (tempoPotencialRetrabalho / tempoTotal) * 100
    : 0;

  const taxaDecisaoNum = etapas.length
    ? (decisoes / etapas.length) * 100
    : 0;

  const fteData = calcularFTE(tempoTotal, etapas);
  const infoProcessoData = {
    desenho,
    processo,
    analista,
    negocio,
    area,
    gestor,
    valorFTE: fteData.valorFTE,
    volumetria: fteData.volumetria,
    tempoTotal,
    fteTotal: fteData.fteTotal,
    ftePorArea: fteData.ftePorArea
  };

  document.getElementById("infoProcesso").innerHTML =
    renderInformacoesProcessoExecutivas(infoProcessoData);

  const dadosAnalise = {
    tempoTotal,
    loops,
    conexoesExtrasCount,
    tempoPotencialRetrabalho,
    impactoPotencialRetrabalho: impactoPotencialRetrabalhoNum,
    decisoes,
    taxaDecisao: taxaDecisaoNum,
    top3Gargalos: atividadesTempo.slice(0, 3).map(item => ({
      atividade: item.atividade,
      tempo: item.tempo,
      percentual: tempoTotal ? (item.tempo / tempoTotal) * 100 : 0
    })),
    tempoPorTipo: tiposOrdenados.map(item => ({
      tipo: item.nome,
      tempo: item.tempo,
      percentual: tempoTotal ? (item.tempo / tempoTotal) * 100 : 0
    })),
    tempoPorSistema: sistemasOrdenados.map(item => ({
      sistema: item.nome,
      tempo: item.tempo,
      percentual: tempoTotal ? (item.tempo / tempoTotal) * 100 : 0
    })),
    pareto: (() => {
      let acumulado = 0;
      return atividadesTempo.map(item => {
        const percentual = tempoTotal ? (item.tempo / tempoTotal) * 100 : 0;
        acumulado += percentual;
        return {
          atividade: item.atividade,
          tempo: item.tempo,
          percentual,
          pareto: acumulado
        };
      });
    })()
  };

  renderAnaliseComFiltro();

  // Guarda as posições do render atual (usadas pelo "mover caixa" do editor).
  ultimasPosicoesNos = posicoes;

  // Se o modo de edição estiver ligado, reativa os controles sobre o novo SVG.
  if (modoEdicaoAtivo) {
    aplicarCamadaEdicao();
    renderPainelRaias();
  }
}


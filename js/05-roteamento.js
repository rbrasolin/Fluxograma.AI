/* =========================================================
   05-roteamento.js  |  Gerador de Fluxograma
   Motor de roteamento ortogonal das setas + desenho de conexões
   (linhas 2406-4216 do script.js original - corte contiguo, sem alteracao de codigo)
   ========================================================= */
function getAnchorPoint(node, side) {
  switch (side) {
    case "right":
      return { x: node.x + node.w, y: node.y + node.h / 2 };
    case "left":
      return { x: node.x, y: node.y + node.h / 2 };
    case "top":
      return { x: node.x + node.w / 2, y: node.y };
    case "bottom":
      return { x: node.x + node.w / 2, y: node.y + node.h };
    default:
      return { x: node.x + node.w, y: node.y + node.h / 2 };
  }
}

function createPolylinePath(points) {
  if (!points.length) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

function normalizarPontos(points) {
  const resultado = [];

  points.forEach((point) => {
    if (!point) return;

    const p = {
      x: Number(point.x.toFixed(1)),
      y: Number(point.y.toFixed(1))
    };

    const ultimo = resultado[resultado.length - 1];
    if (ultimo && ultimo.x === p.x && ultimo.y === p.y) return;
    resultado.push(p);
  });

  if (resultado.length <= 2) return resultado;

  const simplificado = [resultado[0]];

  for (let i = 1; i < resultado.length - 1; i++) {
    const anterior = simplificado[simplificado.length - 1];
    const atual = resultado[i];
    const proximo = resultado[i + 1];

    const mesmoX = anterior.x === atual.x && atual.x === proximo.x;
    const mesmoY = anterior.y === atual.y && atual.y === proximo.y;

    if (!mesmoX && !mesmoY) simplificado.push(atual);
  }

  simplificado.push(resultado[resultado.length - 1]);
  return simplificado;
}

function segmentoInterceptaAreaExpandida(p1, p2, left, top, right, bottom) {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  const horizontal = p1.y === p2.y;
  const vertical = p1.x === p2.x;

  if (horizontal) {
    return p1.y >= top && p1.y <= bottom && maxX >= left && minX <= right;
  }

  if (vertical) {
    return p1.x >= left && p1.x <= right && maxY >= top && minY <= bottom;
  }

  return false;
}

function pathCruzaCaixas(points, posicoes = {}, excludeIds = []) {
  const nodes = Object.values(posicoes).filter(node => !excludeIds.includes(node.id));

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    for (const node of nodes) {
      const padX = CONFIG.obstaclePadding;
      const padY = CONFIG.obstaclePadding;
      const left = node.x - padX;
      const right = node.x + node.w + padX;
      const top = node.y - padY;
      const bottom = node.y + node.h + padY;

      if (segmentoInterceptaAreaExpandida(p1, p2, left, top, right, bottom)) {
        return true;
      }
    }
  }

  return false;
}

function segmentosDoPath(points) {
  const segmentos = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    if (!p1 || !p2) continue;
    if (p1.x === p2.x && p1.y === p2.y) continue;

    segmentos.push({ p1, p2 });
  }

  return segmentos;
}

function intervaloSeSobrepoe(a1, a2, b1, b2, margem = 0) {
  const minA = Math.min(a1, a2);
  const maxA = Math.max(a1, a2);
  const minB = Math.min(b1, b2);
  const maxB = Math.max(b1, b2);

  return Math.max(minA, minB) <= Math.min(maxA, maxB) + margem;
}

function segmentosOrtogonaisSeCruzam(segA, segB, margem = 2) {
  const aVertical = segA.p1.x === segA.p2.x;
  const aHorizontal = segA.p1.y === segA.p2.y;
  const bVertical = segB.p1.x === segB.p2.x;
  const bHorizontal = segB.p1.y === segB.p2.y;

  if (!(aVertical || aHorizontal) || !(bVertical || bHorizontal)) {
    return false;
  }

  // vertical x horizontal
  if (aVertical && bHorizontal) {
    const x = segA.p1.x;
    const y = segB.p1.y;

    return (
      intervaloSeSobrepoe(segA.p1.y, segA.p2.y, y, y, margem) &&
      intervaloSeSobrepoe(segB.p1.x, segB.p2.x, x, x, margem)
    );
  }

  // horizontal x vertical
  if (aHorizontal && bVertical) {
    const x = segB.p1.x;
    const y = segA.p1.y;

    return (
      intervaloSeSobrepoe(segA.p1.x, segA.p2.x, x, x, margem) &&
      intervaloSeSobrepoe(segB.p1.y, segB.p2.y, y, y, margem)
    );
  }

  // paralelos sobrepostos
  if (aVertical && bVertical && Math.abs(segA.p1.x - segB.p1.x) <= margem) {
    return intervaloSeSobrepoe(segA.p1.y, segA.p2.y, segB.p1.y, segB.p2.y, margem);
  }

  if (aHorizontal && bHorizontal && Math.abs(segA.p1.y - segB.p1.y) <= margem) {
    return intervaloSeSobrepoe(segA.p1.x, segA.p2.x, segB.p1.x, segB.p2.x, margem);
  }

  return false;
}

function pathCruzaConexoes(points, rotasExistentes = [], tolerancia = 2) {
  if (!rotasExistentes || !rotasExistentes.length) return false;

  const segmentosNovos = segmentosDoPath(points);

  for (const rotaExistente of rotasExistentes) {
    const segmentosExistentes = segmentosDoPath(rotaExistente.points || []);

    for (const segNovo of segmentosNovos) {
      for (const segExistente of segmentosExistentes) {
        // permite tocar na ponta exata
        const compartilhaPonta =
          (segNovo.p1.x === segExistente.p1.x && segNovo.p1.y === segExistente.p1.y) ||
          (segNovo.p1.x === segExistente.p2.x && segNovo.p1.y === segExistente.p2.y) ||
          (segNovo.p2.x === segExistente.p1.x && segNovo.p2.y === segExistente.p1.y) ||
          (segNovo.p2.x === segExistente.p2.x && segNovo.p2.y === segExistente.p2.y);

        if (compartilhaPonta) continue;

        if (segmentosOrtogonaisSeCruzam(segNovo, segExistente, tolerancia)) {
          return true;
        }
      }
    }
  }

  return false;
}

function obterLadosUsadosDoNo(noId, rotasExistentes = []) {
  const usados = new Set();

  (rotasExistentes || []).forEach((rota) => {
    if (!rota || !rota.points || rota.points.length < 2) return;

    if (rota.origemId === noId) {
      usados.add(detectarLadoSaida(rota.points));
    }

    if (rota.destinoId === noId) {
      usados.add(detectarLadoEntrada(rota.points));
    }
  });

  return usados;
}

function obterUsoDetalhadoLadosDoNo(noId, rotasExistentes = []) {
  const uso = {
    origem: { left: 0, right: 0, top: 0, bottom: 0 },
    destino: { left: 0, right: 0, top: 0, bottom: 0 }
  };

  (rotasExistentes || []).forEach((rota) => {
    if (!rota || !rota.points || rota.points.length < 2) return;

    if (rota.origemId === noId) {
      const ladoSaida = detectarLadoSaida(rota.points);
      if (uso.origem[ladoSaida] !== undefined) {
        uso.origem[ladoSaida]++;
      }
    }

    if (rota.destinoId === noId) {
      const ladoEntrada = detectarLadoEntrada(rota.points);
      if (uso.destino[ladoEntrada] !== undefined) {
        uso.destino[ladoEntrada]++;
      }
    }
  });

  return uso;
}

function obterLimitesRaiaDaArea(area, posicoes = {}) {
  const nosArea = Object.values(posicoes).filter(
    n => n && n.area === area && n.id !== "__INICIO__" && n.id !== "__FIM__"
  );

  if (!nosArea.length) {
    return { top: 0, bottom: 999999 };
  }

  const top = Math.min(...nosArea.map(n => n.laneTop ?? n.y));
  const bottom = Math.max(...nosArea.map(n => n.laneBottom ?? (n.y + n.h)));

  return { top, bottom };
}

function calcularCanalSuperiorDentroRaia(origem, destino, nivelCanal = 1, posicoes = {}) {
  const limites = obterLimitesRaiaDaArea(origem.area, posicoes);

  const topoNos = Math.min(origem.y, destino.y);
  const topoRaia = limites.top + 8;
  const baseLivre = topoNos - 10;

  // espaço livre acima dos nós
  const espacoDisponivel = Math.max(12, baseLivre - topoRaia);

  // divide o espaço livre em faixas para Sim / Não / extras
  const totalFaixas = 4;
  const passo = espacoDisponivel / totalFaixas;

  let canalY = baseLivre - passo * nivelCanal;

  if (canalY < topoRaia) canalY = topoRaia;
  if (canalY > baseLivre) canalY = baseLivre;

  return canalY;
}

function calcularCanalInferiorDentroRaia(origem, destino, nivelCanal = 1, posicoes = {}) {
  const limites = obterLimitesRaiaDaArea(origem.area, posicoes);

  const baseNos = Math.max(origem.y + origem.h, destino.y + destino.h);
  const topoLivre = baseNos + 10;
  const fundoRaia = limites.bottom - 8;

  // se não existir espaço real abaixo, encosta no limite mais baixo possível
  if (topoLivre >= fundoRaia) {
    return topoLivre;
  }

  const espacoDisponivel = fundoRaia - topoLivre;
  const totalFaixas = 4;
  const passo = espacoDisponivel / totalFaixas;

  let canalY = topoLivre + passo * nivelCanal;

  if (canalY < topoLivre) canalY = topoLivre;
  if (canalY > fundoRaia) canalY = fundoRaia;

  return canalY;
}

function rotaUsaMesmoLadoConflitante(origem, destino, startSide, endSide) {
  const dx = destino.gridCol - origem.gridCol;
  const dy = destino.gridRowGlobal - origem.gridRowGlobal;

  // mantém apenas a proteção do retorno horizontal para esquerda
  // evitando entrada pelo lado direito quando queremos preservar top/bottom
  if (
    origem.isDecision &&
    dy === 0 &&
    dx < 0 &&
    endSide === "right"
  ) {
    return true;
  }

  return false;
}

function calcularComprimento(points) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y);
  }
  return total;
}

function detectarLadoEntrada(points) {
  if (!points || points.length < 2) return "left";
  const prev = points[points.length - 2];
  const end = points[points.length - 1];

  if (prev.x < end.x) return "left";
  if (prev.x > end.x) return "right";
  if (prev.y < end.y) return "top";
  return "bottom";
}

function detectarLadoSaida(points) {
  if (!points || points.length < 2) return "right";
  const start = points[0];
  const next = points[1];

  if (next.x > start.x) return "right";
  if (next.x < start.x) return "left";
  if (next.y > start.y) return "bottom";
  return "top";
}

function ajustarUltimoTrechoParaLado(points, end, side, destinoNode = null) {
  if (!points || points.length < 2) return points;

  const resultado = [...points];
  const prev = resultado[resultado.length - 2];
  const destino = { x: end.x, y: end.y };

  if (side === "left" && Math.abs(prev.y - end.y) <= CONFIG.sameRowTolerance && prev.x <= (destinoNode ? destinoNode.x : end.x)) {
    resultado[resultado.length - 1] = destino;
    return normalizarPontos(resultado);
  }

  if (side === "right" && Math.abs(prev.y - end.y) <= CONFIG.sameRowTolerance && prev.x >= (destinoNode ? destinoNode.x + destinoNode.w : end.x)) {
    resultado[resultado.length - 1] = destino;
    return normalizarPontos(resultado);
  }

  if (side === "top" && Math.abs(prev.x - end.x) <= CONFIG.sameColTolerance && prev.y <= (destinoNode ? destinoNode.y : end.y)) {
    resultado[resultado.length - 1] = destino;
    return normalizarPontos(resultado);
  }

  if (side === "bottom" && Math.abs(prev.x - end.x) <= CONFIG.sameColTolerance && prev.y >= (destinoNode ? destinoNode.y + destinoNode.h : end.y)) {
    resultado[resultado.length - 1] = destino;
    return normalizarPontos(resultado);
  }

  let pivot = null;

  if (side === "left") {
    pivot = { x: end.x - CONFIG.routeGap, y: end.y };
  } else if (side === "right") {
    pivot = { x: end.x + CONFIG.routeGap, y: end.y };
  } else if (side === "top") {
    pivot = { x: end.x, y: end.y - CONFIG.routeGap };
  } else if (side === "bottom") {
    pivot = { x: end.x, y: end.y + CONFIG.routeGap };
  }

  if (!pivot) return normalizarPontos(resultado);

  const novo = [...resultado.slice(0, -1)];
  const ultimoAntes = novo[novo.length - 1];

  if (ultimoAntes.x !== pivot.x && ultimoAntes.y !== pivot.y) {
    if (side === "left" || side === "right") {
      novo.push({ x: pivot.x, y: ultimoAntes.y });
    } else {
      novo.push({ x: ultimoAntes.x, y: pivot.y });
    }
  }

  novo.push(pivot);
  novo.push(destino);
  return normalizarPontos(novo);
}

function ajustarPrimeiroTrechoParaLado(points, start, side) {
  if (!points || points.length < 2) return points;

  const resultado = [...points];
  const next = resultado[1];

  if (side === "right" && Math.abs(next.y - start.y) <= CONFIG.sameRowTolerance && next.x > start.x) {
    resultado[0] = { x: start.x, y: start.y };
    return normalizarPontos(resultado);
  }

  if (side === "left" && Math.abs(next.y - start.y) <= CONFIG.sameRowTolerance && next.x < start.x) {
    resultado[0] = { x: start.x, y: start.y };
    return normalizarPontos(resultado);
  }

  if (side === "top" && Math.abs(next.x - start.x) <= CONFIG.sameColTolerance && next.y < start.y) {
    resultado[0] = { x: start.x, y: start.y };
    return normalizarPontos(resultado);
  }

  if (side === "bottom" && Math.abs(next.x - start.x) <= CONFIG.sameColTolerance && next.y > start.y) {
    resultado[0] = { x: start.x, y: start.y };
    return normalizarPontos(resultado);
  }

  let escape = null;

  if (side === "right") escape = { x: start.x + CONFIG.routeGap, y: start.y };
  else if (side === "left") escape = { x: start.x - CONFIG.routeGap, y: start.y };
  else if (side === "top") escape = { x: start.x, y: start.y - CONFIG.routeGap };
  else if (side === "bottom") escape = { x: start.x, y: start.y + CONFIG.routeGap };

  if (!escape) return normalizarPontos(resultado);

  const novo = [{ x: start.x, y: start.y }, escape];

  if (resultado.length > 1) {
    const terceiro = resultado[1];

    if (side === "left" || side === "right") {
      if (escape.y !== terceiro.y && escape.x !== terceiro.x) {
        novo.push({ x: escape.x, y: terceiro.y });
      }
    } else {
      if (escape.x !== terceiro.x && escape.y !== terceiro.y) {
        novo.push({ x: terceiro.x, y: escape.y });
      }
    }

    for (let i = 1; i < resultado.length; i++) {
      novo.push(resultado[i]);
    }
  }

  return normalizarPontos(novo);
}

function gerarCandidatosRotas(start, end) {
  const candidates = [];

  const mids = [
    [{ x: end.x, y: start.y }],
    [{ x: start.x, y: end.y }],
    [
      { x: start.x + CONFIG.routeGap, y: start.y },
      { x: start.x + CONFIG.routeGap, y: end.y }
    ],
    [
      { x: start.x - CONFIG.routeGap, y: start.y },
      { x: start.x - CONFIG.routeGap, y: end.y }
    ],
    [
      { x: start.x, y: start.y + CONFIG.routeGap },
      { x: end.x, y: start.y + CONFIG.routeGap }
    ],
    [
      { x: start.x, y: start.y - CONFIG.routeGap },
      { x: end.x, y: start.y - CONFIG.routeGap }
    ]
  ];

  mids.forEach(midPoints => {
    candidates.push(normalizarPontos([start, ...midPoints, end]));
  });

  return candidates;
}

function encontrarRotaSegura(start, end, posicoes = {}, excludeIds = [], preferredEndSide = null, preferredStartSide = null, destinoNode = null) {
  const candidates = gerarCandidatosRotas(start, end);

  const avaliadas = candidates.map(points => {
    let ajustado = [...points];

    const startSide = preferredStartSide || detectarLadoSaida(ajustado);
    const endSide = preferredEndSide || detectarLadoEntrada(ajustado);

    ajustado = ajustarPrimeiroTrechoParaLado(ajustado, start, startSide);
    ajustado = ajustarUltimoTrechoParaLado(ajustado, end, endSide, destinoNode);

    return {
      points: ajustado,
      startSide,
      endSide,
      safe: !pathCruzaCaixas(ajustado, posicoes, excludeIds)
    };
  });

  const validos = avaliadas.filter(r => r.safe);

  if (validos.length) {
    validos.sort((a, b) => {
      if (a.points.length !== b.points.length) return a.points.length - b.points.length;
      return calcularComprimento(a.points) - calcularComprimento(b.points);
    });

    const melhor = validos[0];
    let ajustado = melhor.points;
    ajustado = ajustarPrimeiroTrechoParaLado(ajustado, start, preferredStartSide || melhor.startSide);
    ajustado = ajustarUltimoTrechoParaLado(ajustado, end, preferredEndSide || melhor.endSide, destinoNode);

    return {
      points: ajustado,
      startSide: preferredStartSide || melhor.startSide,
      endSide: preferredEndSide || melhor.endSide,
      safe: !pathCruzaCaixas(ajustado, posicoes, excludeIds)
    };
  }

  let fallback = normalizarPontos([start, { x: end.x, y: start.y }, end]);
  const startSide = preferredStartSide || detectarLadoSaida(fallback);
  const endSide = preferredEndSide || detectarLadoEntrada(fallback);

  fallback = ajustarPrimeiroTrechoParaLado(fallback, start, startSide);
  fallback = ajustarUltimoTrechoParaLado(fallback, end, endSide, destinoNode);

  return {
    points: fallback,
    startSide,
    endSide,
    safe: !pathCruzaCaixas(fallback, posicoes, excludeIds)
  };
}

function buildOrthogonalToMerge(start, mergePoint, end, endSide, posicoes = {}, excludeIds = [], preferredStartSide = null) {
  const ateMergeObj = encontrarRotaSegura(start, mergePoint, posicoes, excludeIds, null, preferredStartSide, null);
  return normalizarPontos([...ateMergeObj.points, end]);
}

function escolherParesCandidatos(origem, destino, rotulo = "") {
  const dx = destino.gridCol - origem.gridCol;
  const dy = destino.gridRowGlobal - origem.gridRowGlobal;

  if (origem.isDecision) {
    // decisão -> mesma linha à direita
    if (dy === 0 && dx > 0) {
      if (rotulo === "Sim") {
        return [
          { startSide: "right", endSide: "left" }, // prioridade: reto
          { startSide: "right", endSide: "top" },
          { startSide: "top", endSide: "top" }
        ];
      }

      if (rotulo === "Não") {
        return [
          { startSide: "top", endSide: "top" },
          { startSide: "right", endSide: "top" }
        ];
      }
    }

    // decisão -> mesma linha à esquerda
    if (dy === 0 && dx < 0) {
      if (rotulo === "Não") {
        return [
          { startSide: "bottom", endSide: "bottom" },
          { startSide: "top", endSide: "top" },
          { startSide: "right", endSide: "bottom" }
        ];
      }

      if (rotulo === "Sim") {
        return [
          { startSide: "top", endSide: "top" },
          { startSide: "bottom", endSide: "bottom" },
          { startSide: "left", endSide: "right" }
        ];
      }
    }

    // decisão -> acima e à esquerda
    if (dx < 0 && dy < 0 && rotulo === "Não") {
      return [
        { startSide: "bottom", endSide: "bottom" },
        { startSide: "top", endSide: "top" },
        { startSide: "right", endSide: "bottom" },
        { startSide: "left", endSide: "bottom" }
      ];
    }

    // decisão -> abaixo
    if (dx === 0 && dy > 0) {
      return [
        { startSide: "bottom", endSide: "top" },
        { startSide: "right", endSide: "top" },
        { startSide: "left", endSide: "top" }
      ];
    }

    // decisão -> acima
    if (dx === 0 && dy < 0) {
      return [
        { startSide: "top", endSide: "bottom" },
        { startSide: "right", endSide: "bottom" },
        { startSide: "left", endSide: "bottom" }
      ];
    }
  }

  if (dx === 0 && dy > 0) {
    return [{ startSide: "bottom", endSide: "top" }];
  }

  if (dx === 0 && dy < 0) {
    return [{ startSide: "top", endSide: "bottom" }];
  }

  if (dy === 0 && dx > 0) {
    return [{ startSide: "right", endSide: "left" }];
  }

  if (dy === 0 && dx < 0) {
    return [{ startSide: "left", endSide: "right" }];
  }

  if (dx > 0 && dy > 0) {
    return [
      { startSide: "right", endSide: "left" },
      { startSide: "right", endSide: "top" },
      { startSide: "bottom", endSide: "left" },
      { startSide: "bottom", endSide: "top" }
    ];
  }

  if (dx > 0 && dy < 0) {
    return [
      { startSide: "right", endSide: "left" },
      { startSide: "right", endSide: "bottom" },
      { startSide: "top", endSide: "left" },
      { startSide: "top", endSide: "bottom" }
    ];
  }

  if (dx < 0 && dy > 0) {
    return [
      { startSide: "left", endSide: "right" },
      { startSide: "left", endSide: "top" },
      { startSide: "bottom", endSide: "right" },
      { startSide: "bottom", endSide: "top" }
    ];
  }

  if (dx < 0 && dy < 0) {
    return [
      { startSide: "left", endSide: "right" },
      { startSide: "left", endSide: "bottom" },
      { startSide: "top", endSide: "right" },
      { startSide: "top", endSide: "bottom" }
    ];
  }

  return [{ startSide: "right", endSide: "left" }];
}

function montarRotaOrtogonal(points, label, startSide = "", endSide = "") {
  return {
    points: normalizarPontos(points),
    label,
    startSide,
    endSide
  };
}

function getMergePoint(end, side, gap = CONFIG.sharedMergeGap) {
  switch (side) {
    case "left": return { x: end.x - gap, y: end.y };
    case "right": return { x: end.x + gap, y: end.y };
    case "top": return { x: end.x, y: end.y - gap };
    case "bottom": return { x: end.x, y: end.y + gap };
    default: return { x: end.x - gap, y: end.y };
  }
}

function tentarRotaDecisaoMesmaLinhaAcima(
  origem,
  destino,
  rotulo = "",
  ordemConexao = 0,
  posicoes = {},
  rotasExistentes = []
) {
  if (!origem.isDecision) {
    return null;
  }

  const dx = destino.gridCol - origem.gridCol;
  const dy = destino.gridRowGlobal - origem.gridRowGlobal;

  const rotuloNormalizado = String(rotulo || "").toLowerCase();
  const ehSim = rotuloNormalizado.startsWith("sim");
  const ehNao = rotuloNormalizado.startsWith("não") || rotuloNormalizado.startsWith("nao");

  const mesmoNivel = dy === 0;
  const vaiParaDireita = dx > 0;
  const vaiParaEsquerda = dx < 0;
  const sobe = dy < 0;

  const excludeIds = [origem.id, destino.id, "__INICIO__", "__FIM__"];
  const ladosUsadosOrigem = obterLadosUsadosDoNo(origem.id, rotasExistentes);
  const usoDetalhadoOrigem = obterUsoDetalhadoLadosDoNo(origem.id, rotasExistentes);
  const usoDetalhadoDestino = obterUsoDetalhadoLadosDoNo(destino.id, rotasExistentes);

  const candidatos = [];

  function penalidadeLado(startSide, endSide) {
    let score = 0;

    const usoOrigem = usoDetalhadoOrigem.origem[startSide] || 0;
    const usoDestino = usoDetalhadoDestino.destino[endSide] || 0;

    if (ladosUsadosOrigem.has(startSide)) score += 1000;
    if (usoOrigem > 0) score += usoOrigem * 1000;
    if (usoDestino > 0) score += usoDestino * 900;

    if (ehSim && vaiParaDireita && mesmoNivel) {
      if (startSide !== "right") score += 300;
      if (endSide !== "left") score += 220;
    }

    if (ehNao && vaiParaEsquerda && mesmoNivel) {
      const simJaSaiuPelaDireita = ladosUsadosOrigem.has("right");

      if (simJaSaiuPelaDireita) {
        if (startSide !== "top") score += 260;
        if (endSide !== "top") score += 160;
      } else {
        if (startSide !== "bottom") score += 260;
        if (endSide !== "bottom") score += 160;
      }
    }

    if (ehNao && vaiParaEsquerda && sobe) {
      if (startSide !== "bottom") score += 220;
      if (endSide !== "bottom") score += 140;
    }

    return score;
  }

  function registrarCandidato(startSide, endSide, pontosBase, labelPoint = null) {
    const rota = normalizarPontos(pontosBase);
    const cruzaCaixa = pathCruzaCaixas(rota, posicoes, excludeIds);

    const rotasComparacao = (rotasExistentes || []).filter(r =>
      !(r.origemId === origem.id && r.destinoId === destino.id)
    );

    const cruzaLinha = pathCruzaConexoes(rota, rotasComparacao);
    const comprimento = calcularComprimento(rota);

    const reusaSaidaOrigem = (usoDetalhadoOrigem.origem[startSide] || 0) > 0;
    const reusaEntradaDestino = (usoDetalhadoDestino.destino[endSide] || 0) > 0;

    candidatos.push({
      points: rota,
      startSide,
      endSide,
      cruzaCaixa,
      cruzaLinha,
      comprimento,
      reusaSaidaOrigem,
      reusaEntradaDestino,
      pesoLado: penalidadeLado(startSide, endSide),
      label: labelPoint || {
        x: rota[Math.floor(rota.length / 2)].x,
        y: rota[Math.floor(rota.length / 2)].y - 10
      }
    });
  }

  function registrarCandidatoCanal(startSide, endSide, canalY) {
    const start = getAnchorPoint(origem, startSide);
    const end = getAnchorPoint(destino, endSide);

    const points = [{ x: start.x, y: start.y }];

    if (startSide === "right") {
      const escapeX = start.x + CONFIG.routeGap;
      points.push({ x: escapeX, y: start.y });
      points.push({ x: escapeX, y: canalY });
    } else if (startSide === "left") {
      const escapeX = start.x - CONFIG.routeGap;
      points.push({ x: escapeX, y: start.y });
      points.push({ x: escapeX, y: canalY });
    } else {
      points.push({ x: start.x, y: canalY });
    }

    points.push({ x: end.x, y: canalY });
    points.push({ x: end.x, y: end.y });

    registrarCandidato(
      startSide,
      endSide,
      points,
      {
        x: (start.x + end.x) / 2,
        y: (startSide === "bottom" || endSide === "bottom") ? canalY + 14 : canalY - 10
      }
    );
  }

  if (mesmoNivel && vaiParaDireita) {
    const startRight = getAnchorPoint(origem, "right");
    const endLeft = getAnchorPoint(destino, "left");

    if (ehSim) {
      registrarCandidato(
        "right",
        "left",
        [
          { x: startRight.x, y: startRight.y },
          { x: endLeft.x, y: endLeft.y }
        ],
        {
          x: (startRight.x + endLeft.x) / 2,
          y: startRight.y - 10
        }
      );
    }

    for (let extra = 0; extra < 4; extra++) {
      if (ehSim) {
        registrarCandidatoCanal(
          "right",
          "top",
          calcularCanalSuperiorDentroRaia(origem, destino, 1 + ordemConexao + extra, posicoes)
        );
        registrarCandidatoCanal(
          "top",
          "top",
          calcularCanalSuperiorDentroRaia(origem, destino, 2 + ordemConexao + extra, posicoes)
        );
      } else if (ehNao) {
        registrarCandidatoCanal(
          "top",
          "top",
          calcularCanalSuperiorDentroRaia(origem, destino, 1 + ordemConexao + extra, posicoes)
        );
        registrarCandidatoCanal(
          "right",
          "top",
          calcularCanalSuperiorDentroRaia(origem, destino, 2 + ordemConexao + extra, posicoes)
        );
      }
    }
  }

  if (mesmoNivel && vaiParaEsquerda && ehNao) {
    const simJaSaiuPelaDireita = ladosUsadosOrigem.has("right");

    for (let extra = 0; extra < 5; extra++) {
      if (simJaSaiuPelaDireita) {
        registrarCandidatoCanal(
          "top",
          "top",
          calcularCanalSuperiorDentroRaia(origem, destino, 1 + ordemConexao + extra, posicoes)
        );

        registrarCandidatoCanal(
          "bottom",
          "bottom",
          calcularCanalInferiorDentroRaia(origem, destino, 2 + ordemConexao + extra, posicoes)
        );
      } else {
        registrarCandidatoCanal(
          "bottom",
          "bottom",
          calcularCanalInferiorDentroRaia(origem, destino, 1 + ordemConexao + extra, posicoes)
        );

        registrarCandidatoCanal(
          "top",
          "top",
          calcularCanalSuperiorDentroRaia(origem, destino, 2 + ordemConexao + extra, posicoes)
        );
      }

      registrarCandidatoCanal(
        "right",
        "bottom",
        calcularCanalInferiorDentroRaia(origem, destino, 3 + ordemConexao + extra, posicoes)
      );
    }
  }

  if (ehNao && vaiParaEsquerda && sobe) {
    const startBottom = getAnchorPoint(origem, "bottom");
    const endBottom = getAnchorPoint(destino, "bottom");
    const startRight = getAnchorPoint(origem, "right");

    for (let extra = 0; extra < 6; extra++) {
      const canalY = calcularCanalInferiorDentroRaia(
        origem,
        destino,
        1 + ordemConexao + extra,
        posicoes
      );

      registrarCandidato(
        "bottom",
        "bottom",
        [
          { x: startBottom.x, y: startBottom.y },
          { x: startBottom.x, y: canalY },
          { x: endBottom.x, y: canalY },
          { x: endBottom.x, y: endBottom.y }
        ],
        {
          x: (startBottom.x + endBottom.x) / 2,
          y: canalY + 14
        }
      );

      const escapeX = startRight.x + CONFIG.routeGap;
      registrarCandidato(
        "right",
        "bottom",
        [
          { x: startRight.x, y: startRight.y },
          { x: escapeX, y: startRight.y },
          { x: escapeX, y: canalY },
          { x: endBottom.x, y: canalY },
          { x: endBottom.x, y: endBottom.y }
        ],
        {
          x: (escapeX + endBottom.x) / 2,
          y: canalY + 14
        }
      );
    }
  }

  if (!candidatos.length) return null;

  candidatos.sort((a, b) => {
    if (a.cruzaCaixa !== b.cruzaCaixa) return a.cruzaCaixa ? 1 : -1;
    if (a.cruzaLinha !== b.cruzaLinha) return a.cruzaLinha ? 1 : -1;
    if (a.reusaSaidaOrigem !== b.reusaSaidaOrigem) return a.reusaSaidaOrigem ? 1 : -1;
    if (a.reusaEntradaDestino !== b.reusaEntradaDestino) return a.reusaEntradaDestino ? 1 : -1;
    if (a.pesoLado !== b.pesoLado) return a.pesoLado - b.pesoLado;
    if (a.points.length !== b.points.length) return a.points.length - b.points.length;
    return a.comprimento - b.comprimento;
  });

  const melhorSemConflitoForte = candidatos.find(c =>
    !c.cruzaCaixa &&
    !c.cruzaLinha &&
    !c.reusaSaidaOrigem &&
    !c.reusaEntradaDestino
  );

  const melhorSemCruzar = candidatos.find(c =>
    !c.cruzaCaixa &&
    !c.cruzaLinha
  );

  const melhorSemCaixa = candidatos.find(c => !c.cruzaCaixa);
  const melhor = melhorSemConflitoForte || melhorSemCruzar || melhorSemCaixa || candidatos[0];

  if (melhor.cruzaCaixa) {
    return null;
  }

  return montarRotaOrtogonal(
    melhor.points,
    melhor.label,
    melhor.startSide,
    melhor.endSide
  );
}

function tentarRotaRetornoSuperior(
  origem,
  destino,
  rotulo = "",
  ordemConexao = 0,
  posicoes = {},
  rotasExistentes = []
) {
  const dx = destino.gridCol - origem.gridCol;
  const dy = destino.gridRowGlobal - origem.gridRowGlobal;

  // foco: destino à esquerda e acima
  if (!(dx < 0 && dy < 0)) {
    return null;
  }

  const excludeIds = [origem.id, destino.id, "__INICIO__", "__FIM__"];
  const candidatos = [];

  function registrar(points, startSide, endSide, canalY) {
    const rota = normalizarPontos(points);

    const rotasComparacao = (rotasExistentes || []).filter(r =>
      !(r.origemId === origem.id && r.destinoId === destino.id)
    );

    candidatos.push({
      points: rota,
      startSide,
      endSide,
      cruzaCaixa: pathCruzaCaixas(rota, posicoes, excludeIds),
      cruzaLinha: pathCruzaConexoes(rota, rotasComparacao),
      comprimento: calcularComprimento(rota),
      label: {
        x: (points[0].x + points[points.length - 1].x) / 2,
        y: canalY - 10
      }
    });
  }

  for (let extra = 0; extra < 6; extra++) {
    const canalY = calcularCanalSuperiorDentroRaia(
      origem,
      destino,
      1 + ordemConexao + extra,
      posicoes
    );

    const startTop = getAnchorPoint(origem, "top");
    const endTop = getAnchorPoint(destino, "top");
    const endBottom = getAnchorPoint(destino, "bottom");
    const startLeft = getAnchorPoint(origem, "left");

    // 1) preferido: sai por cima e entra por cima
    registrar(
      [
        { x: startTop.x, y: startTop.y },
        { x: startTop.x, y: canalY },
        { x: endTop.x, y: canalY },
        { x: endTop.x, y: endTop.y }
      ],
      "top",
      "top",
      canalY
    );

    // 2) alternativa: sai por cima e entra por baixo
    registrar(
      [
        { x: startTop.x, y: startTop.y },
        { x: startTop.x, y: canalY },
        { x: endBottom.x, y: canalY },
        { x: endBottom.x, y: endBottom.y }
      ],
      "top",
      "bottom",
      canalY
    );

    // 3) alternativa: sai pela esquerda, sobe e entra por cima
    const escapeX = startLeft.x - CONFIG.routeGap;
    registrar(
      [
        { x: startLeft.x, y: startLeft.y },
        { x: escapeX, y: startLeft.y },
        { x: escapeX, y: canalY },
        { x: endTop.x, y: canalY },
        { x: endTop.x, y: endTop.y }
      ],
      "left",
      "top",
      canalY
    );
  }

  if (!candidatos.length) return null;

  candidatos.sort((a, b) => {
    if (a.cruzaCaixa !== b.cruzaCaixa) return a.cruzaCaixa ? 1 : -1;
    if (a.cruzaLinha !== b.cruzaLinha) return a.cruzaLinha ? 1 : -1;

    // prioridade explícita:
    // top->top > top->bottom > left->top
    const rank = (c) => {
      if (c.startSide === "top" && c.endSide === "top") return 1;
      if (c.startSide === "top" && c.endSide === "bottom") return 2;
      if (c.startSide === "left" && c.endSide === "top") return 3;
      return 9;
    };

    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.points.length !== b.points.length) return a.points.length - b.points.length;
    return a.comprimento - b.comprimento;
  });

  const melhorSemCruzar = candidatos.find(c => !c.cruzaCaixa && !c.cruzaLinha);
  const melhorSemCaixa = candidatos.find(c => !c.cruzaCaixa);
  const melhor = melhorSemCruzar || melhorSemCaixa || candidatos[0];

  if (melhor.cruzaCaixa) {
    return null;
  }

  return montarRotaOrtogonal(
    melhor.points,
    melhor.label,
    melhor.startSide,
    melhor.endSide
  );
}

function escolherRota(origem, destino, contexto = {}) {
  const rotulo = contexto.rotulo || "";
  const ordemConexao = contexto.ordemConexao || 0;
  const posicoes = contexto.posicoes || {};
  const rotasExistentes = contexto.rotasExistentes || [];
  const excludeIds = [origem.id, destino.id, "__INICIO__", "__FIM__"];

  // === Override manual do editor: força os lados escolhidos pelo usuário ===
  const override = obterOverrideConexao(origem.id, destino.id);
  if (override && override.startSide && override.endSide) {
    const APPROACH = Math.max(CONFIG.sharedMergeGap || 0, 26);

    const startAnchor = getAnchorPoint(origem, override.startSide);
    const endAnchor = getAnchorPoint(destino, override.endSide);

    // Pontos de aproximação fora da origem e do destino, alinhados ao lado.
    const startApproach = getMergePoint(startAnchor, override.startSide, APPROACH);
    const endApproach = getMergePoint(endAnchor, override.endSide, APPROACH);

    // No trecho do meio, MANTÉM origem e destino como obstáculos (só ignora
    // Início/Fim), para que a rota contorne as caixas em vez de atravessá-las.
    const excludeMeio = ["__INICIO__", "__FIM__"];
    const rotaMeio = encontrarRotaSegura(
      startApproach, endApproach, posicoes, excludeMeio, null, null, null
    );

    const pontosFinais = normalizarPontos([
      startAnchor,
      startApproach,
      ...rotaMeio.points,
      endApproach,
      endAnchor
    ]);

    // Rótulo sobre a seta, junto à saída (não na média geométrica dos anchors).
    const along = 22, perp = 12;
    let labelPoint;
    switch (override.startSide) {
      case "left":   labelPoint = { x: startAnchor.x - along, y: startAnchor.y - perp }; break;
      case "top":    labelPoint = { x: startAnchor.x + perp, y: startAnchor.y - along }; break;
      case "bottom": labelPoint = { x: startAnchor.x + perp, y: startAnchor.y + along }; break;
      default:       labelPoint = { x: startAnchor.x + along, y: startAnchor.y - perp };
    }

    return montarRotaOrtogonal(
      pontosFinais,
      labelPoint,
      override.startSide,
      override.endSide
    );
  }

  if (origem.id === "__INICIO__") {
    const start = getAnchorPoint(origem, "right");
    const end = getAnchorPoint(destino, "left");
    const rota = encontrarRotaSegura(start, end, posicoes, excludeIds, "left", "right", destino);

    return montarRotaOrtogonal(
      rota.points,
      { x: (start.x + end.x) / 2, y: start.y - 10 },
      rota.startSide,
      rota.endSide
    );
  }

  if (destino.id === "__FIM__") {
    const start = getAnchorPoint(origem, "right");
    const end = getAnchorPoint(destino, "left");
    const rota = encontrarRotaSegura(start, end, posicoes, excludeIds, "left", "right", destino);

    return montarRotaOrtogonal(
      rota.points,
      { x: (start.x + end.x) / 2, y: start.y - 10 },
      rota.startSide,
      rota.endSide
    );
  }

  const rotaEspecialDecisao = tentarRotaDecisaoMesmaLinhaAcima(
    origem,
    destino,
    rotulo,
    ordemConexao,
    posicoes,
    rotasExistentes
  );

  if (rotaEspecialDecisao) {
    return rotaEspecialDecisao;
  }

  const rotaRetornoSuperior = tentarRotaRetornoSuperior(
    origem,
    destino,
    rotulo,
    ordemConexao,
    posicoes,
    rotasExistentes
  );

  if (rotaRetornoSuperior) {
    return rotaRetornoSuperior;
  }

  const ladosUsadosOrigem = obterLadosUsadosDoNo(origem.id, rotasExistentes);
  const usoDetalhadoOrigem = obterUsoDetalhadoLadosDoNo(origem.id, rotasExistentes);
  const usoDetalhadoDestino = obterUsoDetalhadoLadosDoNo(destino.id, rotasExistentes);

  const dx = destino.gridCol - origem.gridCol;
  const dy = destino.gridRowGlobal - origem.gridRowGlobal;

  function penalidadeLadoFallback(startSide, endSide) {
    let score = 0;

    const usoOrigem = usoDetalhadoOrigem.origem[startSide] || 0;
    const usoDestino = usoDetalhadoDestino.destino[endSide] || 0;

    if (ladosUsadosOrigem.has(startSide)) score += 1000;
    if (usoOrigem > 0) score += usoOrigem * 1000;
    if (usoDestino > 0) score += usoDestino * 900;

    if (origem.isDecision && dy === 0 && dx < 0 && rotulo === "Não") {
      if (startSide !== "bottom") score += 250;
      if (endSide !== "bottom") score += 120;
    }

    if (origem.isDecision && dy < 0 && dx < 0 && rotulo === "Não") {
      if (startSide !== "bottom") score += 300;
      if (endSide !== "bottom") score += 180;
    }

    return score;
  }

  const pares = escolherParesCandidatos(origem, destino, rotulo);
  const tentativas = [];

  for (const par of pares) {
    if (rotaUsaMesmoLadoConflitante(origem, destino, par.startSide, par.endSide)) {
      continue;
    }

    const start = getAnchorPoint(origem, par.startSide);
    const end = getAnchorPoint(destino, par.endSide);

    const rota = encontrarRotaSegura(
      start,
      end,
      posicoes,
      excludeIds,
      par.endSide,
      par.startSide,
      destino
    );

    const pontosRota = rota.points || [];
    const cruzaCaixa = pathCruzaCaixas(pontosRota, posicoes, excludeIds);
    const cruzaLinha = pathCruzaConexoes(pontosRota, rotasExistentes);
    const comprimento = calcularComprimento(pontosRota);
    const pesoLado = penalidadeLadoFallback(par.startSide, par.endSide);

    const reusaSaidaOrigem = (usoDetalhadoOrigem.origem[par.startSide] || 0) > 0;
    const reusaEntradaDestino = (usoDetalhadoDestino.destino[par.endSide] || 0) > 0;

    let comprimentoTotal = 0;
    const segmentos = [];

    for (let i = 0; i < pontosRota.length - 1; i++) {
      const p1 = pontosRota[i];
      const p2 = pontosRota[i + 1];
      const comprimentoSeg = Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y);

      if (comprimentoSeg > 0) {
        segmentos.push({
          p1,
          p2,
          comprimento: comprimentoSeg,
          inicio: comprimentoTotal,
          fim: comprimentoTotal + comprimentoSeg
        });
        comprimentoTotal += comprimentoSeg;
      }
    }

    let labelPoint = { x: start.x + 18, y: start.y - 10 };

    if (segmentos.length > 0 && comprimentoTotal > 0) {
      const alvo = comprimentoTotal / 2;

      for (const segmento of segmentos) {
        if (alvo >= segmento.inicio && alvo <= segmento.fim) {
          const deslocamento = alvo - segmento.inicio;

          if (segmento.p1.y === segmento.p2.y) {
            const direcao = segmento.p2.x >= segmento.p1.x ? 1 : -1;
            labelPoint = {
              x: segmento.p1.x + deslocamento * direcao,
              y: segmento.p1.y
            };
          } else if (segmento.p1.x === segmento.p2.x) {
            const direcao = segmento.p2.y >= segmento.p1.y ? 1 : -1;
            labelPoint = {
              x: segmento.p1.x,
              y: segmento.p1.y + deslocamento * direcao
            };
          }

          break;
        }
      }
    }

    tentativas.push({
      ...rota,
      cruzaCaixa,
      cruzaLinha,
      comprimento,
      pesoLado,
      reusaSaidaOrigem,
      reusaEntradaDestino,
      label: labelPoint
    });
  }

  if (!tentativas.length) {
    const start = getAnchorPoint(origem, "right");
    const end = getAnchorPoint(destino, "left");
    const rota = encontrarRotaSegura(start, end, posicoes, excludeIds, "left", "right", destino);

    return montarRotaOrtogonal(
      rota.points,
      { x: (start.x + end.x) / 2, y: start.y - 10 },
      rota.startSide,
      rota.endSide
    );
  }

  tentativas.sort((a, b) => {
    if (a.cruzaCaixa !== b.cruzaCaixa) return a.cruzaCaixa ? 1 : -1;
    if (a.cruzaLinha !== b.cruzaLinha) return a.cruzaLinha ? 1 : -1;
    if (a.reusaSaidaOrigem !== b.reusaSaidaOrigem) return a.reusaSaidaOrigem ? 1 : -1;
    if (a.reusaEntradaDestino !== b.reusaEntradaDestino) return a.reusaEntradaDestino ? 1 : -1;
    if (a.pesoLado !== b.pesoLado) return a.pesoLado - b.pesoLado;
    if (a.points.length !== b.points.length) return a.points.length - b.points.length;
    return a.comprimento - b.comprimento;
  });

  const melhorSemConflitoForte = tentativas.find(t =>
    !t.cruzaCaixa &&
    !t.cruzaLinha &&
    !t.reusaSaidaOrigem &&
    !t.reusaEntradaDestino
  );

  const melhorSemCruzar = tentativas.find(t =>
    !t.cruzaCaixa &&
    !t.cruzaLinha
  );

  const melhorSemCaixa = tentativas.find(t => !t.cruzaCaixa);
  const melhor = melhorSemConflitoForte || melhorSemCruzar || melhorSemCaixa || tentativas[0];

  return montarRotaOrtogonal(
    melhor.points,
    melhor.label,
    melhor.startSide,
    melhor.endSide
  );
}

function construirRotaCompartilhada(start, sharedInfo, posicoes = {}, excludeIds = [], preferredStartSide = null) {
  const mergePoint = { x: sharedInfo.mergePoint.x, y: sharedInfo.mergePoint.y };
  const end = { x: sharedInfo.end.x, y: sharedInfo.end.y };
  const endSide = sharedInfo.endSide;

  return {
    points: buildOrthogonalToMerge(start, mergePoint, end, endSide, posicoes, excludeIds, preferredStartSide),
    label: sharedInfo.label,
    startSide: preferredStartSide,
    endSide
  };
}

function validarRotaCompartilhada(
  rota,
  origem,
  destino,
  posicoes = {},
  routeRegistry = []
) {
  if (!rota || !rota.points || rota.points.length < 2) return false;

  const excludeIds = [origem.id, destino.id, "__INICIO__", "__FIM__"];

  const cruzaCaixa = pathCruzaCaixas(rota.points, posicoes, excludeIds);

  const rotasComparacao = (routeRegistry || []).filter(r =>
    !(r.origemId === origem.id && r.destinoId === destino.id)
  );

  const cruzaLinha = pathCruzaConexoes(rota.points, rotasComparacao);

  return !cruzaCaixa && !cruzaLinha;
}

function podeCompartilharDestino(origem, sharedInfo) {
  if (!sharedInfo) return false;
  return origem.gridCol === sharedInfo.sourceGridCol;
}

/* =====================================================================
   ONDA 3 — Endireitamento guardado de rotas (menos dobras, sempre 90°)
   Reduz dobras desnecessárias SÓ quando o caminho mais curto não cruza
   caixas nem outras setas. Caso contrário, mantém a rota original.
   Aplica-se aos dois pipelines (tela e Excel), que compartilham a rota.
===================================================================== */
function direcaoSeg(a, b) {
  if (a.x === b.x) return b.y > a.y ? "down" : "up";
  return b.x > a.x ? "right" : "left";
}

function removerColineares(points) {
  if (!Array.isArray(points)) return points;
  // remove duplicados consecutivos
  const dedup = [];
  points.forEach(p => {
    const u = dedup[dedup.length - 1];
    if (!u || u.x !== p.x || u.y !== p.y) dedup.push({ x: p.x, y: p.y });
  });
  if (dedup.length < 3) return dedup;
  const out = [dedup[0]];
  for (let i = 1; i < dedup.length - 1; i++) {
    const a = out[out.length - 1], b = dedup[i], c = dedup[i + 1];
    const colinearH = a.y === b.y && b.y === c.y;
    const colinearV = a.x === b.x && b.x === c.x;
    if (colinearH || colinearV) continue; // ponto do meio é redundante
    out.push(b);
  }
  out.push(dedup[dedup.length - 1]);
  return out;
}

function projetarLabelNaRota(label, points) {
  if (!label || !Array.isArray(points) || points.length < 2) return label;
  let melhor = null, menorDist = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    let px, py;
    if (a.x === b.x) {
      px = a.x;
      py = Math.min(Math.max(label.y, Math.min(a.y, b.y)), Math.max(a.y, b.y));
    } else {
      py = a.y;
      px = Math.min(Math.max(label.x, Math.min(a.x, b.x)), Math.max(a.x, b.x));
    }
    const d = Math.hypot(px - label.x, py - label.y);
    if (d < menorDist) { menorDist = d; melhor = { x: px, y: py }; }
  }
  return melhor || label;
}

function simplificarRota(points, posicoes = {}, excludeIds = [], rotasExistentes = []) {
  let melhor = removerColineares(points);
  if (melhor.length < 4) return melhor;

  const dirPrimeiro = direcaoSeg(melhor[0], melhor[1]);
  const dirUltimo = direcaoSeg(melhor[melhor.length - 2], melhor[melhor.length - 1]);

  let mudou = true;
  let guarda = 0;
  while (mudou && guarda++ < 50) {
    mudou = false;
    for (let i = 0; i + 3 < melhor.length; i++) {
      const a = melhor[i], d = melhor[i + 3];
      const cantos = [{ x: a.x, y: d.y }, { x: d.x, y: a.y }];
      for (const corner of cantos) {
        const candidato = melhor.slice(0, i + 1).concat([corner], melhor.slice(i + 3));
        const limpo = removerColineares(candidato);
        if (limpo.length >= melhor.length) continue;          // não reduziu dobras
        if (limpo.length < 2) continue;
        // preserva direção de saída e de chegada (mantém ancoragem nas caixas)
        if (direcaoSeg(limpo[0], limpo[1]) !== dirPrimeiro) continue;
        if (direcaoSeg(limpo[limpo.length - 2], limpo[limpo.length - 1]) !== dirUltimo) continue;
        // só aceita se não cruzar caixas nem outras setas
        if (pathCruzaCaixas(limpo, posicoes, excludeIds)) continue;
        if (pathCruzaConexoes(limpo, rotasExistentes)) continue;
        melhor = limpo;
        mudou = true;
        break;
      }
      if (mudou) break;
    }
  }
  return melhor;
}

function desenharConexao(
  svg,
  origem,
  destino,
  rotulo = "",
  ordemConexao = 0,
  posicoes = {},
  sharedRegistry = {},
  routeRegistry = []
) {
  let rota = escolherRota(origem, destino, {
    rotulo,
    ordemConexao,
    posicoes,
    rotasExistentes: routeRegistry
  });

  const rotaOriginal = {
    points: [...rota.points],
    label: rota.label,
    startSide: rota.startSide,
    endSide: rota.endSide
  };

  const sharedKey = `${destino.id}__${rota.endSide || "auto"}`;
  const sharedInfo = sharedRegistry[sharedKey];

  if (
    destino.id !== "__FIM__" &&
    destino.id !== "__INICIO__" &&
    sharedInfo &&
    origem.id !== sharedInfo.origemId &&
    podeCompartilharDestino(origem, sharedInfo)
  ) {
    const parPreferido = escolherParesCandidatos(
      origem,
      destino,
      origem.isDecision ? rotulo : ""
    )[0];

    const startReal = getAnchorPoint(origem, parPreferido.startSide);

    const rotaCompartilhada = construirRotaCompartilhada(
      startReal,
      sharedInfo,
      posicoes,
      [origem.id, destino.id, "__INICIO__", "__FIM__"],
      parPreferido.startSide
    );

    // só aceita a rota compartilhada se ela continuar válida
    if (validarRotaCompartilhada(rotaCompartilhada, origem, destino, posicoes, routeRegistry)) {
      rota = rotaCompartilhada;
    } else {
      rota = rotaOriginal;
    }
  } else if (destino.id !== "__FIM__" && destino.id !== "__INICIO__") {
    const end = rota.points[rota.points.length - 1];
    sharedRegistry[sharedKey] = {
      origemId: origem.id,
      sourceGridCol: origem.gridCol,
      endSide: rota.endSide || "left",
      end: { x: end.x, y: end.y },
      mergePoint: getMergePoint(end, rota.endSide || "left"),
      label: rota.label
    };
  }

  // Onda 3: endireitamento guardado — reduz dobras só quando o caminho mais
  // curto não cruza caixas nem outras setas (senão mantém a rota atual).
  rota.points = simplificarRota(
    rota.points,
    posicoes,
    [origem.id, destino.id, "__INICIO__", "__FIM__"],
    routeRegistry
  );
  if (rota.label) rota.label = projetarLabelNaRota(rota.label, rota.points);

  const path = criarElementoSVG("path");
  path.setAttribute("d", createPolylinePath(rota.points));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#111111");
  path.setAttribute("stroke-width", CONFIG.lineWidth);
  path.setAttribute("marker-end", "url(#arrow)");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("data-origem", origem.id);
  path.setAttribute("data-destino", destino.id);
  path.setAttribute("class", "conexao-fluxo");
  svg.appendChild(path);

  routeRegistry.push({
    origemId: origem.id,
    destinoId: destino.id,
    points: rota.points
  });

  if (rotulo) {
    const larguraTexto = medirLarguraTexto(rotulo, 12, "bold");
    const larguraCapsula = Math.max(42, larguraTexto + 20);
    const alturaCapsula = 24;
    const xCapsula = rota.label.x - larguraCapsula / 2;
    const yCapsula = rota.label.y - alturaCapsula / 2 - 1;

    const bg = criarElementoSVG("rect");
    bg.setAttribute("x", xCapsula);
    bg.setAttribute("y", yCapsula);
    bg.setAttribute("width", larguraCapsula);
    bg.setAttribute("height", alturaCapsula);
    bg.setAttribute("rx", alturaCapsula / 2);
    bg.setAttribute("ry", alturaCapsula / 2);
    bg.setAttribute("fill", "#ffffff");
    bg.setAttribute("stroke", "#111111");
    bg.setAttribute("stroke-width", "1");
    svg.appendChild(bg);

    const tx = criarElementoSVG("text");
    tx.setAttribute("x", rota.label.x);
    tx.setAttribute("y", rota.label.y + 4);
    tx.setAttribute("text-anchor", "middle");
    tx.setAttribute("font-family", CONFIG.fontFamily);
    tx.setAttribute("font-size", "12");
    tx.setAttribute("font-weight", "bold");
    tx.setAttribute("fill", "#111111");
    tx.textContent = rotulo;
    svg.appendChild(tx);
  }
}

function desenharConexaoExcel(
  svg,
  origem,
  destino,
  rotulo = "",
  ordemConexao = 0,
  posicoes = {},
  sharedRegistry = {},
  routeRegistry = []
) {
  let rota = escolherRota(origem, destino, {
    rotulo,
    ordemConexao,
    posicoes,
    rotasExistentes: routeRegistry
  });

  const rotaOriginal = {
    points: [...rota.points],
    label: rota.label,
    startSide: rota.startSide,
    endSide: rota.endSide
  };

  const sharedKey = `${destino.id}__${rota.endSide || "auto"}`;
  const sharedInfo = sharedRegistry[sharedKey];

  if (
    destino.id !== "__FIM__" &&
    destino.id !== "__INICIO__" &&
    sharedInfo &&
    origem.id !== sharedInfo.origemId &&
    podeCompartilharDestino(origem, sharedInfo)
  ) {
    const parPreferido = escolherParesCandidatos(
      origem,
      destino,
      origem.isDecision ? rotulo : ""
    )[0];

    const startReal = getAnchorPoint(origem, parPreferido.startSide);

    const rotaCompartilhada = construirRotaCompartilhada(
      startReal,
      sharedInfo,
      posicoes,
      [origem.id, destino.id, "__INICIO__", "__FIM__"],
      parPreferido.startSide
    );

    // só aceita a rota compartilhada se ela continuar válida
    if (validarRotaCompartilhada(rotaCompartilhada, origem, destino, posicoes, routeRegistry)) {
      rota = rotaCompartilhada;
    } else {
      rota = rotaOriginal;
    }
  } else if (destino.id !== "__FIM__" && destino.id !== "__INICIO__") {
    const end = rota.points[rota.points.length - 1];
    sharedRegistry[sharedKey] = {
      origemId: origem.id,
      sourceGridCol: origem.gridCol,
      endSide: rota.endSide || "left",
      end: { x: end.x, y: end.y },
      mergePoint: getMergePoint(end, rota.endSide || "left"),
      label: rota.label
    };
  }

  // Onda 3: endireitamento guardado — reduz dobras só quando o caminho mais
  // curto não cruza caixas nem outras setas (senão mantém a rota atual).
  rota.points = simplificarRota(
    rota.points,
    posicoes,
    [origem.id, destino.id, "__INICIO__", "__FIM__"],
    routeRegistry
  );
  if (rota.label) rota.label = projetarLabelNaRota(rota.label, rota.points);

  const path = criarElementoSVG("path");
  path.setAttribute("d", createPolylinePath(rota.points));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#111111");
  path.setAttribute("stroke-width", CONFIG.lineWidth);
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-linecap", "round");
  svg.appendChild(path);

  routeRegistry.push({
    origemId: origem.id,
    destinoId: destino.id,
    points: rota.points
  });

  const p1 = rota.points[rota.points.length - 2];
  const p2 = rota.points[rota.points.length - 1];

  const arrow = criarElementoSVG("path");
  let dArrow = "";

  if (p2.x > p1.x) {
    dArrow = `M ${p2.x - 10} ${p2.y - 4} L ${p2.x} ${p2.y} L ${p2.x - 10} ${p2.y + 4}`;
  } else if (p2.x < p1.x) {
    dArrow = `M ${p2.x + 10} ${p2.y - 4} L ${p2.x} ${p2.y} L ${p2.x + 10} ${p2.y + 4}`;
  } else if (p2.y > p1.y) {
    dArrow = `M ${p2.x - 4} ${p2.y - 10} L ${p2.x} ${p2.y} L ${p2.x + 4} ${p2.y - 10}`;
  } else {
    dArrow = `M ${p2.x - 4} ${p2.y + 10} L ${p2.x} ${p2.y} L ${p2.x + 4} ${p2.y + 10}`;
  }

  arrow.setAttribute("d", dArrow);
  arrow.setAttribute("fill", "none");
  arrow.setAttribute("stroke", "#111111");
  arrow.setAttribute("stroke-width", CONFIG.lineWidth);
  arrow.setAttribute("stroke-linejoin", "round");
  arrow.setAttribute("stroke-linecap", "round");
  svg.appendChild(arrow);

  if (rotulo) {
    const larguraTexto = medirLarguraTexto(rotulo, 12, "bold");
    const larguraCapsula = Math.max(42, larguraTexto + 20);
    const alturaCapsula = 24;
    const xCapsula = rota.label.x - larguraCapsula / 2;
    const yCapsula = rota.label.y - alturaCapsula / 2 - 1;

    const bg = criarElementoSVG("rect");
    bg.setAttribute("x", xCapsula);
    bg.setAttribute("y", yCapsula);
    bg.setAttribute("width", larguraCapsula);
    bg.setAttribute("height", alturaCapsula);
    bg.setAttribute("rx", alturaCapsula / 2);
    bg.setAttribute("ry", alturaCapsula / 2);
    bg.setAttribute("fill", "#ffffff");
    bg.setAttribute("stroke", "#111111");
    bg.setAttribute("stroke-width", "1");
    svg.appendChild(bg);

    const tx = criarElementoSVG("text");
    tx.setAttribute("x", rota.label.x);
    tx.setAttribute("y", rota.label.y + 4);
    tx.setAttribute("text-anchor", "middle");
    tx.setAttribute("font-family", CONFIG.fontFamily);
    tx.setAttribute("font-size", "12");
    tx.setAttribute("font-weight", "bold");
    tx.setAttribute("fill", "#111111");
    tx.textContent = rotulo;
    svg.appendChild(tx);
  }
}


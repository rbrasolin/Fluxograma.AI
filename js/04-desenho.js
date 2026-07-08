/* =========================================================
   04-desenho.js  |  Gerador de Fluxograma
   Desenho de elementos SVG: nós, cápsulas, raias (tela e Excel)
   (linhas 1822-2405 do script.js original - corte contiguo, sem alteracao de codigo)
   ========================================================= */
function desenharSistemaSeparado(svg, etapa, pos) {
  const altura = 24;
  const y = pos.y + pos.h - altura;

  const g = criarElementoSVG("g");

  const rect = criarElementoSVG("rect");
  rect.setAttribute("x", pos.x);
  rect.setAttribute("y", y);
  rect.setAttribute("width", pos.w);
  rect.setAttribute("height", altura);
  rect.setAttribute("class", "system");
  g.appendChild(rect);

  const text = criarElementoSVG("text");
  text.setAttribute("x", pos.x + pos.w / 2);
  text.setAttribute("y", y + 16);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-family", CONFIG.fontFamily);
  text.setAttribute("font-size", CONFIG.smallFontSize);
  text.setAttribute("fill", "#111111");
  text.textContent = etapa.sistema || "Sem sistema";

  g.appendChild(text);
  svg.appendChild(g);
}

function desenharTextoMultilinhaSVG(g, linhas, x, yInicial, fontSize, lineHeight, fill = "#111111", fontWeight = "normal") {
  const text = criarElementoSVG("text");
  text.setAttribute("x", x);
  text.setAttribute("y", yInicial);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-family", CONFIG.fontFamily);
  text.setAttribute("font-size", String(fontSize));
  text.setAttribute("font-weight", fontWeight);
  text.setAttribute("fill", fill);
  text.setAttribute("xml:space", "preserve");

  linhas.forEach((linha, i) => {
    const tspan = criarElementoSVG("tspan");
    tspan.setAttribute("x", x);
    if (i === 0) {
      tspan.setAttribute("dy", "0");
    } else {
      tspan.setAttribute("dy", String(lineHeight));
    }
    tspan.textContent = linha;
    text.appendChild(tspan);
  });

  g.appendChild(text);
}

function desenharNoExcel(svg, etapa, pos) {
  const g = criarElementoSVG("g");
  const pergunta = ehDecisao(etapa);

  if (pergunta) {
    const cx = pos.x + pos.w / 2;
    const cy = pos.y + pos.h / 2;

    const polygon = criarElementoSVG("polygon");
    polygon.setAttribute(
      "points",
      `${cx},${pos.y} ${pos.x + pos.w},${cy} ${cx},${pos.y + pos.h} ${pos.x},${cy}`
    );
    polygon.setAttribute("fill", corHex(etapa.cor));
    polygon.setAttribute("stroke", "#111111");
    polygon.setAttribute("stroke-width", "2");
    g.appendChild(polygon);

    const linhas = obterLinhasEtapa(etapa, pos.w);
    const totalAlturaTexto = linhas.length * CONFIG.textLineHeight;
    const inicioYTexto = pos.y + (pos.h - totalAlturaTexto) / 2 + 14;

    desenharTextoMultilinhaSVG(
      g,
      linhas,
      pos.x + pos.w / 2,
      inicioYTexto,
      CONFIG.fontSize,
      CONFIG.textLineHeight,
      "#111111"
    );
  } else {
    const alturaSistema = 24;
    const ySeparador = pos.y + pos.h - alturaSistema;

    const rectPrincipal = criarElementoSVG("rect");
    rectPrincipal.setAttribute("x", pos.x);
    rectPrincipal.setAttribute("y", pos.y);
    rectPrincipal.setAttribute("width", pos.w);
    rectPrincipal.setAttribute("height", pos.h);
    rectPrincipal.setAttribute("fill", corHex(etapa.cor));
    rectPrincipal.setAttribute("stroke", "#111111");
    rectPrincipal.setAttribute("stroke-width", "2");
    g.appendChild(rectPrincipal);

    const linhaSeparadora = criarElementoSVG("line");
    linhaSeparadora.setAttribute("x1", pos.x);
    linhaSeparadora.setAttribute("y1", ySeparador);
    linhaSeparadora.setAttribute("x2", pos.x + pos.w);
    linhaSeparadora.setAttribute("y2", ySeparador);
    linhaSeparadora.setAttribute("stroke", "#111111");
    linhaSeparadora.setAttribute("stroke-width", "1.5");
    g.appendChild(linhaSeparadora);

    const linhasAtividade = quebrarTextoPorLargura(
      etapa.atividade,
      obterLarguraUtilTexto(etapa, pos.w),
      CONFIG.fontSize
    );

    const linhaTempo = formatarTempoEtapa(etapa);

    const areaUtil = pos.h - alturaSistema - 6;
    const totalAlturaTexto =
      (linhasAtividade.length * CONFIG.textLineHeight) +
      (linhaTempo ? CONFIG.textLineHeight : 0);

    const inicioYTexto = pos.y + (areaUtil - totalAlturaTexto) / 2 + 14;

    linhasAtividade.forEach((linha, i) => {
      const text = criarElementoSVG("text");
      text.setAttribute("x", pos.x + pos.w / 2);
      text.setAttribute("y", inicioYTexto + i * CONFIG.textLineHeight);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-family", CONFIG.fontFamily);
      text.setAttribute("font-size", String(CONFIG.fontSize));
      text.setAttribute("fill", "#111111");
      text.setAttribute("xml:space", "preserve");
      text.textContent = linha;
      g.appendChild(text);
    });

    if (linhaTempo) {
      const textTempo = criarElementoSVG("text");
      textTempo.setAttribute("x", pos.x + pos.w / 2);
      textTempo.setAttribute("y", inicioYTexto + linhasAtividade.length * CONFIG.textLineHeight);
      textTempo.setAttribute("text-anchor", "middle");
      textTempo.setAttribute("font-family", CONFIG.fontFamily);
      textTempo.setAttribute("font-size", String(CONFIG.smallFontSize));
      textTempo.setAttribute("fill", "#111111");
      textTempo.setAttribute("xml:space", "preserve");
      textTempo.textContent = linhaTempo;
      g.appendChild(textTempo);
    }

    const textoSistema = criarElementoSVG("text");
    textoSistema.setAttribute("x", pos.x + pos.w / 2);
    textoSistema.setAttribute("y", ySeparador + 16);
    textoSistema.setAttribute("text-anchor", "middle");
    textoSistema.setAttribute("font-family", CONFIG.fontFamily);
    textoSistema.setAttribute("font-size", String(CONFIG.smallFontSize));
    textoSistema.setAttribute("fill", "#111111");
    textoSistema.setAttribute("xml:space", "preserve");
    textoSistema.textContent = etapa.sistema || "Sem sistema";
    g.appendChild(textoSistema);
  }

  svg.appendChild(g);
}

function obterAlturaNo(etapa, alturaPadraoBase) {
  const alturaSistema = 24;

  if (ehDecisao(etapa)) {
    return Math.ceil(alturaPadraoBase * CONFIG.decisionHeightFactor) + alturaSistema;
  }

  return alturaPadraoBase + alturaSistema;
}

function calcularAlturaNecessariaEtapa(etapa) {
  const largura = obterLarguraNo(etapa);
  const linhas = obterLinhasEtapa(etapa, largura);

  const alturaTexto = linhas.length * CONFIG.textLineHeight;
  const alturaNecessaria = alturaTexto + CONFIG.textPaddingVertical * 2;

  if (ehDecisao(etapa)) {
    return Math.max(CONFIG.boxHeight, Math.ceil(alturaNecessaria / CONFIG.decisionHeightFactor));
  }

  return Math.max(CONFIG.boxHeight, alturaNecessaria);
}

function calcularAlturaPadraoNos(etapas) {
  let maiorAltura = CONFIG.boxHeight;

  etapas.forEach((etapa) => {
    const altura = calcularAlturaNecessariaEtapa(etapa);
    if (altura > maiorAltura) {
      maiorAltura = altura;
    }
  });

  return maiorAltura;
}

function gerarNomeArquivo() {
  const processo = limpar(document.getElementById("processo").value) || "fluxograma";
  return processo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "fluxograma_processo";
}

function limparTudo() {
  const temDadosTopo =
    obterValorCampo("desenho") ||
    obterValorCampo("processo") ||
    obterValorCampo("analista") ||
    obterValorCampo("negocio") ||
    obterValorCampo("area") ||
    obterValorCampo("gestor") ||
    obterValorCampo("entrada");

  const temEtapas = Array.isArray(fluxoData) && fluxoData.some(linha =>
    limpar(linha.area || "") ||
    limpar(linha.atividade || "") ||
    limpar(linha.tipo || "") ||
    limpar(linha.sistema || "") ||
    limpar(linha.tempo || "") ||
    Number(linha.coluna || 1) !== 1 ||
    Number(linha.linha || 1) !== 1 ||
    limpar(linha.proxSim || "") ||
    limpar(linha.proxNao || "") ||
    (Array.isArray(linha.extras) && linha.extras.some(x => limpar(x || ""))) ||
    (linha.cor && linha.cor !== "white")
  );

  const temDiagrama = !!document.querySelector("#diagram svg");

  if (temDadosTopo || temEtapas || temDiagrama) {
    const confirmar = confirm("Deseja realmente excluir todo o fluxo e limpar todos os campos?");
    if (!confirmar) return;
  }

  fecharAutocomplete();

  limparCampo("desenho");
  limparCampo("processo");
  limparCampo("analista");
  limparCampo("negocio");
  limparCampo("area");
  limparCampo("gestor");
  limparCampo("valorFTE");
  limparCampo("volumetria");
  limparCampo("entrada");

  fluxoData = [];
  uidCounter = 1;
  ultimoNomeArquivo = "fluxograma_processo";

  const diagram = document.getElementById("diagram");
  const infoProcesso = document.getElementById("infoProcesso");
  const metricas = document.getElementById("metricas");

  if (diagram) diagram.innerHTML = "";
  if (infoProcesso) infoProcesso.innerHTML = "";
  if (metricas) metricas.innerHTML = "";

  limparEstadoLocal();

  // recria estado visual limpo
  adicionarLinha(0);

  // garante atualização visual completa
  atualizarTabela();
  renderizarDatalists();
  atualizarOpcoesDeConexao();
  salvarEstadoLocal(true);
}

function adicionarLoopSeNecessario(origemId, destinoId, etapaPorId, etapaAtual) {
  const destino = etapaPorId[destinoId];
  if (destino && destino.ordem < etapaAtual.ordem) {
    return 1;
  }
  return 0;
}

function adicionarEtapasImpactadasPorRetorno(origemId, destinoId, etapaPorId, etapasOrdenadas, etapasImpactadasRef) {
  const origem = etapaPorId[origemId];
  const destino = etapaPorId[destinoId];

  if (!origem || !destino) return;
  if (destino.ordem >= origem.ordem) return;

  etapasOrdenadas.forEach((etapa) => {
    if (etapa.ordem >= destino.ordem && etapa.ordem <= origem.ordem) {
      etapasImpactadasRef.add(etapa.id);
    }
  });
}

function desenharCapsula(svg, texto, x, y, width = 60, height = 36) {
  const g = criarElementoSVG("g");

  const rect = criarElementoSVG("rect");
  rect.setAttribute("x", x);
  rect.setAttribute("y", y);
  rect.setAttribute("width", width);
  rect.setAttribute("height", height);
  rect.setAttribute("rx", height / 2);
  rect.setAttribute("ry", height / 2);
  rect.setAttribute("fill", "#ffffff");
  rect.setAttribute("stroke", CONFIG.stroke);
  rect.setAttribute("stroke-width", "2");
  g.appendChild(rect);

  const t = criarElementoSVG("text");
  t.setAttribute("x", x + width / 2);
  t.setAttribute("y", y + height / 2 + 5);
  t.setAttribute("text-anchor", "middle");
  t.setAttribute("font-family", CONFIG.fontFamily);
  t.setAttribute("font-size", "14");
  t.setAttribute("fill", "#111111");
  t.textContent = texto;
  g.appendChild(t);

  svg.appendChild(g);
}

function desenharNo(svg, etapa, pos) {
  const g = criarElementoSVG("g");
  const pergunta = ehDecisao(etapa);

  if (pergunta) {
    const cx = pos.x + pos.w / 2;
    const cy = pos.y + pos.h / 2;

    const polygon = criarElementoSVG("polygon");
    polygon.setAttribute(
      "points",
      `${cx},${pos.y} ${pos.x + pos.w},${cy} ${cx},${pos.y + pos.h} ${pos.x},${cy}`
    );
    polygon.setAttribute("class", `box ${etapa.cor}`);
    g.appendChild(polygon);
  } else {
    const rect = criarElementoSVG("rect");
    rect.setAttribute("x", pos.x);
    rect.setAttribute("y", pos.y);
    rect.setAttribute("width", pos.w);
    rect.setAttribute("height", pos.h);
    rect.setAttribute("class", `box ${etapa.cor}`);
    g.appendChild(rect);
  }

  const linhas = obterLinhasEtapa(etapa, pos.w);
  const alturaSistema = 24;
  const areaUtil = pos.h - alturaSistema;

  const totalAlturaTexto = linhas.length * CONFIG.textLineHeight;
  const inicioYTexto = pos.y + (areaUtil - totalAlturaTexto) / 2 + 14;

  linhas.forEach((linha, i) => {
    const text = criarElementoSVG("text");
    text.setAttribute("x", pos.x + pos.w / 2);
    text.setAttribute("y", inicioYTexto + i * CONFIG.textLineHeight);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-family", CONFIG.fontFamily);
    text.setAttribute("font-size", i === linhas.length - 1 ? CONFIG.smallFontSize : CONFIG.fontSize);
    text.setAttribute("fill", "#111111");
    text.textContent = linha;
    g.appendChild(text);
  });

  svg.appendChild(g);

  if (!pergunta) {
    desenharSistemaSeparado(svg, etapa, pos);
  }
}

function desenharRaias(svg, areasOrdenadas, lanes, svgWidth) {
  areasOrdenadas.forEach((area) => {
    const lane = lanes[area];
    if (!lane) return;

    const g = criarElementoSVG("g");

    const rectExterno = criarElementoSVG("rect");
    rectExterno.setAttribute("x", lane.x);
    rectExterno.setAttribute("y", lane.y);
    rectExterno.setAttribute("width", lane.width);
    rectExterno.setAttribute("height", lane.height);
    rectExterno.setAttribute("fill", "#ffffff");
    rectExterno.setAttribute("stroke", CONFIG.laneBorder);
    rectExterno.setAttribute("stroke-width", "1.2");
    g.appendChild(rectExterno);

    const header = criarElementoSVG("rect");
    header.setAttribute("x", lane.x);
    header.setAttribute("y", lane.y);
    header.setAttribute("width", CONFIG.laneLabelWidth);
    header.setAttribute("height", lane.height);
    header.setAttribute("fill", CONFIG.laneHeaderFill);
    header.setAttribute("stroke", CONFIG.laneBorder);
    header.setAttribute("stroke-width", "1");
    g.appendChild(header);

    const separator = criarElementoSVG("line");
    separator.setAttribute("x1", lane.x + CONFIG.laneLabelWidth);
    separator.setAttribute("y1", lane.y);
    separator.setAttribute("x2", lane.x + CONFIG.laneLabelWidth);
    separator.setAttribute("y2", lane.y + lane.height);
    separator.setAttribute("stroke", CONFIG.laneSeparator);
    separator.setAttribute("stroke-width", "1");
    g.appendChild(separator);

    const texto = criarElementoSVG("text");
    const tx = lane.x + CONFIG.laneLabelWidth / 2;
    const ty = lane.y + lane.height / 2;
    texto.setAttribute("x", tx);
    texto.setAttribute("y", ty);
    texto.setAttribute("text-anchor", "middle");
    texto.setAttribute("font-family", CONFIG.fontFamily);
    texto.setAttribute("font-size", String(CONFIG.laneHeaderFontSize));
    texto.setAttribute("font-weight", "bold");
    texto.setAttribute("fill", "#333333");
    texto.setAttribute("transform", `rotate(-90 ${tx} ${ty})`);
    texto.textContent = area;
    g.appendChild(texto);

    svg.appendChild(g);
  });
}

function desenharRaiasExcel(svg, lanes) {
  const strokeColor = "#bdbdbd";
  const strokeWidth = 1.2;
  const lineHeight = CONFIG.laneHeaderFontSize + 4;

  lanes.forEach((lane, index) => {
    const prevLane = lanes[index - 1] || null;
    const nextLane = lanes[index + 1] || null;

    const topLineY = prevLane
      ? prevLane.y + prevLane.height + (EXCEL_LAYOUT.laneGap / 2)
      : lane.y;

    const bottomLineY = nextLane
      ? lane.y + lane.height + (EXCEL_LAYOUT.laneGap / 2)
      : lane.y + lane.height;

    const visualHeight = bottomLineY - topLineY;

    const labelCenterX = lane.x + lane.labelWidth / 2;
    const labelCenterY = topLineY + visualHeight / 2;

    // linha horizontal superior
    const linhaTopo = criarElementoSVG("line");
    linhaTopo.setAttribute("x1", lane.x);
    linhaTopo.setAttribute("y1", topLineY);
    linhaTopo.setAttribute("x2", lane.x + lane.width);
    linhaTopo.setAttribute("y2", topLineY);
    linhaTopo.setAttribute("stroke", strokeColor);
    linhaTopo.setAttribute("stroke-width", strokeWidth);
    svg.appendChild(linhaTopo);

    // linha horizontal inferior
    const linhaBase = criarElementoSVG("line");
    linhaBase.setAttribute("x1", lane.x);
    linhaBase.setAttribute("y1", bottomLineY);
    linhaBase.setAttribute("x2", lane.x + lane.width);
    linhaBase.setAttribute("y2", bottomLineY);
    linhaBase.setAttribute("stroke", strokeColor);
    linhaBase.setAttribute("stroke-width", strokeWidth);
    svg.appendChild(linhaBase);

    // separador vertical do nome da raia
    const separador = criarElementoSVG("line");
    separador.setAttribute("x1", lane.x + lane.labelWidth);
    separador.setAttribute("y1", topLineY);
    separador.setAttribute("x2", lane.x + lane.labelWidth);
    separador.setAttribute("y2", bottomLineY);
    separador.setAttribute("stroke", strokeColor);
    separador.setAttribute("stroke-width", strokeWidth);
    svg.appendChild(separador);

    const linhas = lane.labelLines && lane.labelLines.length
      ? lane.labelLines
      : [lane.area];

    const totalAlturaTexto = (linhas.length - 1) * lineHeight;

    linhas.forEach((linha, i) => {
      const texto = criarElementoSVG("text");
      texto.setAttribute("x", labelCenterX);
      texto.setAttribute("y", labelCenterY - totalAlturaTexto / 2 + i * lineHeight);
      texto.setAttribute("text-anchor", "middle");
      texto.setAttribute("dominant-baseline", "middle");
      texto.setAttribute("font-family", CONFIG.fontFamily);
      texto.setAttribute("font-size", String(CONFIG.laneHeaderFontSize));
      texto.setAttribute("font-weight", "bold");
      texto.setAttribute("fill", "#111111");
      texto.setAttribute("transform", `rotate(-90 ${labelCenterX} ${labelCenterY})`);
      texto.textContent = linha;
      svg.appendChild(texto);
    });
  });
}


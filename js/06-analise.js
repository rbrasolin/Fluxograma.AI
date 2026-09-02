/* =========================================================
   06-analise.js  |  Gerador de Fluxograma
   Análise do processo: resumo de tempo, Pareto, FTE, render executivo
   (linhas 4217-4544 do script.js original - corte contiguo, sem alteracao de codigo)
   ========================================================= */
/* Estado de blocos recolhidos no painel "Análise do Processo" — só UI, não
   entra no JSON do projeto nem persiste entre reloads (mesma filosofia do
   "recolher tabela" em 02-tabela.js). Precisa ficar num objeto à parte (e
   não só numa classe CSS) porque, diferente da tabela, #metricas é
   recriado do zero (innerHTML) a cada gerarFluxo()/renderAnaliseComFiltro()
   — uma classe CSS sozinha se perderia a cada edição. A chave é o id fixo
   do bloco (estável entre renders, mesmo o conteúdo mudando). */
let blocosAnaliseColapsados = {};

function blocoColapsado(chave) {
  return !!blocosAnaliseColapsados[chave];
}

// Título clicável de um bloco (exec-card ou exec-table-block), com seta de
// recolher/expandir. classeTitulo = "exec-card-title" | "exec-table-title".
function tituloBlocoColapsavel(chave, titulo, classeTitulo) {
  const colapsado = blocoColapsado(chave);
  return `<div class="${classeTitulo}" data-bloco-titulo="${chave}" onclick="alternarBlocoAnalise('${chave}')">
      <span class="bloco-seta">${colapsado ? "▸" : "▾"}</span>
      <span>${escaparHTML(titulo)}</span>
    </div>`;
}

function alternarBlocoAnalise(chave) {
  blocosAnaliseColapsados[chave] = !blocosAnaliseColapsados[chave];
  const colapsado = blocosAnaliseColapsados[chave];
  const bloco = document.querySelector(`[data-bloco="${chave}"]`);
  if (bloco) bloco.classList.toggle("colapsado", colapsado);
  const seta = document.querySelector(`[data-bloco-titulo="${chave}"] .bloco-seta`);
  if (seta) seta.textContent = colapsado ? "▸" : "▾";
}

function gerarHTMLResumoTempo(lista, tempoTotal) {
  return lista
    .map(item => {
      const pct = tempoTotal ? formatarPercentual((item.tempo / tempoTotal) * 100) : "0,0";
      return '<div class="analytics-item">' +
        escaparHTML(item.nome) +
        ' — <span class="icon-time">⏱</span>' + formatarTempo(item.tempo) +
        ' <span class="icon-pct">%</span>' + pct + '%' +
      '</div>';
    })
    .join("");
}

function gerarTabelaPareto(atividadesTempo, tempoTotal) {
  let acumulado = 0;

  const linhas = atividadesTempo.map((item) => {
    const percentual = tempoTotal ? (item.tempo / tempoTotal) * 100 : 0;
    acumulado += percentual;

    return (
      '<tr>' +
        '<td style="padding:8px;border:1px solid #d9d9d9;vertical-align:top;">' + escaparHTML(item.atividade) + '</td>' +
        '<td style="padding:8px;border:1px solid #d9d9d9;white-space:nowrap;text-align:center;">⏱ ' + formatarTempo(item.tempo) + '</td>' +
        '<td style="padding:8px;border:1px solid #d9d9d9;white-space:nowrap;text-align:center;">' + formatarPercentual(percentual) + '%</td>' +
        '<td style="padding:8px;border:1px solid #d9d9d9;white-space:nowrap;text-align:center;">' + formatarPercentual(acumulado) + '%</td>' +
      '</tr>'
    );
  }).join("");

  return (
    '<div style="overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
        '<thead>' +
          '<tr>' +
            '<th style="padding:10px;border:1px solid #d9d9d9;background:#f5f5f5;text-align:left;">Atividade</th>' +
            '<th style="padding:10px;border:1px solid #d9d9d9;background:#f5f5f5;text-align:center;">Tempo</th>' +
            '<th style="padding:10px;border:1px solid #d9d9d9;background:#f5f5f5;text-align:center;">%</th>' +
            '<th style="padding:10px;border:1px solid #d9d9d9;background:#f5f5f5;text-align:center;">Pareto</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + linhas + '</tbody>' +
      '</table>' +
    '</div>'
  );
}

/* =====================================================================
   ONDA 3 — C2: cálculo de FTE
   FTE = (tempo por execução em horas x volumetria mensal) / valor FTE (h/mês)
   Helper único usado pela tela e pelo PDF. Calcula total e por área.
===================================================================== */
/* tempoTotalSegundos DEVE ser por execu\u00e7\u00e3o (n\u00e3o multiplicado por volumetria
   ainda) \u2014 essa fun\u00e7\u00e3o \u00e9 quem faz a multiplica\u00e7\u00e3o, uma vez s\u00f3. Passar um
   tempo j\u00e1 mensal aqui conta a volumetria duas vezes (bug real: FTE total
   saiu 45,64 em vez de 2,28 \u2014 exatamente 20x o valor certo \u2014 porque
   coletarDadosAnaliseEstruturados, em 09-pdf.js, j\u00e1 devolve tempoTotal
   mensal; use dados.tempoTotalPorExecucao pra alimentar esta fun\u00e7\u00e3o). */
function calcularFTE(tempoTotalSegundos, etapas) {
  const valorFTE = parseFloat(String(obterValorCampo("valorFTE") || "").replace(",", ".")) || 0;
  const volumetria = parseFloat(String(obterValorCampo("volumetria") || "").replace(",", ".")) || 0;
  const valido = valorFTE > 0 && volumetria > 0;
  const horasTotal = (tempoTotalSegundos || 0) / 3600;
  const fteTotal = valido ? (horasTotal * volumetria) / valorFTE : null;

  const porArea = {};
  (etapas || []).forEach(e => {
    const a = limpar(e.area || "") || "Sem \u00c1rea";
    porArea[a] = (porArea[a] || 0) + (e.tempo || 0);
  });
  const ftePorArea = Object.entries(porArea)
    .map(([area, seg]) => ({
      area,
      tempoSeg: seg,                                              // por execu\u00e7\u00e3o \u2014 base do c\u00e1lculo de FTE, n\u00e3o exibir direto
      tempoSegMensal: volumetria > 0 ? seg * volumetria : seg,     // exibi\u00e7\u00e3o: volume mensal, coerente com o resto da An\u00e1lise
      fte: valido ? ((seg / 3600) * volumetria) / valorFTE : null
    }))
    .sort((x, y) => y.tempoSeg - x.tempoSeg);

  return { valorFTE, volumetria, fteTotal, ftePorArea, valido };
}

/* Monta as linhas do cabeçalho do processo (Desenho/Processo/Analista/...)
   pra uso nos exports (SVG, PNG, PDF) — regra: campo vazio não entra na
   linha nenhuma, pra não poluir o arquivo exportado. Lê os campos crus do
   topo + recalcula tempo/FTE do jeito que a tela já faz — não depende de
   gerarFluxo() ter rodado, dá pra chamar a qualquer momento. */
function obterLinhasCabecalhoProcesso() {
  const linhas = [];
  const add = (rotulo, valor) => {
    const v = (valor == null) ? "" : String(valor).trim();
    if (v) linhas.push(`${rotulo}: ${v}`);
  };

  add("Desenho", obterValorCampo("desenho"));
  add("Processo", obterValorCampo("processo"));
  add("Analista", obterValorCampo("analista"));
  add("Negócio", obterValorCampo("negocio"));
  add("Área", obterValorCampo("area"));
  add("Gestor", obterValorCampo("gestor"));
  add("Valor FTE (h/mês)", obterValorCampo("valorFTE"));
  add("Volumetria (exec./mês)", obterValorCampo("volumetria"));

  if (Array.isArray(fluxoData) && fluxoData.length) {
    const etapas = obterEtapasDaTabela();
    if (etapas.length) {
      const dados = coletarDadosAnaliseEstruturados();
      if (dados) {
        add("Tempo por execução", formatarTempo(dados.tempoTotalPorExecucao));
        const fte = calcularFTE(dados.tempoTotalPorExecucao, etapas);
        if (fte.fteTotal != null) add("FTE total", formatarFTE(fte.fteTotal));
      }
    }
  }

  return linhas;
}

/* Aviso "X sem tempo" nos totalizadores (FTE total, Tempo total do processo,
   Potencial retrabalho) — detecta atividades com o campo Tempo em branco
   (não "0" digitado por engano, e sim ausente de verdade) pra sinalizar que
   esses totais podem estar sub-contados por uma caixa que passou batido sem
   tempo preenchido. Clicável: abre a lista de quais atividades estão sem
   tempo, pra ir direto corrigir. Puramente informativo — não bloqueia nada,
   não altera fluxoData nem os cálculos em si. */
function etapasSemTempo(filtroArea) {
  let etapas = obterEtapasDaTabela();
  if (filtroArea) {
    etapas = etapas.filter(e => (limpar(e.area || "") || "Sem Área") === filtroArea);
  }
  return etapas.filter(e => !e.tempoTexto || !String(e.tempoTexto).trim());
}

function avisoSemTempoHTML(filtroArea) {
  const lista = etapasSemTempo(filtroArea);
  if (!lista.length) return "";
  const filtroAttr = escaparHTML(filtroArea || "");
  return ` <span class="aviso-sem-tempo" title="${lista.length} atividade(s) sem tempo informado — clique para ver quais" onclick="event.stopPropagation(); mostrarEtapasSemTempo('${filtroAttr}', event)">⚠ ${lista.length} sem tempo</span>`;
}

function mostrarEtapasSemTempo(filtroArea, ev) {
  fecharTodosOsPopovers();
  const lista = etapasSemTempo(filtroArea);

  let modal = document.getElementById("modalSemTempo");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modalSemTempo";
    document.body.appendChild(modal);
  }

  const itens = lista.map(e => {
    const areaTxt = (e.area && e.area !== "Sem Área") ? ` <span class="sem-tempo-area">— ${escaparHTML(e.area)}</span>` : "";
    return `<li>${escaparHTML(e.id)} · ${escaparHTML(e.atividade)}${areaTxt}</li>`;
  }).join("");

  modal.innerHTML = `
    <div class="pop-header">
      <span><b>Atividades sem tempo informado</b></span>
      <button type="button" class="pop-fechar" onclick="fecharModalSemTempo()">✕</button>
    </div>
    <div class="sem-tempo-dica">Essas atividades não têm o campo Tempo preenchido — os totais de tempo/FTE/retrabalho não contam com elas.</div>
    <ul class="sem-tempo-lista">${itens || "<li>Nenhuma.</li>"}</ul>
  `;

  if (typeof mostrarBackdropEditor === "function") mostrarBackdropEditor();
  if (typeof posicionarFlutuante === "function") {
    posicionarFlutuante(modal, ev);
  } else {
    modal.style.display = "block";
  }
}

function fecharModalSemTempo() {
  const modal = document.getElementById("modalSemTempo");
  if (modal) modal.style.display = "none";
  if (typeof esconderBackdropEditor === "function") esconderBackdropEditor();
}

function formatarFTE(v) {
  if (v == null) return "Não informado";
  return (Math.round(v * 100) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// layoutFixo + col.width (ex.: "38%") padronizam a posição das colunas entre
// tabelas diferentes (ex.: Top 3 Gargalos/Tempo por Tipo/Tempo por Sistema/
// Pareto têm a 1ª coluna com nome diferente, mas as demais — Tempo/%/Pareto —
// ficam alinhadas verticalmente entre os blocos, em vez de cada tabela
// dimensionar as colunas sozinha pelo próprio conteúdo.
function renderTabelaAnaliseHTML({ chave, titulo, columns, rows, layoutFixo }) {
  const estiloLargura = (col) => col.width ? ` style="width:${col.width}"` : "";

  const thead = `
    <thead>
      <tr>
        ${columns.map(col => `
          <th class="${col.align === "center" ? "th-center" : ""}"${estiloLargura(col)}>
            ${escaparHTML(col.header)}
          </th>
        `).join("")}
      </tr>
    </thead>
  `;

  const tbody = `
    <tbody>
      ${rows.map(row => `
        <tr>
          ${columns.map(col => `
            <td class="${col.align === "center" ? "td-center" : ""}"${estiloLargura(col)}>
              ${escaparHTML(row[col.key] ?? "")}
            </td>
          `).join("")}
        </tr>
      `).join("")}
    </tbody>
  `;

  return `
    <div class="exec-table-block${blocoColapsado(chave) ? " colapsado" : ""}" data-bloco="${chave}">
      ${tituloBlocoColapsavel(chave, titulo, "exec-table-title")}
      <div class="exec-table-wrap">
        <table class="exec-table${layoutFixo ? " exec-table-fixa" : ""}">
          ${thead}
          ${tbody}
        </table>
      </div>
    </div>
  `;
}

function renderResumoAnaliseExecutivo(dados) {
  const sufixoMensal = dados.volumetriaAplicada ? " (mensal)" : "";
  return `
    <div class="exec-summary-grid">
      <div class="exec-summary-item" title="Soma do tempo de todas as etapas${dados.volumetriaAplicada ? ", multiplicado pela volumetria informada" : ""}.">
        <div class="exec-summary-label">Tempo total do processo${sufixoMensal}</div>
        <div class="exec-summary-value">${formatarTempo(dados.tempoTotal)}${avisoSemTempoHTML(filtroAnaliseArea)}</div>
      </div>
      <div class="exec-summary-item" title="Quantas vezes o fluxo retorna para uma etapa anterior (indica repetição/retrabalho no processo).">
        <div class="exec-summary-label">Loops detectados</div>
        <div class="exec-summary-value">${dados.loops}</div>
      </div>
      <div class="exec-summary-item" title="Tempo (e % do total) das etapas que podem ser refeitas por causa de um loop no processo.">
        <div class="exec-summary-label">Potencial retrabalho${sufixoMensal}</div>
        <div class="exec-summary-value">${formatarTempo(dados.tempoPotencialRetrabalho)} | ${formatarPercentual(dados.impactoPotencialRetrabalho)}%${avisoSemTempoHTML(filtroAnaliseArea)}</div>
      </div>
      <div class="exec-summary-item" title="Quantas etapas do processo são pontos de decisão, e qual % isso representa do total de etapas.">
        <div class="exec-summary-label">Taxa de decisão</div>
        <div class="exec-summary-value">${dados.decisoes} etapa(s) | ${formatarPercentual(dados.taxaDecisao)}%</div>
      </div>
    </div>
  `;
}

/* =====================================================================
   ONDA 3 — C2.2: filtro de raia na Análise do Processo
   A seleção (raia ou Todos) recalcula os números via coletarDados(filtro).
===================================================================== */
function aplicarFiltroAnalise(area) {
  filtroAnaliseArea = area || "";
  renderAnaliseComFiltro();
}

function renderFTEResumo(fte, filtroArea) {
  let html = `<div class="exec-card${blocoColapsado("fte") ? " colapsado" : ""}" data-bloco="fte">${tituloBlocoColapsavel("fte", "FTE", "exec-card-title")}`;
  html += `<div class="exec-summary-grid">
      <div class="exec-summary-item" title="Soma do tempo de todas as atividades multiplicado pela volumetria (execu\u00e7\u00f5es/m\u00eas) \u2014 quantas pessoas em tempo integral esse processo consome."><div class="exec-summary-label">FTE ${filtroArea ? "da raia" : "total"}</div><div class="exec-summary-value">${formatarFTE(fte.fteTotal)}${avisoSemTempoHTML(filtroArea)}</div></div>
      <div class="exec-summary-item" title="Quantas vezes o processo \u00e9 executado por m\u00eas."><div class="exec-summary-label">Volumetria</div><div class="exec-summary-value">${fte.volumetria ? fte.volumetria + " /m\u00eas" : "N\u00e3o informado"}</div></div>
      <div class="exec-summary-item" title="Quantidade de horas dispon\u00edveis por um FTE (uma pessoa) por m\u00eas \u2014 base de c\u00e1lculo do FTE do processo."><div class="exec-summary-label">Valor FTE</div><div class="exec-summary-value">${fte.valorFTE ? fte.valorFTE + " h/m\u00eas" : "N\u00e3o informado"}</div></div>
    </div>`;
  if (!filtroArea && fte.ftePorArea && fte.ftePorArea.length > 1) {
    const sufixoMensalFte = fte.volumetria > 0 ? " (mensal)" : "";
    const rows = fte.ftePorArea.map(a =>
      `<tr><td>${escaparHTML(a.area)}</td><td class="td-center">${formatarTempo(a.tempoSegMensal)}</td><td class="td-center">${formatarFTE(a.fte)}</td></tr>`
    ).join("");
    html += `<div class="exec-table-block"><div class="exec-table-title">FTE por \u00e1rea</div><div class="exec-table-wrap"><table class="exec-table"><thead><tr><th>\u00c1rea</th><th class="th-center">Tempo${sufixoMensalFte}</th><th class="th-center">FTE</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }
  html += `</div>`;
  return html;
}

/* =====================================================================
   ONDA 3 — Handoffs entre áreas
   Um handoff é toda conexão (Sim/Não/extra) em que a raia de origem é
   diferente da raia de destino. Métrica-chave de business case: cada
   troca de bastão entre áreas é fonte de espera, retrabalho e perda de
   contexto. O grafo é sempre montado sobre o fluxo INTEIRO; o filtro de
   raia decide apenas o recorte exibido. Usa os mesmos helpers do motor
   (quebrarListaIds / destinoEhValido) para ler as conexões.
===================================================================== */
function calcularHandoffs() {
  const etapas = obterEtapasDaTabela();
  const idsValidos = new Set(etapas.map(e => e.id));
  const etapaPorId = {};
  etapas.forEach(e => { etapaPorId[e.id] = e; });

  const parCount = {};        // "Origem\u0000Destino" -> count
  let total = 0;
  let totalConexoes = 0;

  etapas.forEach(etapa => {
    const areaOrigem = etapa.area || "Sem \u00c1rea";
    const destinos = []
      .concat(quebrarListaIds(etapa.proxSim))
      .concat(quebrarListaIds(etapa.proxNao))
      .concat(quebrarListaIds(etapa.conexoesExtras))
      .filter(d => destinoEhValido(d, idsValidos));

    // Deduplica por nó de destino: a mesma transição origem->destino conta 1x,
    // mesmo que apareça em proxSim e em conexoesExtras ao mesmo tempo
    // (ex.: "Sim = próxima da ordem" reaplicado sobre uma conexão extra já existente).
    const destinosVistos = new Set();

    destinos.forEach(destinoId => {
      if (destinosVistos.has(destinoId)) return;
      destinosVistos.add(destinoId);
      const destino = etapaPorId[destinoId];
      if (!destino) return;
      totalConexoes++;
      const areaDestino = destino.area || "Sem \u00c1rea";
      if (areaOrigem !== areaDestino) {
        total++;
        const chave = areaOrigem + "\u0000" + areaDestino;
        parCount[chave] = (parCount[chave] || 0) + 1;
      }
    });
  });

  const pares = Object.entries(parCount)
    .map(([chave, count]) => {
      const partes = chave.split("\u0000");
      return { origem: partes[0], destino: partes[1], count };
    })
    .sort((a, b) => (b.count - a.count) || a.origem.localeCompare(b.origem, "pt-BR"));

  const areasSet = new Set();
  pares.forEach(p => { areasSet.add(p.origem); areasSet.add(p.destino); });

  return { total, totalConexoes, pares, areasEnvolvidas: areasSet.size };
}

function renderHandoffs(h, filtroArea) {
  // Sem nenhum handoff no processo inteiro.
  if (!h || h.total === 0) {
    return `<div class="exec-card${blocoColapsado("handoffs") ? " colapsado" : ""}" data-bloco="handoffs">${tituloBlocoColapsavel("handoffs", "Handoffs entre \u00e1reas", "exec-card-title")}
      <div class="exec-summary-grid">
        <div class="exec-summary-item" title="Quantas vezes o processo muda de \u00e1rea (troca de bast\u00e3o entre raias)."><div class="exec-summary-label">Total de handoffs</div><div class="exec-summary-value">0</div></div>
      </div>
      <div class="analytics-item">Nenhuma troca de bast\u00e3o entre \u00e1reas neste fluxo.</div>
    </div>`;
  }

  // Escopo "Todos" — matriz completa área → área.
  if (!filtroArea) {
    const rows = h.pares.map(p =>
      `<tr><td>${escaparHTML(p.origem)}</td><td>${escaparHTML(p.destino)}</td><td class="td-center">${p.count}</td></tr>`
    ).join("");
    return `<div class="exec-card${blocoColapsado("handoffs") ? " colapsado" : ""}" data-bloco="handoffs">${tituloBlocoColapsavel("handoffs", "Handoffs entre \u00e1reas", "exec-card-title")}
      <div class="exec-summary-grid">
        <div class="exec-summary-item" title="Quantas vezes o processo muda de \u00e1rea (troca de bast\u00e3o entre raias)."><div class="exec-summary-label">Total de handoffs</div><div class="exec-summary-value">${h.total}</div></div>
        <div class="exec-summary-item" title="Quantas \u00e1reas (raias) diferentes participam deste processo."><div class="exec-summary-label">\u00c1reas envolvidas</div><div class="exec-summary-value">${h.areasEnvolvidas}</div></div>
        <div class="exec-summary-item" title="Quantos pares distintos de \u00e1rea de origem \u2192 \u00e1rea de destino existem nas trocas de bast\u00e3o."><div class="exec-summary-label">Interfaces entre \u00e1reas</div><div class="exec-summary-value">${h.pares.length}</div></div>
      </div>
      <div class="exec-table-block"><div class="exec-table-title">Handoffs detalhado (\u00e1rea \u2192 \u00e1rea)</div>
        <div class="exec-table-wrap"><table class="exec-table">
          <thead><tr><th>De</th><th>Para</th><th class="th-center">Handoffs</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>
    </div>`;
  }

  // Escopo de uma raia — entradas e saídas dela.
  const saida = h.pares.filter(p => p.origem === filtroArea);
  const entrada = h.pares.filter(p => p.destino === filtroArea);
  const totalSaida = saida.reduce((s, p) => s + p.count, 0);
  const totalEntrada = entrada.reduce((s, p) => s + p.count, 0);

  const rowsSaida = saida.map(p =>
    `<tr><td class="td-center">Sa\u00edda</td><td>${escaparHTML(p.destino)}</td><td class="td-center">${p.count}</td></tr>`
  );
  const rowsEntrada = entrada.map(p =>
    `<tr><td class="td-center">Entrada</td><td>${escaparHTML(p.origem)}</td><td class="td-center">${p.count}</td></tr>`
  );
  const corpo = rowsSaida.concat(rowsEntrada).join("")
    || '<tr><td colspan="3">Nenhuma troca com outras \u00e1reas.</td></tr>';

  return `<div class="exec-card${blocoColapsado("handoffs") ? " colapsado" : ""}" data-bloco="handoffs">${tituloBlocoColapsavel("handoffs", "Handoffs entre \u00e1reas", "exec-card-title")}
    <div class="exec-summary-grid">
      <div class="exec-summary-item" title="Quantas vezes esta \u00e1rea troca o processo com outra \u00e1rea, somando sa\u00eddas e entradas."><div class="exec-summary-label">Total da raia</div><div class="exec-summary-value">${totalSaida + totalEntrada}</div></div>
      <div class="exec-summary-item" title="Quantas vezes o processo sai desta \u00e1rea direto para outra."><div class="exec-summary-label">Sa\u00eddas (para outras)</div><div class="exec-summary-value">${totalSaida}</div></div>
      <div class="exec-summary-item" title="Quantas vezes o processo chega nesta \u00e1rea vindo de outra."><div class="exec-summary-label">Entradas (de outras)</div><div class="exec-summary-value">${totalEntrada}</div></div>
    </div>
    <div class="exec-table-block"><div class="exec-table-title">Trocas envolvendo esta raia</div>
      <div class="exec-table-wrap"><table class="exec-table">
        <thead><tr><th class="th-center">Sentido</th><th>Outra \u00e1rea</th><th class="th-center">Handoffs</th></tr></thead>
        <tbody>${corpo}</tbody>
      </table></div>
    </div>
  </div>`;
}

function renderAnaliseComFiltro() {
  const cont = document.getElementById("metricas");
  if (!cont) return;

  const areasAtuais = Array.from(new Set(
    obterEtapasDaTabela().map(e => limpar(e.area || "") || "Sem \u00c1rea")
  ));
  if (filtroAnaliseArea && !areasAtuais.includes(filtroAnaliseArea)) {
    filtroAnaliseArea = "";
  }

  const dados = coletarDadosAnaliseEstruturados(filtroAnaliseArea);
  if (!dados) { cont.innerHTML = ""; return; }

  let etapasFiltradas = obterEtapasDaTabela();
  if (filtroAnaliseArea) {
    etapasFiltradas = etapasFiltradas.filter(e => (limpar(e.area || "") || "Sem \u00c1rea") === filtroAnaliseArea);
  }
  const fte = calcularFTE(dados.tempoTotalPorExecucao, etapasFiltradas);

  const opts = ['<option value="">Todos</option>'].concat(
    areasAtuais.map(a => `<option value="${escaparHTML(a)}" ${a === filtroAnaliseArea ? "selected" : ""}>${escaparHTML(a)}</option>`)
  ).join("");

  const filtroHTML = `<div class="analise-filtro"><label title="Selecione uma área para focar a análise nela, ou deixe em &quot;Todos&quot; para ver o processo inteiro.">Qual área você quer analisar?</label><select onchange="aplicarFiltroAnalise(this.value)">${opts}</select></div>`;

  const handoffs = calcularHandoffs();

  cont.innerHTML = filtroHTML + renderFTEResumo(fte, filtroAnaliseArea) + renderHandoffs(handoffs, filtroAnaliseArea) + renderizarAnaliseExecutiva(dados);
}

function renderizarAnaliseExecutiva(dados) {
  // Com volumetria informada, todo tempo abaixo já vem multiplicado (volume
  // mensal, coerente com o FTE) — deixa isso explícito nos rótulos, senão os
  // números saltam sem explicação em relação ao "tempo por execução" mostrado
  // no topo (ver coletarDadosAnaliseEstruturados, em 09-pdf.js).
  const sufixoMensal = dados.volumetriaAplicada ? " (mensal)" : "";

  const top3Rows = dados.top3Gargalos.map(item => ({
    atividade: item.atividade,
    tempoFmt: formatarTempo(item.tempo),
    percentualFmt: `${formatarPercentual(item.percentual)}%`,
    paretoFmt: `${formatarPercentual(item.pareto)}%`
  }));

  const tipoRows = dados.tempoPorTipo.map(item => ({
    tipo: item.tipo,
    tempoFmt: formatarTempo(item.tempo),
    percentualFmt: `${formatarPercentual(item.percentual)}%`,
    paretoFmt: `${formatarPercentual(item.pareto)}%`
  }));

  const sistemaRows = dados.tempoPorSistema.map(item => ({
    sistema: item.sistema,
    tempoFmt: formatarTempo(item.tempo),
    percentualFmt: `${formatarPercentual(item.percentual)}%`,
    paretoFmt: `${formatarPercentual(item.pareto)}%`
  }));

  const paretoRows = dados.pareto.map(item => ({
    atividade: item.atividade,
    tempoFmt: formatarTempo(item.tempo),
    percentualFmt: `${formatarPercentual(item.percentual)}%`,
    paretoFmt: `${formatarPercentual(item.pareto)}%`
  }));

  return `
    <div class="exec-card${blocoColapsado("analise-processo") ? " colapsado" : ""}" data-bloco="analise-processo">
      ${tituloBlocoColapsavel("analise-processo", "Análise do Processo", "exec-card-title")}

      ${renderResumoAnaliseExecutivo(dados)}

      ${renderTabelaAnaliseHTML({
        chave: "top3-gargalos",
        titulo: "Top 3 Gargalos",
        layoutFixo: true,
        columns: [
          { header: "Atividade", key: "atividade", align: "left", width: "38%" },
          { header: "Tempo (horas)" + sufixoMensal, key: "tempoFmt", align: "center", width: "26%" },
          { header: "%", key: "percentualFmt", align: "center", width: "16%" },
          { header: "Pareto", key: "paretoFmt", align: "center", width: "20%" }
        ],
        rows: top3Rows
      })}

      ${renderTabelaAnaliseHTML({
        chave: "tempo-tipo",
        titulo: "Tempo por Tipo",
        layoutFixo: true,
        columns: [
          { header: "Tipo", key: "tipo", align: "left", width: "38%" },
          { header: "Tempo (horas)" + sufixoMensal, key: "tempoFmt", align: "center", width: "26%" },
          { header: "%", key: "percentualFmt", align: "center", width: "16%" },
          { header: "Pareto", key: "paretoFmt", align: "center", width: "20%" }
        ],
        rows: tipoRows
      })}

      ${renderTabelaAnaliseHTML({
        chave: "tempo-sistema",
        titulo: "Tempo por Sistema",
        layoutFixo: true,
        columns: [
          { header: "Sistema", key: "sistema", align: "left", width: "38%" },
          { header: "Tempo (horas)" + sufixoMensal, key: "tempoFmt", align: "center", width: "26%" },
          { header: "%", key: "percentualFmt", align: "center", width: "16%" },
          { header: "Pareto", key: "paretoFmt", align: "center", width: "20%" }
        ],
        rows: sistemaRows
      })}

      ${renderTabelaAnaliseHTML({
        chave: "pareto",
        titulo: "Pareto de Tempo",
        layoutFixo: true,
        columns: [
          { header: "Atividade", key: "atividade", align: "left", width: "38%" },
          { header: "Tempo (horas)" + sufixoMensal, key: "tempoFmt", align: "center", width: "26%" },
          { header: "%", key: "percentualFmt", align: "center", width: "16%" },
          { header: "Pareto", key: "paretoFmt", align: "center", width: "20%" }
        ],
        rows: paretoRows
      })}
    </div>
  `;
}


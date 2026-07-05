/* =========================================================
   06-analise.js  |  Gerador de Fluxograma
   Análise do processo: resumo de tempo, Pareto, FTE, render executivo
   (linhas 4217-4544 do script.js original - corte contiguo, sem alteracao de codigo)
   ========================================================= */
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
      tempoSeg: seg,
      fte: valido ? ((seg / 3600) * volumetria) / valorFTE : null
    }))
    .sort((x, y) => y.tempoSeg - x.tempoSeg);

  return { valorFTE, volumetria, fteTotal, ftePorArea, valido };
}

function formatarFTE(v) {
  if (v == null) return "Não informado";
  return (Math.round(v * 100) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function renderInformacoesProcessoExecutivas(info) {
  return `
    <div class="exec-card">
      <div class="exec-card-title">Informações do Processo</div>
      <div class="exec-info-grid">
        <div class="exec-info-item">
          <div class="exec-info-label">Desenho</div>
          <div class="exec-info-value">${escaparHTML(info.desenho || "Não informado")}</div>
        </div>
        <div class="exec-info-item">
          <div class="exec-info-label">Processo</div>
          <div class="exec-info-value">${escaparHTML(info.processo || "Não informado")}</div>
        </div>
        <div class="exec-info-item">
          <div class="exec-info-label">Analista</div>
          <div class="exec-info-value">${escaparHTML(info.analista || "Não informado")}</div>
        </div>
        <div class="exec-info-item">
          <div class="exec-info-label">Negócio</div>
          <div class="exec-info-value">${escaparHTML(info.negocio || "Não informado")}</div>
        </div>
        <div class="exec-info-item">
          <div class="exec-info-label">Área</div>
          <div class="exec-info-value">${escaparHTML(info.area || "Não informado")}</div>
        </div>
        <div class="exec-info-item">
          <div class="exec-info-label">Gestor</div>
          <div class="exec-info-value">${escaparHTML(info.gestor || "Não informado")}</div>
        </div>
        <div class="exec-info-item">
          <div class="exec-info-label">Valor FTE (h/mês)</div>
          <div class="exec-info-value">${info.valorFTE ? info.valorFTE : "Não informado"}</div>
        </div>
        <div class="exec-info-item">
          <div class="exec-info-label">Volumetria (exec./mês)</div>
          <div class="exec-info-value">${info.volumetria ? info.volumetria : "Não informado"}</div>
        </div>
        <div class="exec-info-item">
          <div class="exec-info-label">Tempo por execução</div>
          <div class="exec-info-value">${info.tempoTotal != null ? formatarTempo(info.tempoTotal) : "Não informado"}</div>
        </div>
        <div class="exec-info-item">
          <div class="exec-info-label">FTE total</div>
          <div class="exec-info-value">${formatarFTE(info.fteTotal != null ? info.fteTotal : null)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderTabelaAnaliseHTML({ titulo, columns, rows }) {
  const thead = `
    <thead>
      <tr>
        ${columns.map(col => `
          <th class="${col.align === "center" ? "th-center" : ""}">
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
            <td class="${col.align === "center" ? "td-center" : ""}">
              ${escaparHTML(row[col.key] ?? "")}
            </td>
          `).join("")}
        </tr>
      `).join("")}
    </tbody>
  `;

  return `
    <div class="exec-table-block">
      <div class="exec-table-title">${escaparHTML(titulo)}</div>
      <div class="exec-table-wrap">
        <table class="exec-table">
          ${thead}
          ${tbody}
        </table>
      </div>
    </div>
  `;
}

function renderResumoAnaliseExecutivo(dados) {
  return `
    <div class="exec-summary-grid">
      <div class="exec-summary-item">
        <div class="exec-summary-label">Tempo total do processo</div>
        <div class="exec-summary-value">${formatarTempo(dados.tempoTotal)}</div>
      </div>
      <div class="exec-summary-item">
        <div class="exec-summary-label">Loops detectados</div>
        <div class="exec-summary-value">${dados.loops}</div>
      </div>
      <div class="exec-summary-item">
        <div class="exec-summary-label">Potencial retrabalho</div>
        <div class="exec-summary-value">${formatarTempo(dados.tempoPotencialRetrabalho)} | ${formatarPercentual(dados.impactoPotencialRetrabalho)}%</div>
      </div>
      <div class="exec-summary-item">
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
  const escopo = filtroArea ? `Raia: ${escaparHTML(filtroArea)}` : "Processo inteiro";
  let html = `<div class="exec-card"><div class="exec-card-title">FTE \u2014 ${escopo}</div>`;
  html += `<div class="exec-summary-grid">
      <div class="exec-summary-item"><div class="exec-summary-label">FTE ${filtroArea ? "da raia" : "total"}</div><div class="exec-summary-value">${formatarFTE(fte.fteTotal)}</div></div>
      <div class="exec-summary-item"><div class="exec-summary-label">Volumetria</div><div class="exec-summary-value">${fte.volumetria ? fte.volumetria + " /m\u00eas" : "N\u00e3o informado"}</div></div>
      <div class="exec-summary-item"><div class="exec-summary-label">Valor FTE</div><div class="exec-summary-value">${fte.valorFTE ? fte.valorFTE + " h/m\u00eas" : "N\u00e3o informado"}</div></div>
    </div>`;
  if (!filtroArea && fte.ftePorArea && fte.ftePorArea.length > 1) {
    const rows = fte.ftePorArea.map(a =>
      `<tr><td>${escaparHTML(a.area)}</td><td class="td-center">${formatarTempo(a.tempoSeg)}</td><td class="td-center">${formatarFTE(a.fte)}</td></tr>`
    ).join("");
    html += `<div class="exec-table-block"><div class="exec-table-title">FTE por \u00e1rea</div><div class="exec-table-wrap"><table class="exec-table"><thead><tr><th>\u00c1rea</th><th class="th-center">Tempo</th><th class="th-center">FTE</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }
  html += `</div>`;
  return html;
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
  const fte = calcularFTE(dados.tempoTotal, etapasFiltradas);

  const opts = ['<option value="">Todos</option>'].concat(
    areasAtuais.map(a => `<option value="${escaparHTML(a)}" ${a === filtroAnaliseArea ? "selected" : ""}>${escaparHTML(a)}</option>`)
  ).join("");

  const filtroHTML = `<div class="analise-filtro"><label>Raia:</label><select onchange="aplicarFiltroAnalise(this.value)">${opts}</select></div>`;

  cont.innerHTML = filtroHTML + renderFTEResumo(fte, filtroAnaliseArea) + renderizarAnaliseExecutiva(dados);
}

function renderizarAnaliseExecutiva(dados) {
  const top3Rows = dados.top3Gargalos.map(item => ({
    atividade: item.atividade,
    tempoFmt: formatarTempo(item.tempo),
    percentualFmt: `${formatarPercentual(item.percentual)}%`
  }));

  const tipoRows = dados.tempoPorTipo.map(item => ({
    tipo: item.tipo,
    tempoFmt: formatarTempo(item.tempo),
    percentualFmt: `${formatarPercentual(item.percentual)}%`
  }));

  const sistemaRows = dados.tempoPorSistema.map(item => ({
    sistema: item.sistema,
    tempoFmt: formatarTempo(item.tempo),
    percentualFmt: `${formatarPercentual(item.percentual)}%`
  }));

  const paretoRows = dados.pareto.map(item => ({
    atividade: item.atividade,
    tempoFmt: formatarTempo(item.tempo),
    percentualFmt: `${formatarPercentual(item.percentual)}%`,
    paretoFmt: `${formatarPercentual(item.pareto)}%`
  }));

  return `
    <div class="exec-card">
      <div class="exec-card-title">Análise do Processo</div>

      ${renderResumoAnaliseExecutivo(dados)}

      ${renderTabelaAnaliseHTML({
        titulo: "Top 3 Gargalos",
        columns: [
          { header: "Atividade", key: "atividade", align: "left" },
          { header: "Tempo (horas)", key: "tempoFmt", align: "center" },
          { header: "%", key: "percentualFmt", align: "center" }
        ],
        rows: top3Rows
      })}

      ${renderTabelaAnaliseHTML({
        titulo: "Tempo por Tipo",
        columns: [
          { header: "Tipo", key: "tipo", align: "left" },
          { header: "Tempo (horas)", key: "tempoFmt", align: "center" },
          { header: "%", key: "percentualFmt", align: "center" }
        ],
        rows: tipoRows
      })}

      ${renderTabelaAnaliseHTML({
        titulo: "Tempo por Sistema",
        columns: [
          { header: "Sistema", key: "sistema", align: "left" },
          { header: "Tempo (horas)", key: "tempoFmt", align: "center" },
          { header: "%", key: "percentualFmt", align: "center" }
        ],
        rows: sistemaRows
      })}

      ${renderTabelaAnaliseHTML({
        titulo: "Pareto de Tempo",
        columns: [
          { header: "Atividade", key: "atividade", align: "left" },
          { header: "Tempo (horas)", key: "tempoFmt", align: "center" },
          { header: "%", key: "percentualFmt", align: "center" },
          { header: "Pareto", key: "paretoFmt", align: "center" }
        ],
        rows: paretoRows
      })}
    </div>
  `;
}


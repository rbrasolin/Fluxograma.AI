/* =========================================================
   11-editor.js  |  Gerador de Fluxograma
   Editor interativo (Onda 2): popover, mover caixa, conexões, terminais, raias
   (linhas 6664-7810 do script.js original - corte contiguo, sem alteracao de codigo)
   ========================================================= */
function chaveOverride(origemId, destinoId) {
  return `${origemId}__${destinoId}`;
}

function obterOverrideConexao(origemId, destinoId) {
  if (!overridesConexoes) return null;
  return overridesConexoes[chaveOverride(origemId, destinoId)] || null;
}

/* Rótulo final de uma conexão: usa o rótulo explícito (Sim/Não) se o
   usuário definiu; caso contrário, o padrão calculado pelo motor. */
function rotuloConexaoFinal(origemId, destinoId, padrao) {
  if (!rotulosConexoes) return padrao;
  const v = rotulosConexoes[chaveOverride(origemId, destinoId)];
  return (v === undefined || v === null) ? padrao : v;
}

/* ---------- Toggle do modo de edição ---------- */
function alternarModoEdicao() {
  if (!document.querySelector("#diagram svg")) {
    gerarFluxo();
    if (!document.querySelector("#diagram svg")) {
      mostrarToast("Gere o fluxo primeiro.", "alerta");
      return;
    }
  }

  modoEdicaoAtivo = !modoEdicaoAtivo;
  const btn = document.getElementById("btnAjustarFluxo");

  if (modoEdicaoAtivo) {
    if (btn) { btn.classList.add("ativo"); btn.textContent = "Concluir ajustes"; }
    aplicarCamadaEdicao();
    renderPainelRaias();
    mostrarToast("Modo de ajuste ativo: clique numa seta para corrigir entrada/saída.", "info", 4500);
  } else {
    if (btn) { btn.classList.remove("ativo"); btn.textContent = "Ajustar fluxo"; }
    removerCamadaEdicao();
    fecharPopoverConexao();
    mostrarToast("Ajustes concluídos.", "ok");
  }
}

/* ---------- Camada clicável sobre as setas ---------- */
function aplicarCamadaEdicao() {
  const svg = document.querySelector("#diagram svg");
  if (!svg) return;

  // remove camada anterior, se houver
  const antiga = svg.querySelector("g.editor-ui");
  if (antiga) antiga.remove();

  const g = criarElementoSVG("g");
  g.setAttribute("class", "editor-ui");

  svg.querySelectorAll("path.conexao-fluxo").forEach((p) => {
    const origemId = p.getAttribute("data-origem");
    const destinoId = p.getAttribute("data-destino");

    // destaque da conexão selecionada
    if (
      conexaoSelecionada &&
      conexaoSelecionada.origemId === origemId &&
      conexaoSelecionada.destinoId === destinoId
    ) {
      p.setAttribute("stroke", "#1d6fe0");
      p.setAttribute("stroke-width", CONFIG.lineWidth + 1.4);
    } else {
      p.setAttribute("stroke", "#111111");
      p.setAttribute("stroke-width", CONFIG.lineWidth);
    }

    // área de clique mais larga (transparente) por cima da seta
    const hit = criarElementoSVG("path");
    hit.setAttribute("d", p.getAttribute("d"));
    hit.setAttribute("fill", "none");
    hit.setAttribute("stroke", "rgba(0,0,0,0.001)");
    hit.setAttribute("stroke-width", "16");
    hit.setAttribute("stroke-linecap", "round");
    hit.setAttribute("style", "cursor:pointer");
    hit.addEventListener("click", (ev) => {
      ev.stopPropagation();
      abrirPopoverConexao(origemId, destinoId, ev.clientX, ev.clientY);
    });
    g.appendChild(hit);
  });

  // Caixas clicáveis para "mover caixa" (Onda 3 / 3b)
  if (ultimasPosicoesNos) {
    const mapaMov = mapaIdVisualUid();
    mapaMov.validas.forEach((l) => {
      const idVis = mapaMov.uidParaVisual[l.uid];
      const pos = ultimasPosicoesNos[idVis];
      if (!pos) return;
      const hitNo = criarElementoSVG("rect");
      hitNo.setAttribute("x", pos.x);
      hitNo.setAttribute("y", pos.y);
      hitNo.setAttribute("width", pos.w);
      hitNo.setAttribute("height", pos.h);
      hitNo.setAttribute("fill", "rgba(0,0,0,0.001)");
      hitNo.setAttribute("style", "cursor:move");
      hitNo.addEventListener("click", (ev) => {
        ev.stopPropagation();
        abrirMoverCaixa(l.uid, ev);
      });
      g.appendChild(hitNo);
    });
  }

  svg.appendChild(g);
}

function removerCamadaEdicao() {
  const svg = document.querySelector("#diagram svg");
  if (svg) {
    const g = svg.querySelector("g.editor-ui");
    if (g) g.remove();
    // restaura aparência padrão das conexões
    svg.querySelectorAll("path.conexao-fluxo").forEach((p) => {
      p.setAttribute("stroke", "#111111");
      p.setAttribute("stroke-width", CONFIG.lineWidth);
    });
  }
  const painel = document.getElementById("painelRaias");
  if (painel) painel.remove();
  conexaoSelecionada = null;
}

/* ---------- Popover de ajuste de uma conexão ---------- */
let popoverPos = { x: 0, y: 0 };

function abrirPopoverConexao(origemId, destinoId, x, y) {
  conexaoSelecionada = { origemId, destinoId };
  popoverPos = { x, y };
  renderPopoverConexao();
  aplicarCamadaEdicao(); // reforça o destaque da selecionada
}

function rotuloNo(id) {
  if (id === "__INICIO__") return "Início";
  if (id === "__FIM__") return "Fim";
  return id;
}

function renderPopoverConexao() {
  if (!conexaoSelecionada) return;

  let pop = document.getElementById("popoverConexao");
  if (!pop) {
    pop = document.createElement("div");
    pop.id = "popoverConexao";
    document.body.appendChild(pop);
  }

  const { origemId, destinoId } = conexaoSelecionada;
  const override = obterOverrideConexao(origemId, destinoId) || {};
  const estrutural = conexaoEhEstrutural(origemId, destinoId);

  const botoesLado = (qual, ativo) =>
    LADOS.map(l => {
      const sel = ativo === l.lado ? " sel" : "";
      return `<button type="button" class="lado-btn${sel}" title="${l.nome}"
        onclick="definirLadoConexao('${qual}','${l.lado}')">${l.icone}</button>`;
    }).join("");

  // Seletor de destino (só para conexões entre atividades reais)
  let blocoDestino = "";
  if (estrutural) {
    const opcoes = listaAtividadesSelect()
      .map(a => {
        const sel = a.id === destinoId ? " selected" : "";
        return `<option value="${escaparHTML(a.id)}"${sel}>${escaparHTML(a.label)}</option>`;
      })
      .join("");
    blocoDestino = `
      <div class="pop-grupo">
        <div class="pop-label">Conectar em (destino)</div>
        <select class="pop-select"
          onchange="alterarDestinoConexao('${origemId}','${destinoId}', this.value)">
          ${opcoes}
        </select>
      </div>`;
  }

  const acoesRodape = estrutural
    ? `<button type="button" class="pop-apagar" onclick="apagarConexao('${origemId}','${destinoId}')">Apagar seta</button>
       <button type="button" class="pop-auto" onclick="resetarConexaoAtual()">Lados automáticos</button>`
    : `<button type="button" class="pop-apagar" onclick="apagarSetaTerminal('${origemId}','${destinoId}')">Apagar seta</button>
       <button type="button" class="pop-auto" onclick="resetarConexaoAtual()">Lados automáticos</button>`;

  pop.innerHTML = `
    <div class="pop-header">
      <span class="pop-titulo">${escaparHTML(rotuloNoComId(origemId))}<br>→ ${escaparHTML(rotuloNoComId(destinoId))}</span>
      <button type="button" class="pop-fechar" onclick="fecharPopoverConexao()">✕</button>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Saída de ${escaparHTML(descricaoNo(origemId))}</div>
      <div class="pop-botoes">${botoesLado("start", override.startSide)}</div>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Entrada em ${escaparHTML(descricaoNo(destinoId))}</div>
      <div class="pop-botoes">${botoesLado("end", override.endSide)}</div>
    </div>
    ${blocoDestino}
    <div class="pop-rodape pop-rodape-acoes">
      ${acoesRodape}
    </div>
  `;

  // posiciona dentro da viewport
  pop.style.display = "block";
  const margem = 10;
  const larg = pop.offsetWidth || 240;
  const alt = pop.offsetHeight || 200;
  let px = popoverPos.x + 12;
  let py = popoverPos.y + 12;
  if (px + larg + margem > window.innerWidth) px = window.innerWidth - larg - margem;
  if (py + alt + margem > window.innerHeight) py = window.innerHeight - alt - margem;
  pop.style.left = Math.max(margem, px) + "px";
  pop.style.top = Math.max(margem, py) + "px";
}

function fecharPopoverConexao() {
  const pop = document.getElementById("popoverConexao");
  if (pop) pop.style.display = "none";
  conexaoSelecionada = null;
  if (modoEdicaoAtivo) aplicarCamadaEdicao();
}

function definirLadoConexao(qual, lado) {
  if (!conexaoSelecionada) return;
  const { origemId, destinoId } = conexaoSelecionada;
  const chave = chaveOverride(origemId, destinoId);
  const atual = overridesConexoes[chave] ? { ...overridesConexoes[chave] } : {};

  if (qual === "start") {
    atual.startSide = lado;
    if (!atual.endSide) atual.endSide = "left"; // completa para a rota ter efeito imediato
  } else {
    atual.endSide = lado;
    if (!atual.startSide) atual.startSide = "right";
  }

  overridesConexoes[chave] = atual;
  salvarEstadoLocal(true);
  gerarFluxo();          // re-renderiza respeitando o override
  renderPopoverConexao();// reflete a seleção atual nos botões
}

function resetarConexaoAtual() {
  if (!conexaoSelecionada) return;
  const chave = chaveOverride(conexaoSelecionada.origemId, conexaoSelecionada.destinoId);
  delete overridesConexoes[chave];
  salvarEstadoLocal(true);
  gerarFluxo();
  renderPopoverConexao();
  mostrarToast("Conexão voltou ao roteamento automático.", "ok");
}

/* ---------- Painel de ordenação das raias ---------- */
function renderPainelRaias() {
  let painel = document.getElementById("painelRaias");
  if (!painel) {
    painel = document.createElement("div");
    painel.id = "painelRaias";
    const ref = document.getElementById("diagramScrollTop");
    if (ref && ref.parentNode) {
      ref.parentNode.insertBefore(painel, ref);
    } else {
      const wrap = document.getElementById("diagramWrap");
      if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(painel, wrap);
    }
  }

  const areas = (ultimasAreasOrdenadas && ultimasAreasOrdenadas.length)
    ? ultimasAreasOrdenadas
    : [];

  if (!areas.length) {
    painel.innerHTML = "";
    return;
  }

  const itens = areas.map((nome, i) => `
    <div class="raia-item">
      <span class="raia-pos">${i + 1}º</span>
      <span class="raia-nome" title="${escaparHTML(nome)}">${escaparHTML(nome)}</span>
      <span class="raia-acoes">
        <button type="button" ${i === 0 ? "disabled" : ""} onclick="moverRaia('${escaparHTML(nome).replace(/'/g, "\\'")}', -1)" title="Subir">↑</button>
        <button type="button" ${i === areas.length - 1 ? "disabled" : ""} onclick="moverRaia('${escaparHTML(nome).replace(/'/g, "\\'")}', 1)" title="Descer">↓</button>
      </span>
    </div>`).join("");

  // Controles de Início/Fim (ponto 4)
  const atividades = listaAtividadesSelect();
  const opcInicio = [`<option value="">Primeira atividade (padrão)</option>`]
    .concat(atividades.map(a => {
      const sel = a.id === inicioAlvo ? " selected" : "";
      return `<option value="${escaparHTML(a.id)}"${sel}>${escaparHTML(a.label)}</option>`;
    })).join("");
  const opcFim = [`<option value="">Última atividade (padrão)</option>`]
    .concat(atividades.map(a => {
      const sel = a.id === fimOrigem ? " selected" : "";
      return `<option value="${escaparHTML(a.id)}"${sel}>${escaparHTML(a.label)}</option>`;
    })).join("");

  const listaTerminais = (terminais || []).map(t => `
    <div class="terminal-item">
      <span>${t.tipo === "inicio" ? "Início" : "Fim"} → ${escaparHTML(t.alvo)} · ${escaparHTML(descricaoNo(t.alvo))}</span>
      <button type="button" onclick="removerTerminal('${t.id}')" title="Remover">✕</button>
    </div>`).join("");

  const blocoTerminais = `
    <div class="terminais-bloco">
      <div class="terminais-titulo">Início e Fim</div>
      <div class="terminal-linha">
        <span class="pop-label">Início conecta em</span>
        <select class="pop-select" onchange="definirInicioAlvo(this.value)">${opcInicio}</select>
      </div>
      <div class="terminal-linha">
        <span class="pop-label">Fim vem de</span>
        <select class="pop-select" onchange="definirFimOrigem(this.value)">${opcFim}</select>
      </div>
      <div class="terminal-acoes">
        <button type="button" class="btn-terminal" onclick="abrirCriadorTerminal('inicio', event)">+ Início</button>
        <button type="button" class="btn-terminal" onclick="abrirCriadorTerminal('fim', event)">+ Fim</button>
      </div>
      ${listaTerminais ? `<div class="terminais-lista">${listaTerminais}</div>` : ""}
    </div>`;

  painel.innerHTML = `
    <div class="raias-header">
      <span>Ordem das raias</span>
      <button type="button" class="raias-reset" onclick="resetarAjustesFluxo()">Resetar ajustes</button>
    </div>
    <div class="raias-lista">${itens}</div>
    ${blocoTerminais}
    <div class="raias-dica">
      <button type="button" class="btn-nova-seta" onclick="abrirCriadorCaixa(event)">+ Nova caixa</button>
      <button type="button" class="btn-nova-seta" onclick="abrirCriadorConexao(event)">+ Nova seta</button>
      <span>Clique numa seta do fluxo para mudar lados, trocar destino ou apagar.</span>
    </div>
  `;
}

function moverRaia(nome, direcao) {
  let base = (ordemRaias && ordemRaias.length) ? [...ordemRaias] : [...ultimasAreasOrdenadas];
  // garante que todas as raias atuais estão na base e remove as que sumiram
  ultimasAreasOrdenadas.forEach(a => { if (!base.includes(a)) base.push(a); });
  base = base.filter(a => ultimasAreasOrdenadas.includes(a));

  const i = base.indexOf(nome);
  const j = i + direcao;
  if (i === -1 || j < 0 || j >= base.length) return;

  [base[i], base[j]] = [base[j], base[i]];
  ordemRaias = base;
  salvarEstadoLocal(true);
  gerarFluxo(); // re-render reaplica camada e painel
}

function resetarAjustesFluxo() {
  const temAjustes =
    (overridesConexoes && Object.keys(overridesConexoes).length) ||
    (ordemRaias && ordemRaias.length) ||
    (rotulosConexoes && Object.keys(rotulosConexoes).length) ||
    (terminais && terminais.length) ||
    inicioAlvo || fimOrigem || inicioOculto ||
    (Array.isArray(fluxoData) && fluxoData.some(l => l && l.semSaida));

  if (!temAjustes) {
    mostrarToast("Não há ajustes manuais para resetar.", "info");
    return;
  }

  if (!confirm("Remover todos os ajustes manuais de setas e ordem de raias?")) return;

  overridesConexoes = {};
  ordemRaias = [];
  rotulosConexoes = {};
  terminais = [];
  inicioAlvo = "";
  fimOrigem = "";
  inicioOculto = false;
  conexaoSelecionada = null;
  // limpa marcações de "sem saída" feitas manualmente
  fluxoData.forEach(l => { if (l) l.semSaida = false; });
  salvarEstadoLocal(true);
  gerarFluxo();
  fecharPopoverConexao();
  mostrarToast("Ajustes manuais removidos. Fluxo voltou ao automático.", "ok");
}

/* Fecha o popover ao clicar fora dele (e fora das setas) */
document.addEventListener("click", (event) => {
  const pop = document.getElementById("popoverConexao");
  if (!pop || pop.style.display === "none") return;
  if (event.target.closest("#popoverConexao")) return;
  if (event.target.closest("g.editor-ui")) return;
  fecharPopoverConexao();
});

/* =====================================================================
   ONDA 2.1 — Edição estrutural de conexões
   (trocar destino, apagar e criar setas; descrições por atividade)
   Mexe em fluxoData (proxSim / proxNao / extras), por UID.
===================================================================== */

function mapaIdVisualUid() {
  const validas = fluxoData.filter(l => limpar(l.atividade || "") !== "");
  const visualParaUid = {};
  const uidParaVisual = {};
  validas.forEach((l, i) => {
    const v = gerarIdVisual(i);
    visualParaUid[v] = l.uid;
    uidParaVisual[l.uid] = v;
  });
  return { visualParaUid, uidParaVisual, validas };
}

/* Descrição amigável de um nó (atividade), com fallback para o ID */
function descricaoNo(idVisual) {
  if (idVisual === "__INICIO__") return "Início";
  if (idVisual === "__FIM__") return "Fim";
  const { visualParaUid } = mapaIdVisualUid();
  const uid = visualParaUid[idVisual];
  const linha = fluxoData.find(l => l.uid === uid);
  const desc = linha ? limpar(linha.atividade || "") : "";
  return desc || idVisual;
}

/* Rótulo curto "C · Efetuar pagamento" para selects */
function rotuloNoComId(idVisual) {
  const desc = descricaoNo(idVisual);
  if (idVisual === "__INICIO__" || idVisual === "__FIM__") return desc;
  return `${idVisual} · ${desc}`;
}

/* Lista de atividades para os seletores de destino/origem */
function listaAtividadesSelect() {
  const { validas } = mapaIdVisualUid();
  return validas.map((l, i) => ({
    id: gerarIdVisual(i),
    label: `${gerarIdVisual(i)} · ${limpar(l.atividade || "")}`
  }));
}

function tipoConexaoPorUid(origemUid, destinoUid) {
  const linha = fluxoData.find(l => l.uid === origemUid);
  if (!linha) return null;
  if (linha.proxSim === destinoUid) return "sim";
  if (linha.proxNao === destinoUid) return "nao";
  if (Array.isArray(linha.extras) && linha.extras.includes(destinoUid)) return "extra";
  return null;
}

/* Uma conexão é "estrutural" (editável) quando liga duas atividades reais.
   Setas de/para Início e Fim são automáticas e não entram aqui. */
function conexaoEhEstrutural(origemVisual, destinoVisual) {
  const ehTerminal = (id) => typeof id === "string" && id.startsWith("__");
  return !ehTerminal(origemVisual) && !ehTerminal(destinoVisual);
}

function persistirEdicaoEstrutural() {
  salvarEstadoLocal(true);
  atualizarTabela();
  gerarFluxo();
}

function alterarDestinoConexao(origemVisual, destinoAntigo, destinoNovo) {
  if (destinoNovo === destinoAntigo) return;
  const { visualParaUid } = mapaIdVisualUid();
  const oUid = visualParaUid[origemVisual];
  const dAntigo = visualParaUid[destinoAntigo];
  const dNovo = visualParaUid[destinoNovo];
  const linha = fluxoData.find(l => l.uid === oUid);
  if (!linha || !dNovo) return;

  if (oUid === dNovo) {
    mostrarToast("Uma atividade não pode conectar nela mesma.", "alerta");
    return;
  }

  const tipo = tipoConexaoPorUid(oUid, dAntigo);
  if (tipo === "sim") {
    linha.proxSim = dNovo;
    linha.simRemovido = false;
  }
  else if (tipo === "nao") linha.proxNao = dNovo;
  else if (tipo === "extra") {
    const i = linha.extras.indexOf(dAntigo);
    if (i !== -1) linha.extras[i] = dNovo;
  } else {
    return;
  }

  // O override de lados era do par antigo; transfere para o novo par.
  const chaveAntiga = chaveOverride(origemVisual, destinoAntigo);
  const chaveNova = chaveOverride(origemVisual, destinoNovo);
  if (overridesConexoes[chaveAntiga]) {
    overridesConexoes[chaveNova] = overridesConexoes[chaveAntiga];
    delete overridesConexoes[chaveAntiga];
  }
  if (rotulosConexoes[chaveAntiga] !== undefined) {
    rotulosConexoes[chaveNova] = rotulosConexoes[chaveAntiga];
    delete rotulosConexoes[chaveAntiga];
  }

  conexaoSelecionada = { origemId: origemVisual, destinoId: destinoNovo };
  persistirEdicaoEstrutural();
  renderPopoverConexao();
  mostrarToast(`Destino alterado para ${destinoNovo}.`, "ok");
}

function apagarConexao(origemVisual, destinoVisual) {
  const { visualParaUid } = mapaIdVisualUid();
  const oUid = visualParaUid[origemVisual];
  const dUid = visualParaUid[destinoVisual];
  const linha = fluxoData.find(l => l.uid === oUid);
  if (!linha) return;

  const tipo = tipoConexaoPorUid(oUid, dUid);
  if (tipo === "sim") {
    linha.proxSim = "";
    linha.proxSimAuto = false;
    linha.simRemovido = true; // Sim removido de propósito: não reconectar automaticamente
  }
  else if (tipo === "nao") linha.proxNao = "";
  else if (tipo === "extra") linha.extras = linha.extras.filter(u => u !== dUid);
  else return;

  // Se não sobrou nenhuma saída, marca como "sem saída de propósito"
  // para o motor não reconectar ao Fim automaticamente.
  const aindaTemSaida =
    limpar(linha.proxSim || "") || limpar(linha.proxNao || "") ||
    (Array.isArray(linha.extras) && linha.extras.length > 0);
  linha.semSaida = !aindaTemSaida;

  delete overridesConexoes[chaveOverride(origemVisual, destinoVisual)];
  delete rotulosConexoes[chaveOverride(origemVisual, destinoVisual)];
  fecharPopoverConexao();
  persistirEdicaoEstrutural();
  mostrarToast("Seta removida.", "ok");
}

/* Excluir setas de terminais (Início/Fim padrão e adicionais) */
function apagarSetaTerminal(origemId, destinoId) {
  if (destinoId === "__FIM__") {
    // caixa -> Fim automático: marca a caixa como "sem saída de propósito"
    const { visualParaUid } = mapaIdVisualUid();
    const uid = visualParaUid[origemId];
    const linha = fluxoData.find(l => l.uid === uid);
    if (linha) linha.semSaida = true;
  } else if (origemId === "__INICIO__") {
    // Início padrão -> caixa: esconde o Início padrão
    inicioOculto = true;
  } else if (typeof origemId === "string" && origemId.startsWith("__INI_")) {
    // terminal Início adicional
    const tid = origemId.slice(6, -2);
    terminais = terminais.filter(t => t.id !== tid);
  } else if (typeof destinoId === "string" && destinoId.startsWith("__FIMX_")) {
    // terminal Fim adicional
    const tid = destinoId.slice(7, -2);
    terminais = terminais.filter(t => t.id !== tid);
  } else {
    mostrarToast("Essa seta não pode ser removida por aqui.", "alerta");
    return;
  }

  delete overridesConexoes[chaveOverride(origemId, destinoId)];
  fecharPopoverConexao();
  salvarEstadoLocal(true);
  gerarFluxo();
  mostrarToast("Seta removida. Você já pode criar uma nova (Sim/Não) com o + Nova seta.", "ok");
}

function criarConexao(origemVisual, destinoVisual, tipo) {
  const { visualParaUid } = mapaIdVisualUid();
  const oUid = visualParaUid[origemVisual];
  const dUid = visualParaUid[destinoVisual];
  if (!oUid || !dUid) {
    mostrarToast("Selecione origem e destino válidos.", "alerta");
    return;
  }
  if (oUid === dUid) {
    mostrarToast("Origem e destino não podem ser a mesma atividade.", "alerta");
    return;
  }
  const linha = fluxoData.find(l => l.uid === oUid);
  if (!Array.isArray(linha.extras)) linha.extras = [];

  const jaExiste =
    linha.proxSim === dUid || linha.proxNao === dUid || linha.extras.includes(dUid);
  if (jaExiste) {
    mostrarToast("Essa conexão já existe.", "alerta");
    return;
  }

  if (tipo === "sim") {
    if (linha.proxSim && linha.proxSim !== dUid && !linha.extras.includes(linha.proxSim)) {
      linha.extras.push(linha.proxSim); // não perde a saída anterior
    }
    linha.proxSim = dUid;
    linha.proxSimAuto = false;
    linha.simRemovido = false; // Sim recriado manualmente
  } else if (tipo === "nao") {
    linha.proxNao = dUid;
  } else {
    linha.extras.push(dUid);
  }

  // Caixa voltou a ter saída -> não é mais "sem saída de propósito".
  linha.semSaida = false;

  // Rótulo explícito: se o usuário escolheu Sim/Não, a seta sempre mostra o texto
  // (mesmo entre caixas que não são decisão).
  const chave = chaveOverride(origemVisual, destinoVisual);
  if (tipo === "sim") rotulosConexoes[chave] = "Sim";
  else if (tipo === "nao") rotulosConexoes[chave] = "Não";

  fecharCriadorConexao();
  persistirEdicaoEstrutural();
  mostrarToast(`Nova seta criada: ${origemVisual} → ${destinoVisual}.`, "ok");
}

/* ---------- Criador de nova conexão (formulário flutuante) ---------- */
function abrirCriadorConexao(ev) {
  const atividades = listaAtividadesSelect();
  if (atividades.length < 2) {
    mostrarToast("É preciso ter ao menos duas atividades para criar uma seta.", "alerta");
    return;
  }

  mostrarBackdropEditor();
  let box = document.getElementById("criadorConexao");
  if (!box) {
    box = document.createElement("div");
    box.id = "criadorConexao";
    document.body.appendChild(box);
  }

  const opcoes = atividades
    .map(a => `<option value="${escaparHTML(a.id)}">${escaparHTML(a.label)}</option>`)
    .join("");

  box.innerHTML = `
    <div class="pop-header">
      <span><b>Nova seta</b></span>
      <button type="button" class="pop-fechar" onclick="fecharCriadorConexao()">✕</button>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">De (origem)</div>
      <select id="novaConexaoOrigem" class="pop-select">${opcoes}</select>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Para (destino)</div>
      <select id="novaConexaoDestino" class="pop-select">${opcoes}</select>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Tipo</div>
      <select id="novaConexaoTipo" class="pop-select">
        <option value="extra">Conexão extra (sem rótulo)</option>
        <option value="sim">Saída principal (Sim)</option>
        <option value="nao">Saída "Não" (decisão)</option>
      </select>
    </div>
    <div class="pop-rodape pop-rodape-acoes">
      <button type="button" class="pop-criar" onclick="confirmarCriarConexao()">Criar seta</button>
    </div>
  `;

  // pré-seleciona destino diferente da origem
  const selDest = box.querySelector("#novaConexaoDestino");
  if (atividades.length > 1) selDest.selectedIndex = 1;

  posicionarFlutuante(box, ev);
}

function confirmarCriarConexao() {
  const o = document.getElementById("novaConexaoOrigem");
  const d = document.getElementById("novaConexaoDestino");
  const t = document.getElementById("novaConexaoTipo");
  if (!o || !d || !t) return;
  criarConexao(o.value, d.value, t.value);
}

function fecharCriadorConexao() {
  const box = document.getElementById("criadorConexao");
  if (box) box.style.display = "none";
  esconderBackdropEditor();
}

/* =====================================================================
   ONDA 2.2 — Terminais Início/Fim (mover e adicionar)
===================================================================== */

function definirInicioAlvo(idVisual) {
  inicioAlvo = idVisual || "";
  salvarEstadoLocal(true);
  gerarFluxo();
  mostrarToast(
    inicioAlvo ? `Início agora conecta em ${inicioAlvo}.` : "Início voltou para a primeira atividade.",
    "ok"
  );
}

function definirFimOrigem(idVisual) {
  fimOrigem = idVisual || "";
  salvarEstadoLocal(true);
  gerarFluxo();
  mostrarToast(
    fimOrigem ? `Fim agora vem de ${fimOrigem}.` : "Fim voltou para a última atividade.",
    "ok"
  );
}

function adicionarTerminal(tipo, alvoIdVisual, lado, rotulo) {
  const { visualParaUid } = mapaIdVisualUid();
  if (!visualParaUid[alvoIdVisual]) {
    mostrarToast("Selecione uma atividade válida.", "alerta");
    return;
  }
  const ladoFinal = ["top", "right", "bottom", "left"].includes(lado)
    ? lado : (tipo === "inicio" ? "left" : "right");
  const novoId = `T${terminalCounter++}`;
  terminais.push({ id: novoId, tipo, alvo: alvoIdVisual, lado: ladoFinal });

  // Rótulo da seta do terminal (sem rótulo / Sim / Não)
  if (rotulo === "sim" || rotulo === "nao") {
    const termId = (tipo === "inicio" ? "__INI_" : "__FIMX_") + novoId + "__";
    const chave = tipo === "inicio"
      ? chaveOverride(termId, alvoIdVisual)
      : chaveOverride(alvoIdVisual, termId);
    rotulosConexoes[chave] = rotulo === "sim" ? "Sim" : "Não";
  }

  fecharCriadorTerminal();
  salvarEstadoLocal(true);
  gerarFluxo();
  mostrarToast(`${tipo === "inicio" ? "Início" : "Fim"} adicional criado em ${alvoIdVisual}.`, "ok");
}

function removerTerminal(id) {
  terminais = terminais.filter(t => t.id !== id);
  salvarEstadoLocal(true);
  gerarFluxo();
  mostrarToast("Terminal removido.", "ok");
}

/* Formulário flutuante para criar um terminal Início/Fim extra */
function abrirCriadorTerminal(tipo, ev) {
  const atividades = listaAtividadesSelect();
  if (!atividades.length) {
    mostrarToast("Crie atividades antes de adicionar terminais.", "alerta");
    return;
  }

  mostrarBackdropEditor();
  let box = document.getElementById("criadorTerminal");
  if (!box) {
    box = document.createElement("div");
    box.id = "criadorTerminal";
    document.body.appendChild(box);
  }

  const opcoes = atividades
    .map(a => `<option value="${escaparHTML(a.id)}">${escaparHTML(a.label)}</option>`)
    .join("");

  const titulo = tipo === "inicio" ? "Novo Início" : "Novo Fim";
  const label = tipo === "inicio" ? "Conectar o Início em" : "Trazer o Fim a partir de";
  const ladoPadrao = tipo === "inicio" ? "left" : "right";
  const ladoOpts = [
    ["left", "Esquerda"], ["right", "Direita"], ["top", "Acima"], ["bottom", "Abaixo"]
  ].map(([v, t]) => `<option value="${v}"${v === ladoPadrao ? " selected" : ""}>${t}</option>`).join("");

  box.innerHTML = `
    <div class="pop-header">
      <span><b>${titulo}</b></span>
      <button type="button" class="pop-fechar" onclick="fecharCriadorTerminal()">✕</button>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">${label}</div>
      <select id="novoTerminalAlvo" class="pop-select">${opcoes}</select>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Posição em relação à caixa</div>
      <select id="novoTerminalLado" class="pop-select">${ladoOpts}</select>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Tipo da seta</div>
      <select id="novoTerminalRotulo" class="pop-select">
        <option value="extra">Conexão sem rótulo</option>
        <option value="sim">Saída com "Sim"</option>
        <option value="nao">Saída com "Não"</option>
      </select>
    </div>
    <div class="pop-rodape pop-rodape-acoes">
      <button type="button" class="pop-criar" onclick="confirmarCriarTerminal('${tipo}')">Adicionar</button>
    </div>
  `;
  posicionarFlutuante(box, ev);
}

function confirmarCriarTerminal(tipo) {
  const sel = document.getElementById("novoTerminalAlvo");
  const ladoSel = document.getElementById("novoTerminalLado");
  const rotSel = document.getElementById("novoTerminalRotulo");
  if (!sel) return;
  adicionarTerminal(tipo, sel.value, ladoSel ? ladoSel.value : undefined, rotSel ? rotSel.value : undefined);
}

function fecharCriadorTerminal() {
  const box = document.getElementById("criadorTerminal");
  if (box) box.style.display = "none";
  esconderBackdropEditor();
}

/* ---------- Apoio: fundo escurecido + posicionamento dos formulários ---------- */
function mostrarBackdropEditor() {
  let bd = document.getElementById("editorBackdrop");
  if (!bd) {
    bd = document.createElement("div");
    bd.id = "editorBackdrop";
    bd.addEventListener("click", () => {
      fecharCriadorTerminal();
      fecharCriadorConexao();
      fecharCriadorCaixa();
      fecharMoverCaixa();
    });
    document.body.appendChild(bd);
  }
  bd.classList.add("show");
}

function esconderBackdropEditor() {
  const bd = document.getElementById("editorBackdrop");
  const t = document.getElementById("criadorTerminal");
  const c = document.getElementById("criadorConexao");
  const cx = document.getElementById("criadorCaixa");
  const mv = document.getElementById("moverCaixa");
  const algumAberto =
    (t && t.style.display === "block") ||
    (c && c.style.display === "block") ||
    (cx && cx.style.display === "block") ||
    (mv && mv.style.display === "block");
  if (bd && !algumAberto) bd.classList.remove("show");
}

function posicionarFlutuante(box, ev) {
  // Garante o comportamento mesmo se o CSS não tiver carregado (cache):
  box.style.position = "fixed";
  box.style.zIndex = "10001";
  box.style.display = "block";

  const larg = box.offsetWidth || 300;
  const alt = box.offsetHeight || 240;
  const margem = 12;
  let px, py;

  const btn = ev && (ev.currentTarget || ev.target);
  if (btn && btn.getBoundingClientRect) {
    const r = btn.getBoundingClientRect();
    px = r.left;
    py = r.bottom + 8; // logo abaixo do botão clicado
  } else if (ev && typeof ev.clientX === "number") {
    px = ev.clientX + 14;
    py = ev.clientY + 14;
  } else {
    px = (window.innerWidth - larg) / 2;
    py = 110;
  }

  // mantém dentro da área visível
  if (px + larg + margem > window.innerWidth) px = window.innerWidth - larg - margem;
  if (py + alt + margem > window.innerHeight) py = window.innerHeight - alt - margem;
  box.style.left = Math.max(margem, px) + "px";
  box.style.top = Math.max(margem, py) + "px";
}

/* =====================================================================
   ONDA 2.7 — Inserir nova caixa (atividade/decisão) pelo desenho
===================================================================== */

/* Lista de conexões existentes (para "inserir no meio") */
function listaConexoesExistentes() {
  const { uidParaVisual } = mapaIdVisualUid();
  const itens = [];
  fluxoData.forEach((l) => {
    if (limpar(l.atividade || "") === "") return;
    const oVis = uidParaVisual[l.uid];
    if (!oVis) return;
    const add = (dUid) => {
      const dVis = uidParaVisual[dUid];
      if (!dVis) return;
      itens.push({
        value: `${oVis}__${dVis}`,
        label: `${oVis} · ${descricaoNo(oVis)} → ${dVis} · ${descricaoNo(dVis)}`
      });
    };
    if (l.proxSim) add(l.proxSim);
    if (l.proxNao) add(l.proxNao);
    (l.extras || []).forEach(add);
  });
  return itens;
}

function inserirNovaCaixa(opts) {
  const tipo = opts.tipo === "decisao" ? "decisao" : "atividade";
  const atividade = limpar(opts.atividade || "");
  const area = opts.area || "";
  const col = Math.max(1, Number(opts.coluna) || 1);
  const lin = Math.max(1, Number(opts.linha) || 1);

  if (!atividade) { mostrarToast("Informe o texto da atividade.", "alerta"); return; }
  if (!area) { mostrarToast("Escolha a raia (área).", "alerta"); return; }

  // Empurra +1 todas as caixas com coluna >= col (em todas as raias) e fixa manual.
  fluxoData.forEach((l) => {
    if (limpar(l.atividade || "") === "") return;
    if ((Number(l.coluna) || 1) >= col) {
      l.coluna = (Number(l.coluna) || 1) + 1;
      l.colunaManual = true;
    }
  });

  const novoUid = gerarUID();
  const nova = {
    uid: novoUid, ordem: 0, id: "",
    area, atividade,
    tipo: tipo === "decisao" ? "Decisão" : "",
    sistema: "", tempo: "",
    coluna: col, linha: lin, colunaManual: true, linhaManual: true,
    cor: "white",
    proxSim: "", proxSimAuto: false, proxNao: "", extras: [], semSaida: false
  };
  fluxoData.push(nova);

  // Conexão "no meio de uma seta existente": origem→destino vira origem→nova→destino
  if (opts.inserirEntre && opts.inserirEntre.includes("__")) {
    const [oVis, dVis] = opts.inserirEntre.split("__");
    const mapa = mapaIdVisualUid();
    const oUid = mapa.visualParaUid[oVis];
    const dUid = mapa.visualParaUid[dVis];
    const origemLinha = fluxoData.find(l => l.uid === oUid);
    if (origemLinha && dUid) {
      // redireciona a saída origem→destino para origem→nova (mantém o slot Sim/Não)
      if (origemLinha.proxSim === dUid) origemLinha.proxSim = novoUid;
      else if (origemLinha.proxNao === dUid) origemLinha.proxNao = novoUid;
      else if (Array.isArray(origemLinha.extras)) {
        const i = origemLinha.extras.indexOf(dUid);
        if (i !== -1) origemLinha.extras[i] = novoUid;
      }
      nova.proxSim = dUid;        // nova → destino
      origemLinha.semSaida = false;

      // transfere rótulo/override da seta antiga para o novo trecho origem→nova
      const novaVis = mapa.uidParaVisual[novoUid];
      const chaveAntiga = chaveOverride(oVis, dVis);
      const chaveNova = chaveOverride(oVis, novaVis);
      if (rotulosConexoes[chaveAntiga] !== undefined) {
        rotulosConexoes[chaveNova] = rotulosConexoes[chaveAntiga];
        delete rotulosConexoes[chaveAntiga];
      }
      delete overridesConexoes[chaveAntiga];
    }
  }

  salvarEstadoLocal(true);
  atualizarTabela();
  gerarFluxo();
  mostrarToast(`Caixa "${atividade}" inserida na coluna ${col}.`, "ok");
}

/* ---------- Formulário flutuante de Nova caixa ---------- */
function abrirCriadorCaixa(ev) {
  const areas = (ultimasAreasOrdenadas && ultimasAreasOrdenadas.length)
    ? ultimasAreasOrdenadas
    : Array.from(new Set(fluxoData.map(l => l.area).filter(a => limpar(a || "") !== "")));
  if (!areas.length) {
    mostrarToast("Crie ao menos uma atividade/raia antes de inserir caixas.", "alerta");
    return;
  }

  mostrarBackdropEditor();
  let box = document.getElementById("criadorCaixa");
  if (!box) {
    box = document.createElement("div");
    box.id = "criadorCaixa";
    document.body.appendChild(box);
  }

  const optAreas = areas.map(a => `<option value="${escaparHTML(a)}">${escaparHTML(a)}</option>`).join("");
  const conex = listaConexoesExistentes();
  const optConex = [`<option value="">Deixar solta (conecto depois)</option>`]
    .concat(conex.map(c => `<option value="${escaparHTML(c.value)}">${escaparHTML(c.label)}</option>`))
    .join("");

  box.innerHTML = `
    <div class="pop-header">
      <span><b>Nova caixa</b></span>
      <button type="button" class="pop-fechar" onclick="fecharCriadorCaixa()">✕</button>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Tipo</div>
      <select id="novaCaixaTipo" class="pop-select">
        <option value="atividade">Atividade</option>
        <option value="decisao">Decisão</option>
      </select>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Texto da atividade</div>
      <input type="text" id="novaCaixaTexto" class="pop-select" placeholder="Ex.: Validar relatório" />
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Raia (área)</div>
      <select id="novaCaixaArea" class="pop-select">${optAreas}</select>
    </div>
    <div class="pop-grupo pop-grupo-linha">
      <div>
        <div class="pop-label">Coluna</div>
        <input type="number" id="novaCaixaColuna" class="pop-select" min="1" value="1" />
      </div>
      <div>
        <div class="pop-label">Linha</div>
        <input type="number" id="novaCaixaLinha" class="pop-select" min="1" value="1" />
      </div>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Conexão</div>
      <select id="novaCaixaEntre" class="pop-select">${optConex}</select>
    </div>
    <div class="pop-rodape pop-rodape-acoes">
      <button type="button" class="pop-criar" onclick="confirmarCriarCaixa()">Inserir caixa</button>
    </div>
  `;
  posicionarFlutuante(box, ev);
}

function confirmarCriarCaixa() {
  inserirNovaCaixa({
    tipo: (document.getElementById("novaCaixaTipo") || {}).value,
    atividade: (document.getElementById("novaCaixaTexto") || {}).value,
    area: (document.getElementById("novaCaixaArea") || {}).value,
    coluna: (document.getElementById("novaCaixaColuna") || {}).value,
    linha: (document.getElementById("novaCaixaLinha") || {}).value,
    inserirEntre: (document.getElementById("novaCaixaEntre") || {}).value
  });
  fecharCriadorCaixa();
}

function fecharCriadorCaixa() {
  const box = document.getElementById("criadorCaixa");
  if (box) box.style.display = "none";
  esconderBackdropEditor();
}


/* =====================================================================
   ONDA 3 — 3b: Mover caixa pelo editor visual
   Clicar numa caixa no modo edição abre este popover (Raia/Coluna/Linha).
   Só altera dados (coluna/linha/área) e re-renderiza; não toca no motor.
===================================================================== */
function abrirMoverCaixa(uid, ev) {
  const linha = fluxoData.find(l => l.uid === uid);
  if (!linha) return;

  const areas = (ultimasAreasOrdenadas && ultimasAreasOrdenadas.length)
    ? ultimasAreasOrdenadas
    : Array.from(new Set(fluxoData.map(l => l.area).filter(a => limpar(a || "") !== "")));

  mostrarBackdropEditor();
  let box = document.getElementById("moverCaixa");
  if (!box) {
    box = document.createElement("div");
    box.id = "moverCaixa";
    document.body.appendChild(box);
  }

  const optAreas = areas.map(a =>
    `<option value="${escaparHTML(a)}" ${a === linha.area ? "selected" : ""}>${escaparHTML(a)}</option>`
  ).join("");

  box.innerHTML = `
    <div class="pop-header">
      <span><b>Mover caixa</b></span>
      <button type="button" class="pop-fechar" onclick="fecharMoverCaixa()">\u2715</button>
    </div>
    <div class="pop-titulo">${escaparHTML(limpar(linha.atividade || "") || "(sem nome)")}</div>
    <div class="pop-grupo">
      <div class="pop-label">Raia (\u00e1rea)</div>
      <select id="moverArea" class="pop-select" onchange="aplicarMoverArea('${uid}')">${optAreas}</select>
    </div>
    <div class="mover-dpad">
      <button type="button" class="dpad-btn dpad-up" title="Subir linha" onclick="nudgeMoverCaixa('${uid}',0,-1)">\u25b2</button>
      <button type="button" class="dpad-btn dpad-left" title="Coluna \u00e0 esquerda" onclick="nudgeMoverCaixa('${uid}',-1,0)">\u25c0</button>
      <div class="dpad-center" id="moverPosLabel">Col ${Number(linha.coluna) || 1} \u00b7 Lin ${Number(linha.linha) || 1}</div>
      <button type="button" class="dpad-btn dpad-right" title="Coluna \u00e0 direita" onclick="nudgeMoverCaixa('${uid}',1,0)">\u25b6</button>
      <button type="button" class="dpad-btn dpad-down" title="Descer linha" onclick="nudgeMoverCaixa('${uid}',0,1)">\u25bc</button>
    </div>
    <div class="mover-dica">\u25b2\u25bc muda a linha \u00b7 \u25c0\u25b6 muda a coluna</div>
  `;
  posicionarFlutuante(box, ev);
}

function aplicarMoverArea(uid) {
  const linha = fluxoData.find(l => l.uid === uid);
  if (!linha) return;
  const sel = document.getElementById("moverArea");
  if (!sel || !sel.value) return;
  linha.area = sel.value;
  linha.colunaManual = true;
  linha.linhaManual = true;
  salvarEstadoLocal(true);
  atualizarTabela();
  gerarFluxo();
}

// Move a caixa 1 passo: dCol (-1 esquerda / +1 direita), dLin (-1 sobe / +1 desce).
// Aplica na hora e mantém o popover aberto para empurrar em sequência.
function nudgeMoverCaixa(uid, dCol, dLin) {
  const linha = fluxoData.find(l => l.uid === uid);
  if (!linha) return;
  const novaCol = Math.max(1, (Number(linha.coluna) || 1) + dCol);
  const novaLin = Math.max(1, (Number(linha.linha) || 1) + dLin);
  linha.coluna = novaCol;
  linha.colunaManual = true;
  linha.linha = novaLin;
  linha.linhaManual = true;
  salvarEstadoLocal(true);
  atualizarTabela();
  gerarFluxo();
  const lbl = document.getElementById("moverPosLabel");
  if (lbl) lbl.textContent = `Col ${novaCol} \u00b7 Lin ${novaLin}`;
}

function fecharMoverCaixa() {
  const box = document.getElementById("moverCaixa");
  if (box) box.style.display = "none";
  esconderBackdropEditor();
}

/* =====================================================================
   ONDA 3 — A2: Validação pré-geração
   Bloco aditivo. Lê apenas de fluxoData + estado do editor.
   NÃO altera o motor de roteamento nem a geração do SVG (online/Excel).
===================================================================== */

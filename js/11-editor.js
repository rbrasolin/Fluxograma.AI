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
  const _diag = document.getElementById("diagram");
  if (_diag) _diag.classList.toggle("diagram-editando", modoEdicaoAtivo);
  const btn = document.getElementById("btnAjustarFluxo");

  if (modoEdicaoAtivo) {
    if (btn) { btn.classList.add("ativo"); btn.textContent = "Finalizar Fluxo"; }
    aplicarCamadaEdicao();
    renderPainelRaias();
    mostrarToast("Modo de ajuste ativo: clique numa seta para corrigir entrada/saída.", "info", 4500);
  } else {
    if (btn) { btn.classList.remove("ativo"); btn.textContent = "Editar Fluxo"; }
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
  fecharTodosOsPopovers();
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

  // "+ Inserir caixa aqui" funciona em qualquer seta: entre duas atividades, ou
  // envolvendo Início/Fim (inserirNovaCaixa sabe tratar os dois casos).
  const blocoInserir = `
    <div class="pop-rodape">
      <button type="button" class="pop-criar" onclick="abrirCriadorCaixa(event, {origemId:'${origemId}', destinoId:'${destinoId}'}); fecharPopoverConexao();">+ Inserir caixa aqui</button>
    </div>`;

  pop.innerHTML = `
    <div class="pop-header">
      <span class="pop-titulo">${escaparHTML(descricaoNo(origemId))}<br>→ ${escaparHTML(descricaoNo(destinoId))}</span>
      <button type="button" class="pop-fechar" onclick="fecharPopoverConexao()">✕</button>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Saída</div>
      <div class="pop-botoes">${botoesLado("start", override.startSide)}</div>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Entrada</div>
      <div class="pop-botoes">${botoesLado("end", override.endSide)}</div>
    </div>
    ${blocoDestino}
    ${blocoInserir}
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

  painel.innerHTML = `
    <div class="raias-dica">
      <button type="button" class="btn-nova-seta" onclick="abrirCriadorTerminal('inicio', event)">+ Início</button>
      <button type="button" class="btn-nova-seta" onclick="abrirCriadorTerminal('fim', event)">+ Fim</button>
      <button type="button" class="btn-nova-seta" onclick="abrirComecarDoZero(event)">+ Raia</button>
      <button type="button" id="btnDesfazer" class="raias-reset" onclick="desfazer()" title="Desfazer (Ctrl+Z fora dos campos)" disabled>↶ Desfazer</button>
      <button type="button" id="btnRefazer" class="raias-reset" onclick="refazer()" title="Refazer (Ctrl+Y fora dos campos)" disabled>↷ Refazer</button>
      <button type="button" class="raias-reset" onclick="resetarAjustesFluxo()">Resetar ajustes</button>
      <span>Clique numa raia para reordená-la, num Início/Fim para reposicioná-lo, numa caixa para editá-la ou criar uma seta a partir dela, ou numa seta (inclusive de Início/Fim) para mudar lados, inserir uma caixa, trocar destino ou apagar.</span>
    </div>
  `;

  // Os botões acima nascem do zero a cada render (disabled="true" por
  // padrão no template) — ressincroniza com o estado real da pilha de
  // undo/redo, senão eles ficam sempre desabilitados até a próxima ação.
  if (typeof atualizarBotoesUndo === "function") atualizarBotoesUndo();
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

/* =====================================================================
   Popover "Mover raia" — reordenação por clique no cabeçalho da raia.
   Substitui o antigo painel "Ordem das raias". Reusa moverRaia() e o mesmo
   padrão visual/posicionamento do popover "Mover caixa".
===================================================================== */
function abrirMoverRaia(nome, ev) {
  fecharTodosOsPopovers();
  const n = String(nome);
  mostrarBackdropEditor();

  let box = document.getElementById("moverRaia");
  if (!box) {
    box = document.createElement("div");
    box.id = "moverRaia";
    document.body.appendChild(box);
  }

  const nEsc = escaparHTML(n);
  const nAttr = n.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  box.innerHTML = `
    <div class="pop-header">
      <span><b>Mover raia</b></span>
      <button type="button" class="pop-fechar" onclick="fecharMoverRaia()">\u2715</button>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Nome da raia</div>
      <input type="text" class="pop-input" id="renomearRaiaInput" value="${nEsc}"
        onblur="aplicarRenomearRaia('${nAttr}')"
        onkeydown="if(event.key==='Enter'){this.blur();} else if(event.key==='Escape'){this.value=this.defaultValue; this.blur();}" />
    </div>
    <div class="raia-mover-acoes">
      <button type="button" class="raia-mv-btn raia-mv-up" onclick="nudgeMoverRaia('${nAttr}',-1)">\u25b2 Subir</button>
      <button type="button" class="raia-mv-btn raia-mv-down" onclick="nudgeMoverRaia('${nAttr}',1)">\u25bc Descer</button>
    </div>
  `;

  // Abre no ponto do clique (sobre a raia), não no rodapé do #diagram.
  posicionarFlutuante(box, { clientX: ev && ev.clientX, clientY: ev && ev.clientY });
  atualizarMoverRaia(n);
}

// Recalcula os botões desabilitados conforme a ordem atual das raias.
function atualizarMoverRaia(nome) {
  const box = document.getElementById("moverRaia");
  if (!box || box.style.display === "none") return;

  const ordem = (ordemRaias && ordemRaias.length)
    ? ordemRaias
    : (ultimasAreasOrdenadas || []);
  const i = ordem.indexOf(nome);

  const up = box.querySelector(".raia-mv-up");
  const down = box.querySelector(".raia-mv-down");
  if (up) up.disabled = (i <= 0);
  if (down) down.disabled = (i === -1 || i >= ordem.length - 1);
}

// Renomeia a raia (input do popover "Mover raia", ao perder o foco/Enter).
// A raia não tem UID próprio: sua identidade é o texto em fluxoData[].area,
// então renomear = trocar esse texto em todas as linhas da raia + em ordemRaias.
function aplicarRenomearRaia(nomeAntigo) {
  const input = document.getElementById("renomearRaiaInput");
  if (!input) return;

  const novoNome = normalizarEspacos(input.value);

  if (!novoNome || novoNome === nomeAntigo) {
    input.value = nomeAntigo;
    return;
  }

  const areasAtuais = (ultimasAreasOrdenadas && ultimasAreasOrdenadas.length) ? ultimasAreasOrdenadas : [];
  const colide = areasAtuais.some(a => a !== nomeAntigo && a.toLocaleLowerCase("pt-BR") === novoNome.toLocaleLowerCase("pt-BR"));
  if (colide) {
    mostrarToast(`Já existe uma raia chamada "${novoNome}".`, "alerta");
    input.value = nomeAntigo;
    return;
  }

  fluxoData.forEach(l => { if (l.area === nomeAntigo) l.area = novoNome; });
  if (Array.isArray(ordemRaias)) {
    const idx = ordemRaias.indexOf(nomeAntigo);
    if (idx >= 0) ordemRaias[idx] = novoNome;
  }

  salvarEstadoLocal(true);
  atualizarTabela();
  gerarFluxo();
  fecharMoverRaia();
  mostrarToast(`Raia renomeada para "${novoNome}".`, "ok");
}

// Move a raia 1 posição e mantém o popover aberto para reordenar em sequência.
function nudgeMoverRaia(nome, direcao) {
  moverRaia(nome, direcao); // salva estado + re-renderiza o fluxo
  atualizarMoverRaia(nome);
}

function fecharMoverRaia() {
  const box = document.getElementById("moverRaia");
  if (box) box.style.display = "none";
  esconderBackdropEditor();
}

/* =====================================================================
   Popover "Mover Início/Fim" — reposiciona o terminal trocando a caixa-alvo.
   Dropdown escolhe a raia; d-pad navega entre as caixas da raia (◀▶ coluna,
   ▲▼ linha). Excluir remove o terminal. Não toca no desenho/golden: só muda
   qual caixa o terminal aponta (inicioAlvo/fimOrigem para os padrão, t.alvo
   para os extras).
===================================================================== */
function terminalPorTermId(termId) {
  const m = String(termId).match(/^__(?:INI|FIMX)_(.+)__$/);
  if (!m) return null;
  return (terminais || []).find(t => t.id === m[1]) || null;
}

function tipoDoTerminal(termId) {
  if (termId === "__INICIO__" || String(termId).indexOf("__INI_") === 0) return "inicio";
  return "fim";
}

function alvoDoTerminal(termId) {
  const etapas = obterEtapasDaTabela();
  if (termId === "__INICIO__") {
    return (inicioAlvo && etapas.some(e => e.id === inicioAlvo)) ? inicioAlvo : (etapas[0] ? etapas[0].id : "");
  }
  if (termId === "__FIM__") {
    return (fimOrigem && etapas.some(e => e.id === fimOrigem)) ? fimOrigem : (etapas.length ? etapas[etapas.length - 1].id : "");
  }
  const t = terminalPorTermId(termId);
  return t ? t.alvo : "";
}

// Só ajusta o dado (sem salvar/re-renderizar) — usado por quem já vai salvar/
// renderizar depois de mais alguma coisa (ex.: inserirNovaCaixa, que faz isso uma
// vez só, no final, depois de mexer em mais de uma coisa).
function aplicarAlvoTerminal(termId, novoAlvo) {
  if (!novoAlvo) return false;
  if (termId === "__INICIO__") { inicioAlvo = novoAlvo; inicioOculto = false; }
  else if (termId === "__FIM__") { fimOrigem = novoAlvo; fimOculto = false; }
  else {
    const t = terminalPorTermId(termId);
    if (!t) return false;
    t.alvo = novoAlvo;
  }
  return true;
}

function definirAlvoTerminal(termId, novoAlvo) {
  if (!aplicarAlvoTerminal(termId, novoAlvo)) return;
  salvarEstadoLocal(true);
  gerarFluxo();
}

function abrirMoverTerminal(termId, ev) {
  fecharTodosOsPopovers();
  const tipo = tipoDoTerminal(termId);
  const nome = tipo === "inicio" ? "Início" : "Fim";
  const etapas = obterEtapasDaTabela();
  const areas = (ultimasAreasOrdenadas && ultimasAreasOrdenadas.length)
    ? ultimasAreasOrdenadas
    : Array.from(new Set(etapas.map(e => e.area).filter(a => limpar(a || "") !== "")));
  const alvo = alvoDoTerminal(termId);
  const at = etapas.find(e => e.id === alvo);
  const raiaAtual = at ? at.area : "";

  mostrarBackdropEditor();
  let box = document.getElementById("moverTerminal");
  if (!box) { box = document.createElement("div"); box.id = "moverTerminal"; document.body.appendChild(box); }

  const optAreas = areas.map(a => `<option value="${escaparHTML(a)}" ${a === raiaAtual ? "selected" : ""}>${escaparHTML(a)}</option>`).join("");
  const idAttr = String(termId).replace(/'/g, "\\'");

  box.innerHTML = `
    <div class="pop-header">
      <span><b>Mover ${nome}</b></span>
      <button type="button" class="pop-fechar" onclick="fecharMoverTerminal()">\u2715</button>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Raia (\u00e1rea)</div>
      <select id="moverTerminalRaia" class="pop-select" onchange="trocarRaiaTerminal('${idAttr}')">${optAreas}</select>
    </div>
    <div class="mover-dpad">
      <button type="button" class="dpad-btn dpad-up" title="Caixa acima" onclick="nudgeMoverTerminal('${idAttr}',0,-1)">\u25b2</button>
      <button type="button" class="dpad-btn dpad-left" title="Caixa \u00e0 esquerda" onclick="nudgeMoverTerminal('${idAttr}',-1,0)">\u25c0</button>
      <div class="dpad-center" id="moverTerminalLabel">${escaparHTML(alvo || "\u2014")}</div>
      <button type="button" class="dpad-btn dpad-right" title="Caixa \u00e0 direita" onclick="nudgeMoverTerminal('${idAttr}',1,0)">\u25b6</button>
      <button type="button" class="dpad-btn dpad-down" title="Caixa abaixo" onclick="nudgeMoverTerminal('${idAttr}',0,1)">\u25bc</button>
    </div>
    <div class="mover-dica">Conecta na caixa acima \u00b7 \u25c0\u25b6 coluna \u00b7 \u25b2\u25bc linha</div>
    <div class="pop-rodape">
      <button type="button" class="pop-seta-btn" onclick="abrirCriadorTerminal('${tipo}', event); fecharMoverTerminal();">${tipo === "inicio" ? "+ Seta a partir daqui" : "+ Seta at\u00e9 aqui"}</button>
    </div>
    <button type="button" class="raia-mv-btn terminal-excluir" onclick="excluirTerminal('${idAttr}')">\u2715 Excluir ${nome}</button>
  `;
  posicionarFlutuante(box, { clientX: ev && ev.clientX, clientY: ev && ev.clientY });
}

function atualizarLabelMoverTerminal(termId) {
  const alvo = alvoDoTerminal(termId);
  const lbl = document.getElementById("moverTerminalLabel");
  if (lbl) lbl.textContent = alvo || "\u2014";
  const sel = document.getElementById("moverTerminalRaia");
  if (sel) {
    const at = obterEtapasDaTabela().find(e => e.id === alvo);
    if (at) sel.value = at.area;
  }
}

function nudgeMoverTerminal(termId, dCol, dLin) {
  const etapas = obterEtapasDaTabela();
  const alvo = alvoDoTerminal(termId);
  const at = etapas.find(e => e.id === alvo);
  if (!at) return;
  const area = at.area;
  const c = Number(at.coluna) || 1, l = Number(at.linha) || 1;
  const mesma = etapas.filter(e => e.area === area && e.id !== alvo)
    .map(e => ({ id: e.id, c: Number(e.coluna) || 1, l: Number(e.linha) || 1 }));
  let cand = null;
  if (dCol !== 0) {
    cand = mesma.filter(e => dCol > 0 ? e.c > c : e.c < c)
      .sort((a, b) => Math.abs(a.c - c) - Math.abs(b.c - c) || Math.abs(a.l - l) - Math.abs(b.l - l))[0];
  } else {
    cand = mesma.filter(e => dLin > 0 ? e.l > l : e.l < l)
      .sort((a, b) => Math.abs(a.l - l) - Math.abs(b.l - l) || Math.abs(a.c - c) - Math.abs(b.c - c))[0];
  }
  if (!cand) { mostrarToast("N\u00e3o h\u00e1 caixa nessa dire\u00e7\u00e3o dentro da raia.", "alerta"); return; }
  definirAlvoTerminal(termId, cand.id);
  atualizarLabelMoverTerminal(termId);
}

function trocarRaiaTerminal(termId) {
  const sel = document.getElementById("moverTerminalRaia");
  if (!sel || !sel.value) return;
  const naRaia = obterEtapasDaTabela().filter(e => e.area === sel.value)
    .sort((a, b) => (Number(a.coluna) || 1) - (Number(b.coluna) || 1) || (Number(a.linha) || 1) - (Number(b.linha) || 1));
  if (!naRaia.length) { mostrarToast("Essa raia n\u00e3o tem caixas.", "alerta"); return; }
  const alvo = tipoDoTerminal(termId) === "inicio" ? naRaia[0].id : naRaia[naRaia.length - 1].id;
  definirAlvoTerminal(termId, alvo);
  atualizarLabelMoverTerminal(termId);
}

function excluirTerminal(termId) {
  if (termId === "__INICIO__") inicioOculto = true;
  else if (termId === "__FIM__") fimOculto = true;
  else { const t = terminalPorTermId(termId); if (t) terminais = terminais.filter(x => x.id !== t.id); }
  salvarEstadoLocal(true);
  gerarFluxo();
  fecharMoverTerminal();
  mostrarToast(`${tipoDoTerminal(termId) === "inicio" ? "In\u00edcio" : "Fim"} removido.`, "ok");
}

function fecharMoverTerminal() {
  const box = document.getElementById("moverTerminal");
  if (box) box.style.display = "none";
  esconderBackdropEditor();
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
  fimOculto = false;
  conexaoSelecionada = null;
  // limpa marcações de "sem saída" feitas manualmente
  fluxoData.forEach(l => { if (l) l.semSaida = false; });
  salvarEstadoLocal(true);
  gerarFluxo();
  fecharPopoverConexao();
  mostrarToast("Ajustes manuais removidos. Fluxo voltou ao automático.", "ok");
}

/* Fecha TODOS os popovers do editor de uma vez — usada tanto pelo listener de
   "clicar fora" abaixo quanto no topo de cada abrirX(), pra garantir que só
   existe um popover aberto por vez. Sem isso, abrir um popover novo enquanto
   outro já estava aberto (ex.: abrir "Mover caixa" com "Mover raia" ainda de
   pé) deixava os dois empilhados na tela — bug real, achado num teste: um
   clique que devia abrir "Mover terminal" acabou sendo capturado pelo
   "Mover raia" que tinha ficado preso ali por baixo. */
function fecharTodosOsPopovers() {
  fecharPopoverConexao();
  fecharMoverCaixa();
  fecharMoverRaia();
  fecharMoverTerminal();
  fecharCriadorConexao();
  fecharCriadorCaixa();
  fecharCriadorTerminal();
  fecharComecarDoZero();
}

/* Fecha os popovers do editor ao clicar fora deles. Não fecha se o clique foi:
   - dentro de algum popover aberto (não interrompe o que o usuário está fazendo);
   - num elemento que ELE MESMO abre/troca um popover (caixa, seta, raia, terminal) —
     senão o popover abriria e seria fechado no mesmo clique (quem abre já chama
     fecharTodosOsPopovers() por conta própria, ver cada abrirX() abaixo). */
document.addEventListener("click", (event) => {
  if (!event.target || !event.target.closest) return;
  if (event.target.closest(
    "#popoverConexao, #moverCaixa, #moverRaia, #moverTerminal, " +
    "#criadorConexao, #criadorCaixa, #criadorTerminal, #comecarDoZero"
  )) return;
  if (event.target.closest("g.editor-ui")) return; // caixas e setas (área de clique do SVG)
  if (event.target.closest("[data-raia]")) return;   // cabeçalho de raia
  if (event.target.closest("[data-terminal]")) return; // ícone Início/Fim
  if (event.target.closest(".raias-dica")) return;   // + Início / + Fim / + Raia / Resetar
  if (event.target.closest("#blocoComecarZero")) return; // botão "Começar a desenhar"

  fecharTodosOsPopovers();
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
    // Caixa voltou a ter saída "Sim" -> não é mais "sem saída de propósito"
    // nesse slot. Só reseta AQUI (não em "não"/"extra" abaixo): esses dois
    // campos só são lidos por reaplicarSugestoesConexao pra decidir se
    // auto-liga o Sim — criar uma seta "Não" ou "extra" não deveria reabrir
    // esse slot. `semSaida` é a marcação do usuário ("sem saída de
    // propósito", também lida pelo desenho do Fim automático);
    // `simSlotCongelado` é o congelamento interno e temporário de
    // criarConexaoNovaCaixa/inserirNovaCaixa (ver `ultimaAntes` nas duas) —
    // campos separados de propósito, pra o congelamento interno não ser
    // lido como "usuário disse que não tem saída" e a caixa perder a seta
    // pro Fim (bug real, achado com o mesmo fluxo de teste do Achado 4).
    linha.semSaida = false;
    linha.simSlotCongelado = false;
  } else if (tipo === "nao") {
    linha.proxNao = dUid;
  } else {
    linha.extras.push(dUid);
  }

  // Rótulo explícito: se o usuário escolheu Sim/Não, a seta sempre mostra o texto
  // (mesmo entre caixas que não são decisão).
  const chave = chaveOverride(origemVisual, destinoVisual);
  if (tipo === "sim") rotulosConexoes[chave] = "Sim";
  else if (tipo === "nao") rotulosConexoes[chave] = "Não";

  fecharCriadorConexao();
  persistirEdicaoEstrutural();
  mostrarToast(`Nova seta criada: ${origemVisual} → ${destinoVisual}.`, "ok");
}

/* Cria uma caixa nova E já conecta origem → nova numa única ação — o motor por
   trás de "+ Nova caixa" no seletor de destino de abrirCriadorConexao.

   Duas mecânicas separadas, cada uma resolvendo um efeito colateral distinto:

   1) COLUNA/LINHA: nunca empurra OUTRAS raias — "+ Caixa a partir daqui" é
      sempre uma extensão LOCAL a partir da caixa clicada. Se a coluna logo
      depois da origem já estiver ocupada NESSA raia (o caso de uma decisão
      ganhando a 2ª saída — Sim e Não a partir da mesma caixa —, já que as
      duas competem pela mesma coluna), empilha a caixa nova numa linha
      abaixo, na MESMA coluna, em vez de empurrar a coluna de tudo. Bug real,
      achado num fluxo grande de teste (4 raias, decisões ramificadas): a 2ª
      saída de uma decisão empurrava caixas de raias sem relação nenhuma —
      e, como um fluxo grande acumula várias colisões ao longo da montagem,
      uma caixa que já estava bem posicionada ia sendo empurrada repetidas
      vezes por colisões alheias, até ficar isolada longe de onde devia
      (setas gigantes cruzando o fluxo inteiro, quase impossíveis de clicar).
      Empilhar Sim/Não na mesma coluna (em vez de um do lado do outro) é
      também mais correto: são caminhos ALTERNATIVOS, não sequenciais — não
      faz sentido um vir "depois" do outro no eixo do tempo.
      inserirNovaCaixa (motor do "+ Inserir caixa aqui"/"+ Raia") NÃO muda —
      continua empurrando globalmente quando splica no meio de uma seta
      existente, porque ali a colisão é sempre real (o destino que já estava
      lá) — cenário genuinamente diferente deste.

   2) ARRAY: "nova" sempre entra no FIM do array (fluxoData.push) — nunca
      desloca ninguém no array (só na coluna/linha, acima), então nenhuma
      letra muda e dispensa reletramento. Mas isso faz a linha que HOJE é a
      última do array virar a "próxima" dela aos olhos de
      reaplicarSugestoesConexao (chamada por gerarFluxo logo em seguida),
      que auto-liga todo "Sim" vazio à próxima linha do array. Se essa
      última linha for uma caixa qualquer sem saída — não necessariamente a
      origem clicada —, ela ganhava uma seta "Sim" pra caixa nova que
      ninguém pediu (bug real, achado num .json de teste do usuário: clique
      em B criou uma seta fantasma D→nova, só porque D por acaso era a
      última linha do array). Congela o slot do Sim dessa linha
      (`simSlotCongelado` — campo próprio, separado de `semSaida`, pra não
      ser lido como "usuário marcou sem saída de propósito" e a caixa
      perder a seta automática pro Fim; ver reaplicarSugestoesConexao) pra
      evitar isso. Se por acaso for a própria origem (o caso mais comum:
      continuar desenhando a partir da última caixa do fluxo), criarConexao
      desfaz o congelamento normalmente, ao ligar a saída real dela na caixa
      nova.

   A conexão em si (Sim/Não/extra, rótulo, guarda anti-duplicata) é 100%
   delegada a criarConexao — zero wiring duplicado. */
function criarConexaoNovaCaixa(origemVisual, tipo, tipoCaixaBruto, atividadeTextoBruto) {
  const atividade = normalizarEspacos(atividadeTextoBruto);
  if (!atividade) { mostrarToast("Informe o texto da nova atividade.", "alerta"); return; }

  // Texto livre (igual a coluna "Tipo" da tabela — ver inserirNovaCaixa).
  const tipoCaixa = normalizarTextoCampo("tipo", tipoCaixaBruto || "");

  const { visualParaUid } = mapaIdVisualUid();
  const oUid = visualParaUid[origemVisual];
  const origemLinha = fluxoData.find(l => l.uid === oUid);
  if (!origemLinha) { mostrarToast("Não encontrei a caixa de origem.", "alerta"); return; }

  const area = origemLinha.area || "";
  const linhaLane = Math.max(1, Number(origemLinha.linha) || 1);
  const col = Math.max(1, Number(origemLinha.coluna) || 1) + 1;

  // Empilha em vez de empurrar — ver mecânica 1) acima.
  let linhaAlvo = linhaLane;
  while (existePosicaoOcupadaNaRaia(null, area, linhaAlvo, col)) {
    linhaAlvo++;
  }

  const ultimaAntes = fluxoData[fluxoData.length - 1];
  if (ultimaAntes && !ultimaAntes.proxSim && !ultimaAntes.semSaida && !ultimaAntes.simRemovido) {
    ultimaAntes.simSlotCongelado = true;
  }

  const nova = {
    uid: gerarUID(), ordem: 0, id: "",
    area, atividade,
    tipo: tipoCaixa,
    sistema: "", tempo: "",
    coluna: col, linha: linhaAlvo, colunaManual: true, linhaManual: true,
    cor: "white",
    proxSim: "", proxSimAuto: false, proxNao: "", extras: [], semSaida: false
  };

  fluxoData.push(nova);

  const novaVisual = mapaIdVisualUid().uidParaVisual[nova.uid];
  criarConexao(origemVisual, novaVisual, tipo);
}

/* ---------- Criador de nova conexão (formulário flutuante) ----------
   Sempre aberto a partir de uma caixa (popover "Mover caixa"): a origem é
   essa caixa, travada. Dois botões levam ao mesmo formulário, só mudando o
   destino pré-selecionado: "+ Caixa a partir daqui" abre em "+ Nova caixa"
   (abrirCriadorConexao direto); "+ Seta a partir daqui" abre já numa
   atividade existente (via abrirCriadorConexaoExistente abaixo), pro caso em
   que o usuário só quer ligar em algo que já existe (reconvergência, loop),
   sem criar caixa nova nenhuma. */

/* "+ Seta a partir daqui": exige pelo menos uma outra atividade no fluxo pra
   fazer sentido; se não tiver, orienta a usar "+ Caixa a partir daqui"
   primeiro (que não tem essa exigência — é o caminho de bootstrap). */
function abrirCriadorConexaoExistente(uidOrigem, ev) {
  const { uidParaVisual } = mapaIdVisualUid();
  const origemVisual = uidParaVisual[uidOrigem];
  if (!origemVisual) return;

  const atividades = listaAtividadesSelect().filter(a => a.id !== origemVisual);
  if (!atividades.length) {
    mostrarToast(
      "Ainda não existe outra atividade pra ligar. Use \"+ Caixa a partir daqui\" pra criar a próxima.",
      "alerta"
    );
    return;
  }

  abrirCriadorConexao(uidOrigem, ev, atividades[0].id);
}

/* `destinoInicial`: undefined = pré-seleciona "+ Nova caixa" (chamada direta,
   via "+ Caixa a partir daqui"); um id visual = pré-seleciona essa atividade
   (chamada por abrirCriadorConexaoExistente, via "+ Seta a partir daqui"). */
function abrirCriadorConexao(uidOrigem, ev, destinoInicial) {
  fecharTodosOsPopovers();
  const { uidParaVisual } = mapaIdVisualUid();
  const origemVisual = uidParaVisual[uidOrigem];
  if (!origemVisual) return;

  const atividades = listaAtividadesSelect().filter(a => a.id !== origemVisual);

  mostrarBackdropEditor();
  let box = document.getElementById("criadorConexao");
  if (!box) {
    box = document.createElement("div");
    box.id = "criadorConexao";
    document.body.appendChild(box);
  }

  const opcoes = atividades
    .map(a => `<option value="${escaparHTML(a.id)}"${a.id === destinoInicial ? " selected" : ""}>${escaparHTML(a.label)}</option>`)
    .join("");

  box.innerHTML = `
    <div class="pop-header">
      <span id="novaConexaoTitulo"><b>Nova caixa</b></span>
      <button type="button" class="pop-fechar" onclick="fecharCriadorConexao()">✕</button>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">De (origem)</div>
      <div class="pop-origem-fixa">${escaparHTML(rotuloNoComId(origemVisual))}</div>
      <input type="hidden" id="novaConexaoOrigem" value="${escaparHTML(origemVisual)}" />
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Para (destino)</div>
      <select id="novaConexaoDestino" class="pop-select" onchange="alternarCamposNovaCaixaConexao()">
        <option value="__NOVA__"${!destinoInicial ? " selected" : ""}>+ Nova caixa</option>
        ${opcoes}
      </select>
    </div>
    <div class="pop-grupo" id="novaConexaoCamposCaixa">
      <div class="pop-label">Texto da nova atividade</div>
      <input type="text" id="novaConexaoCaixaTexto" class="pop-select" placeholder="Ex.: Validar relatório" />
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
      <button type="button" class="pop-criar" id="novaConexaoBotaoCriar" onclick="confirmarCriarConexao()">Criar caixa</button>
    </div>
  `;

  alternarCamposNovaCaixaConexao();
  posicionarFlutuante(box, ev);
}

/* Mostra os campos "Tipo da nova caixa" / "Texto da nova atividade" só quando
   o destino selecionado é "+ Nova caixa"; escondidos ao escolher uma
   atividade já existente. Também ajusta o título e o botão do popover — esse
   formulário serve pros dois casos (criar caixa nova, ou só ligar numa
   atividade já existente), então o texto muda junto pra não ficar sempre
   falando em "seta" quando o que o usuário está criando é uma caixa. */
function alternarCamposNovaCaixaConexao() {
  const destino = document.getElementById("novaConexaoDestino");
  const campos = document.getElementById("novaConexaoCamposCaixa");
  const titulo = document.getElementById("novaConexaoTitulo");
  const botao = document.getElementById("novaConexaoBotaoCriar");
  if (!destino) return;

  const criandoCaixa = destino.value === "__NOVA__";
  if (campos) campos.style.display = criandoCaixa ? "" : "none";
  if (titulo) titulo.innerHTML = criandoCaixa ? "<b>Nova caixa</b>" : "<b>Nova seta</b>";
  if (botao) botao.textContent = criandoCaixa ? "Criar caixa" : "Criar seta";
}

function confirmarCriarConexao() {
  const o = document.getElementById("novaConexaoOrigem");
  const d = document.getElementById("novaConexaoDestino");
  const t = document.getElementById("novaConexaoTipo");
  if (!o || !d || !t) return;

  if (d.value === "__NOVA__") {
    const textoCaixa = (document.getElementById("novaConexaoCaixaTexto") || {}).value;
    criarConexaoNovaCaixa(o.value, t.value, "", textoCaixa);
    return;
  }

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
  fecharTodosOsPopovers();
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
      fecharComecarDoZero();
      fecharMoverCaixa();
      fecharMoverRaia();
      fecharMoverTerminal();
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
  const cz = document.getElementById("comecarDoZero");
  const mv = document.getElementById("moverCaixa");
  const mr = document.getElementById("moverRaia");
  const mt = document.getElementById("moverTerminal");
  const algumAberto =
    (t && t.style.display === "block") ||
    (c && c.style.display === "block") ||
    (cx && cx.style.display === "block") ||
    (cz && cz.style.display === "block") ||
    (mv && mv.style.display === "block") ||
    (mr && mr.style.display === "block") ||
    (mt && mt.style.display === "block");
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

// Reletra TODA referência guardada por letra (A/B/C...) depois que a ordem do array
// muda (ex.: uma caixa foi inserida no meio): as chaves de overridesConexoes/
// rotulosConexoes ("X__Y") E os alvos de terminal (inicioAlvo, fimOrigem,
// terminais[].alvo — também guardados como letra, não uid). A letra é só posição; o
// que ela representa (par de UIDs, ou uma caixa-alvo) continua o mesmo, mas a chave/
// valor guardado usa a letra ANTIGA. Sem reletrar, o estilo/rótulo de uma seta ou o
// alvo de um Início/Fim "somem"/apontam pro lugar errado (a busca não bate mais com
// o que a tela desenha). Terminal (__INICIO__/__FIM__) não é letra posicional, fica
// intocado nas CHAVES de overridesConexoes/rotulosConexoes.
function reletrarReferenciasVisuais(mapaAntes, mapaDepois) {
  if (!mapaAntes || !mapaDepois) return;

  const reletrarLetra = (letra) => {
    if (!letra) return letra;
    const uid = mapaAntes.visualParaUid[letra];
    return (uid && mapaDepois.uidParaVisual[uid]) ? mapaDepois.uidParaVisual[uid] : letra;
  };

  const reletrarObjeto = (obj) => {
    const novo = {};
    Object.keys(obj).forEach((chave) => {
      // Token de terminal (ex.: "__INICIO__") já contém "__" dentro dele — um
      // split ingênuo por "__" quebraria o token ao meio e corromperia a chave.
      // Só reletra quando a chave é claramente "duas letras normais" (exatamente
      // 2 pedaços); chave envolvendo Início/Fim fica intocada (mais seguro deixar
      // de reletrar esse caso raro do que arriscar corromper a chave).
      const partes = chave.split("__");
      if (partes.length !== 2) { novo[chave] = obj[chave]; return; }
      const [a, b] = partes;
      novo[chaveOverride(reletrarLetra(a), reletrarLetra(b))] = obj[chave];
    });
    return novo;
  };
  overridesConexoes = reletrarObjeto(overridesConexoes || {});
  rotulosConexoes = reletrarObjeto(rotulosConexoes || {});

  if (typeof inicioAlvo !== "undefined") inicioAlvo = reletrarLetra(inicioAlvo);
  if (typeof fimOrigem !== "undefined") fimOrigem = reletrarLetra(fimOrigem);
  if (Array.isArray(terminais)) {
    terminais.forEach((t) => { if (t) t.alvo = reletrarLetra(t.alvo); });
  }
}

function inserirNovaCaixa(opts) {
  // Texto livre (igual a coluna "Tipo" da tabela — ehDecisao reconhece
  // "decisão"/"decisao" sem diferenciar caixa/acento; qualquer outro valor é
  // só metadado, usado no recorte "tempo por tipo" da Análise/PDF).
  // normalizarTextoCampo (não só normalizarEspacos) porque "tipo" tem dedupe
  // de grafia contra valores já existentes — sem isso, digitar "decisão" numa
  // caixa nova quando já existe "Decisão" no fluxo criaria duas categorias
  // diferentes no recorte por tipo, em vez de uma só.
  const tipo = normalizarTextoCampo("tipo", opts.tipo || "");
  const atividade = limpar(opts.atividade || "");
  const area = opts.area || "";
  const col = Math.max(1, Number(opts.coluna) || 1);
  const lin = Math.max(1, Number(opts.linha) || 1);

  if (!atividade) { mostrarToast("Informe o texto da atividade.", "alerta"); return; }
  if (!area) { mostrarToast("Escolha a raia (área).", "alerta"); return; }

  // Só empurra +1 as caixas com coluna >= col (em todas as raias) se a
  // posição alvo (essa área, nessa linha, nessa coluna) já estiver ocupada —
  // senão não tem nada "no caminho" pra abrir espaço. Bug real, achado com um
  // .json de teste do usuário: criar uma raia nova (vazia) sempre empurrava a
  // coluna de TODAS as outras raias, mesmo sem nenhum conflito — inserir na
  // raia nova não deveria mexer em raia nenhuma que já tinha suas próprias
  // caixas nos seus próprios lugares.
  if (existePosicaoOcupadaNaRaia(null, area, lin, col)) {
    fluxoData.forEach((l) => {
      if (limpar(l.atividade || "") === "") return;
      if ((Number(l.coluna) || 1) >= col) {
        l.coluna = (Number(l.coluna) || 1) + 1;
        l.colunaManual = true;
      }
    });
  }

  const novoUid = gerarUID();
  const nova = {
    uid: novoUid, ordem: 0, id: "",
    area, atividade,
    tipo,
    sistema: "", tempo: "",
    coluna: col, linha: lin, colunaManual: true, linhaManual: true,
    cor: "white",
    proxSim: "", proxSimAuto: false, proxNao: "", extras: [], semSaida: false
  };

  // Resolve ANTES de tocar no array: onde a nova linha entra na lista e o que ela
  // está "cortando" — pode ser uma seta entre duas atividades, uma saindo do
  // Início, ou uma entrando no Fim (opts.origemId/destinoId, vindo do popover da
  // seta clicada). Crítico inserir na posição certa (logo após a origem, ou logo
  // antes do destino no caso do Início), não empilhar no fim: reaplicarSugestoesConexao
  // (chamada pelo gerarFluxo logo abaixo) recalcula toda ligação "automática" pela
  // ORDEM DO ARRAY — empilhar no fim desfaz religações e inventa ligações fantasma.
  const ehTerminal = (id) => typeof id === "string" && id.startsWith("__");

  const oVis = opts.origemId || null;
  const dVis = opts.destinoId || null;

  let origemLinha = null, destinoLinha = null, dUid = null;
  let terminalOrigemId = null, terminalDestinoId = null;
  let chaveAntiga = null, mapaAntes = null;
  let indiceInsercao = fluxoData.length; // padrão: solta, no fim (como sempre foi)

  if (oVis && dVis) {
    mapaAntes = mapaIdVisualUid();

    if (ehTerminal(oVis)) {
      // Início (padrão ou extra) → X: a nova entra ANTES de X.
      dUid = mapaAntes.visualParaUid[dVis];
      destinoLinha = dUid ? fluxoData.find(l => l.uid === dUid) : null;
      if (destinoLinha) {
        indiceInsercao = fluxoData.indexOf(destinoLinha);
        terminalOrigemId = oVis;
      }
    } else if (ehTerminal(dVis)) {
      // X → Fim (padrão ou extra): a nova entra DEPOIS de X.
      const oUid = mapaAntes.visualParaUid[oVis];
      const origemIndex = fluxoData.findIndex(l => l.uid === oUid);
      origemLinha = origemIndex >= 0 ? fluxoData[origemIndex] : null;
      if (origemLinha) {
        indiceInsercao = origemIndex + 1;
        terminalDestinoId = dVis;
      }
    } else {
      // Caso normal: atividade → atividade.
      const oUid = mapaAntes.visualParaUid[oVis];
      dUid = mapaAntes.visualParaUid[dVis];
      const origemIndex = fluxoData.findIndex(l => l.uid === oUid);
      origemLinha = origemIndex >= 0 ? fluxoData[origemIndex] : null;
      if (origemLinha && dUid) {
        indiceInsercao = origemIndex + 1;
        chaveAntiga = chaveOverride(oVis, dVis);
      } else {
        origemLinha = null;
      }
    }
  }

  // Se a caixa nova vai pro FIM do array (sem contexto de seta — o caso do
  // "+ Raia"/"Começar a desenhar", sem origemId/destinoId), a linha que hoje
  // é a última do array vira a "próxima" dela aos olhos de
  // reaplicarSugestoesConexao, que pode lhe dar um "Sim" automático
  // indesejado (mesmo bug já corrigido em criarConexaoNovaCaixa — congela
  // aqui pelo mesmo motivo, com o mesmo campo simSlotCongelado — separado
  // de semSaida, pra não fazer a caixa perder a seta automática pro Fim).
  // Os outros 3 casos (splice no meio) não têm esse risco: nada vira "novo
  // último elemento" quando a inserção não é no fim.
  if (indiceInsercao === fluxoData.length) {
    const ultimaAntes = fluxoData[fluxoData.length - 1];
    if (ultimaAntes && !ultimaAntes.proxSim && !ultimaAntes.semSaida && !ultimaAntes.simRemovido) {
      ultimaAntes.simSlotCongelado = true;
    }
  }

  fluxoData.splice(indiceInsercao, 0, nova);
  const mapaPos = mapaAntes ? mapaIdVisualUid() : null;

  if (terminalOrigemId && destinoLinha) {
    // Início → Nova → destino (destino era o alvo do terminal antes da inserção).
    nova.proxSim = destinoLinha.uid;
    reletrarReferenciasVisuais(mapaAntes, mapaPos); // primeiro corrige o que "andou"
    aplicarAlvoTerminal(terminalOrigemId, mapaPos.uidParaVisual[novoUid]); // depois, o alvo novo (não pode ser pego pelo reletrar acima)
  } else if (terminalDestinoId && origemLinha) {
    // origem → Nova → Fim (origem antes ia direto pro Fim).
    origemLinha.proxSim = novoUid;
    origemLinha.proxSimAuto = false;
    origemLinha.simRemovido = false;
    origemLinha.semSaida = false;
    reletrarReferenciasVisuais(mapaAntes, mapaPos);
    aplicarAlvoTerminal(terminalDestinoId, mapaPos.uidParaVisual[novoUid]);
  } else if (origemLinha && dUid) {
    // redireciona a saída origem→destino para origem→nova (mantém o slot Sim/Não)
    if (origemLinha.proxSim === dUid) {
      origemLinha.proxSim = novoUid;
      origemLinha.proxSimAuto = false; // trava: senão reaplicarSugestoesConexao desfaz
      origemLinha.simRemovido = false;
    } else if (origemLinha.proxNao === dUid) {
      origemLinha.proxNao = novoUid;
    } else if (Array.isArray(origemLinha.extras)) {
      const i = origemLinha.extras.indexOf(dUid);
      if (i !== -1) origemLinha.extras[i] = novoUid;
    }
    nova.proxSim = dUid;        // nova → destino
    origemLinha.semSaida = false;

    // transfere rótulo/override da seta antiga para o novo trecho origem→nova
    // (usa o mapa DEPOIS do splice — o id visual da nova linha só existe agora)
    const oVisAtual = mapaPos.uidParaVisual[origemLinha.uid];
    const novaVis = mapaPos.uidParaVisual[novoUid];
    const chaveNova = chaveOverride(oVisAtual, novaVis);
    if (rotulosConexoes[chaveAntiga] !== undefined) {
      rotulosConexoes[chaveNova] = rotulosConexoes[chaveAntiga];
      delete rotulosConexoes[chaveAntiga];
    }
    if (overridesConexoes[chaveAntiga] !== undefined) {
      overridesConexoes[chaveNova] = overridesConexoes[chaveAntiga];
      delete overridesConexoes[chaveAntiga];
    }

    // Reletra TODAS as outras chaves/alvos que ficaram com a letra desatualizada
    // por causa do deslocamento no array (ex.: uma seta extra A→C, sem nada a ver
    // com essa inserção, vira A→D porque a caixa que era "C" empurrou pra frente).
    // O que a letra representa não muda — só a letra. Sem isso, o estilo/rótulo/
    // alvo referente a essas outras coisas "some" (a busca não bate mais com o que
    // a tela desenha).
    reletrarReferenciasVisuais(mapaAntes, mapaPos);
  }

  salvarEstadoLocal(true);
  atualizarTabela();
  gerarFluxo();
  mostrarToast(`Caixa "${atividade}" inserida na coluna ${col}.`, "ok");
}

/* ---------- Nova raia (com a 1ª caixa dela) ----------
   Duas portas de entrada pro mesmo popover: o bloco "Desenhe do zero" (fora
   do modo de edição, só aparece com o fluxo vazio — cria a 1ª raia de todas)
   e o botão "+ Raia" na barra do editor (dentro do modo de edição, sempre
   visível — adiciona mais uma raia a um fluxo que já existe). Os dois casos
   usam exatamente a mesma mecânica: inserirNovaCaixa, chamada sem
   origemId/destinoId, entra no fim do array sem disparar nenhuma lógica de
   rewiring (pra um array vazio isso é a posição 0; pra um array já populado,
   só mais uma linha no fim — e coluna 1 é o ponto de partida natural pra uma
   raia nova, que ainda não se conecta a nada do resto do fluxo). Depois de
   criar, garante o modo de ajuste ligado — no caso "+ Raia" já estava,
   então não faz nada; no caso "Desenhe do zero" é quem liga. */
function abrirComecarDoZero(ev) {
  fecharTodosOsPopovers();
  mostrarBackdropEditor();
  let box = document.getElementById("comecarDoZero");
  if (!box) {
    box = document.createElement("div");
    box.id = "comecarDoZero";
    document.body.appendChild(box);
  }

  box.innerHTML = `
    <div class="pop-header">
      <span></span>
      <button type="button" class="pop-fechar" onclick="fecharComecarDoZero()">✕</button>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Nome da raia (área)</div>
      <input type="text" id="zeroRaiaNome" class="pop-select" placeholder="Ex.: Comercial" />
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Texto da primeira atividade</div>
      <input type="text" id="zeroCaixaTexto" class="pop-select" placeholder="Ex.: Receber solicitação" />
    </div>
    <div class="pop-rodape pop-rodape-acoes">
      <button type="button" class="pop-criar" onclick="confirmarComecarDoZero()">Criar raia</button>
    </div>
  `;
  posicionarFlutuante(box, ev);
}

function confirmarComecarDoZero() {
  const area = normalizarEspacos((document.getElementById("zeroRaiaNome") || {}).value);
  const atividade = normalizarEspacos((document.getElementById("zeroCaixaTexto") || {}).value);

  const antes = fluxoData.length;
  inserirNovaCaixa({ atividade, area, coluna: 1, linha: 1 });
  // inserirNovaCaixa já valida atividade/área vazias (toast + aborta sem tocar
  // fluxoData nesse caso) — só fecha e entra no modo de ajuste se ela de fato
  // criou a linha.
  if (fluxoData.length === antes) return;

  fecharComecarDoZero();
  if (!modoEdicaoAtivo) alternarModoEdicao();
}

function fecharComecarDoZero() {
  const box = document.getElementById("comecarDoZero");
  if (box) box.style.display = "none";
  esconderBackdropEditor();
}

/* ---------- Formulário flutuante de Nova caixa ----------
   Só abre a partir de "+ Inserir caixa aqui", no popover de uma seta (qualquer
   uma — entre atividades, ou envolvendo Início/Fim). O contexto {origemId,
   destinoId} da seta clicada vem sempre preenchido; guarda em box.dataset pra
   confirmarCriarCaixa() ler depois. Raia/Coluna/Linha são calculados a partir da
   caixa de referência da seta — só sobra Tipo + Texto pra preencher. */
function abrirCriadorCaixa(ev, contextoConexao) {
  if (!contextoConexao || !contextoConexao.origemId || !contextoConexao.destinoId) return;

  fecharTodosOsPopovers();
  mostrarBackdropEditor();
  let box = document.getElementById("criadorCaixa");
  if (!box) {
    box = document.createElement("div");
    box.id = "criadorCaixa";
    document.body.appendChild(box);
  }

  box.dataset.contexto = JSON.stringify(contextoConexao);
  const tituloContexto = `<div class="pop-titulo">${escaparHTML(descricaoNo(contextoConexao.origemId))}<br>→ nova →<br>${escaparHTML(descricaoNo(contextoConexao.destinoId))}</div>`;

  box.innerHTML = `
    <div class="pop-header">
      <span><b>Nova caixa</b></span>
      <button type="button" class="pop-fechar" onclick="fecharCriadorCaixa()">✕</button>
    </div>
    ${tituloContexto}
    <div class="pop-grupo">
      <div class="pop-label">Texto da atividade</div>
      <input type="text" id="novaCaixaTexto" class="pop-select" placeholder="Ex.: Validar relatório" />
    </div>
    <div class="pop-rodape pop-rodape-acoes">
      <button type="button" class="pop-criar" onclick="confirmarCriarCaixa()">Inserir caixa</button>
    </div>
  `;
  posicionarFlutuante(box, ev);
}

function confirmarCriarCaixa() {
  const box = document.getElementById("criadorCaixa");
  const contexto = (box && box.dataset.contexto) ? JSON.parse(box.dataset.contexto) : null;
  if (!contexto) return;

  const atividade = (document.getElementById("novaCaixaTexto") || {}).value;
  const { origemId, destinoId } = contexto;
  const ehTerminal = (id) => typeof id === "string" && id.startsWith("__");
  const { visualParaUid } = mapaIdVisualUid();

  // Referência de área/coluna/linha: a atividade real dos dois lados da seta.
  // Início→X: a referência é X, e a nova caixa entra ANTES dele (mesma coluna de
  // X, empurrando X pra frente). X→Fim: a referência é X, e a nova caixa entra
  // DEPOIS dele (coluna+1), igual ao caso normal atividade→atividade.
  const idReferencia = ehTerminal(origemId) ? destinoId : origemId;
  const referencia = fluxoData.find(l => l.uid === visualParaUid[idReferencia]);
  if (!referencia) {
    mostrarToast("Não encontrei a caixa de referência dessa seta.", "erro");
    return;
  }
  const colunaRef = Number(referencia.coluna) || 1;

  inserirNovaCaixa({
    atividade,
    area: referencia.area,
    coluna: ehTerminal(origemId) ? colunaRef : colunaRef + 1,
    linha: referencia.linha,
    origemId,
    destinoId
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

  fecharTodosOsPopovers();

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
    <div class="pop-grupo">
      <div class="pop-label">Texto da caixa</div>
      <textarea class="pop-textarea" id="editarAtividadeCaixa" rows="2"
        onblur="aplicarEditarAtividadeCaixa('${uid}')"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault(); this.blur();} else if(event.key==='Escape'){this.value=this.defaultValue; this.blur();}"
      >${escaparHTML(limpar(linha.atividade || ""))}</textarea>
    </div>
    <div class="pop-grupo-linha">
      <div class="pop-grupo">
        <div class="pop-label">Sistema</div>
        <input type="text" class="pop-input" id="editarSistemaCaixa" list="sugestoes-sistema"
          value="${escaparHTML(limpar(linha.sistema || ""))}"
          onblur="aplicarEditarCampoCaixa('${uid}','sistema')"
          onkeydown="if(event.key==='Enter'){this.blur();} else if(event.key==='Escape'){this.value=this.defaultValue; this.blur();}" />
      </div>
      <div class="pop-grupo">
        <div class="pop-label">Tempo</div>
        <input type="text" class="pop-input" id="editarTempoCaixa"
          value="${escaparHTML(limpar(linha.tempo || ""))}"
          onblur="aplicarEditarCampoCaixa('${uid}','tempo')"
          onkeydown="if(event.key==='Enter'){this.blur();} else if(event.key==='Escape'){this.value=this.defaultValue; this.blur();}" />
      </div>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Cor</div>
      <select id="editarCorCaixa" class="pop-select" onchange="aplicarEditarCampoCaixa('${uid}','cor')">
        <option value="white" ${linha.cor === "white" ? "selected" : ""}>Branco</option>
        <option value="blue" ${linha.cor === "blue" ? "selected" : ""}>Azul</option>
        <option value="green" ${linha.cor === "green" ? "selected" : ""}>Verde</option>
        <option value="yellow" ${linha.cor === "yellow" ? "selected" : ""}>Amarelo</option>
        <option value="red" ${linha.cor === "red" ? "selected" : ""}>Vermelho</option>
      </select>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Raia (\u00e1rea)</div>
      <select id="moverArea" class="pop-select" onchange="aplicarMoverArea('${uid}')">${optAreas}</select>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Tipo da atividade (opcional)</div>
      <input type="text" class="pop-input" id="editarTipoCaixa" list="sugestoes-tipo"
        value="${escaparHTML(limpar(linha.tipo || ""))}"
        placeholder="Ex.: Manual, Autom\u00e1tica..."
        onblur="aplicarEditarCampoCaixa('${uid}','tipo')"
        onkeydown="if(event.key==='Enter'){this.blur();} else if(event.key==='Escape'){this.value=this.defaultValue; this.blur();}" />
    </div>
    <div class="mover-dpad">
      <button type="button" class="dpad-btn dpad-up" title="Subir linha" onclick="nudgeMoverCaixa('${uid}',0,-1)">\u25b2</button>
      <button type="button" class="dpad-btn dpad-left" title="Coluna \u00e0 esquerda" onclick="nudgeMoverCaixa('${uid}',-1,0)">\u25c0</button>
      <div class="dpad-center" id="moverPosLabel">Col ${Number(linha.coluna) || 1} \u00b7 Lin ${Number(linha.linha) || 1}</div>
      <button type="button" class="dpad-btn dpad-right" title="Coluna \u00e0 direita" onclick="nudgeMoverCaixa('${uid}',1,0)">\u25b6</button>
      <button type="button" class="dpad-btn dpad-down" title="Descer linha" onclick="nudgeMoverCaixa('${uid}',0,1)">\u25bc</button>
    </div>
    <div class="mover-dica">\u25b2\u25bc muda a linha \u00b7 \u25c0\u25b6 muda a coluna</div>
    <div class="pop-rodape">
      <div class="raia-mover-acoes">
        <button type="button" class="pop-seta-btn" onclick="abrirCriadorConexao('${uid}', event); fecharMoverCaixa();">+ Caixa a partir daqui</button>
        <button type="button" class="pop-seta-btn" onclick="abrirCriadorConexaoExistente('${uid}', event); fecharMoverCaixa();">+ Seta a partir daqui</button>
      </div>
    </div>
    <button type="button" class="raia-mv-btn terminal-excluir" onclick="excluirCaixaEditor('${uid}')">\u2715 Excluir caixa</button>
  `;
  posicionarFlutuante(box, ev);
}

// Exclui a caixa pelo popover "Mover caixa", reusando excluirLinha (mesma fun\u00e7\u00e3o do
// bot\u00e3o de excluir da tabela): j\u00e1 confirma se a caixa est\u00e1 conectada em outras linhas,
// remove as refer\u00eancias \u00f3rf\u00e3s e reaplica posi\u00e7\u00f5es/conex\u00f5es. S\u00f3 diferencia detectando
// se o usu\u00e1rio cancelou o confirm() (fluxoData n\u00e3o mudou de tamanho) pra n\u00e3o fechar o
// popover nem re-renderizar \u00e0 toa.
function excluirCaixaEditor(uid) {
  const antes = fluxoData.length;
  excluirLinha(uid);
  if (fluxoData.length === antes) return;
  gerarFluxo();
  fecharMoverCaixa();
  mostrarToast("Caixa exclu\u00edda.", "ok");
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

// Edita o texto (atividade) da caixa direto pelo popover "Mover caixa", ao
// perder o foco/Enter. Reusa finalizarCampoNormalizado (mesma normalização da
// tabela) para manter os dois pontos de edição consistentes.
function aplicarEditarAtividadeCaixa(uid) {
  const linha = fluxoData.find(l => l.uid === uid);
  if (!linha) return;
  const el = document.getElementById("editarAtividadeCaixa");
  if (!el) return;

  const bruto = normalizarEspacos(el.value);
  const atual = normalizarEspacos(linha.atividade || "");

  if (!bruto) {
    el.value = linha.atividade || "";
    mostrarToast("O texto da caixa não pode ficar em branco.", "alerta");
    return;
  }
  if (bruto === atual) {
    el.value = linha.atividade || "";
    return;
  }

  finalizarCampoNormalizado(uid, "atividade", el);
  salvarEstadoLocal(true);
  atualizarTabela();
  gerarFluxo();
  mostrarToast("Texto da caixa atualizado.", "ok");
}

// Edita Tipo, Sistema, Tempo ou Cor da caixa pelo popover "Mover caixa" (todos
// opcionais, sem guarda de campo vazio, diferente da atividade). Mesma
// normalização da tabela — inclusive o Tipo, que é texto livre (não um
// seletor fixo Atividade/Decisão): ehDecisao reconhece "decisão"/"decisao"
// digitado ali, qualquer outro valor vira metadado pro recorte "tempo por
// tipo" da Análise/PDF, igual já funcionava vindo da tabela.
const CAMPOS_EDITAR_CAIXA = {
  tipo: { id: "editarTipoCaixa", rotulo: "Tipo" },
  sistema: { id: "editarSistemaCaixa", rotulo: "Sistema" },
  tempo: { id: "editarTempoCaixa", rotulo: "Tempo" },
  cor: { id: "editarCorCaixa", rotulo: "Cor" }
};

function aplicarEditarCampoCaixa(uid, campo) {
  const linha = fluxoData.find(l => l.uid === uid);
  if (!linha) return;
  const config = CAMPOS_EDITAR_CAIXA[campo];
  const el = config && document.getElementById(config.id);
  if (!el) return;

  const bruto = normalizarEspacos(el.value);
  const atual = normalizarEspacos(linha[campo] || "");
  if (bruto === atual) {
    el.value = linha[campo] || "";
    return;
  }

  finalizarCampoNormalizado(uid, campo, el);
  salvarEstadoLocal(true);
  atualizarTabela();
  gerarFluxo();
  mostrarToast(`${config.rotulo} atualizado.`, "ok");
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

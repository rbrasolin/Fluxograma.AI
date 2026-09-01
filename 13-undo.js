/* =========================================================
   13-undo.js  |  Gerador de Fluxograma
   B1 — Undo/Redo por snapshots de estado (isolado, aditivo)

   Como funciona:
   - Mantém uma pilha linear de snapshots (JSON de obterEstadoAtual()).
   - Captura automática: 01-estado.js chama historicoAoSalvar() a cada
     estado persistido (já com debounce nativo do salvarEstadoLocal).
   - Restauração reaproveita o pipeline existente (STORAGE_KEY + restaurarEstadoLocal),
     o mesmo usado no load e no importarProjetoJSON. Zero deserialização nova.
   - NÃO toca no pipeline do SVG Excel (gerarFluxoExcel).
   ========================================================= */
(function () {
  const MAX_HISTORICO = 60;   // teto de snapshots guardados
  let pilha = [];             // array de strings JSON
  let ponteiro = -1;          // índice do estado atual dentro da pilha
  let restaurando = false;    // trava: não captura durante undo/redo

  function snapshotAtual() {
    try { return JSON.stringify(obterEstadoAtual()); }
    catch (e) { return null; }
  }

  function atualizarBotoes() {
    const bu = document.getElementById("btnDesfazer");
    const br = document.getElementById("btnRefazer");
    if (bu) bu.disabled = (ponteiro <= 0);
    if (br) br.disabled = (ponteiro >= pilha.length - 1);
  }

  /* Gancho chamado por salvarEstadoLocal (01-estado.js) a cada persistência. */
  window.historicoAoSalvar = function (estado) {
    if (restaurando) return;                       // ignora o save disparado pela própria restauração
    let json;
    try { json = JSON.stringify(estado); } catch (e) { return; }
    if (ponteiro >= 0 && pilha[ponteiro] === json) return;  // dedupe: estado idêntico ao atual

    pilha = pilha.slice(0, ponteiro + 1);          // descarta o "futuro" (redo) ao criar novo ramo
    pilha.push(json);
    if (pilha.length > MAX_HISTORICO) pilha.shift();
    ponteiro = pilha.length - 1;
    atualizarBotoes();
  };

  /* Aplica um snapshot reaproveitando o caminho de restauração já existente. */
  function aplicarSnapshot(json) {
    restaurando = true;
    try {
      localStorage.setItem(STORAGE_KEY, json);
      restaurarEstadoLocal();
      atualizarTabela();
      renderizarDatalists();

      // Re-renderiza o fluxo apenas se já existe um diagrama na tela.
      const diagrama = document.getElementById("diagram");
      if (diagrama && diagrama.innerHTML.trim() !== "") {
        try { gerarFluxo(); } catch (e) { console.error("Undo/redo: falha ao regerar fluxo:", e); }
      }

      salvarEstadoLocal(true); // persiste o estado restaurado (não recaptura: trava ligada)
    } catch (e) {
      console.error("Undo/redo: falha ao aplicar snapshot:", e);
    } finally {
      restaurando = false;
    }
  }

  window.desfazer = function () {
    if (ponteiro <= 0) {
      if (typeof mostrarToast === "function") mostrarToast("Nada para desfazer.", "info");
      return;
    }
    ponteiro--;
    aplicarSnapshot(pilha[ponteiro]);
    atualizarBotoes();
    if (typeof mostrarToast === "function") mostrarToast("Desfeito.", "info");
  };

  window.refazer = function () {
    if (ponteiro >= pilha.length - 1) {
      if (typeof mostrarToast === "function") mostrarToast("Nada para refazer.", "info");
      return;
    }
    ponteiro++;
    aplicarSnapshot(pilha[ponteiro]);
    atualizarBotoes();
    if (typeof mostrarToast === "function") mostrarToast("Refeito.", "info");
  };

  /* Semente inicial: registra o estado logo após a inicialização da app. */
  window.addEventListener("DOMContentLoaded", function () {
    // setTimeout(0) garante rodar depois do inicializarAplicacao (mesma fila DOMContentLoaded).
    setTimeout(function () {
      const json = snapshotAtual();
      if (json) { pilha = [json]; ponteiro = 0; atualizarBotoes(); }
    }, 0);
  });

  /* Atalhos de teclado — respeitam o undo/redo NATIVO quando o foco está em campo de texto. */
  function ehCampoEditavel(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || el.isContentEditable === true;
  }

  document.addEventListener("keydown", function (e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;
    if (ehCampoEditavel(document.activeElement)) return; // deixa o navegador cuidar do texto

    const k = (e.key || "").toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); window.desfazer(); }
    else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); window.refazer(); }
  });
})();

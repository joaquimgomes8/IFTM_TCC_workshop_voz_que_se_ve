(function () {
  // ─── VLibras ───────────────────────────────────────────────────────────────
  new window.VLibras.Widget('https://vlibras.gov.br/app');

  // ─── Elementos ─────────────────────────────────────────────────────────────
  const startBtn       = document.getElementById('start');
  const stopBtn        = document.getElementById('stop');
  const clearBtn       = document.getElementById('clearHistory');
  const exportBtn      = document.getElementById('exportHistory');
  const librasAtualBtn = document.getElementById('librasAtual');
  const sessaoAtual    = document.getElementById('sessaoAtual');
  const historico      = document.getElementById('historico');
  const status         = document.getElementById('status');
  const vlibrasTexto   = document.getElementById('vlibras-texto');
  const vlibrasPanel   = document.getElementById('vlibras-panel');
  const librasInstrucao = document.getElementById('libras-instrucao');

  // ─── Estado ────────────────────────────────────────────────────────────────
  let recognition;
  let isListening = false;
  let currentSessionText = "";

  // ─── Helpers ───────────────────────────────────────────────────────────────
  window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  function setStatus(msg, active = false) {
    status.textContent = msg;
    status.dataset.active = active ? "true" : "false";
  }

  // ─── Histórico ─────────────────────────────────────────────────────────────
  function addToHistory(text) {
    const sessions = loadSessionsJSON();
    const session = {
      id: Date.now(),
      text: text,
      data: new Date().toLocaleString('pt-BR')
    };
    sessions.push(session);
    localStorage.setItem('speechHistoryV2', JSON.stringify(sessions));
    renderHistory(sessions);
  }

  function loadSessionsJSON() {
    try {
      return JSON.parse(localStorage.getItem('speechHistoryV2')) || [];
    } catch {
      return [];
    }
  }

  function renderHistory(sessions) {
    historico.innerHTML = '';
    if (sessions.length === 0) {
      historico.innerHTML = '<p class="empty-msg">Nenhuma sessão registrada ainda.</p>';
      return;
    }
    sessions.forEach((s, i) => {
      const bloco = document.createElement('div');
      bloco.className = 'bloco-sessao';
      bloco.innerHTML = `
        <div class="sessao-meta">
          <span class="sessao-num">Sessão ${i + 1}</span>
          <span class="sessao-data">${s.data}</span>
        </div>
        <p class="sessao-texto">${s.text}</p>
        <div class="sessao-acoes">
          <button class="btn-mini" onclick="copiarSessao(${s.id})" aria-label="Copiar sessão ${i+1}">📋 Copiar</button>
          <button class="btn-mini btn-libras-mini" onclick="traduzirSessao(${s.id})" aria-label="Traduzir sessão ${i+1} para Libras">🤟 Libras</button>
          <button class="btn-mini btn-danger" onclick="deletarSessao(${s.id})" aria-label="Deletar sessão ${i+1}">🗑️</button>
        </div>
      `;
      historico.appendChild(bloco);
    });
  }

  function clearHistory() {
    if (!confirm('Deseja limpar todo o histórico? Esta ação não pode ser desfeita.')) return;
    localStorage.removeItem('speechHistoryV2');
    renderHistory([]);
  }

  // ─── Ações globais das sessões do histórico ────────────────────────────────
  window.copiarSessao = function(id) {
    const sessions = loadSessionsJSON();
    const s = sessions.find(x => x.id === id);
    if (s) navigator.clipboard.writeText(s.text).then(() => alert('Texto copiado!'));
  };

  window.deletarSessao = function(id) {
    if (!confirm('Remover esta sessão?')) return;
    const sessions = loadSessionsJSON().filter(x => x.id !== id);
    localStorage.setItem('speechHistoryV2', JSON.stringify(sessions));
    renderHistory(sessions);
  };

  function enviarParaVLibras(texto) {
    if (!texto || !texto.trim()) {
      alert('Não há texto para traduzir.');
      return;
    }

    // Coloca o texto no painel visível que o VLibras monitora
    vlibrasTexto.textContent = texto.trim();
    vlibrasPanel.style.display = 'block';
    librasInstrucao.style.display = 'block';

    // Tenta disparar o VLibras programaticamente
    // O widget expõe o método Translate via evento ou DOM
    setTimeout(() => {
      try {
        // Método 1: Clica no botão de play do widget VLibras internamente
        const vwBtn = document.querySelector('[vw-access-button]');
        if (vwBtn) {
          // Abre o widget se estiver fechado
          const pluginWrapper = document.querySelector('[vw-plugin-wrapper]');
          if (pluginWrapper) pluginWrapper.style.display = 'block';
        }

        // Método 2: Dispara o evento de tradução que o VLibras escuta
        const translateEvent = new CustomEvent('vlibras:translate', {
          detail: { text: texto.trim() }
        });
        document.dispatchEvent(translateEvent);

        // Método 3: Seleciona o texto no painel para o VLibras detectar
        const range = document.createRange();
        range.selectNodeContents(vlibrasTexto);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

      } catch(e) {
        console.warn('VLibras auto-trigger:', e);
      }
    }, 300);
  }

  window.traduzirSessao = function(id) {
    const sessions = loadSessionsJSON();
    const s = sessions.find(x => x.id === id);
    if (s) {
      // Rola para o topo para ver o painel VLibras
      window.scrollTo({ top: 0, behavior: 'smooth' });
      enviarParaVLibras(s.text);
    }
  };

  // ─── Botão Traduzir Sessão Atual ──────────────────────────────────────────
  librasAtualBtn.onclick = () => {
    const texto = currentSessionText.trim() || sessaoAtual.textContent.trim();
    enviarParaVLibras(texto);
  };

  // ─── Exportar ──────────────────────────────────────────────────────────────
  if (exportBtn) {
    exportBtn.onclick = () => {
      const sessions = loadSessionsJSON();
      if (sessions.length === 0) {
        alert('Nenhuma sessão no histórico para exportar.');
        return;
      }
      let text = 'HISTÓRICO DE TRANSCRIÇÕES – VozLibras\n';
      text += '='.repeat(40) + '\n\n';
      sessions.forEach((s, i) => {
        text += `Sessão ${i + 1} – ${s.data}\n`;
        text += s.text + '\n\n';
      });
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'historico-vozlibras.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
  }

  // ─── Reconhecimento de Voz ─────────────────────────────────────────────────
  if (!window.SpeechRecognition) {
    alert('Seu navegador não suporta a API de reconhecimento de voz. Use o Google Chrome.');
    startBtn.disabled = true;
    stopBtn.disabled = true;
  } else {
    recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentSessionText += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      sessaoAtual.textContent = currentSessionText + interimTranscript;
    };

    recognition.onerror = (event) => {
      const msgs = {
        'not-allowed': '⛔ Permissão de microfone negada.',
        'network':     '🌐 Erro de rede. Verifique sua conexão.',
        'no-speech':   '🔇 Nenhuma fala detectada.',
        'aborted':     '🛑 Gravação cancelada.'
      };
      setStatus(msgs[event.error] || '❌ Erro: ' + event.error);
      isListening = false;
      startBtn.disabled = false;
      stopBtn.disabled = true;
    };

    // BUG FIX: reinicia automaticamente se parar sozinho (silêncio)
    recognition.onend = () => {
      if (isListening) {
        // Ainda deve estar gravando — reinicia automaticamente
        recognition.start();
      } else {
        setStatus('⏹️ Gravação encerrada.');
        startBtn.disabled = false;
        stopBtn.disabled = true;
      }
    };
  }

  // ─── Botão INICIAR ─────────────────────────────────────────────────────────
  startBtn.onclick = () => {
    if (recognition && !isListening) {
      currentSessionText = "";
      sessaoAtual.textContent = "";
      vlibrasPanel.style.display = 'none';
      librasInstrucao.style.display = 'none';
      setStatus("🔴 Gravando...", true);
      recognition.start();
      isListening = true;
      startBtn.disabled = true;
      stopBtn.disabled = false;
    }
  };

  // ─── Botão PARAR ───────────────────────────────────────────────────────────
  stopBtn.onclick = () => {
    if (recognition && isListening) {
      isListening = false; // Antes de stop() para que onend não reinicie
      recognition.stop();
      startBtn.disabled = false;
      stopBtn.disabled = true;
      if (currentSessionText.trim().length > 0) {
        addToHistory(currentSessionText.trim());
        currentSessionText = "";
      }
    }
  };

  // ─── Botão LIMPAR ──────────────────────────────────────────────────────────
  if (clearBtn) clearBtn.onclick = clearHistory;

  // ─── Init ──────────────────────────────────────────────────────────────────
  renderHistory(loadSessionsJSON());

})();

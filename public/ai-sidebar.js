document.addEventListener('DOMContentLoaded', () => {
    const aiMode = document.body.dataset.aiMode;
    const mode = aiMode === 'doctor' ? 'doctor' : 'patient';
    const toggles = document.querySelectorAll('.ai-toggle');
    if (!toggles.length) return;

    const container = document.createElement('aside');
    container.className = 'ai-sidebar';
    container.innerHTML = `
        <div class="ai-sidebar-header">
            <h3>${mode === 'doctor' ? 'Doctor AI Assistant' : 'Symptom AI Assistant'}</h3>
            <button type="button" class="ai-close-btn" aria-label="Close AI panel">x</button>
        </div>
        <div class="ai-chat-output" id="ai-chat-output">
            ${mode === 'doctor'
                ? 'Doctor assistant ready. Ask for differential support, focused follow-up questions, or care-plan drafting.'
                : 'Symptom assistant ready. Share symptoms and I can suggest next steps and what specialist to consult.'}
        </div>
        <div class="ai-input-area">
            <input type="text" id="ai-user-input" placeholder="${mode === 'doctor' ? 'Ask your assistant...' : 'Describe your symptoms...'}" autocomplete="off">
            <button type="button" id="ai-send-btn">Send</button>
        </div>
    `;
    document.body.appendChild(container);

    const closeBtn = container.querySelector('.ai-close-btn');
    const output = container.querySelector('#ai-chat-output');
    const input = container.querySelector('#ai-user-input');
    const sendBtn = container.querySelector('#ai-send-btn');

    const messageHistory = [{
        role: 'system',
        content: mode === 'doctor'
            ? 'You are a doctor-facing telemedicine assistant. Give concise differential support, focused follow-up questions, and actionable care-plan suggestions.'
            : 'You are a patient symptom triage assistant. Give safe, non-diagnostic advice, suggest next steps, and recommend a relevant specialist.'
    }];

    const appendMessage = (role, content) => {
        const item = document.createElement('div');
        item.className = `ai-msg ${role === 'user' ? 'ai-user-msg' : 'ai-bot-msg'}`;
        item.textContent = content;
        output.appendChild(item);
        output.scrollTop = output.scrollHeight;
    };

    const verifyRoleIfNeeded = async () => {
        if (aiMode !== 'patient' && aiMode !== 'doctor') {
            return true;
        }

        try {
            const res = await fetch('/api/user/details');
            if (!res.ok) return false;
            const user = await res.json();
            return user.role === aiMode;
        } catch (err) {
            return false;
        }
    };

    const openSidebar = async () => {
        const ok = await verifyRoleIfNeeded();
        if (!ok) {
            window.location.href = 'login.html';
            return;
        }
        container.classList.add('open');
        setTimeout(() => input.focus(), 150);
    };

    toggles.forEach((toggle) => {
        toggle.addEventListener('click', async (event) => {
            event.preventDefault();
            if (container.classList.contains('open')) {
                container.classList.remove('open');
            } else {
                await openSidebar();
            }
        });
    });

    closeBtn.addEventListener('click', () => {
        container.classList.remove('open');
    });

    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;

        appendMessage('user', text);
        messageHistory.push({ role: 'user', content: text });
        input.value = '';
        sendBtn.disabled = true;

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: messageHistory,
                    temperature: mode === 'doctor' ? 0.3 : 0.4
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'AI request failed');
            }

            const reply = data.reply || 'I could not generate a response.';
            appendMessage('assistant', reply);
            messageHistory.push({ role: 'assistant', content: reply });
        } catch (error) {
            appendMessage('assistant', `Connection error: ${error.message}`);
        } finally {
            sendBtn.disabled = false;
        }
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});

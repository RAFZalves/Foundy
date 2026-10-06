const itemForm = $('#itemForm');

itemForm?.addEventListener('submit', async e => {
    e.preventDefault();

    try {
        const me = await api('/api/me');

        if (!me.user) {
            location.href = '/pages/login.html';
            return;
        }

        const fd = new FormData(itemForm);
        const result = await api('/api/items', {
            method: 'POST',
            body: fd
        });

        toast(result.image_filename
            ? 'Registro criado com imagem!'
            : 'Registro criado!');

        setTimeout(() => {
            location.href = `/pages/item.html?id=${result.id}`;
        }, 650);
    } catch (err) {
        toast(err.message);
    }
});

const supportForm = $('#supportForm');

supportForm?.addEventListener('submit', async e => {
    e.preventDefault();

    try {
        await api('/api/support', {
            method: 'POST',
            body: JSON.stringify(
                Object.fromEntries(new FormData(supportForm))
            )
        });

        supportForm.reset();
        toast('Chamado enviado ao suporte!');
        if (typeof loadStudentTickets === 'function') {
            loadStudentTickets();
        }
    } catch (err) {
        toast(err.message);
    }
});

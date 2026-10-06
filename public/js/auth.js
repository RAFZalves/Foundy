const form = document.querySelector('form[data-action]');
const accountTypeInputs = document.querySelectorAll('input[name="accountType"]');
const studentFields = document.querySelector('#studentFields');
const teamFields = document.querySelector('#teamFields');

function updateRegistrationMode() {
    const type = document.querySelector('input[name="accountType"]:checked')?.value || 'student';
    const student = type === 'student';
    studentFields?.classList.toggle('hidden', !student);
    teamFields?.classList.toggle('hidden', student);
    studentFields?.querySelectorAll('input').forEach(i => i.required = student);
    teamFields?.querySelectorAll('input').forEach(i => i.required = !student);
}
accountTypeInputs.forEach(i => i.addEventListener('change', updateRegistrationMode));
updateRegistrationMode();

form?.addEventListener('submit', async e => {
    e.preventDefault();
    try {
        const data = Object.fromEntries(new FormData(form));
        await api(form.dataset.action, { method: 'POST', body: JSON.stringify(data) });
        location.href = '/';
    } catch (err) {
        toast(err.message);
    }
});

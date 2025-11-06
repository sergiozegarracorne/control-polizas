const overlay = document.getElementById('overlay');
const modalForm = document.getElementById('modalForm');
const modalTitle = document.getElementById('modalTitle');
const closeModalBtn = document.getElementById('closeModal');
const newPolicyBtn = document.getElementById('newPolicyBtn');
const newClientBtn = document.getElementById('newClientBtn');
const policyTableBody = document.getElementById('policyTableBody');
const emptyState = document.getElementById('emptyState');

const policyTemplate = document.getElementById('policyFormTemplate');
const clientTemplate = document.getElementById('clientFormTemplate');

function openModal(type, data = {}) {
  modalForm.innerHTML = '';
  let template;
  if (type === 'policy') {
    template = policyTemplate.content.cloneNode(true);
    modalTitle.textContent = data.id ? 'Editar póliza' : 'Nueva póliza';
    populatePolicyForm(template, data);
  } else {
    template = clientTemplate.content.cloneNode(true);
    modalTitle.textContent = data.id ? 'Editar cliente' : 'Nuevo cliente';
    populateClientForm(template, data);
  }
  modalForm.appendChild(template);
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
  modalForm.dataset.type = type;
  modalForm.dataset.id = data.id || '';
}

function closeModal() {
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
  modalForm.reset?.();
  modalForm.removeAttribute('data-type');
  modalForm.removeAttribute('data-id');
}

function populatePolicyForm(template, data) {
  const form = template.querySelector('div').parentElement;
  form.querySelector('[name="policy_number"]').value = data.policy_number || '';
  form.querySelector('[name="claim_number"]').value = data.claim_number || '';
  form.querySelector('[name="date"]').value = data.date ? data.date.slice(0, 10) : '';
  form.querySelector('[name="address"]').value = data.address || '';
  form.querySelector('[name="broker_letter_number"]').value = data.broker_letter_number || '';
  form.querySelector('[name="broker_letter_date"]').value = data.broker_letter_date ? data.broker_letter_date.slice(0, 10) : '';
  form.querySelector('[name="attended"]').checked = Boolean(data.attended);
}

function populateClientForm(template, data) {
  const form = template.querySelector('div').parentElement;
  form.querySelector('[name="policy_id"]').value = data.policy_id || '';
  form.querySelector('[name="name"]').value = data.name || '';
  form.querySelector('[name="claim_presented"]').checked = Boolean(data.claim_presented);
  form.querySelector('[name="letter_sent"]').checked = Boolean(data.letter_sent);
  form.querySelector('[name="client_letter_number"]').value = data.client_letter_number || '';
  form.querySelector('[name="client_letter_date"]').value = data.client_letter_date ? data.client_letter_date.slice(0, 10) : '';
  form.querySelector('[name="existing_technical_report_path"]').value = data.technical_report_path || '';
  form.querySelector('[name="existing_inspection_report_path"]').value = data.inspection_report_path || '';
  const technicalLink = form.querySelector('[data-role="technical-report-link"]');
  if (technicalLink) {
    if (data.technical_report_path) {
      technicalLink.innerHTML = `<a href="${data.technical_report_path}" target="_blank">Ver informe cargado</a>`;
      technicalLink.classList.remove('hidden');
    } else {
      technicalLink.textContent = '';
      technicalLink.classList.add('hidden');
    }
  }
  const inspectionLink = form.querySelector('[data-role="inspection-report-link"]');
  if (inspectionLink) {
    if (data.inspection_report_path) {
      inspectionLink.innerHTML = `<a href="${data.inspection_report_path}" target="_blank">Ver acta cargada</a>`;
      inspectionLink.classList.remove('hidden');
    } else {
      inspectionLink.textContent = '';
      inspectionLink.classList.add('hidden');
    }
  }
}

async function fetchPolicyClients() {
  const res = await fetch('/api/policy-clients');
  const data = await res.json();
  renderTable(data);
}

function renderTable(rows) {
  policyTableBody.innerHTML = '';
  if (!rows.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-blue-50/50 transition';
    tr.innerHTML = `
      ${createCell(row.policy_number, 'policy', row.policy_id)}
      ${createCell(row.claim_number || '—', 'policy', row.policy_id)}
      ${createCell(formatDate(row.date), 'policy', row.policy_id)}
      ${createCell(row.address || '—', 'policy', row.policy_id)}
      ${createCell(row.attended ? 'Sí' : 'No', 'policy', row.policy_id)}
      ${createCell(row.broker_letter_number || '—', 'policy', row.policy_id)}
      ${createCell(formatDate(row.broker_letter_date), 'policy', row.policy_id)}
      ${createCell(row.client_name || '—', row.client_id ? 'client' : 'policy', row.client_id || row.policy_id)}
      ${createCell(row.client_id ? (row.claim_presented ? 'Sí' : 'No') : '—', row.client_id ? 'client' : 'policy', row.client_id || row.policy_id)}
      ${createCell(row.client_id ? (row.letter_sent ? 'Sí' : 'No') : '—', row.client_id ? 'client' : 'policy', row.client_id || row.policy_id)}
      ${createCell(row.client_letter_number || '—', row.client_id ? 'client' : 'policy', row.client_id || row.policy_id)}
      ${createCell(formatDate(row.client_letter_date), row.client_id ? 'client' : 'policy', row.client_id || row.policy_id)}
      ${createLinkCell(row.technical_report_path, row.client_id ? 'client' : 'policy', row.client_id || row.policy_id)}
      ${createLinkCell(row.inspection_report_path, row.client_id ? 'client' : 'policy', row.client_id || row.policy_id)}
    `;
    policyTableBody.appendChild(tr);
  });
}

function createCell(content, type, id) {
  return `<td class="px-4 py-3 text-sm text-slate-700" data-type="${type}" data-id="${id || ''}">${content}</td>`;
}

function createLinkCell(path, type, id) {
  const attributes = `data-type="${type}" data-id="${id || ''}"`;
  if (!path) {
    return `<td class="px-4 py-3 text-sm text-slate-400" ${attributes}>—</td>`;
  }
  return `<td class="px-4 py-3 text-sm" ${attributes}><a href="${path}" target="_blank" class="text-blue-600 hover:underline">Ver PDF</a></td>`;
}

function formatDate(value) {
  if (!value) return '—';
  return value.slice(0, 10);
}

async function readFileAsDataURL(file) {
  if (!file) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

modalForm.addEventListener('click', (event) => {
  if (event.target.dataset.action === 'cancel') {
    closeModal();
  }
});

modalForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const type = modalForm.dataset.type;
  const id = modalForm.dataset.id;
  const formData = new FormData(modalForm);
  if (type === 'policy') {
    const payload = {
      policy_number: formData.get('policy_number'),
      claim_number: formData.get('claim_number') || null,
      date: formData.get('date') || null,
      address: formData.get('address') || null,
      broker_letter_number: formData.get('broker_letter_number') || null,
      broker_letter_date: formData.get('broker_letter_date') || null,
      attended: formData.get('attended') === 'on'
    };
    await savePolicy(id, payload);
  } else {
    const technicalFile = formData.get('technical_report_file');
    const inspectionFile = formData.get('inspection_report_file');
    const payload = {
      policy_id: Number(formData.get('policy_id')),
      name: formData.get('name'),
      claim_presented: formData.get('claim_presented') === 'on',
      letter_sent: formData.get('letter_sent') === 'on',
      client_letter_number: formData.get('client_letter_number') || null,
      client_letter_date: formData.get('client_letter_date') || null,
      existing_technical_report_path: formData.get('existing_technical_report_path') || null,
      existing_inspection_report_path: formData.get('existing_inspection_report_path') || null,
      technical_report_file: technicalFile && technicalFile.size ? null : null,
      inspection_report_file: inspectionFile && inspectionFile.size ? null : null
    };
    if (technicalFile && technicalFile.size) {
      payload.technical_report_file = {
        name: technicalFile.name,
        data: await readFileAsDataURL(technicalFile)
      };
    }
    if (inspectionFile && inspectionFile.size) {
      payload.inspection_report_file = {
        name: inspectionFile.name,
        data: await readFileAsDataURL(inspectionFile)
      };
    }
    await saveClient(id, payload);
  }
  closeModal();
  await fetchPolicyClients();
});

closeModalBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', (event) => {
  if (event.target === overlay) {
    closeModal();
  }
});

newPolicyBtn.addEventListener('click', () => openModal('policy'));
newClientBtn.addEventListener('click', () => openModal('client'));

policyTableBody.addEventListener('click', async (event) => {
  const cell = event.target.closest('td');
  if (!cell) return;
  const type = cell.dataset.type;
  const id = cell.dataset.id;
  if (!type) return;
  if (type === 'policy' && id) {
    const policy = await fetchPolicy(id);
    if (policy && policy.id) {
      openModal('policy', policy);
    }
  } else if (type === 'client' && id) {
    const client = await fetchClient(id);
    if (client && client.id) {
      openModal('client', client);
    }
  }
});

async function fetchPolicy(id) {
  const res = await fetch(`/api/policies/${id}`);
  return res.json();
}

async function fetchClient(id) {
  const res = await fetch(`/api/clients/${id}`);
  return res.json();
}

async function savePolicy(id, payload) {
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/policies/${id}` : '/api/policies';
  await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function saveClient(id, payload) {
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/clients/${id}` : '/api/clients';
  await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

fetchPolicyClients();

const statusEl = document.getElementById('status');
const qrEl = document.getElementById('qr');
const messageEl = document.getElementById('message');

const update = (payload) => {
  if (statusEl && payload.status) statusEl.textContent = payload.status;
  if (qrEl && payload.qrDataUrl) {
    qrEl.src = payload.qrDataUrl;
  }
  if (messageEl) {
    messageEl.textContent = payload.message || '';
  }
};

if (window.tapbridge && window.tapbridge.onStatus) {
  window.tapbridge.onStatus(update);
}

import { supabase } from '../lib/supabaseClient';

export const downloadCSV = (rows, filename) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    window.alert('Walang data para i-export.');
    return;
  }

  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = typeof value === 'string' ? value : String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
  ].join('\n');

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  link.download = `${filename}-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const notifyUser = async (userId, title, body, type = 'admin_update') => {
  if (!userId) return { error: new Error('Missing user_id') };
  return supabase.from('notifications').insert({
    user_id: userId,
    title,
    body,
    type,
    is_read: false,
  });
};

export const useSimpleToast = () => {
  // Lightweight toast helper. The component side keeps the toast state and
  // renders the markup; this hook just returns the show/clear helpers.
  const [toast, setToast] = [null, () => {}];
  return { toast, setToast };
};

export const showWindowToast = (message) => {
  // Extremely minimal fallback so placeholder alerts don't block the thread.
  try {
    const el = document.createElement('div');
    el.textContent = message;
    el.style.cssText =
      'position:fixed;right:24px;bottom:24px;z-index:9999;padding:12px 18px;border-radius:10px;background:#0f172a;color:#fff;font-weight:600;box-shadow:0 10px 24px rgba(2,6,23,0.25);font-family:Inter,sans-serif;font-size:14px;';
    document.body.appendChild(el);
    window.setTimeout(() => {
      el.style.transition = 'opacity 0.3s ease';
      el.style.opacity = '0';
      window.setTimeout(() => el.remove(), 300);
    }, 2500);
  } catch (error) {
    window.alert(message);
  }
};

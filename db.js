import { client } from './supabaseClient.js';
import { EMPLOYEE_PAY_RATE, CLIENT_CHARGE_RATE } from './config.js';
import { timeToHours } from './utils.js';

// ---- reads ----------------------------------------------------------------

export async function fetchAll() {
  const [employees, clients, jobs, settingsRows, payments] = await Promise.all([
    client.from('employees').select('*').order('name'),
    client.from('clients').select('*').order('name'),
    client.from('jobs').select('*').order('date', { ascending: false }),
    client.from('business_settings').select('*').eq('id', 1).maybeSingle(),
    client.from('payments').select('*'),
  ]);
  for (const r of [employees, clients, jobs, payments]) {
    if (r.error) throw r.error;
  }
  if (settingsRows.error) throw settingsRows.error;

  return {
    employees: employees.data || [],
    clients: clients.data || [],
    jobs: jobs.data || [],
    settings: settingsRows.data || {},
    payments: payments.data || [],
  };
}

// ---- money rules ------------------------------------------------------------
// Flat business model: every employee is paid £14/hr, every homeowner is
// billed £16/hr. Green waste is the one variable add-on (+£10 client / +£8
// employee), read from business_settings since that's already DB-editable.

export function computeJobMoney(job, employee, settings) {
  const h = jobHours(job);
  const gwPay = Number(settings.green_waste_pay ?? 8);
  const gwCharge = Number(settings.green_waste_charge ?? 10);
  const pay = job.pay_amount != null ? Number(job.pay_amount) : h * EMPLOYEE_PAY_RATE + (job.green_waste ? gwPay : 0);
  const billed = job.client_charge != null ? Number(job.client_charge) : h * CLIENT_CHARGE_RATE + (job.green_waste ? gwCharge : 0);
  return { hours: h, pay, billed };
}

export function jobHours(job) {
  return timeToHours(job.start_time, job.end_time);
}

// ---- mutations --------------------------------------------------------------

export async function markJobDone(job, employee, settings) {
  // 'completed' is the employee app's own vocabulary for "finished" — the
  // dashboard's "done, to pay" vs "paid" distinction comes from payment_id,
  // not from a separate status value, so this never touches anything the
  // employee app doesn't already expect.
  const { hours: h, pay, billed } = computeJobMoney(job, employee, settings);
  const { error } = await client
    .from('jobs')
    .update({ status: 'completed', pay_amount: pay, client_charge: billed })
    .eq('id', job.id);
  if (error) throw error;
}

export async function setReview(jobId, review_status) {
  const { error } = await client.from('jobs').update({ review_status }).eq('id', jobId);
  if (error) throw error;
}

export async function confirmAll(jobIds) {
  if (!jobIds.length) return;
  const { error } = await client.from('jobs').update({ review_status: 'confirmed' }).in('id', jobIds);
  if (error) throw error;
}

export async function nudgeHandover(clientId) {
  const { error } = await client.from('clients').update({ last_nudged_at: new Date().toISOString() }).eq('id', clientId);
  if (error) throw error;
}

// Sends a payment run: flips every job across all the given rows to paid.
// NOTE: there is no live bank/Starling integration here and no bookkeeping
// row is written either — this is deliberately just the "settle these jobs"
// step; moving the actual money is still a manual step outside this app.
// Only `jobs.paid` changes here — jobs.status stays 'completed' (the
// employee app's value), so the employee app's own reads/writes are never
// touched by a payment run.
export async function sendPaymentRun(rows) {
  const jobIds = rows.flatMap((row) => row.jobIds);
  if (!jobIds.length) return;
  const { error } = await client.from('jobs').update({ paid: true }).in('id', jobIds);
  if (error) throw error;
}

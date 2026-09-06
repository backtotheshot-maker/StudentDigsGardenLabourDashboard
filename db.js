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

// Sends a payment run: one `payments` row per student covering their confirmed,
// unpaid jobs, then flips those jobs to paid and links them to the new payment row.
// NOTE: there is no live bank/Starling integration here — this records that the
// run happened and settles the jobs; moving the actual money is still a manual
// step (or a future integration) outside this app.
export async function sendPaymentRun(rows, reference) {
  const today = new Date().toISOString().slice(0, 10);
  const results = [];
  for (const row of rows) {
    const { data: payment, error: payErr } = await client
      .from('payments')
      .insert({
        employee_id: row.employeeId,
        week_start_date: today,
        week_end_date: today,
        amount_due: row.pay,
        status: 'paid',
        paid_at: new Date().toISOString(),
        top_up: row.topUp || 0,
        reference,
      })
      .select()
      .single();
    if (payErr) throw payErr;
    // Only payment_id changes here — jobs.status stays 'completed' (the
    // employee app's value). Setting payment_id is what makes the dashboard
    // treat the job as "paid" from here on.
    const { error: jobsErr } = await client
      .from('jobs')
      .update({ payment_id: payment.id })
      .in('id', row.jobIds);
    if (jobsErr) throw jobsErr;
    results.push(payment);
  }
  return results;
}
